import { describe, expect, it } from "vitest";
import { boardHref, parseFilters, resolveFilters, serializeFilters } from "./board-filters.js";

describe("boardHref", () => {
  it("writes every set filter as a param, and leaves the default sort implicit", () => {
    expect(boardHref({ status: "blocked", sort: "activity" })).toBe("/?status=blocked");
    expect(boardHref({ category: "coding", sort: "stale" })).toBe("/?category=coding&sort=stale");
  });

  it("says 'no filters' out loud, so clearing the last one is not read as a plain visit", () => {
    expect(boardHref({})).toBe("/?filters=none");
  });
});

describe("resolveFilters", () => {
  const remembered = "status=blocked&sort=stale";

  it("restores the remembered set when the URL says nothing about filters", () => {
    expect(resolveFilters({}, remembered)).toEqual({ status: "blocked", sort: "stale" });
  });

  it("lets one filter in the URL describe the whole set", () => {
    expect(resolveFilters({ category: "coding" }, remembered)).toEqual({ category: "coding" });
  });

  it("honours an explicit 'none' over the remembered set", () => {
    expect(resolveFilters({ filters: "none" }, remembered)).toEqual({});
  });

  it("copes with no memory at all", () => {
    expect(resolveFilters({}, undefined)).toEqual({});
    expect(resolveFilters({}, "")).toEqual({});
  });

  it("ignores anything that is not a filter", () => {
    expect(resolveFilters({ ...({ nonsense: "1" } as object) }, remembered)).toEqual({
      status: "blocked",
      sort: "stale",
    });
  });
});

describe("serializeFilters", () => {
  it("round-trips through parseFilters", () => {
    const filters = { category: "coding", status: "active", sort: "name" };
    expect(parseFilters(serializeFilters(filters))).toEqual(filters);
  });

  it("remembers nothing when nothing is filtered", () => {
    expect(serializeFilters({})).toBe("");
    expect(serializeFilters({ sort: "activity" })).toBe("");
  });
});
