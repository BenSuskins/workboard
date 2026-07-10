import Link from "next/link";
import {
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
import { relativeTime } from "@/lib/format";
import { prPipeline } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

const STALE_MS = 7 * 24 * 60 * 60 * 1000;

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; status?: string; health?: string }>;
}) {
  const filters: Filters = await searchParams;
  const database = db();

  const all = listProjects(database, {});
  const details = all
    .map((p) => getProjectDetail(database, p.id, { updatesLimit: 1 }))
    .filter((d): d is ProjectDetail => d !== undefined);

  const filtered = details.filter(({ project }) => {
    if (filters.category && project.category !== filters.category) return false;
    if (filters.status && project.status !== (filters.status as ProjectStatus)) return false;
    if (filters.health && project.health !== (filters.health as ProjectHealth)) return false;
    return true;
  });

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
          {lastSyncAt && <span className="text-[11px] text-muted">data synced {relativeTime(lastSyncAt)}</span>}
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
            <section className="rounded-xl border border-hairline bg-surface p-4">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-ink">Latest digest</h2>
                <span className="text-[11px] text-muted">
                  {relativeTime(digest.createdAt)} ·{" "}
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
            <section className="rounded-xl border border-hairline bg-surface p-4">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-ink">Triage</h2>
                <span className="text-[11px] text-muted">{relativeTime(triage.createdAt)}</span>
              </div>
              <div className="line-clamp-[8]">
                <Markdown>{triage.body}</Markdown>
              </div>
            </section>
          )}
        </div>
      )}

      <FilterBar filters={filters} categories={categories} />

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-grid px-6 py-16 text-center text-sm text-muted">
          No projects match.{" "}
          <Link href="/projects/new" className="text-accent hover:underline">
            Create one
          </Link>{" "}
          or connect a coding agent to the MCP server.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((d) => (
            <ProjectCard key={d.project.id} detail={d} />
          ))}
        </div>
      )}
    </div>
  );
}
