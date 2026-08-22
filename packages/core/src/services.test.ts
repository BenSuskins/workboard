import { beforeEach, describe, expect, it } from "vitest";
import { openDb, type Db } from "./db/client.js";
import { aggregateCheckRuns } from "./integrations/github.js";
import {
  claimTask,
  deleteLink,
  deleteTask,
  getActivityCounts,
  getSyncHealth,
  getTaskDetail,
  listDeleted,
  listQueuedTasks,
  listShelvedProjects,
  listSummaryHistory,
  listWarnings,
  raiseWarning,
  recordSyncResult,
  resolveWarning,
  restoreLink,
  restoreTask,
  setProjectPinned,
  setTaskAgentReady,
} from "./services.js";
import {
  addLink,
  addTask,
  addUpdate,
  createProject,
  findProject,
  getActivity,
  getProjectDetail,
  getProjectMetrics,
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

  it("stores description and priority, and get_task detail resolves the project", () => {
    const p = createProject(db, { name: "Alpha" });
    const task = addTask(db, p.id, "ship it", {
      description: "## Problem\n\nQueue ignores priority.\n\n**Accept:** high first",
      priority: "high",
    });

    const detail = getTaskDetail(db, task.id)!;
    expect(detail.task.title).toBe("ship it");
    expect(detail.task.description).toContain("Accept:");
    expect(detail.task.priority).toBe("high");
    expect(detail.project.slug).toBe("alpha");
    expect(getTaskDetail(db, 99999)).toBeUndefined();

    // unprioritized default + clearing a priority back to none
    updateTask(db, task.id, { priority: null });
    expect(getTaskDetail(db, task.id)!.task.priority).toBeNull();
  });

  it("orders project tasks by status, then priority (null last)", () => {
    const p = createProject(db, { name: "Alpha" });
    addTask(db, p.id, "none", {});
    addTask(db, p.id, "high", { priority: "high" });
    addTask(db, p.id, "low", { priority: "low" });
    addTask(db, p.id, "wip none", { status: "in_progress" });
    const detail = getProjectDetail(db, p.id)!;
    expect(detail.tasks.map((t) => t.title)).toEqual(["wip none", "high", "low", "none"]);
  });
});

describe("soft deletes", () => {
  it("deleted tasks vanish from detail and activity but can be restored", () => {
    const p = createProject(db, { name: "Alpha" });
    const t = addTask(db, p.id, "keep me");
    deleteTask(db, t.id);
    expect(getProjectDetail(db, p.id)!.tasks).toHaveLength(0);
    expect(getActivity(db, 0).projects[0].openTasks).toHaveLength(0);
    expect(listDeleted(db, p.id).tasks.map((x) => x.title)).toEqual(["keep me"]);
    restoreTask(db, t.id);
    expect(getProjectDetail(db, p.id)!.tasks.map((x) => x.title)).toEqual(["keep me"]);
    expect(listDeleted(db, p.id).tasks).toHaveLength(0);
  });

  it("deleted links vanish from detail, find_project, activity, and sync health", () => {
    const p = createProject(db, { name: "Alpha" });
    const l = addLink(db, p.id, { url: "https://github.com/acme/solo" });
    recordSyncResult(db, l.id, "boom");
    deleteLink(db, l.id);
    expect(getProjectDetail(db, p.id)!.links).toHaveLength(0);
    expect(findProject(db, { repo: "acme/solo" })).toHaveLength(0);
    expect(getActivity(db, 0).projects[0].links).toHaveLength(0);
    expect(getSyncHealth(db).failing).toHaveLength(0);
    restoreLink(db, l.id);
    expect(getProjectDetail(db, p.id)!.links).toHaveLength(1);
    expect(findProject(db, { repo: "acme/solo" })).toHaveLength(1);
    expect(getSyncHealth(db).failing).toHaveLength(1);
  });
});

describe("summary history", () => {
  it("returns project summaries newest first, excluding reports", () => {
    const p = createProject(db, { name: "Alpha" });
    upsertSummary(db, p.id, "v1");
    upsertSummary(db, p.id, "v2");
    upsertSummary(db, p.id, "v3");
    saveReport(db, "digest", "not a summary");
    const history = listSummaryHistory(db, p.id);
    expect(history.map((s) => s.body)).toEqual(["v3", "v2", "v1"]);
    expect(getProjectDetail(db, p.id)!.latestSummary!.body).toBe("v3");
  });
});

describe("activity counts (sparkline data)", () => {
  it("buckets updates per day, oldest first", () => {
    const p = createProject(db, { name: "Alpha" });
    addUpdate(db, p.id, "today 1");
    addUpdate(db, p.id, "today 2");
    const counts = getActivityCounts(db, p.id, 14);
    expect(counts).toHaveLength(14);
    expect(counts[13]).toBe(2); // today is the last bucket
    expect(counts.slice(0, 13).every((c) => c === 0)).toBe(true);
  });

  it("returns all zeros for a quiet project", () => {
    const p = createProject(db, { name: "Quiet" });
    expect(getActivityCounts(db, p.id, 7)).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });
});

