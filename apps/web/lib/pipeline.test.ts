import { describe, expect, it } from "vitest";
import { prBucket, type PrLite } from "./pipeline.js";

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
