import type { CiStatus, Link, PrSnapshot, RepoScope, RepoScopeSnapshot, Snapshot } from "@workboard/core";

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

/** Just enough of a project to link to it from a PR row. */
export interface ProjectRef {
  slug: string;
  name: string;
}

export interface ProjectLinks {
  project: ProjectRef;
  links: (Link & { snapshot: Snapshot | null })[];
}

export interface PrIndex {
  /** repo#number → project, for PRs the board already tracks: a pr link, or discovery through a repo link. */
  tracked: Map<string, ProjectRef>;
  /** repo links, so a brand-new PR can still find its project before any sync has seen it. */
  repos: { repo: string; scope: RepoScope | null; project: ProjectRef }[];
}

/** What a PR needs to carry to be matched against a project's links. */
export interface PrIdentity {
  repo: string;
  number: number;
  labels?: string[];
  headRef?: string;
}

export function buildPrIndex(projects: ProjectLinks[]): PrIndex {
  const index: PrIndex = { tracked: new Map(), repos: [] };
  for (const { project, links } of projects) {
    for (const pr of prPipeline(links).prs) {
      const key = `${pr.repo}#${pr.number}`;
      if (!index.tracked.has(key)) index.tracked.set(key, project);
    }
    for (const link of links) {
      if (link.provider !== "github" || link.kind !== "repo" || !link.externalId) continue;
      index.repos.push({ repo: link.externalId, scope: link.scope, project });
    }
  }
  return index;
}

/**
 * A path-scoped link needs the PR's file list to judge, which this view does not
 * fetch — but sync already filtered those PRs into the snapshot, so such a PR is
 * matched by `tracked` or not at all. Claiming it here would attribute every PR
 * in the monorepo to one project.
 */
function scopeAdmits(scope: RepoScope | null, pr: PrIdentity): boolean {
  if (!scope) return true;
  if (scope.pathPrefixes?.length) return false;
  if (scope.labels?.length && !pr.labels?.some((label) => scope.labels!.includes(label))) return false;
  if (scope.branchPrefix && !pr.headRef?.startsWith(scope.branchPrefix)) return false;
  return true;
}

/**
 * The project a PR belongs to, if any. A PR the board already tracks names its
 * project outright; otherwise a repo link can claim it — but only when exactly
 * one project's link fits, since two projects sharing a monorepo would otherwise
 * both look right.
 */
export function projectForPr(index: PrIndex, pr: PrIdentity): ProjectRef | undefined {
  const tracked = index.tracked.get(`${pr.repo}#${pr.number}`);
  if (tracked) return tracked;
  const candidates = index.repos.filter((entry) => entry.repo === pr.repo && scopeAdmits(entry.scope, pr));
  const [first] = candidates;
  return first && candidates.every((entry) => entry.project.slug === first.project.slug) ? first.project : undefined;
}
