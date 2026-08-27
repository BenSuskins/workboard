import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectDetail } from "@workboard/core";
import { loadPullRequests } from "./prs.js";

const { fetchMyOpenPrs, githubConfigured } = vi.hoisted(() => ({
  fetchMyOpenPrs: vi.fn(),
  githubConfigured: vi.fn(),
}));

vi.mock("@workboard/core", () => ({ fetchMyOpenPrs, githubConfigured }));

const pr = (overrides: Record<string, unknown> = {}) => ({
  type: "pr" as const,
  number: 7,
  repo: "acme/app",
  title: "A change",
  url: "https://github.com/acme/app/pull/7",
  state: "open" as const,
  draft: false,
  merged: false,
  reviewDecision: "review_pending" as const,
  ciStatus: "passing" as const,
  labels: [],
  headRef: "topic",
  author: "octocat",
  updatedAt: "2026-08-26T10:00:00Z",
  ...overrides,
});

/** One project linking acme/app, with a synced snapshot of somebody else's PR in it. */
const details = [
  {
    project: { slug: "checkout", name: "Checkout" },
    links: [
      {
        id: 1,
        projectId: 1,
        provider: "github",
        kind: "repo",
        url: "https://github.com/acme/app",
        externalId: "acme/app",
        title: "acme/app",
        scope: null,
        createdAt: 0,
        deletedAt: null,
        snapshot: {
          id: 1,
          linkId: 1,
          fetchedAt: 0,
          data: { type: "repo", repo: "acme/app", scope: null, prs: [pr({ number: 99, author: "someone" })] },
        },
      },
    ],
  },
] as unknown as ProjectDetail[];

describe("loadPullRequests", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the token owner's own PRs, with the project of any the board tracks", async () => {
    githubConfigured.mockReturnValue(true);
    fetchMyOpenPrs.mockResolvedValue({
      login: "octocat",
      truncated: false,
      prs: [pr(), pr({ number: 8, repo: "other/repo", updatedAt: "2026-08-27T10:00:00Z" })],
    });

    const result = await loadPullRequests(details);
    expect(result.mode).toBe("mine");
    expect(result.login).toBe("octocat");
    // Most recently updated first.
    expect(result.rows.map((row) => row.pr.number)).toEqual([8, 7]);
    // A repo link claims the PR in its repo; a PR nothing links carries no project.
    expect(result.rows[1].project).toEqual({ slug: "checkout", name: "Checkout" });
    expect(result.rows[0].project).toBeUndefined();
  });

  it("falls back to what the board synced when GitHub refuses, and says why", async () => {
    githubConfigured.mockReturnValue(true);
    fetchMyOpenPrs.mockRejectedValue(new Error("GitHub /user → 401"));

    const result = await loadPullRequests(details);
    expect(result.mode).toBe("tracked");
    expect(result.error).toContain("401");
    expect(result.rows.map((row) => row.pr.number)).toEqual([99]);
  });

  it("shows the board's own PRs when there is no token to name anyone", async () => {
    githubConfigured.mockReturnValue(false);

    const result = await loadPullRequests(details);
    expect(result.mode).toBe("tracked");
    expect(fetchMyOpenPrs).not.toHaveBeenCalled();
    expect(result.rows.map((row) => row.pr.number)).toEqual([99]);
  });
});
