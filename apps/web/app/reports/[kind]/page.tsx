import { notFound } from "next/navigation";
import { listReports } from "@workboard/core";
import { Markdown } from "@/components/markdown";
import { Mermaid } from "@/components/mermaid";
import { SectionHeading } from "@/components/section";
import { db } from "@/lib/db";
import { authorLabel, fullDate } from "@/lib/format";

export const dynamic = "force-dynamic";

type ReportKind = "digest" | "triage" | "accomplishments";

/** Each kind is its own page now, so each gets its own framing rather than a shared tab row. */
const KINDS: Record<ReportKind, { title: string; blurb: string; skill: string; tone: string }> = {
  digest: {
    title: "Digests",
    blurb: "Where everything stands, across every project.",
    skill: "workboard-digest",
    tone: "border-accent/40 bg-accent/10 text-accent",
  },
  triage: {
    title: "Triage",
    blurb: "What needs attention — stale work, blockers, and risks.",
    skill: "workboard-triage",
    tone: "border-warning/40 bg-warning/10 text-warning",
  },
  accomplishments: {
    title: "Accomplishments",
    blurb: "What shipped, yours and your agents'.",
    skill: "workboard-accomplishments",
    tone: "border-good/40 bg-good/10 text-good",
  },
};

const isReportKind = (value: string): value is ReportKind => value in KINDS;

export async function generateMetadata({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  return { title: isReportKind(kind) ? `${KINDS[kind].title} · Workboard` : "Workboard" };
}

export default async function ReportsPage({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!isReportKind(kind)) notFound();
  const meta = KINDS[kind];
  const reports = listReports(db(), kind);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-7">
      <Mermaid />

      <div className="flex flex-col gap-1">
        <h1 className="text-heading font-semibold tracking-tight text-ink">{meta.title}</h1>
        <p className="text-meta text-muted">{meta.blurb}</p>
      </div>

      {reports.length === 0 ? (
        <div className="rounded-card border border-dashed border-grid px-6 py-16 text-center text-body text-muted">
          None yet. Run the <code>{meta.skill}</code> skill from a coding agent to write one.
        </div>
      ) : (
        <>
          <SectionHeading title="Latest first" count={reports.length} />
          {reports.map((report) => (
            <article key={report.id} className="rounded-card border border-hairline bg-surface p-5">
              <div className="mb-3 flex items-center gap-2 text-meta text-muted">
                <span className={`rounded-pill border px-2 py-0.5 font-medium ${meta.tone}`}>{report.kind}</span>
                <span>{authorLabel(report.generatedBy)}</span>
                <span>· {fullDate(report.createdAt)}</span>
              </div>
              <Markdown>{report.body}</Markdown>
            </article>
          ))}
        </>
      )}
    </div>
  );
}
