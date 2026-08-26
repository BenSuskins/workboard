import type { CiStatus, Link, PrSnapshot, RepoScopeSnapshot, Snapshot } from "@workboard/core";

export interface PrLite {
  number: number;
  repo: string;
  title: string;
  url: string;
  state: "open" | "closed";
  draft: boolean;
  merged: boolean;
  reviewDecision?: PrSnapshot["reviewDecision"];
  ciStatus?: CiStatus;
  author: string | null;
  updatedAt: string;
}

export interface Pipeline {
  draft: number;
  inReview: number;
  approved: number;
  mergedRecently: number;
  ciFailing: number;
  prs: PrLite[];
}

const RECENT_MS = 7 * 24 * 60 * 60 * 1000;

/** Collect PRs across a project's pr-links and scoped repo snapshots, deduped by repo#number. */
export function prPipeline(links: (Link & { snapshot: Snapshot | null })[]): Pipeline {
  const byId = new Map<string, PrLite>();
  for (const link of links) {
    const data = link.snapshot?.data as PrSnapshot | RepoScopeSnapshot | undefined;
    if (!data || typeof data !== "object") continue;
    if (data.type === "pr") {
      byId.set(`${data.repo}#${data.number}`, data);
    } else if (data.type === "repo") {
      for (const pr of data.prs) {
        const key = `${pr.repo}#${pr.number}`;
        if (!byId.has(key)) byId.set(key, pr);
      }
    }
  }
  const prs = [...byId.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const recentCutoff = Date.now() - RECENT_MS;
  let draft = 0;
  let inReview = 0;
  let approved = 0;
  let mergedRecently = 0;
  let ciFailing = 0;
  for (const pr of prs) {
    if (pr.state === "open") {
      if (pr.draft) draft++;
      else if (pr.reviewDecision === "approved") approved++;
      else inReview++;
      // CI only counts for in-flight PRs; closed/merged never carry ciStatus
      if (pr.ciStatus === "failing") ciFailing++;
    } else if (pr.merged && Date.parse(pr.updatedAt) > recentCutoff) {
      mergedRecently++;
    }
  }
  return { draft, inReview, approved, mergedRecently, ciFailing, prs };
}

export function hasPipeline(p: Pipeline): boolean {
  return p.draft + p.inReview + p.approved + p.mergedRecently > 0;
}

export type PrBucket = "failing" | "approved" | "changes" | "review" | "draft";

/**
 * Which pile an open PR belongs in, in the order you act on them. Exactly one
 * bucket per PR, first match wins — so a red build outranks review state, and a
 * draft only counts as a draft once its checks are green.
 */
export function prBucket(pr: PrLite): PrBucket {
  if (pr.ciStatus === "failing") return "failing";
  if (pr.draft) return "draft";
  if (pr.reviewDecision === "approved") return "approved";
  if (pr.reviewDecision === "changes_requested") return "changes";
  return "review";
}