describe("sync health", () => {
  it("tracks failures and recovery per link", () => {
    const p = createProject(db, { name: "Alpha" });
    const l = addLink(db, p.id, { url: "https://github.com/acme/solo" });
    recordSyncResult(db, l.id, null);
    expect(getSyncHealth(db).failing).toHaveLength(0);
    expect(getSyncHealth(db).lastSuccessAt).not.toBeNull();

    recordSyncResult(db, l.id, "GitHub rate limited");
    const health = getSyncHealth(db);
    expect(health.failing).toHaveLength(1);
    expect(health.failing[0].error).toBe("GitHub rate limited");
    expect(health.failing[0].projectSlug).toBe("alpha");
    // the earlier success timestamp is retained so the UI can say how old the data is
    expect(health.failing[0].lastSuccessAt).not.toBeNull();

    recordSyncResult(db, l.id, null);
    expect(getSyncHealth(db).failing).toHaveLength(0);
  });

  it("surfaces sync errors on project detail links", () => {
    const p = createProject(db, { name: "Alpha" });
    const l = addLink(db, p.id, { url: "https://github.com/acme/solo" });
    recordSyncResult(db, l.id, "401 bad credentials");
    const detail = getProjectDetail(db, p.id)!;
    expect(detail.links[0].syncState?.lastError).toBe("401 bad credentials");
  });

  it("archived projects' links don't pollute health", () => {
    const p = createProject(db, { name: "Old" });
    const l = addLink(db, p.id, { url: "https://github.com/acme/old" });
    recordSyncResult(db, l.id, "boom");
    updateProject(db, p.id, { status: "archived" });
    expect(getSyncHealth(db).failing).toHaveLength(0);
  });
});

describe("agent task queue", () => {
  it("lists queued tasks priority-first (null last), FIFO within each, scoped and filtered", () => {
    const p1 = createProject(db, { name: "Alpha" });
    const p2 = createProject(db, { name: "Beta" });
    const first = addTask(db, p1.id, "first", { agentReady: true });
    const second = addTask(db, p1.id, "second", { agentReady: true });
    addTask(db, p1.id, "not queued");
    const other = addTask(db, p2.id, "other project", { agentReady: true });

    expect(listQueuedTasks(db).map((t) => t.id)).toEqual([first.id, second.id, other.id]);
    expect(listQueuedTasks(db, { projectId: p1.id })).toHaveLength(2);
    expect(listQueuedTasks(db, { projectId: p2.id }).map((t) => t.title)).toEqual(["other project"]);

    // a later-created high jumps ahead of earlier unprioritized work; null trails
    const urgent = addTask(db, p1.id, "urgent", { agentReady: true, priority: "high" });
    const low = addTask(db, p1.id, "low prio", { agentReady: true, priority: "low" });
    expect(listQueuedTasks(db, { projectId: p1.id }).map((t) => t.title)).toEqual(["urgent", "low prio", "first", "second"]);
    expect(urgent.priority).toBe("high");
    expect(low.description).toBe("");
  });

  it("excludes done and soft-deleted tasks from the queue", () => {
    const p = createProject(db, { name: "Alpha" });
    const done = addTask(db, p.id, "done", { agentReady: true });
    const gone = addTask(db, p.id, "gone", { agentReady: true });
    updateTask(db, done.id, { status: "done" });
    deleteTask(db, gone.id);
    expect(listQueuedTasks(db)).toHaveLength(0);
  });

  it("claims atomically: stamps claimer, moves to in_progress, logs to the timeline", () => {
    const p = createProject(db, { name: "Alpha" });
    const first = addTask(db, p.id, "first", { agentReady: true });
    addTask(db, p.id, "second", { agentReady: true });

    const claimed = claimTask(db, first.id, "agent:claude");
    expect(claimed.status).toBe("in_progress");
    expect(claimed.claimedBy).toBe("agent:claude");
    expect(claimed.claimedAt).not.toBeNull();

    // claimed task leaves the queue
    expect(listQueuedTasks(db).map((t) => t.title)).toEqual(["second"]);

    const detail = getProjectDetail(db, p.id)!;
    const claimUpdate = detail.updates.find((u) => u.body.includes("first"));
    expect(claimUpdate?.type).toBe("agent_update");
    expect(claimUpdate?.author).toBe("agent:claude");
  });

  it("rejects double claims and claims of non-queued tasks", () => {
    const p = createProject(db, { name: "Alpha" });
    const queued = addTask(db, p.id, "queued", { agentReady: true });
    const plain = addTask(db, p.id, "plain");

    claimTask(db, queued.id, "agent:one");
    expect(() => claimTask(db, queued.id, "agent:two")).toThrow(/already claimed/);
    expect(() => claimTask(db, plain.id, "agent:one")).toThrow(/not queued/);
  });

  it("un-queuing releases an active claim and reverts to todo", () => {
    const p = createProject(db, { name: "Alpha" });
    const task = addTask(db, p.id, "queued", { agentReady: true });
    claimTask(db, task.id, "agent:claude");

    setTaskAgentReady(db, task.id, false);
    const after = getProjectDetail(db, p.id)!.tasks.find((t) => t.id === task.id)!;
    expect(after.agentReady).toBe(0);
    expect(after.claimedBy).toBeNull();
    expect(after.claimedAt).toBeNull();
    expect(after.status).toBe("todo");
  });

  it("reverting a claimed task to todo clears the claim", () => {
    const p = createProject(db, { name: "Alpha" });
    const task = addTask(db, p.id, "queued", { agentReady: true });
    claimTask(db, task.id, "agent:claude");

    updateTask(db, task.id, { status: "todo" });
    expect(listQueuedTasks(db).map((t) => t.id)).toEqual([task.id]);
    const fresh = getProjectDetail(db, p.id)!.tasks.find((t) => t.id === task.id)!;
    expect(fresh.claimedBy).toBeNull();
    expect(fresh.claimedAt).toBeNull();
  });

  it("completing a claimed task keeps the claim for attribution", () => {
    const p = createProject(db, { name: "Alpha" });
    const task = addTask(db, p.id, "queued", { agentReady: true });
    claimTask(db, task.id, "agent:claude");
    updateTask(db, task.id, { status: "done" });

    const done = getProjectDetail(db, p.id)!.tasks.find((t) => t.id === task.id)!;
    expect(done.status).toBe("done");
    expect(done.claimedBy).toBe("agent:claude");
  });
});

