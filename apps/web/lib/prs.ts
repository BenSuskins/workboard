import { fetchMyOpenPrs, githubConfigured, type ProjectDetail } from "@workboard/core";
import { buildPrIndex, prPipeline, projectForPr, type PrLite, type ProjectRef } from "./pipeline";

export interface PrRow {
  pr: PrLite;
  /** Present only when the PR maps onto a project the board tracks. */
  project?: ProjectRef;
}

export interface PullRequests {
  /** `mine` is the token owner's own open PRs; `tracked` is the fallback — whatever the board has synced. */
  mode: "mine" | "tracked";
  rows: PrRow[];
  login?: string;
  /** More open PRs exist than the page GitHub was asked for. */
  truncated?: boolean;
  /** Set when GitHub was configured but the read failed, so the page can say why it fell back. */
  error?: string;
}

/** The tile the row draws needs the hue and the glyph, not only the name. */
function projectRef(detail: ProjectDetail): ProjectRef {
  const { slug, name, accent, icon } = detail.project;
  return { slug, name, accent, icon };
}

/** The board's own PRs, whoever wrote them — what this page showed before a token could name you. */
function trackedPrs(details: ProjectDetail[]): PrRow[] {
  const rows: PrRow[] = [];
  for (const detail of details) {
    const project = projectRef(detail);
    for (const pr of prPipeline(detail.links).prs) {
      if (pr.state === "open") rows.push({ pr, project });
    }
  }
  return rows;
}

/**
 * Open pull requests for the PR view and the sidebar badge, so the two always
 * agree. With a token this is *your* open PRs across GitHub, each carrying a
 * project only if the board tracks it; without one — or if GitHub refuses — it
 * degrades to the PRs the board has synced.
 */
export async function loadPullRequests(details: ProjectDetail[]): Promise<PullRequests> {
  const byUpdated = (a: PrRow, b: PrRow) => b.pr.updatedAt.localeCompare(a.pr.updatedAt);
  if (!githubConfigured()) return { mode: "tracked", rows: trackedPrs(details).sort(byUpdated) };

  const index = buildPrIndex(
    details.map((detail) => ({
      project: projectRef(detail),
      links: detail.links,
    })),
  );
  try {
    const { login, prs, truncated } = await fetchMyOpenPrs();
    const rows = prs.map((pr) => ({ pr, project: projectForPr(index, pr) }));
    return { mode: "mine", login, truncated, rows: rows.sort(byUpdated) };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { mode: "tracked", error, rows: trackedPrs(details).sort(byUpdated) };
  }
}
