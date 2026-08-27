import { describe, expect, it } from "vitest";
import {
  assigneeQuery,
  issuesHref,
  parseIssueFilters,
  resolveIssueFilters,
  serializeIssueFilters,
} from "./issue-filters.js";

describe("issuesHref", () => {
  it("writes every set filter as a param", () => {
    expect(issuesHref({ lane: "queued", assignee: "me" })).toBe("/issues?lane=queued&assignee=me");
    expect(issuesHref({ label: "bug", q: "flaky test" })).toBe("/issues?label=bug&q=flaky+test");
  });

  it("says 'no filters' out loud, so clearing the last one is not read as a plain visit", () => {
    expect(issuesHref({})).toBe("/issues?filters=none");
  });
});

describe("resolveIssueFilters", () => {
  const remembered = "lane=queued&label=bug";

  it("restores the remembered set when the URL says nothing about filters", () => {
    expect(resolveIssueFilters({}, remembered)).toEqual({ lane: "queued", label: "bug" });
  });

  it("lets one filter in the URL describe the whole set", () => {
    expect(resolveIssueFilters({ assignee: "me" }, remembered)).toEqual({ assignee: "me" });
  });

  it("honours an explicit 'none' over the remembered set", () => {
    expect(resolveIssueFilters({ filters: "none" }, remembered)).toEqual({});
  });

  it("round-trips through the cookie", () => {
    const filters = { lane: "moving", assignee: "me", label: "infra", priority: "high", project: "workboard", q: "sync" };
    expect(parseIssueFilters(serializeIssueFilters(filters))).toEqual(filters);
  });
});

describe("assigneeQuery", () => {
  it("translates the URL's words into what the domain stores", () => {
    expect(assigneeQuery("me")).toBe("user");
    expect(assigneeQuery("none")).toBeNull();
    expect(assigneeQuery("agent:claude")).toBe("agent:claude");
    expect(assigneeQuery(undefined)).toBeUndefined();
  });
});
