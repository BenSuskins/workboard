import Link from "next/link";
import { getProjectDetail, listProjects, type ProjectDetail } from "@workboard/core";
import { ciLabel, GitHubMark, prStateDot } from "@/components/chips";
import { SectionHeading } from "@/components/section";
import { db } from "@/lib/db";
import { prPipeline, type PrLite } from "@/lib/pipeline";
import { relativeTime } from "@/lib/format";

export const dynamic = "force-dynamic";

interface Row {
  pr: PrLite;
  projectName: string;
  projectSlug: string;
}

/**
 * Every open pull request across the board, newest first. GitHub only gives us
 * a token, not a login, so this cannot honestly claim to show "mine" — it shows
 * what is open on the projects you track.
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
  const failing = rows.filter((row) => row.pr.ciStatus === "failing").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-heading font-semibold tracking-tight text-ink">Pull requests</h1>
        <p className="text-meta text-muted">
          {rows.length === 0
            ? "No open pull requests tracked."
            : `${rows.length} open across your projects${failing > 0 ? ` · ${failing} with CI failing` : ""}`}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-card border border-dashed border-grid px-6 py-16 text-center text-body text-muted">
          Nothing open. Link a repo or a PR to a project, and set <code>GITHUB_TOKEN</code> so Workboard can sync it.
        </div>
      ) : (
        <section className="flex flex-col gap-3">
          <SectionHeading title="Open" count={rows.length} />
          <ul className="overflow-hidden rounded-card border border-hairline bg-surface">
            {rows.map(({ pr, projectName, projectSlug }) => {
              const dot = prStateDot(pr);
              const ci = ciLabel(pr.ciStatus);
              return (
                <li
                  key={`${pr.repo}#${pr.number}`}
                  className="flex items-center gap-3 border-b border-hairline px-4 py-3 last:border-b-0 hover:bg-surface-2"
                >
                  <span className={`size-2 shrink-0 rounded-full ${dot.cls}`} title={dot.label} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <a href={pr.url} target="_blank" rel="noreferrer" className="truncate text-body text-ink hover:text-accent">
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
                    <span className="text-muted">{dot.label}</span>
                    <span className="hidden text-muted sm:inline">{relativeTime(pr.updatedAt)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
