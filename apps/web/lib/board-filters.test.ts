import { describe, expect, it } from "vitest";
import { boardHref, parseFilters, resolveFilters, serializeFilters } from "./board-filters.js";

describe("boardHref", () => {
  it("writes every set filter as a param, and leaves the default sort implicit", () => {
    expect(boardHref({ status: "blocked", sort: "activity" })).toBe("/?status=blocked");
    expect(boardHref({ category: "coding", health: "red", sort: "stale" })).toBe(
      "/?category=coding&health=red&sort=stale",
    );
  });

  it("says 'no filters' out loud, so clearing the last one is not read as a plain visit", () => {
    expect(boardHref({})).toBe("/?filters=none");
    expect(boardHref({ view: "list" })).toBe("/?filters=none&view=list");
  });
});

describe("resolveFilters", () => {
  const remembered = "status=blocked&sort=stale";

  it("restores the remembered set when the URL says nothing about filters", () => {
    expect(resolveFilters({}, remembered)).toEqual({ status: "blocked", sort: "stale", view: undefined });
  });

  it("lets one filter in the URL describe the whole set", () => {
    expect(resolveFilters({ health: "red" }, remembered)).toEqual({ health: "red", view: undefined });
  });

  it("honours an explicit 'none' over the remembered set", () => {
    expect(resolveFilters({ filters: "none" }, remembered)).toEqual({ view: undefined });
  });

  it("keeps the layout out of it — ?view= alone still restores the filters", () => {
    expect(resolveFilters({ view: "list" }, remembered)).toEqual({
      status: "blocked",
      sort: "stale",
      view: "list",
    });
  });

  it("copes with no memory at all", () => {
    expect(resolveFilters({}, undefined)).toEqual({ view: undefined });
    expect(resolveFilters({}, "")).toEqual({ view: undefined });
  });

  it("ignores anything that is not a filter", () => {
    expect(resolveFilters({ ...({ nonsense: "1" } as object) }, remembered)).toEqual({
      status: "blocked",
      sort: "stale",
      view: undefined,
    });
  });
});

describe("serializeFilters", () => {
  it("round-trips through parseFilters", () => {
    const filters = { category: "coding", status: "active", health: "amber", sort: "name" };
    expect(parseFilters(serializeFilters(filters))).toEqual(filters);
  });

  it("remembers nothing when nothing is filtered", () => {
    expect(serializeFilters({})).toBe("");
    // The layout is remembered by its own cookie, so it never lands here.
    expect(serializeFilters({ view: "list", sort: "activity" })).toBe("");
  });
});
