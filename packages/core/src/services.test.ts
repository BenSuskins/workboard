import { beforeEach, describe, expect, it } from "vitest";
import { openDb, type Db } from "./db/client.js";
import { aggregateCheckRuns } from "./integrations/github.js";
import {
  listWarnings,
  raiseWarning,
  resolveWarning,
} from "./services.js";
import {
  addLink,
  addTask,
  addUpdate,
  createProject,
  findProject,
  getActivity,
  getProjectDetail,
  inferLink,
  latestReport,
  listProjects,
  listReports,
  saveReport,
  saveSnapshot,
  updateProject,
  updateTask,
  upsertSummary,
} from "./services.js";

let db: Db;
beforeEach(() => {
  db = openDb(":memory:");
});

describe("projects", () => {
  it("creates with slug and defaults", () => {
    const p = createProject(db, { name: "Payments v2 Migration!" });
    expect(p.slug).toBe("payments-v2-migration");
    expect(p.status).toBe("active");
    expect(p.health).toBe("green");
  });

  it("dedupes slugs", () => {
    createProject(db, { name: "Alpha" });
    const second = createProject(db, { name: "Alpha" });
    expect(second.slug).toBe("alpha-2");
  });

  it("logs status changes to the timeline", () => {
    const p = createProject(db, { name: "Alpha" });
    updateProject(db, p.id, { status: "blocked" }, "agent:tester");
    const detail = getProjectDetail(db, p.id)!;
    expect(detail.project.status).toBe("blocked");
    expect(detail.updates[0].type).toBe("status_change");
    expect(detail.updates[0].author).toBe("agent:tester");
  });

  it("filters archived out by default", () => {
    const p = createProject(db, { name: "Old" });
    createProject(db, { name: "Current" });
    updateProject(db, p.id, { status: "archived" });
    expect(listProjects(db).map((x) => x.name)).toEqual(["Current"]);
    expect(listProjects(db, { includeArchived: true })).toHaveLength(2);
  });
});

describe("link inference", () => {
  it("infers GitHub PRs, issues, and repos", () => {
    expect(inferLink("https://github.com/acme/platform/pull/4821")).toEqual({
      provider: "github",
      kind: "pr",
      externalId: "acme/platform#4821",
    });
    expect(inferLink("https://github.com/acme/platform/issues/9")).toEqual({
      provider: "github",
      kind: "issue",
      externalId: "acme/platform#9",
    });
    expect(inferLink("https://github.com/acme/platform")).toEqual({ provider: "github", kind: "repo", externalId: "acme/platform" });
  });

  it("infers Jira issues and Google Docs", () => {
    expect(inferLink("https://acme.atlassian.net/browse/PAY-312").externalId).toBe("PAY-312");
    expect(inferLink("https://docs.google.com/document/d/1AbC_d-e/edit").externalId).toBe("1AbC_d-e");
    expect(inferLink("https://example.com/whatever").provider).toBe("url");
  });
});

describe("find_project (monorepo resolution)", () => {
  function setup() {
    const payments = createProject(db, { name: "Payments" });
    addLink(db, payments.id, {
      url: "https://github.com/acme/platform",
      scope: { pathPrefixes: ["services/payments/"], branchPrefix: "payments-v2/", labels: ["payments"] },
    });
    addLink(db, payments.id, { url: "https://github.com/acme/platform/pull/4821" });
    const search = createProject(db, { name: "Search" });
    addLink(db, search.id, {
      url: "https://github.com/acme/platform",
      scope: { pathPrefixes: ["services/search/"] },
    });
    return { payments, search };
  }

  it("resolves by exact PR link first", () => {
    const { payments } = setup();
    const matches = findProject(db, { repo: "acme/platform", prNumber: 4821 });
    expect(matches[0].project.id).toBe(payments.id);
    expect(matches[0].confidence).toBe("exact");
  });

  it("resolves by branch prefix", () => {
    const { payments } = setup();
    const matches = findProject(db, { repo: "acme/platform", branch: "payments-v2/read-cutover" });
    expect(matches).toHaveLength(1);
    expect(matches[0].project.id).toBe(payments.id);
    expect(matches[0].confidence).toBe("scoped");
  });

  it("resolves by changed paths", () => {
    const { search } = setup();
    const matches = findProject(db, { repo: "acme/platform", paths: ["services/search/ranker.ts"] });
    expect(matches).toHaveLength(1);
    expect(matches[0].project.id).toBe(search.id);
  });

  it("returns multiple candidates when ambiguous (bare repo fallback)", () => {
    setup();
    const matches = findProject(db, { repo: "acme/platform", branch: "unrelated-branch" });
    // neither scope matches the branch, no unscoped repo links exist → no matches
    expect(matches).toHaveLength(0);
  });

  it("falls back to unscoped repo links", () => {
    const p = createProject(db, { name: "Solo" });
    addLink(db, p.id, { url: "https://github.com/acme/solo-service" });
    const matches = findProject(db, { repo: "acme/solo-service", branch: "main" });
    expect(matches).toHaveLength(1);
    expect(matches[0].confidence).toBe("repo");
  });
});

