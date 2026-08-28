import { cookies } from "next/headers";
import Link from "next/link";
import {
  getActivityCounts,
  getProjectDetail,
  getWorkspaceActivityCounts,
  integrationStatus,
  listOpenQuestions,
  listProjects,
  type ProjectDetail,
  type ProjectHealth,
  type ProjectStatus,
} from "@workboard/core";
import { BoardTopBar } from "@/components/board-top-bar";
import { Digest } from "@/components/digest";
import { RefreshButton } from "@/components/refresh-button";
import { refreshAllAction } from "@/lib/actions";
import { FilterBar } from "@/components/filter-bar";
import { FilterMemory } from "@/components/filter-memory";
import { ProjectCard } from "@/components/project-card";
import { BoardStatStrip } from "@/components/stat-strip";
import { SyncBanner } from "@/components/sync-banner";
import { projectWantingAttention } from "@/lib/digest";
import {
  FILTERS_COOKIE,
  resolveFilters,
  serializeFilters,
  type BoardParams,
} from "@/lib/board-filters";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

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

export default async function Dashboard({ searchParams }: { searchParams: Promise<BoardParams> }) {
  const cookieStore = await cookies();
  // The URL describes the filters whenever it mentions any; otherwise the last set is restored.
  const filters = resolveFilters(await searchParams, cookieStore.get(FILTERS_COOKIE)?.value);
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
      return true;
    })
    .sort(pinnedFirst(sorter));

  const categories = [...new Set(all.map((p) => p.category))].sort();
  const allTasks = details.flatMap((d) => d.tasks);
  const movingTasks = allTasks.filter((t) => t.status === "in_progress").length;
  const blockedTasks = allTasks.filter((t) => t.status === "blocked").length;
  const upForGrabs = allTasks.filter((t) => t.agentReady && t.status === "todo" && !t.claimedAt).length;
  const doneTasks = allTasks.filter((t) => t.status === "done").length;
  const questions = listOpenQuestions(database).length;
  const stats = {
    projects: all.length,
    moving: movingTasks,
    upForGrabs,
    blocked: blockedTasks,
    questions,
    done: doneTasks,
  };

  // The digest names its own unit, so it needs one number the strip does not:
  // how many projects those moving tasks are spread across.
  const movingProjects = details.filter((d) => d.tasks.some((t) => t.status === "in_progress")).length;
  const attention = projectWantingAttention(
    details.map(({ project, openWarnings }) => ({
      name: project.name,
      status: project.status,
      warnings: openWarnings.length,
      lastActivityAt: project.lastActivityAt,
    })),
  );
  // The chart is gone, but the state word still has to know whether the week was quiet.
  const week = getWorkspaceActivityCounts(database, 7).reduce((total, day) => total + day, 0);

  const integrations = integrationStatus();
  const anyConfigured = integrations.github || integrations.jira || integrations.google;

  return (
    <div className="flex min-h-screen flex-col">
      <FilterMemory serialized={serializeFilters(filters)} />
      <BoardTopBar
        shown={filtered.length}
        total={all.length}
        refresh={anyConfigured ? <RefreshButton action={refreshAllAction} label="Refresh" /> : null}
      />
      <div className="px-8 pb-10 pt-7">
        <SyncBanner />
        <div className="flex flex-col gap-[26px]">
          <Digest counts={{ ...stats, movingProjects, attention }} week={week} />

          <BoardStatStrip filters={filters} stats={stats} />

          <div className="flex flex-col gap-3">
            <FilterBar filters={filters} categories={categories} />

            {filtered.length === 0 ? (
              <div className="rounded-card border border-dashed border-grid px-6 py-16 text-center text-body text-muted">
                No projects match.{" "}
                <Link href="/projects/new" className="text-accent hover:underline">
                  Create one
                </Link>{" "}
                or connect a coding agent to the MCP server.
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(296px,1fr))] items-start gap-4">
                {filtered.map((d) => (
                  <ProjectCard
                    key={d.project.id}
                    detail={d}
                    activityCounts={getActivityCounts(database, d.project.id, 30)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
