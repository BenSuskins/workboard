import { TimeAgo } from "@/components/time-ago";
import { cookies } from "next/headers";
import Link from "next/link";
import {
  getActivityCounts,
  getProjectDetail,
  getSyncHealth,
  getWorkspaceActivityCounts,
  integrationStatus,
  latestReport,
  listOpenQuestions,
  listProjects,
  type ProjectDetail,
  type ProjectHealth,
  type ProjectStatus,
} from "@workboard/core";
import { AlertRow } from "@/components/alert-row";
import { BoardKeynav } from "@/components/board-keynav";
import { Composer } from "@/components/composer";
import { RefreshButton } from "@/components/refresh-button";
import { refreshAllAction } from "@/lib/actions";
import { FilterBar, type Filters } from "@/components/filter-bar";
import { Markdown } from "@/components/markdown";
import { Mermaid } from "@/components/mermaid";
import { ProjectCard } from "@/components/project-card";
import { ProjectRow } from "@/components/project-row";
import { PulseCard } from "@/components/pulse-card";
import { StatStrip } from "@/components/stat-strip";
import { SyncBanner } from "@/components/sync-banner";
import { ViewToggle } from "@/components/view-toggle";
import { db } from "@/lib/db";
import { prPipeline } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

const STALE_MS = 7 * 24 * 60 * 60 * 1000;

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 } as const;
const HEALTH_RANK = { red: 0, amber: 1, green: 2 } as const;

/** Pinned projects lead the board whichever sort is active; the chosen sort orders within each group. */
function pinnedFirst(sorter: (a: ProjectDetail, b: ProjectDetail) => number) {
  return (a: ProjectDetail, b: ProjectDetail) => b.project.pinned - a.project.pinned || sorter(a, b);
}

const SORTERS: Record<string, (a: ProjectDetail, b: ProjectDetail) => number> = {
  activity: (a, b) => b.project.lastActivityAt - a.project.lastActivityAt,
  priority: (a, b) =>
    PRIORITY_RANK[a.project.priority] - PRIORITY_RANK[b.project.priority] ||
    b.project.lastActivityAt - a.project.lastActivityAt,
  health: (a, b) =>
    HEALTH_RANK[a.project.health] - HEALTH_RANK[b.project.health] || b.project.lastActivityAt - a.project.lastActivityAt,
  stale: (a, b) => a.project.lastActivityAt - b.project.lastActivityAt,
  name: (a, b) => a.project.name.localeCompare(b.project.name),
};

/** Explicit ?view= wins; otherwise the wb-board-view cookie; otherwise cards. */
async function resolveView(filters: Filters): Promise<"cards" | "list"> {
  if (filters.view === "list" || filters.view === "cards") return filters.view;
  const cookieStore = await cookies();
  return cookieStore.get("wb-board-view")?.value === "list" ? "list" : "cards";
}