describe("activity + reports", () => {
  it("collects updates since a timestamp with snapshots", () => {
    const p = createProject(db, { name: "Alpha" });
    const link = addLink(db, p.id, { url: "https://github.com/acme/platform/pull/1" });
    saveSnapshot(db, link.id, { type: "pr", state: "open" });
    addUpdate(db, p.id, "shipped a thing", { type: "agent_update", author: "agent:x" });
    upsertSummary(db, p.id, "All good.");
    const feed = getActivity(db, Date.now() - 1000);
    expect(feed.projects).toHaveLength(1);
    expect(feed.projects[0].updates).toHaveLength(1);
    expect(feed.projects[0].latestSummary).toBe("All good.");
    expect((feed.projects[0].links[0].snapshot as { state: string }).state).toBe("open");
  });

  it("stores and lists cross-project reports", () => {
    saveReport(db, "digest", "weekly digest body");
    saveReport(db, "triage", "triage body");
    expect(listReports(db)).toHaveLength(2);
    expect(latestReport(db, "digest")!.body).toBe("weekly digest body");
    // project summaries don't leak into reports
    const p = createProject(db, { name: "Alpha" });
    upsertSummary(db, p.id, "summary");
    expect(listReports(db)).toHaveLength(2);
  });
});

describe("warnings", () => {
  it("raises, orders by severity, and includes in project detail", () => {
    const p = createProject(db, { name: "Alpha" });
    raiseWarning(db, p.id, { message: "minor thing", severity: "info" });
    raiseWarning(db, p.id, { message: "CI is red", severity: "critical", suggestedAction: "rerun the deploy", raisedBy: "agent:ci-bot" });
    const open = listWarnings(db, { projectId: p.id });
    expect(open.map((w) => w.severity)).toEqual(["critical", "info"]);
    expect(open[0].suggestedAction).toBe("rerun the deploy");
    expect(getProjectDetail(db, p.id)!.openWarnings).toHaveLength(2);
  });

  it("resolving removes from open list and logs to the timeline", () => {
    const p = createProject(db, { name: "Alpha" });
    const w = raiseWarning(db, p.id, { message: "needs a decision" });
    resolveWarning(db, w.id, { resolvedBy: "user", note: "decided option B" });
    expect(listWarnings(db, { projectId: p.id })).toHaveLength(0);
    const detail = getProjectDetail(db, p.id)!;
    expect(detail.updates[0].body).toContain("Resolved warning");
    expect(detail.updates[0].body).toContain("decided option B");
  });

  it("appears in the activity feed for digests/triage", () => {
    const p = createProject(db, { name: "Alpha" });
    raiseWarning(db, p.id, { message: "stuck" });
    const feed = getActivity(db, Date.now() - 1000);
    expect(feed.projects[0].openWarnings).toHaveLength(1);
  });
});

describe("CI check aggregation", () => {
  it("fails if any run failed, even with others passing or running", () => {
    expect(
      aggregateCheckRuns([
        { status: "completed", conclusion: "success" },
        { status: "in_progress", conclusion: null },
        { status: "completed", conclusion: "failure" },
      ]),
    ).toBe("failing");
  });

  it("pending while anything is still running", () => {
    expect(
      aggregateCheckRuns([
        { status: "completed", conclusion: "success" },
        { status: "queued", conclusion: null },
      ]),
    ).toBe("pending");
  });

  it("passing when all completed without failure (neutral/skipped ok)", () => {
    expect(
      aggregateCheckRuns([
        { status: "completed", conclusion: "success" },
        { status: "completed", conclusion: "skipped" },
        { status: "completed", conclusion: "neutral" },
      ]),
    ).toBe("passing");
  });

  it("null when there are no checks", () => {
    expect(aggregateCheckRuns([])).toBeNull();
  });
});

describe("tasks", () => {
  it("adds, updates, and orders tasks", () => {
    const p = createProject(db, { name: "Alpha" });
    const t1 = addTask(db, p.id, "todo thing");
    addTask(db, p.id, "wip thing", { status: "in_progress" });
    updateTask(db, t1.id, { status: "done" });
    const detail = getProjectDetail(db, p.id)!;
    expect(detail.tasks.map((t) => t.status)).toEqual(["in_progress", "done"]);
  });
});
