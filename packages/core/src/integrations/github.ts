import type { RepoScope } from "../domain.js";

/** CI aggregate for a PR's head commit. Only computed for open PRs — closed/merged carry null. */
export type CiStatus = "passing" | "failing" | "pending" | null;

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
  ciStatus: CiStatus;
  labels: string[];
  headRef: string;
  author: string | null;
  updatedAt: string;
}

export interface RepoScopeSnapshot {
  type: "repo";
  repo: string;
  prs: (Omit<PrSnapshot, "type" | "reviewDecision" | "ciStatus"> & { ciStatus?: CiStatus })[];
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

// When GitHub reports an exhausted quota, all calls short-circuit until the
// advertised reset so a 10-minute poll can't dig the hole deeper.
let rateLimitedUntil = 0;

async function gh<T>(path: string): Promise<T> {
  if (Date.now() < rateLimitedUntil) {
    throw new Error(`GitHub rate limited — retrying after ${new Date(rateLimitedUntil).toISOString()}`);
  }
  const res = await fetch(`${API}${path}`, {
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if ((res.status === 403 || res.status === 429) && res.headers.get("x-ratelimit-remaining") === "0") {
    const reset = Number(res.headers.get("x-ratelimit-reset")) * 1000;
    rateLimitedUntil = Number.isFinite(reset) && reset > Date.now() ? reset : Date.now() + 15 * 60 * 1000;
    throw new Error(`GitHub rate limited — retrying after ${new Date(rateLimitedUntil).toISOString()}`);
  }
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
  head: { ref: string; sha: string };
  user: { login: string } | null;
  updated_at: string;
}

export interface CheckRun {
  status: "queued" | "in_progress" | "completed" | string;
  conclusion: string | null;
}

/** failure-ish conclusion anywhere → failing; anything still running → pending; else passing (or null if no checks). */
export function aggregateCheckRuns(runs: CheckRun[]): CiStatus {
  if (runs.length === 0) return null;
  const FAILING = new Set(["failure", "timed_out", "cancelled", "action_required", "startup_failure"]);
  let pending = false;
  for (const run of runs) {
    if (run.status !== "completed") pending = true;
    else if (run.conclusion && FAILING.has(run.conclusion)) return "failing";
  }
  return pending ? "pending" : "passing";
}

async function fetchCiStatus(repo: string, sha: string): Promise<CiStatus> {
  const result = await gh<{ check_runs: CheckRun[] }>(`/repos/${repo}/commits/${sha}/check-runs?per_page=100`);
  return aggregateCheckRuns(result.check_runs);
}

function toPr(repo: string, pr: RawPr): Omit<PrSnapshot, "type" | "reviewDecision" | "ciStatus"> {
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

/**
 * externalId format: "owner/repo#123".
 * Review + CI status are only checked for open PRs — closed/merged PRs are
 * historical record and their checks are ignored.
 */
export async function fetchPr(externalId: string): Promise<PrSnapshot> {
  const [repo, num] = externalId.split("#");
  const pr = await gh<RawPr>(`/repos/${repo}/pulls/${num}`);
  let reviewDecision: PrSnapshot["reviewDecision"] = null;
  let ciStatus: CiStatus = null;
  if (pr.state === "open") {
    ciStatus = await fetchCiStatus(repo, pr.head.sha);
    if (!pr.draft) {
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
  }
  return { type: "pr", reviewDecision, ciStatus, ...toPr(repo, pr) };
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
 * files call per PR, so it is capped to the 20 most recent. Open PRs (up to 15)
 * are enriched with CI status; closed/merged PRs are ignored for status checks.
 */
export async function fetchScopedRepo(repo: string, scope: RepoScope | null): Promise<RepoScopeSnapshot> {
  const raw = await gh<RawPr[]>(`/repos/${repo}/pulls?state=all&sort=updated&direction=desc&per_page=50`);
  const shaByNumber = new Map(raw.map((pr) => [pr.number, pr.head.sha]));
  let prs: RepoScopeSnapshot["prs"] = raw.map((pr) => toPr(repo, pr));
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
  let ciCalls = 0;
  for (const pr of prs) {
    if (pr.state !== "open" || ciCalls >= 15) continue;
    const sha = shaByNumber.get(pr.number);
    if (!sha) continue;
    ciCalls++;
    pr.ciStatus = await fetchCiStatus(repo, sha);
  }
  return { type: "repo", repo, prs, scope };
}
