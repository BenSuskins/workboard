import { describe, expect, it } from "vitest";
import { prsHref, resolvePrBucket } from "./pr-filters";

describe("pr filters", () => {
  it("makes a filtered queue a link, and the whole queue the bare path", () => {
    expect(prsHref("failing")).toBe("/prs?bucket=failing");
    expect(prsHref(null)).toBe("/prs");
  });

  it("reads back a bucket it knows", () => {
    expect(resolvePrBucket({ bucket: "approved" })).toBe("approved");
  });

  it("ignores a bucket it does not know, rather than filtering to nothing", () => {
    expect(resolvePrBucket({ bucket: "nonsense" })).toBeUndefined();
    expect(resolvePrBucket({})).toBeUndefined();
  });
});
