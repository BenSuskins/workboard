import type { RepoScope } from "../db/schema.js";

export interface PrSnapshot {
  type: "pr";
  number: number;
  repo: string;
  title: string;
  url: string;
  state: "open" | "closed";
  draft: boolean;
  merged: boolean;
  reviewDecision: "approved" | "changes_requested" | "review_pending" | null;
  labels: string[];
  headRef: string;
  author: string | null;
  updatedAt: string;
}

export interface RepoScopeSnapshot {
  type: "repo";
  repo: string;
  prs: Omit<PrSnapshot, "type" | "reviewDecision">[];
  scope: RepoScope | null;
}

export interface IssueSnapshot {
  type: "issue";
  number: number;
  repo: string;
  title: string;
  url: string;
  state: "open" | "closed";
  labels: string[];
  updatedAt: string;
}

const API = "https://api.github.com";

export function githubConfigured(): boolean {
  return Boolean(process.env.GITHUB_TOKEN);
}

async function gh<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) throw new Error(`GitHub ${path} → ${res.status} ${await res.text().then((t) => t.slice(0, 200))}`);
  return res.json() as Promise<T>;
}

interface RawPr {
  number: number;
  title: string;
  html_url: string;
  state: "open" | "closed";
  draft: boolean;
  merged_at: string | null;
  labels: { name: string }[];
  head: { ref: string };
  user: { login: string } | null;
  updated_at: string;
}

function toPr(repo: string, pr: RawPr): Omit<PrSnapshot, "type" | "reviewDecision"> {
  return {
    number: pr.number,
    repo,
    title: pr.title,
    url: pr.html_url,
    state: pr.state,
    draft: pr.draft,
    merged: pr.merged_at != null,
    labels: pr.labels.map((l) => l.name),
    headRef: pr.head.ref,
    author: pr.user?.login ?? null,
    updatedAt: pr.updated_at,
  };
}

/** externalId format: "owner/repo#123" */
export async function fetchPr(externalId: string): Promise<PrSnapshot> {
  const [repo, num] = externalId.split("#");
  const pr = await gh<RawPr>(`/repos/${repo}/pulls/${num}`);
  let reviewDecision: PrSnapshot["reviewDecision"] = null;
  if (pr.state === "open" && !pr.draft) {
    const reviews = await gh<{ user: { login: string } | null; state: string }[]>(
      `/repos/${repo}/pulls/${num}/reviews?per_page=100`,
    );
    // latest review per reviewer wins
    const latest = new Map<string, string>();
    for (const r of reviews) {
      if (!r.user || (r.state !== "APPROVED" && r.state !== "CHANGES_REQUESTED")) continue;
      latest.set(r.user.login, r.state);
    }
    const states = [...latest.values()];
    reviewDecision = states.includes("CHANGES_REQUESTED")
      ? "changes_requested"
      : states.includes("APPROVED")
        ? "approved"
        : "review_pending";
  }
  return { type: "pr", reviewDecision, ...toPr(repo, pr) };
}

export async function fetchIssue(externalId: string): Promise<IssueSnapshot> {
  const [repo, num] = externalId.split("#");
  const issue = await gh<{
    number: number;
    title: string;
    html_url: string;
    state: "open" | "closed";
    labels: { name: string }[];
    updated_at: string;
  }>(`/repos/${repo}/issues/${num}`);
  return {
    type: "issue",
    number: issue.number,
    repo,
    title: issue.title,
    url: issue.html_url,
    state: issue.state,
    labels: issue.labels.map((l) => l.name),
    updatedAt: issue.updated_at,
  };
}

/**
 * Monorepo-aware discovery: recent PRs in the repo narrowed to one project's
 * scope (labels / branch prefix / path prefixes). Path filtering requires a
 * files call per PR, so it is capped to the 20 most recent.
 */
export async function fetchScopedRepo(repo: string, scope: RepoScope | null): Promise<RepoScopeSnapshot> {
  const raw = await gh<RawPr[]>(`/repos/${repo}/pulls?state=all&sort=updated&direction=desc&per_page=50`);
  let prs = raw.map((pr) => toPr(repo, pr));
  if (scope?.labels?.length) {
    prs = prs.filter((pr) => pr.labels.some((l) => scope.labels!.includes(l)));
  }
  if (scope?.branchPrefix) {
    prs = prs.filter((pr) => pr.headRef.startsWith(scope.branchPrefix!));
  }
  if (scope?.pathPrefixes?.length) {
    const checked = prs.slice(0, 20);
    const kept: typeof prs = [];
    for (const pr of checked) {
      const files = await gh<{ filename: string }[]>(`/repos/${repo}/pulls/${pr.number}/files?per_page=100`);
      if (files.some((f) => scope.pathPrefixes!.some((p) => f.filename.startsWith(p)))) kept.push(pr);
    }
    prs = kept;
  }
  return { type: "repo", repo, prs, scope };
}
