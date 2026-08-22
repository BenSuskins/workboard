import { TimeAgo } from "@/components/time-ago";
import Link from "next/link";
import {
  getActivityCounts,
  getProjectDetail,
  getSyncHealth,
  integrationStatus,
  latestReport,
  listProjects,
  type ProjectDetail,
  type ProjectHealth,
  type ProjectStatus,
} from "@workboard/core";
import { RefreshButton } from "@/components/refresh-button";
import { refreshAllAction } from "@/lib/actions";
import { FilterBar, type Filters } from "@/components/filter-bar";
import { Markdown } from "@/components/markdown";
import { ProjectCard } from "@/components/project-card";
import { StatTile } from "@/components/stat-tile";
import { SyncBanner } from "@/components/sync-banner";
import { db } from "@/lib/db";
import { prPipeline } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

const STALE_MS = 7 * 24 * 60 * 60 * 1000;

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 } as const;
const HEALTH_RANK = { red: 0, amber: 1, green: 2 } as const;

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

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; status?: string; health?: string; sort?: string }>;
}) {
  const filters: Filters = await searchParams;
  const database = db();

  const all = listProjects(database, {});
  const details = all
    .map((p) => getProjectDetail(database, p.id, { updatesLimit: 1 }))
    .filter((d): d is ProjectDetail => d !== undefined);

  const filtered = details
    .filter(({ project }) => {
      if (filters.category && project.category !== filters.category) return false;
      // Explicit status filter wins; otherwise the board is a noise floor —
      // finished (done) and archived projects live in /archive.
      if (filters.status) {
        if (project.status !== (filters.status as ProjectStatus)) return false;
      } else if (project.status === "done" || project.status === "archived") {
        return false;
      }
      if (filters.health && project.health !== (filters.health as ProjectHealth)) return false;
      return true;
    })
    .sort((a, b) => Number(b.project.pinned) - Number(a.project.pinned) || (SORTERS[filters.sort ?? "activity"] ?? SORTERS.activity)(a, b));

  const pinned = filtered.filter(({ project }) => project.pinned);
  const rest = filtered.filter(({ project }) => !project.pinned);

  const categories = [...new Set(all.map((p) => p.category))].sort();
  const active = all.filter((p) => p.status === "active").length;
  const blocked = all.filter((p) => p.status === "blocked").length;
  const stale = all.filter((p) => p.status === "active" && Date.now() - p.lastActivityAt > STALE_MS).length;
  let openPrs = 0;
  let ciFailing = 0;
  for (const d of details) {
    const pipe = prPipeline(d.links);
    openPrs += pipe.draft + pipe.inReview + pipe.approved;
    ciFailing += pipe.ciFailing;
  }
  const openWarnings = details.reduce((n, d) => n + d.openWarnings.length, 0);

  const digest = latestReport(database, "digest");
  const triage = latestReport(database, "triage");
  const integrations = integrationStatus();
  const anyConfigured = integrations.github || integrations.jira || integrations.google;
  const lastSyncAt = getSyncHealth(database).lastSuccessAt;

  return (
    <div className="flex flex-col gap-6">
      <SyncBanner />
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold tracking-tight text-ink">Board</h1>
        <div className="flex items-center gap-2.5">
          <Link href="/archive" className="text-xs text-muted transition-colors hover:text-accent">
            Archive
          </Link>
          {lastSyncAt && <span className="text-[11px] text-muted">data synced {<TimeAgo at={lastSyncAt} />}</span>}
          {anyConfigured ? (
            <RefreshButton action={refreshAllAction} label="Refresh data" />
          ) : (
            <span className="text-[11px] text-muted" title="Set GITHUB_TOKEN / JIRA_* / GOOGLE_* in .env to enable live data">
              no integrations configured
            </span>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Active projects" value={active} />
        <StatTile label="Blocked" value={blocked} tone={blocked > 0 ? "critical" : "default"} />
        <StatTile label="Warnings" value={openWarnings} tone={openWarnings > 0 ? "warning" : "default"} />
        <StatTile label="Stale (7d+ quiet)" value={stale} tone={stale > 0 ? "warning" : "default"} />
        <StatTile label="Open PRs" value={openPrs} />
        <StatTile label="CI failing" value={ciFailing} tone={ciFailing > 0 ? "critical" : "default"} />
      </div>

      {(digest || triage) && (
        <div className="grid gap-3 lg:grid-cols-2">
          {digest && (
            <section className="rounded-[10px] border border-hairline bg-surface p-4">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-ink">Latest digest</h2>
                <span className="text-[11px] text-muted">
                  {<TimeAgo at={digest.createdAt} />} ·{" "}
                  <Link href="/reports" className="text-accent hover:underline">
                    all reports
                  </Link>
                </span>
              </div>
              <div className="line-clamp-[8]">
                <Markdown>{digest.body}</Markdown>
              </div>
            </section>
          )}
          {triage && (
            <section className="rounded-[10px] border border-hairline bg-surface p-4">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-ink">Triage</h2>
                <span className="text-[11px] text-muted">{<TimeAgo at={triage.createdAt} />}</span>
              </div>
              <div className="line-clamp-[8]">
                <Markdown>{triage.body}</Markdown>
              </div>
            </section>
          )}
        </div>
      )}

      <FilterBar filters={filters} categories={categories} />

      {pinned.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-[11px] uppercase tracking-wide text-muted">Pinned</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pinned.map((d) => (
              <ProjectCard key={d.project.id} detail={d} activityCounts={getActivityCounts(database, d.project.id)} />
            ))}
          </div>
        </section>
      )}
      {rest.length === 0 && pinned.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-grid px-6 py-16 text-center text-sm text-muted">
          No projects match.{" "}
          <Link href="/projects/new" className="text-accent hover:underline">
            Create one
          </Link>{" "}
          or connect a coding agent to the MCP server.
        </div>
      ) : (
        rest.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((d) => (
              <ProjectCard key={d.project.id} detail={d} activityCounts={getActivityCounts(database, d.project.id)} />
            ))}
          </div>
        )
      )}
    </div>
  );
}
