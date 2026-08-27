import { describe, expect, it } from "vitest";
import { buildPrIndex, prBucket, projectForPr, type PrLite, type ProjectLinks } from "./pipeline.js";

const pr = (overrides: Partial<PrLite>): PrLite => ({
  number: 1,
  repo: "acme/app",
  title: "A change",
  url: "https://github.com/acme/app/pull/1",
  state: "open",
  draft: false,
  merged: false,
  reviewDecision: "review_pending",
  author: "someone",
  updatedAt: "2026-08-26T10:00:00Z",
  ...overrides,
});

describe("prBucket", () => {
  it("sorts an open PR by its review state", () => {
    expect(prBucket(pr({ reviewDecision: "approved" }))).toBe("approved");
    expect(prBucket(pr({ reviewDecision: "changes_requested" }))).toBe("changes");
    expect(prBucket(pr({ reviewDecision: "review_pending" }))).toBe("review");
    expect(prBucket(pr({ reviewDecision: null }))).toBe("review");
  });

  it("puts a draft in its own pile", () => {
    expect(prBucket(pr({ draft: true }))).toBe("draft");
  });

  it("lets a red build outrank every review state", () => {
    expect(prBucket(pr({ ciStatus: "failing", reviewDecision: "approved" }))).toBe("failing");
    expect(prBucket(pr({ ciStatus: "failing", draft: true }))).toBe("failing");
  });

  it("does not treat passing or pending CI as a bucket of its own", () => {
    expect(prBucket(pr({ ciStatus: "passing", reviewDecision: "approved" }))).toBe("approved");
    expect(prBucket(pr({ ciStatus: "pending", reviewDecision: "approved" }))).toBe("approved");
    expect(prBucket(pr({ ciStatus: undefined, reviewDecision: "approved" }))).toBe("approved");
  });

  it("gives every PR exactly one bucket", () => {
    const cases = [
      pr({}),
      pr({ draft: true }),
      pr({ reviewDecision: "approved" }),
      pr({ ciStatus: "failing" }),
      pr({ ciStatus: "passing", draft: true, reviewDecision: "changes_requested" }),
    ];
    for (const candidate of cases) {
      expect(["failing", "approved", "changes", "review", "draft"]).toContain(prBucket(candidate));
    }
  });
});


const project = { slug: "checkout", name: "Checkout" };
const other = { slug: "search", name: "Search" };

const link = (overrides: Partial<ProjectLinks["links"][number]>): ProjectLinks["links"][number] => ({
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
  snapshot: null,
  ...overrides,
});

const snapshot = (data: unknown) => ({ id: 1, linkId: 1, data, fetchedAt: 0 });

describe("projectForPr", () => {
  it("names the project of a PR the board already tracks", () => {
    const index = buildPrIndex([
      {
        project,
        links: [
          link({
            kind: "pr",
            externalId: "acme/app#7",
            snapshot: snapshot({ type: "pr", repo: "acme/app", number: 7, state: "open", updatedAt: "2026-08-26" }),
          }),
        ],
      },
    ]);
    expect(projectForPr(index, { repo: "acme/app", number: 7 })).toEqual(project);
    expect(projectForPr(index, { repo: "acme/app", number: 8 })).toBeUndefined();
  });

  it("lets a repo link claim a PR nothing has synced yet", () => {
    const index = buildPrIndex([{ project, links: [link({})] }]);
    expect(projectForPr(index, { repo: "acme/app", number: 99 })).toEqual(project);
    expect(projectForPr(index, { repo: "acme/other", number: 99 })).toBeUndefined();
  });

  it("uses a link's scope to tell two projects in one monorepo apart", () => {
    const index = buildPrIndex([
      { project, links: [link({ scope: { branchPrefix: "checkout/" } })] },
      { project: other, links: [link({ id: 2, projectId: 2, scope: { labels: ["search"] } })] },
    ]);
    expect(projectForPr(index, { repo: "acme/app", number: 1, headRef: "checkout/tax" })).toEqual(project);
    expect(projectForPr(index, { repo: "acme/app", number: 2, labels: ["search"] })).toEqual(other);
    // Fits neither scope, so neither project may claim it.
    expect(projectForPr(index, { repo: "acme/app", number: 3, headRef: "chore/deps" })).toBeUndefined();
  });

  it("refuses to guess when two unscoped projects link the same repo", () => {
    const index = buildPrIndex([
      { project, links: [link({})] },
      { project: other, links: [link({ id: 2, projectId: 2 })] },
    ]);
    expect(projectForPr(index, { repo: "acme/app", number: 4 })).toBeUndefined();
  });

  it("leaves a path-scoped link to the sync that can actually check paths", () => {
    const index = buildPrIndex([{ project, links: [link({ scope: { pathPrefixes: ["apps/web/"] } })] }]);
    expect(projectForPr(index, { repo: "acme/app", number: 5 })).toBeUndefined();
  });
});
