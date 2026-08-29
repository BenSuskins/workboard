import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearMyOpenPrs, fetchMyOpenPrs } from "./github.js";

/** A GitHub stand-in: one open PR of mine, plus whatever the enrichment calls ask for. */
function stubGitHub(
  items: { repo: string; number: number }[],
  totalCount = items.length,
  options: { reviews?: { user: { login: string }; state: string }[]; bare?: boolean } = {},
) {
  const calls: string[] = [];
  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const path = String(url).replace("https://api.github.com", "");
      calls.push(path);
      if (path === "/user") return json({ login: "octocat" });
      if (path.startsWith("/search/issues")) {
        return json({
          total_count: totalCount,
          items: items.map((item) => ({
            number: item.number,
            repository_url: `https://api.github.com/repos/${item.repo}`,
          })),
        });
      }
      if (path.includes("/check-runs")) {
        return json({
          check_runs: [
            {
              name: "unit / core",
              status: "completed",
              conclusion: "success",
              started_at: "2026-08-26T09:00:00Z",
              completed_at: "2026-08-26T09:00:58Z",
            },
          ],
        });
      }
      if (path.endsWith("/reviews?per_page=100")) {
        return json(options.bare ? [] : (options.reviews ?? [{ user: { login: "hubot" }, state: "APPROVED" }]));
      }
      const [, , owner, name, , number] = path.split("/");
      const extra = options.bare
        ? {}
        : { additions: 412, deletions: 96, requested_reviewers: [{ login: "dana" }] };
      return json({
        number: Number(number),
        title: `PR ${number}`,
        html_url: `https://github.com/${owner}/${name}/pull/${number}`,
        state: "open",
        draft: false,
        merged_at: null,
        labels: [{ name: "feature" }],
        head: { ref: "topic", sha: "abc123" },
        user: { login: "octocat" },
        updated_at: "2026-08-26T10:00:00Z",
        ...extra,
      });
    }),
  );
  return calls;
}

describe("fetchMyOpenPrs", () => {
  beforeEach(() => {
    process.env.GITHUB_TOKEN = "test-token";
    clearMyOpenPrs();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearMyOpenPrs();
  });

  it("asks GitHub only for open PRs the token's owner authored", async () => {
    const calls = stubGitHub([{ repo: "acme/app", number: 7 }]);
    const { login, prs } = await fetchMyOpenPrs(0);
    expect(login).toBe("octocat");
    const search = calls.find((path) => path.startsWith("/search/issues"))!;
    expect(decodeURIComponent(search)).toContain("is:pr is:open archived:false author:octocat");
    expect(prs).toHaveLength(1);
    expect(prs[0]).toMatchObject({ repo: "acme/app", number: 7, reviewDecision: "approved", ciStatus: "passing" });
  });

  it("reads each hit in full, since search carries neither CI nor reviews", async () => {
    const calls = stubGitHub([{ repo: "acme/app", number: 7 }]);
    await fetchMyOpenPrs(0);
    expect(calls).toContain("/repos/acme/app/pulls/7");
    expect(calls).toContain("/repos/acme/app/commits/abc123/check-runs?per_page=100");
    expect(calls).toContain("/repos/acme/app/pulls/7/reviews?per_page=100");
  });

  it("keeps the diff size, the reviewers and the checks the same calls already returned", async () => {
    const calls = stubGitHub([{ repo: "acme/app", number: 7 }]);
    const [pr] = (await fetchMyOpenPrs(0)).prs;
    expect(pr).toMatchObject({ additions: 412, deletions: 96 });
    // Whoever reviewed, plus whoever is still being waited on.
    expect(pr.reviewers).toEqual(["hubot", "dana"]);
    expect(pr.checks).toEqual([
      {
        name: "unit / core",
        status: "completed",
        conclusion: "success",
        started_at: "2026-08-26T09:00:00Z",
        completed_at: "2026-08-26T09:00:58Z",
      },
    ]);
    // Still the same three requests — nothing new is asked of GitHub.
    expect(calls.filter((path) => path.startsWith("/repos/"))).toHaveLength(3);
  });

  it("names who asked for changes, so the row can say it", async () => {
    stubGitHub([{ repo: "acme/app", number: 7 }], 1, {
      reviews: [
        { user: { login: "hubot" }, state: "APPROVED" },
        { user: { login: "dana" }, state: "CHANGES_REQUESTED" },
      ],
    });
    const [pr] = (await fetchMyOpenPrs(0)).prs;
    expect(pr.reviewDecision).toBe("changes_requested");
    expect(pr.changesRequestedBy).toBe("dana");
  });

  it("survives a response that carries none of the new fields", async () => {
    stubGitHub([{ repo: "acme/app", number: 7 }], 1, { bare: true });
    const [pr] = (await fetchMyOpenPrs(0)).prs;
    expect(pr).toMatchObject({ repo: "acme/app", number: 7 });
    expect(pr.additions).toBeUndefined();
    expect(pr.deletions).toBeUndefined();
    expect(pr.reviewers).toEqual([]);
    expect(pr.changesRequestedBy).toBeNull();
  });

  it("serves a cached list until it goes stale", async () => {
    const calls = stubGitHub([{ repo: "acme/app", number: 7 }]);
    await fetchMyOpenPrs();
    const afterFirst = calls.length;
    await fetchMyOpenPrs();
    expect(calls).toHaveLength(afterFirst);
    await fetchMyOpenPrs(0);
    expect(calls.length).toBeGreaterThan(afterFirst);
  });

  it("says when GitHub had more than the page it returned", async () => {
    stubGitHub([{ repo: "acme/app", number: 7 }], 40);
    expect((await fetchMyOpenPrs(0)).truncated).toBe(true);
    clearMyOpenPrs();
    stubGitHub([{ repo: "acme/app", number: 7 }]);
    expect((await fetchMyOpenPrs(0)).truncated).toBe(false);
  });
});