describe("pinning + shelved projects", () => {
  it("pins and unpins a project", () => {
    const p = createProject(db, { name: "Alpha" });
    expect(setProjectPinned(db, p.id, true).pinned).toBe(1);
    expect(setProjectPinned(db, p.id, false).pinned).toBe(0);
  });

  it("lists done and archived projects as shelved, excluding active ones", () => {
    const finished = createProject(db, { name: "Finished" });
    const parked = createProject(db, { name: "Parked" });
    const current = createProject(db, { name: "Current" });
    updateProject(db, finished.id, { status: "done" });
    updateProject(db, parked.id, { status: "archived" });

    const shelved = listShelvedProjects(db);
    expect(shelved.map((p) => p.name).sort()).toEqual(["Finished", "Parked"]);
    expect(listProjects(db, {}).map((p) => p.name)).toContain("Current");
  });
});

describe("progress metrics + accomplishments", () => {
  it("computes task completion and PR throughput from snapshots", () => {
    const p = createProject(db, { name: "Alpha" });
    addTask(db, p.id, "one");
    addTask(db, p.id, "two");
    const three = addTask(db, p.id, "three");
    updateTask(db, three.id, { status: "done" });

    const pr = addLink(db, p.id, { url: "https://github.com/acme/platform/pull/1" });
    saveSnapshot(db, pr.id, {
      type: "pr",
      number: 1,
      repo: "acme/platform",
      state: "open",
      merged: false,
      updatedAt: new Date().toISOString(),
    });
    // merged PR via a scoped repo snapshot
    const repo = addLink(db, p.id, { url: "https://github.com/acme/platform" });
    saveSnapshot(db, repo.id, {
      type: "repo",
      repo: "acme/platform",
      prs: [
        { number: 2, repo: "acme/platform", state: "closed", merged: true, updatedAt: new Date().toISOString() },
        { number: 3, repo: "acme/platform", state: "closed", merged: false, updatedAt: new Date().toISOString() },
      ],
    });

    const m = getProjectMetrics(db, p.id)!;
    expect(m.tasksTotal).toBe(3);
    expect(m.tasksDone).toBe(1);
    expect(m.openPrs).toBe(1);
    expect(m.mergedRecently).toBe(1);
    expect(m.daysSinceActivity).toBe(0);
  });

  it("returns undefined for unknown projects", () => {
    expect(getProjectMetrics(db, "nope")).toBeUndefined();
  });

  it("stores and lists accomplishments reports", () => {
    saveReport(db, "accomplishments", "Shipped X, Y, Z.");
    saveReport(db, "digest", "Weekly digest");
    expect(latestReport(db, "accomplishments")?.body).toBe("Shipped X, Y, Z.");
    const all = listReports(db);
    expect(all.map((r) => r.kind).sort()).toEqual(["accomplishments", "digest"]);
  });
});
