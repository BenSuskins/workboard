import { notFound } from "next/navigation";
import {
  listProjects,
  listQueuedTasks,
  listReports,
  listTasks,
  listWarnings,
  type Store,
  type Summary,
  type TaskRow,
  type WarningSeverity,
} from "@workboard/core";
import { AccomplishmentsReport } from "@/components/reports/accomplishments-report";
import { DigestReport } from "@/components/reports/digest-report";
import { TriageReport, type SeverityGroup } from "@/components/reports/triage-report";
import { Mermaid } from "@/components/mermaid";
import { PageTopBar } from "@/components/page-top-bar";
import { ReportShell, RunRail } from "@/components/report-shell";
import type { StatCell } from "@/components/stat-strip";
import { db } from "@/lib/db";
import { groupByWeek, runDateParts } from "@/lib/reports";

export const dynamic = "force-dynamic";

type ReportKind = "digest" | "triage" | "accomplishments";

/** Each kind is its own page now, so each gets its own framing rather than a shared tab row. */
const KINDS: Record<ReportKind, { title: string; skill: string }> = {
  digest: { title: "Digests", skill: "workboard-digest" },
  triage: { title: "Triage", skill: "workboard-triage" },
  accomplishments: { title: "Accomplishments", skill: "workboard-accomplishments" },
};

const GAP: Record<ReportKind, string> = {
  digest: "gap-[26px]",
  triage: "gap-[22px]",
  accomplishments: "gap-6",
};

const isReportKind = (value: string): value is ReportKind => value in KINDS;

/** Accomplishments looks back this far before a done task drops off the page. */
const EIGHT_WEEKS_MS = 8 * 7 * 24 * 60 * 60 * 1000;
const SEVERITY_ORDER: WarningSeverity[] = ["critical", "warning", "info"];

export async function generateMetadata({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  return { title: isReportKind(kind) ? `${KINDS[kind].title} · Workboard` : "Workboard" };
}

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string }>;
  searchParams: Promise<{ run?: string }>;
}) {
  const { kind } = await params;
  if (!isReportKind(kind)) notFound();
  const meta = KINDS[kind];
  const database = db();
  const reports = listReports(database, kind);

  const { run: runParam } = await searchParams;
  const requestedId = runParam ? Number(runParam) : undefined;
  const explicit = reports.find((report) => report.id === requestedId);

  // Digest has no live fallback — its body is always a saved run's write-up,
  // so with none saved yet there is nothing to show but the skill hint.
  if (kind === "digest" && reports.length === 0) {
    return (
      <div className="flex h-screen flex-col">
        <PageTopBar name={meta.title} count="No runs yet" />
        <div className="flex-1 px-8 pt-7">
          <p className="text-body text-muted">
            None yet. Run the <code>{meta.skill}</code> skill from a coding agent to write one.
          </p>
        </div>
      </div>
    );
  }

  // Triage and Accomplishments fall back to the live store, so "selected" only
  // means something once a saved run is explicitly asked for.
  const selected = kind === "digest" ? (explicit ?? reports[0]) : explicit;

  return (
    <div className="flex h-screen flex-col">
      <Mermaid />
      <PageTopBar name={meta.title} count={countFor(kind, database, reports)} />
      <ReportShell
        gap={GAP[kind]}
        rail={<RunRail runs={reports} currentId={selected?.id ?? -1} basePath={`/reports/${kind}`} />}
      >
        {kind === "digest" && (
          <DigestReport run={selected as Summary} others={reports.filter((report) => report.id !== selected!.id)} />
        )}
        {kind === "triage" && (
          <TriageReport cells={triageCells(database)} run={selected} groups={selected ? [] : severityGroups(database)} />
        )}
        {kind === "accomplishments" && (
          <AccomplishmentsReport run={selected} rows={selected ? [] : recentDoneTasks(database)} />
        )}
      </ReportShell>
    </div>
  );
}

function countFor(kind: ReportKind, database: Store, reports: Summary[]): string {
  if (kind === "digest") {
    return `${reports.length} run${reports.length === 1 ? "" : "s"} · latest ${latestLabel(reports[0].createdAt)}`;
  }
  if (kind === "triage") {
    const warnings = listWarnings(database, {});
    const critical = warnings.filter((warning) => warning.severity === "critical").length;
    return `${warnings.length} open · ${critical} critical`;
  }
  const done = recentDoneTasks(database);
  const weeks = groupByWeek(done, (row) => row.task.updatedAt).length;
  return `${done.length} shipped in ${weeks} week${weeks === 1 ? "" : "s"}`;
}

/** "today", "yesterday", or a plain date — the digest count names its latest run this way. */
function latestLabel(ms: number): string {
  const startOfDay = (at: number) => {
    const date = new Date(at);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  };
  const diffDays = Math.round((startOfDay(Date.now()) - startOfDay(ms)) / 86_400_000);
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  return runDateParts(ms).date;
}

function triageCells(database: Store): StatCell[] {
  const warnings = listWarnings(database, {});
  const bySeverity = (severity: WarningSeverity) => warnings.filter((warning) => warning.severity === severity).length;
  return [
    { label: "Critical", value: bySeverity("critical"), dot: "bg-critical" },
    { label: "Warning", value: bySeverity("warning"), dot: "bg-warning" },
    { label: "Info", value: bySeverity("info"), dot: "bg-accent" },
    { label: "Unclaimed up for grabs", value: listQueuedTasks(database).length, dot: "bg-accent" },
  ];
}

function severityGroups(database: Store): SeverityGroup[] {
  const projects = new Map(listProjects(database, {}).map((project) => [project.id, { slug: project.slug, name: project.name }]));
  const warnings = listWarnings(database, {});
  return SEVERITY_ORDER.flatMap((severity) => {
    const rows = warnings
      .filter((warning) => warning.severity === severity)
      .flatMap((warning) => {
        const project = projects.get(warning.projectId);
        return project ? [{ warning, project }] : [];
      });
    return rows.length > 0 ? [{ severity, rows }] : [];
  });
}

function recentDoneTasks(database: Store): TaskRow[] {
  const cutoff = Date.now() - EIGHT_WEEKS_MS;
  return listTasks(database, { lane: "done" }).filter((row) => row.task.updatedAt >= cutoff);
}
