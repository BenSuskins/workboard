import Link from "next/link";
import { getProjectDetail, listProjects, type ProjectDetail } from "@workboard/core";
import { ciLabel, GitHubMark } from "@/components/chips";
import { SectionHeading } from "@/components/section";
import { db } from "@/lib/db";
import { prBucket, prPipeline, type PrBucket, type PrLite } from "@/lib/pipeline";
import { relativeTime } from "@/lib/format";

export const dynamic = "force-dynamic";

interface Row {
  pr: PrLite;
  projectName: string;
  projectSlug: string;
}

/** Display for each bucket. The rules themselves live in lib/pipeline. */
const BUCKETS = [
  {
    key: "failing",
    title: "Failing checks",
    blurb: "CI is red \u2014 these need a fix before review matters.",
    tone: "text-critical",
    dot: "bg-critical",
  },
  {
    key: "approved",
    title: "Approved",
    blurb: "Signed off and green. Ready to merge.",
    tone: "text-good",
    dot: "bg-good",
  },
  {
    key: "changes",
    title: "Changes requested",
    blurb: "A reviewer asked for work.",
    tone: "text-serious",
    dot: "bg-serious",
  },
  {
    key: "review",
    title: "Ready for review",
    blurb: "Open, not draft, waiting on a reviewer.",
    tone: "text-warning",
    dot: "bg-warning",
  },
  {
    key: "draft",
    title: "Draft",
    blurb: "Still being written.",
    tone: "text-muted",
    dot: "bg-muted",
  },
] as const satisfies readonly { key: PrBucket; title: string; blurb: string; tone: string; dot: string }[];

/**
 * Every open pull request across the board, grouped by what you would do about
 * it. GitHub gives us a token, not a login, so this cannot honestly claim to
 * show "mine" — it shows what is open on the projects you track.
 */
export default async function PullRequestsPage() {
  const database = db();
  const details = listProjects(database, {})
    .map((project) => getProjectDetail(database, project.id, { postsLimit: 0 }))
    .filter((detail): detail is ProjectDetail => detail !== undefined);

  const rows: Row[] = [];
  for (const detail of details) {
    for (const pr of prPipeline(detail.links).prs) {
      if (pr.state !== "open") continue;
      rows.push({ pr, projectName: detail.project.name, projectSlug: detail.project.slug });
    }
  }
  rows.sort((a, b) => b.pr.updatedAt.localeCompare(a.pr.updatedAt));

  const grouped = BUCKETS.map((bucket) => ({
    ...bucket,
    rows: rows.filter((row) => prBucket(row.pr) === bucket.key),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-heading font-semibold tracking-tight text-ink">Pull requests</h1>
        <p className="text-meta text-muted">
          {rows.length === 0 ? "No open pull requests tracked." : `${rows.length} open across your projects`}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-card border border-dashed border-grid px-6 py-16 text-center text-body text-muted">
          Nothing open. Link a repo or a PR to a project, and set <code>GITHUB_TOKEN</code> so Workboard can sync it.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-card border border-hairline bg-surface px-4 py-3">
            {grouped.map((bucket) => (
              <span key={bucket.key} className="inline-flex items-center gap-2 text-meta">
                <span className={`size-1.5 rounded-full ${bucket.dot}`} aria-hidden />
                <span className={`font-semibold tabular-nums ${bucket.rows.length > 0 ? bucket.tone : "text-muted"}`}>
                  {bucket.rows.length}
                </span>
                <span className="text-ink-2">{bucket.title.toLowerCase()}</span>
              </span>
            ))}
          </div>

          {grouped.map((bucket) =>
            bucket.rows.length === 0 ? null : (
              <section key={bucket.key} className="flex flex-col gap-3">
                <SectionHeading title={bucket.title} count={bucket.rows.length} />
                <p className="-mt-2 text-meta text-muted">{bucket.blurb}</p>
                <ul className="overflow-hidden rounded-card border border-hairline bg-surface">
                  {bucket.rows.map(({ pr, projectName, projectSlug }) => {
                    const ci = ciLabel(pr.ciStatus);
                    return (
                      <li
                        key={`${pr.repo}#${pr.number}`}
                        className="flex items-center gap-3 border-b border-hairline px-4 py-3 last:border-b-0 hover:bg-surface-2"
                      >
                        <span className={`size-2 shrink-0 rounded-full ${bucket.dot}`} aria-hidden />
                        <div className="min-w-0 flex-1">
                          <a
                            href={pr.url}
                            target="_blank"
                            rel="noreferrer"
                            className="truncate text-body text-ink hover:text-accent"
                          >
                            {pr.title}
                          </a>
                          <div className="flex flex-wrap items-center gap-x-2 text-meta text-muted">
                            <span className="inline-flex items-center gap-1">
                              <GitHubMark />
                              {pr.repo} #{pr.number}
                            </span>
                            <span>·</span>
                            <Link href={`/projects/${projectSlug}`} className="hover:text-ink">
                              {projectName}
                            </Link>
                            {pr.author && (
                              <>
                                <span>·</span>
                                <span>{pr.author}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2.5 text-meta">
                          {ci && (
                            <span
                              className={
                                pr.ciStatus === "failing"
                                  ? "font-semibold text-critical"
                                  : pr.ciStatus === "passing"
                                    ? "text-good"
                                    : "text-muted"
                              }
                            >
                              {ci}
                            </span>
                          )}
                          <span className="hidden text-muted sm:inline">{relativeTime(pr.updatedAt)}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ),
          )}
        </>
      )}
    </div>
  );
}