function CollapsedReport({ title, at, children, footer }: {
  title: string;
  at: number;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <details className="group rounded-card border border-hairline bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-2.5 text-body [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-1.5 font-medium text-ink">
          <span aria-hidden className="text-muted transition-transform group-open:rotate-90">
            ›
          </span>
          {title}
        </span>
        <span className="flex items-center gap-1.5 text-meta font-normal text-muted">
          {<TimeAgo at={at} />}
          {footer}
        </span>
      </summary>
      <div className="border-t border-hairline px-3.5 py-3">{children}</div>
    </details>
  );
}

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; status?: string; health?: string; sort?: string; view?: string }>;
}) {
  const filters: Filters = await searchParams;
  const view = await resolveView(filters);
  const database = db();

  const all = listProjects(database, {});
  const details = all
    // Enough posts to name everyone who has touched a project lately for the card's avatars.
    .map((p) => getProjectDetail(database, p.id, { postsLimit: 20 }))
    .filter((d): d is ProjectDetail => d !== undefined);

  const sorter = SORTERS[filters.sort ?? "activity"] ?? SORTERS.activity;
  const filtered = details
    .filter(({ project }) => {
      if (filters.category && project.category !== filters.category) return false;
      if (filters.status && project.status !== (filters.status as ProjectStatus)) return false;
      if (filters.health && project.health !== (filters.health as ProjectHealth)) return false;
      return true;
    })
    .sort(pinnedFirst(sorter));

  const categories = [...new Set(all.map((p) => p.category))].sort();
  const active = all.filter((p) => p.status === "active").length;
  const blocked = all.filter((p) => p.status === "blocked").length;
  const stale = all.filter((p) => p.status === "active" && Date.now() - p.lastActivityAt > STALE_MS).length;
  let ciFailing = 0;
  for (const d of details) ciFailing += prPipeline(d.links).ciFailing;
  const openWarnings = details.reduce((n, d) => n + d.openWarnings.length, 0);
  const openQuestions = listOpenQuestions(database).length;
  const allTasks = details.flatMap((d) => d.tasks);
  const movingTasks = allTasks.filter((t) => t.status === "in_progress").length;
  const upForGrabs = allTasks.filter((t) => t.agentReady && t.status === "todo" && !t.claimedAt).length;
  const doneTasks = allTasks.filter((t) => t.status === "done").length;
  const pulseCounts = getWorkspaceActivityCounts(database, 30);

  const digest = latestReport(database, "digest");
  const triage = latestReport(database, "triage");
  const integrations = integrationStatus();
  const anyConfigured = integrations.github || integrations.jira || integrations.google;
  const lastSyncAt = getSyncHealth(database).lastSuccessAt;

  return (
    <div className="flex flex-col gap-6">
      <SyncBanner />
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-heading font-semibold tracking-tight text-ink">Board</h1>
        <div className="flex items-center gap-2.5">
          {lastSyncAt && <span className="text-meta text-muted">data synced {<TimeAgo at={lastSyncAt} />}</span>}
          {anyConfigured ? (
            <RefreshButton action={refreshAllAction} label="Refresh data" />
          ) : (
            <span className="text-meta text-muted" title="Set GITHUB_TOKEN / JIRA_* / GOOGLE_* in .env to enable live data">
              no integrations configured
            </span>
          )}
          <ViewToggle filters={filters} view={view} />
        </div>
      </div>

      <StatStrip
        filters={filters}
        stats={{ projects: all.length, moving: movingTasks, upForGrabs, questions: openQuestions, done: doneTasks }}
      />

      <AlertRow filters={filters} alerts={{ blocked, warnings: openWarnings, stale, ciFailing }} />

      <PulseCard pulse={{ counts: pulseCounts, blocked, moving: active }} />

      {(digest || triage) && (
        <div className="grid gap-2 lg:grid-cols-2">
          {digest && (
            <CollapsedReport
              title="Latest digest"
              at={digest.createdAt}
              footer={
                <>
                  ·{" "}
                  <Link href="/reports" className="text-accent hover:underline">
                    all reports
                  </Link>
                </>
              }
            >
              <Markdown>{digest.body}</Markdown>
            </CollapsedReport>
          )}
          {triage && (
            <CollapsedReport title="Triage" at={triage.createdAt}>
              <Markdown>{triage.body}</Markdown>
            </CollapsedReport>
          )}
        </div>
      )}

      <FilterBar filters={filters} categories={categories} />

      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-title font-semibold text-ink">Projects</h2>
        <span className="text-meta tabular-nums text-muted">{filtered.length}</span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-card border border-dashed border-grid px-6 py-16 text-center text-body text-muted">
          No projects match.{" "}
          <Link href="/projects/new" className="text-accent hover:underline">
            Create one
          </Link>{" "}
          or connect a coding agent to the MCP server.
        </div>
      ) : view === "list" ? (
        <div className="overflow-hidden rounded-card border border-hairline bg-surface">
          <BoardKeynav>
            {filtered.map((d) => (
              <ProjectRow key={d.project.id} detail={d} />
            ))}
          </BoardKeynav>
        </div>
      ) : (
        <BoardKeynav grid>
          {filtered.map((d, i) => (
            <ProjectCard
              key={d.project.id}
              detail={d}
              index={i + 1}
              activityCounts={getActivityCounts(database, d.project.id)}
            />
          ))}
        </BoardKeynav>
      )}

      <Composer projects={all.map((p) => ({ id: p.id, slug: p.slug, name: p.name }))} />
    </div>
  );
}
