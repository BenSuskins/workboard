import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { openStore, type Store } from "./store/store.js";
import { aggregateCheckRuns } from "./integrations/github.js";
import {
  addTaskComment,
  claimTask,
  deleteLink,
  deleteTask,
  getActivityCounts,
  getSyncHealth,
  getPost,
  getTaskDetail,
  findTaskByIdentifier,
  listAnswers,
  listComments,
  listLabels,
  listDeleted,
  listOpenQuestions,
  listQueuedTasks,
  listShelvedProjects,
  listTaskComments,
  listTaskReplies,
  listSummaryHistory,
  listTasks,
  listWarnings,
  raiseWarning,
  recordSyncResult,
  resolveWarning,
  restoreLink,
  restoreTask,
  setProjectPinned,
  setTaskAgentReady,
  setTaskLane,
  taskIdentifier,
  taskLane,
  taskReplyCounts,
} from "./services.js";
import {
  addLink,
  addTask,
  addComment,
  addPost,
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

// The suite is unchanged from the SQLite implementation apart from this handle:
// it is the contract proving the markdown store behaves like the database it replaced.
let db: Store;
beforeEach(() => {
  db = openStore(mkdtempSync(join(tmpdir(), "workboard-test-")));
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
    expect(detail.posts[0].type).toBe("status_change");
    expect(detail.posts[0].author).toBe("agent:tester");
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
    addPost(db, p.id, "shipped a thing", { type: "agent_update", author: "agent:x" });
    upsertSummary(db, p.id, "All good.");
    const feed = getActivity(db, Date.now() - 1000);
    expect(feed.projects).toHaveLength(1);
    expect(feed.projects[0].posts).toHaveLength(1);
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
    expect(detail.posts[0].body).toContain("Resolved warning");
    expect(detail.posts[0].body).toContain("decided option B");
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
    addPost(db, p.id, "today 1");
    addPost(db, p.id, "today 2");
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
    const claimUpdate = detail.posts.find((u) => u.body.includes("first"));
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

describe("posts, comments, and questions", () => {
  it("gives every post a globally unique id, not one per project", () => {
    const alpha = createProject(db, { name: "Alpha" });
    const beta = createProject(db, { name: "Beta" });
    const ids = [
      addPost(db, alpha.id, "a").id,
      addPost(db, beta.id, "b").id,
      addPost(db, alpha.id, "c").id,
      addPost(db, beta.id, "d").id,
    ];
    expect(new Set(ids).size).toBe(ids.length);
    // A post is addressable by id alone, so a collision would resolve to the wrong project.
    expect(ids.map((id) => getPost(db, id)!.projectId)).toEqual([alpha.id, beta.id, alpha.id, beta.id]);
  });

  it("keeps a long-form title alongside the body", () => {
    const project = createProject(db, { name: "Alpha" });
    const post = addPost(db, project.id, "## Where the cards stand\n\nSeven closed.", {
      title: "Wave 1 shipped",
      type: "agent_update",
      author: "agent:builder",
    });
    const stored = getProjectDetail(db, project.id)!.posts[0];
    expect([stored.title, stored.type, stored.author]).toEqual(["Wave 1 shipped", "agent_update", "agent:builder"]);
    expect(stored.body).toContain("Seven closed.");
    expect(stored.id).toBe(post.id);
  });

  it("threads comments onto a post in the order they arrive", () => {
    const project = createProject(db, { name: "Alpha" });
    const post = addPost(db, project.id, "body", { title: "T", author: "agent:builder" });
    addComment(db, post.id, "first", "user");
    addComment(db, post.id, "second", "agent:builder");
    expect(listComments(db, post.id).map((c) => [c.author, c.body])).toEqual([
      ["user", "first"],
      ["agent:builder", "second"],
    ]);
  });

  it("counts a question as open until somebody else answers it", () => {
    const project = createProject(db, { name: "Alpha" });
    const question = addPost(db, project.id, "Which database?", { type: "question", title: "Which database?", author: "agent:builder" });
    expect(listOpenQuestions(db).map((q) => q.id)).toEqual([question.id]);

    // The asker adding context does not answer their own question.
    addComment(db, question.id, "context", "agent:builder");
    expect(listOpenQuestions(db)).toHaveLength(1);

    addComment(db, question.id, "Postgres", "user");
    expect(listOpenQuestions(db)).toHaveLength(0);
    expect(getPost(db, question.id)!.answeredAt).toBeTypeOf("number");
  });

  it("excludes questions on archived projects from the open count", () => {
    const project = createProject(db, { name: "Alpha" });
    addPost(db, project.id, "?", { type: "question", author: "agent:builder" });
    updateProject(db, project.id, { status: "archived" });
    expect(listOpenQuestions(db)).toHaveLength(0);
  });

  it("returns replies to an agent's own posts, and not its own replies", () => {
    const project = createProject(db, { name: "Alpha" });
    const mine = addPost(db, project.id, "body", { title: "Mine", author: "agent:builder" });
    const theirs = addPost(db, project.id, "body", { title: "Theirs", author: "agent:other" });
    addComment(db, mine.id, "user feedback", "user");
    addComment(db, mine.id, "my own follow-up", "agent:builder");
    addComment(db, theirs.id, "not for me", "user");

    const answers = listAnswers(db, { agentName: "agent:builder" });
    expect(answers.map((a) => a.comment.body)).toEqual(["user feedback"]);
    expect(answers[0].post.id).toBe(mine.id);
    expect(answers[0].projectSlug).toBe("alpha");
  });

  it("filters answers by timestamp so an agent only sees what is new", () => {
    const project = createProject(db, { name: "Alpha" });
    const post = addPost(db, project.id, "body", { author: "agent:builder" });
    const old = addComment(db, post.id, "seen already", "user");
    const fresh = addComment(db, post.id, "new", "user");
    expect(listAnswers(db, { agentName: "agent:builder", since: old.createdAt }).map((a) => a.comment.id)).toEqual([fresh.id]);
  });
});

describe("partial updates", () => {
  it("ignores fields explicitly passed as undefined", () => {
    const project = createProject(db, { name: "Alpha", description: "keep me" });
    const task = addTask(db, project.id, "Keep this title", { description: "keep this spec" });

    updateTask(db, task.id, { title: undefined, description: undefined, status: "done" });
    const after = getTaskDetail(db, task.id)!.task;
    expect([after.title, after.description, after.status]).toEqual(["Keep this title", "keep this spec", "done"]);

    updateProject(db, project.id, { name: undefined, health: "amber" });
    expect(getProjectDetail(db, project.id)!.project).toMatchObject({ name: "Alpha", description: "keep me", health: "amber" });
  });
});

describe("pinning + shelved projects", () => {
  it("pins and unpins a project", () => {
    const p = createProject(db, { name: "Alpha" });
    expect(setProjectPinned(db, p.id, true).pinned).toBe(1);
    expect(setProjectPinned(db, p.id, false).pinned).toBe(0);
  });

  it("leads the list with pinned projects, regardless of recency", () => {
    const older = createProject(db, { name: "Older" });
    createProject(db, { name: "Newer" });
    setProjectPinned(db, older.id, true);
    expect(listProjects(db).map((p) => p.name)).toEqual(["Older", "Newer"]);
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

describe("board lanes", () => {
  it("derives a lane from the fields the queue already uses", () => {
    const p = createProject(db, { name: "Alpha" });
    expect(taskLane(addTask(db, p.id, "filed"))).toBe("backlog");
    const queued = addTask(db, p.id, "queued", { agentReady: true });
    expect(taskLane(queued)).toBe("queued");
    expect(taskLane(claimTask(db, queued.id, "agent:claude"))).toBe("moving");
    expect(taskLane(updateTask(db, queued.id, { status: "blocked" }))).toBe("blocked");
    expect(taskLane(updateTask(db, queued.id, { status: "done" }))).toBe("done");
  });

  it("does not call a claimed task queued, even while its flag is still set", () => {
    const p = createProject(db, { name: "Alpha" });
    const task = addTask(db, p.id, "work", { agentReady: true });
    const claimed = claimTask(db, task.id, "agent:claude");
    expect(claimed.agentReady).toBe(1);
    expect(taskLane(claimed)).toBe("moving");
  });

  it("queues a task moved into up-for-grabs, releasing any claim first", () => {
    const p = createProject(db, { name: "Alpha" });
    const task = addTask(db, p.id, "work", { agentReady: true });
    claimTask(db, task.id, "agent:claude");

    const requeued = setTaskLane(db, task.id, "queued");
    expect(taskLane(requeued)).toBe("queued");
    expect(requeued.claimedBy).toBeNull();
    expect(requeued.claimedAt).toBeNull();
    expect(listQueuedTasks(db).map((t) => t.id)).toEqual([task.id]);
    // The claim marker is gone, so a second agent can win it.
    expect(claimTask(db, task.id, "agent:other").claimedBy).toBe("agent:other");
  });

  it("takes a task out of the queue when moved to the backlog", () => {
    const p = createProject(db, { name: "Alpha" });
    const task = addTask(db, p.id, "work", { agentReady: true });
    const filed = setTaskLane(db, task.id, "backlog");
    expect(taskLane(filed)).toBe("backlog");
    expect(filed.agentReady).toBe(0);
    expect(listQueuedTasks(db)).toHaveLength(0);
  });

  it("keeps the claimer on a blocked task but takes it off the queue", () => {
    const p = createProject(db, { name: "Alpha" });
    const task = addTask(db, p.id, "work", { agentReady: true });
    claimTask(db, task.id, "agent:claude");

    const blocked = setTaskLane(db, task.id, "blocked");
    expect(blocked.status).toBe("blocked");
    expect(blocked.claimedBy).toBe("agent:claude");
    expect(listQueuedTasks(db)).toHaveLength(0);
    expect(() => claimTask(db, task.id, "agent:other")).toThrow();
  });

  it("survives a round trip through every lane", () => {
    const p = createProject(db, { name: "Alpha" });
    const task = addTask(db, p.id, "work");
    for (const lane of ["queued", "moving", "blocked", "done", "backlog"] as const) {
      expect(taskLane(setTaskLane(db, task.id, lane))).toBe(lane);
    }
  });
});

describe("task replies", () => {
  it("threads replies on a task, oldest first", () => {
    const p = createProject(db, { name: "Alpha" });
    const task = addTask(db, p.id, "work");
    addTaskComment(db, task.id, "picked this up", "agent:claude");
    addTaskComment(db, task.id, "thanks", "user");

    const thread = listTaskComments(db, task.id);
    expect(thread.map((c) => c.author)).toEqual(["agent:claude", "user"]);
    expect(thread.every((c) => c.postId === null && c.taskId === task.id)).toBe(true);
    expect(getTaskDetail(db, task.id)?.comments).toHaveLength(2);
  });

  it("refuses to reply on a task that does not exist", () => {
    expect(() => addTaskComment(db, 999, "hello")).toThrow(/not found/);
  });

  it("keeps task replies out of a post's thread and out of list_answers", () => {
    const p = createProject(db, { name: "Alpha" });
    const post = addPost(db, p.id, "a question", { type: "question", author: "agent:claude" });
    const task = addTask(db, p.id, "work");
    addTaskComment(db, task.id, "on the task", "user");
    addComment(db, post.id, "on the post", "user");

    expect(listComments(db, post.id).map((c) => c.body)).toEqual(["on the post"]);
    expect(listAnswers(db).map((a) => a.comment.body)).toEqual(["on the post"]);
    expect(getProjectDetail(db, p.id)?.comments.map((c) => c.body)).toEqual(["on the post"]);
  });

  it("returns replies on the tasks an agent claimed, skipping its own", () => {
    const p = createProject(db, { name: "Alpha" });
    const mine = addTask(db, p.id, "mine", { agentReady: true });
    const theirs = addTask(db, p.id, "theirs", { agentReady: true });
    claimTask(db, mine.id, "agent:claude");
    claimTask(db, theirs.id, "agent:other");

    addTaskComment(db, mine.id, "blocked on staging", "agent:claude");
    addTaskComment(db, mine.id, "seed it", "user");
    addTaskComment(db, theirs.id, "not for claude", "user");

    const replies = listTaskReplies(db, { agentName: "claude" });
    expect(replies.map((r) => r.comment.body)).toEqual(["seed it"]);
    expect(replies[0].task.id).toBe(mine.id);
    expect(replies[0].projectSlug).toBe("alpha");
    // Unfiltered, every task reply comes back.
    expect(listTaskReplies(db)).toHaveLength(3);
  });

  it("honours since, so an agent only sees what is new", () => {
    const p = createProject(db, { name: "Alpha" });
    const task = addTask(db, p.id, "work", { agentReady: true });
    claimTask(db, task.id, "agent:claude");
    const first = addTaskComment(db, task.id, "old news", "user");
    const second = addTaskComment(db, task.id, "new news", "user");

    const fresh = listTaskReplies(db, { agentName: "claude", since: first.createdAt });
    expect(fresh.map((r) => r.comment.id)).toEqual([second.id]);
  });

  it("counts a project's replies per task in one pass", () => {
    const p = createProject(db, { name: "Alpha" });
    const other = createProject(db, { name: "Beta" });
    const task = addTask(db, p.id, "work");
    const quiet = addTask(db, p.id, "quiet");
    const elsewhere = addTask(db, other.id, "elsewhere");
    addTaskComment(db, task.id, "one");
    addTaskComment(db, task.id, "two");
    addTaskComment(db, elsewhere.id, "other project");

    const counts = taskReplyCounts(db, p.id);
    expect(counts.get(task.id)).toBe(2);
    expect(counts.get(quiet.id)).toBeUndefined();
    expect(counts.get(elsewhere.id)).toBeUndefined();
  });
});

describe("blocked tasks", () => {
  it("never hands a blocked task to the queue", () => {
    const p = createProject(db, { name: "Alpha" });
    const task = addTask(db, p.id, "work", { agentReady: true });
    updateTask(db, task.id, { status: "blocked" });
    expect(listQueuedTasks(db)).toHaveLength(0);
    expect(() => claimTask(db, task.id, "agent:claude")).toThrow();
  });

  it("counts as open work, not finished work", () => {
    const p = createProject(db, { name: "Alpha" });
    updateTask(db, addTask(db, p.id, "work").id, { status: "blocked" });
    const metrics = getProjectMetrics(db, p.id);
    expect(metrics?.tasksTotal).toBe(1);
    expect(metrics?.tasksDone).toBe(0);
  });

  it("sorts blocked work above the backlog on the project page", () => {
    const p = createProject(db, { name: "Alpha" });
    addTask(db, p.id, "todo");
    const stuck = addTask(db, p.id, "stuck");
    updateTask(db, stuck.id, { status: "blocked" });
    expect(getProjectDetail(db, p.id)?.tasks.map((t) => t.title)).toEqual(["stuck", "todo"]);
  });
});

describe("issue identifiers", () => {
  it("names issues per project, from 1, and resolves the name back to the task", () => {
    const eng = createProject(db, { name: "Engineering Platform" });
    const design = createProject(db, { name: "Design System" });
    expect(eng.key).toBe("EP");
    expect(design.key).toBe("DS");

    const first = addTask(db, eng.id, "first");
    const second = addTask(db, eng.id, "second");
    const other = addTask(db, design.id, "elsewhere");

    // Numbers are per project, so a second project starts at 1 again.
    expect(taskIdentifier(eng, first)).toBe("EP-1");
    expect(taskIdentifier(eng, second)).toBe("EP-2");
    expect(taskIdentifier(design, other)).toBe("DS-1");

    expect(findTaskByIdentifier(db, "EP-2")!.task.id).toBe(second.id);
    // Case and spacing are how a person types it, not a different issue.
    expect(findTaskByIdentifier(db, " ep-2 ")!.task.id).toBe(second.id);
    expect(findTaskByIdentifier(db, "EP-99")).toBeUndefined();
    expect(findTaskByIdentifier(db, "not an identifier")).toBeUndefined();
  });

  it("keeps keys unique, so an identifier names exactly one issue", () => {
    const first = createProject(db, { name: "Design System" });
    const second = createProject(db, { name: "Data Science" });
    expect(first.key).toBe("DS");
    expect(second.key).toBe("DS2");
  });

  it("cleans a key a person typed, and keeps it unique", () => {
    createProject(db, { name: "Engineering" });
    const other = createProject(db, { name: "Something else" });
    expect(updateProject(db, other.id, { key: "  ops-1 " }).key).toBe("OPS1");
    // Colliding with the first project's key gets disambiguated rather than shadowing it.
    expect(updateProject(db, other.id, { key: "eng" }).key).toBe("ENG2");
  });

  it("keeps a deleted task's number, so restoring it restores its name", () => {
    const p = createProject(db, { name: "Alpha" });
    const task = addTask(db, p.id, "gone");
    addTask(db, p.id, "still here");
    deleteTask(db, task.id);
    expect(addTask(db, p.id, "new one").number).toBe(3);
    expect(restoreTask(db, task.id).number).toBe(1);
  });
});

describe("assignees", () => {
  it("carries an assignee through create, update, and unassign", () => {
    const p = createProject(db, { name: "Alpha" });
    const task = addTask(db, p.id, "mine", { assignee: "user" });
    expect(task.assignee).toBe("user");
    expect(updateTask(db, task.id, { assignee: null }).assignee).toBeNull();
  });

  it("a claim owns the task, and releasing it hands ownership back to nobody", () => {
    const p = createProject(db, { name: "Alpha" });
    const task = addTask(db, p.id, "queued work", { agentReady: true });
    const claimed = claimTask(db, task.id, "agent:claude");
    expect(claimed.assignee).toBe("agent:claude");

    expect(setTaskAgentReady(db, task.id, false).assignee).toBeNull();
  });

  it("leaves ownership you set yourself alone when a claim is released", () => {
    const p = createProject(db, { name: "Alpha" });
    const task = addTask(db, p.id, "yours", { agentReady: true, assignee: "user" });
    claimTask(db, task.id, "agent:claude");
    // The claim took ownership, but reverting to todo hands it back to you rather
    // than to nobody — you are still the one who asked for it.
    updateTask(db, task.id, { assignee: "user" });
    expect(updateTask(db, task.id, { status: "todo" }).assignee).toBe("user");
  });
});

describe("labels", () => {
  it("normalizes labels on the way in", () => {
    const p = createProject(db, { name: "Alpha" });
    const task = addTask(db, p.id, "tagged", { labels: ["  Bug ", "bug", "Needs   Design", ""] });
    expect(task.labels).toEqual(["bug", "needs design"]);
    expect(updateTask(db, task.id, { labels: ["INFRA"] }).labels).toEqual(["infra"]);
  });

  it("counts the labels in use, most used first", () => {
    const p = createProject(db, { name: "Alpha" });
    addTask(db, p.id, "one", { labels: ["bug"] });
    addTask(db, p.id, "two", { labels: ["bug", "infra"] });
    const deleted = addTask(db, p.id, "three", { labels: ["gone"] });
    deleteTask(db, deleted.id);
    expect(listLabels(db)).toEqual([
      { label: "bug", count: 2 },
      { label: "infra", count: 1 },
    ]);
  });
});

describe("listTasks (the issues view)", () => {
  it("spans projects and filters by lane, assignee, label, priority and text", () => {
    const alpha = createProject(db, { name: "Alpha" });
    const beta = createProject(db, { name: "Beta" });
    const mine = addTask(db, alpha.id, "fix the sync loop", {
      assignee: "user",
      labels: ["bug"],
      priority: "high",
      description: "the poller drifts",
    });
    addTask(db, alpha.id, "queued work", { agentReady: true });
    addTask(db, beta.id, "unrelated", { labels: ["infra"] });

    expect(listTasks(db).length).toBe(3);
    expect(listTasks(db, { projectId: beta.id }).map((r) => r.task.title)).toEqual(["unrelated"]);
    expect(listTasks(db, { lane: "queued" }).map((r) => r.task.title)).toEqual(["queued work"]);
    expect(listTasks(db, { assignee: "user" }).map((r) => r.task.id)).toEqual([mine.id]);
    expect(listTasks(db, { assignee: null }).length).toBe(2);
    expect(listTasks(db, { label: "bug" }).map((r) => r.task.id)).toEqual([mine.id]);
    expect(listTasks(db, { priority: "high" }).map((r) => r.task.id)).toEqual([mine.id]);
    // Search covers the spec and the identifier, not just the title.
    expect(listTasks(db, { query: "poller" }).map((r) => r.task.id)).toEqual([mine.id]);
    expect(listTasks(db, { query: "ALP-1" }).map((r) => r.task.id)).toEqual([mine.id]);
    // Filters combine rather than replace one another.
    expect(listTasks(db, { label: "bug", lane: "queued" })).toEqual([]);
  });

  it("carries the project and identifier on every row, and leaves out deleted work", () => {
    const p = createProject(db, { name: "Alpha" });
    addTask(db, p.id, "kept");
    deleteTask(db, addTask(db, p.id, "dropped").id);
    const rows = listTasks(db);
    expect(rows.map((r) => r.identifier)).toEqual(["ALP-1"]);
    expect(rows[0].project.slug).toBe("alpha");
    expect(rows[0].lane).toBe("backlog");
  });

  it("honours a limit, after ordering", () => {
    const p = createProject(db, { name: "Alpha" });
    addTask(db, p.id, "low", { priority: "low" });
    addTask(db, p.id, "high", { priority: "high" });
    expect(listTasks(db, { limit: 1 }).map((r) => r.task.title)).toEqual(["high"]);
  });
});
