import { getProjectDetail, listProjects, type ProjectDetail } from "@workboard/core";
import { PR_BUCKET_ORDER } from "@/components/labels";
import { PageTopBar } from "@/components/page-top-bar";
import { QueueRail } from "@/components/pr-rail";
import { PrQueue, type PrGroup } from "@/components/pr-queue";
import { RefreshButton } from "@/components/refresh-button";
import { refreshMyPrsAction } from "@/lib/actions";
import { db } from "@/lib/db";
import { prBucket, type PrBucket } from "@/lib/pipeline";
import { resolvePrBucket, type PrParams } from "@/lib/pr-filters";
import { loadPullRequests } from "@/lib/prs";

export const dynamic = "force-dynamic";

export default async function PullRequestsPage({ searchParams }: { searchParams: Promise<PrParams> }) {
  const selected = resolvePrBucket(await searchParams);
  const database = db();
  const details = listProjects(database, {})
    .map((project) => getProjectDetail(database, project.id, { postsLimit: 0 }))
    .filter((detail): detail is ProjectDetail => detail !== undefined);

  const { mode, rows, login, truncated, error } = await loadPullRequests(details);

  // The rail always counts the whole queue, so a filtered view still says how
  // much is waiting outside it.
  const counts = Object.fromEntries(
    PR_BUCKET_ORDER.map((key) => [key, rows.filter((row) => prBucket(row.pr) === key).length]),
  ) as Record<PrBucket, number>;

  const groups: PrGroup[] = PR_BUCKET_ORDER.filter((key) => !selected || key === selected)
    .map((key) => ({ key, rows: rows.filter((row) => prBucket(row.pr) === key) }))
    .filter((group) => group.rows.length > 0);

  const count =
    mode === "mine"
      ? rows.length === 0
        ? `Nothing open under ${login}.`
        : `${rows.length}${truncated ? "+" : ""} open, authored by ${login}`
      : rows.length === 0
        ? "No open pull requests tracked."
        : `${rows.length} open across your projects`;

  return (
    <div className="flex h-screen flex-col">
      <PageTopBar
        name="Pull requests"
        count={count}
        action={mode === "mine" ? <RefreshButton action={refreshMyPrsAction} label="Refresh" /> : undefined}
      />

      <div className="flex min-h-0 flex-1 items-stretch">
        <div className="min-w-0 flex-1 overflow-y-auto px-5 pt-[22px] pb-9">
          {error && (
            <div className="mb-[22px] rounded-card border border-critical/35 bg-critical/[0.08] px-4 py-3 text-meta text-ink-2">
              GitHub would not say which PRs are yours, so this is what the board has synced instead.{" "}
              <span className="text-muted">{error}</span>
            </div>
          )}

          {rows.length === 0 ? (
            <div className="rounded-card border border-dashed border-grid px-6 py-16 text-center text-body text-muted">
              {mode === "mine" ? (
                "No open pull requests. Nothing waiting on you here."
              ) : (
                <>
                  Nothing open. Set <code>GITHUB_TOKEN</code> to see the PRs you have open, or link a repo to a project.
                </>
              )}
            </div>
          ) : (
            <>
              <PrQueue groups={groups} />
              {truncated && (
                <p className="mt-6 text-meta text-muted">
                  Showing the most recently updated. GitHub has more open under {login}.
                </p>
              )}
            </>
          )}
        </div>

        {rows.length > 0 && <QueueRail counts={counts} selected={selected} total={rows.length} />}
      </div>
    </div>
  );
}
