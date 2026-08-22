import { and, desc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import type { Db } from "./db/client.js";
import {
  links,
  projects,
  snapshots,
  summaries,
  tasks,
  updates,
  type Link,
  type LinkKind,
  type LinkProvider,
  type Project,
  type ProjectHealth,
  type ProjectPriority,
  type ProjectStatus,
  type RepoScope,
  type Snapshot,
  type Summary,
  type SummaryKind,
  syncState,
  type SyncState,
  type Task,
  type TaskPriority,
  type TaskStatus,
  type Update,
  type UpdateType,
  type Warning,
  type WarningSeverity,
  warnings,
} from "./db/schema.js";

const now = () => Date.now();

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "project";
}

// ---------- projects ----------

export interface CreateProjectInput {
  name: string;
  description?: string;
  category?: string;
  status?: ProjectStatus;
  priority?: ProjectPriority;
  health?: ProjectHealth;
}

export function createProject(db: Db, input: CreateProjectInput): Project {
  const t = now();
  let slug = slugify(input.name);
  const taken = db.select({ slug: projects.slug }).from(projects).all();
  const takenSet = new Set(taken.map((r) => r.slug));
  if (takenSet.has(slug)) {
    let i = 2;
    while (takenSet.has(`${slug}-${i}`)) i++;
    slug = `${slug}-${i}`;
  }
  return db
    .insert(projects)
    .values({
      slug,
      name: input.name,
      description: input.description ?? "",
      category: input.category ?? "coding",
      status: input.status ?? "active",
      priority: input.priority ?? "medium",
      health: input.health ?? "green",
      createdAt: t,
      updatedAt: t,
      lastActivityAt: t,
    })
    .returning()
    .get();
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  category?: string;
  status?: ProjectStatus;
  priority?: ProjectPriority;
  health?: ProjectHealth;
}

export function updateProject(db: Db, id: number, input: UpdateProjectInput, author = "user"): Project {
  const existing = db.select().from(projects).where(eq(projects.id, id)).get();
  if (!existing) throw new Error(`Project ${id} not found`);
  const t = now();
  const updated = db
    .update(projects)
    .set({ ...input, updatedAt: t, lastActivityAt: t })
    .where(eq(projects.id, id))
    .returning()
    .get();
  if (input.status && input.status !== existing.status) {
    db.insert(updates)
      .values({
        projectId: id,
        type: "status_change",
        body: `Status changed from **${existing.status}** to **${input.status}**`,
        author,
        createdAt: t,
      })
      .run();
  }
  return updated;
}

export interface ListProjectsFilter {
  status?: ProjectStatus | ProjectStatus[];
  category?: string;
  health?: ProjectHealth;
  includeArchived?: boolean;
}

export function listProjects(db: Db, filter: ListProjectsFilter = {}): Project[] {
  const conds = [];
  if (filter.status) {
    const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
    conds.push(inArray(projects.status, statuses));
  } else if (!filter.includeArchived) {
    conds.push(sql`${projects.status} != 'archived'`);
  }
  if (filter.category) conds.push(eq(projects.category, filter.category));
  if (filter.health) conds.push(eq(projects.health, filter.health));
  return db
    .select()
    .from(projects)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(projects.lastActivityAt))
    .all();
}

export function getProject(db: Db, ref: number | string): Project | undefined {
  if (typeof ref === "number") {
    return db.select().from(projects).where(eq(projects.id, ref)).get();
  }
  return db.select().from(projects).where(eq(projects.slug, ref)).get();
}

/** Star a project so its card leads the board. */
export function setProjectPinned(db: Db, id: number, pinned: boolean): Project {
  const updated = db
    .update(projects)
    .set({ pinned: pinned ? 1 : 0, updatedAt: now() })
    .where(eq(projects.id, id))
    .returning()
    .get();
  if (!updated) throw new Error(`Project ${id} not found`);
  return updated;
}

/** Projects resting off the main board: finished (done) and archived. */
export function listShelvedProjects(db: Db): Project[] {
  return db
    .select()
    .from(projects)
    .where(inArray(projects.status, ["done", "archived"]))
    .orderBy(desc(projects.lastActivityAt))
    .all();
}

export interface LinkWithStatus extends Link {
  snapshot: Snapshot | null;
  syncState: SyncState | null;
}

export interface ProjectDetail {
  project: Project;
  tasks: Task[];
  updates: Update[];
  links: LinkWithStatus[];
  latestSummary: Summary | null;
  openWarnings: Warning[];
}

export function getProjectDetail(db: Db, ref: number | string, opts: { updatesLimit?: number } = {}): ProjectDetail | undefined {
  const project = getProject(db, ref);
  if (!project) return undefined;
  const projectTasks = db
    .select()
    .from(tasks)
    .where(and(eq(tasks.projectId, project.id), isNull(tasks.deletedAt)))
    .orderBy(
      sql`CASE ${tasks.status} WHEN 'in_progress' THEN 0 WHEN 'todo' THEN 1 ELSE 2 END`,
      TASK_PRIORITY_RANK,
      desc(tasks.updatedAt),
    )
    .all();
  const projectUpdates = db
    .select()
    .from(updates)
    .where(eq(updates.projectId, project.id))
    .orderBy(desc(updates.createdAt))
    .limit(opts.updatesLimit ?? 50)
    .all();
  const projectLinks = db
    .select()
    .from(links)
    .leftJoin(snapshots, eq(snapshots.linkId, links.id))
    .leftJoin(syncState, eq(syncState.linkId, links.id))
    .where(and(eq(links.projectId, project.id), isNull(links.deletedAt)))
    .all()
    .map((row) => ({ ...row.links, snapshot: row.snapshots, syncState: row.sync_state }));
  const latestSummary =
    db
      .select()
      .from(summaries)
      .where(and(eq(summaries.projectId, project.id), eq(summaries.kind, "project_summary")))
      .orderBy(desc(summaries.createdAt), desc(summaries.id))
      .limit(1)
      .get() ?? null;
  const openWarnings = listWarnings(db, { projectId: project.id });
  return { project, tasks: projectTasks, updates: projectUpdates, links: projectLinks, latestSummary, openWarnings };
}

function touchProject(db: Db, projectId: number) {
  db.update(projects).set({ lastActivityAt: now() }).where(eq(projects.id, projectId)).run();
}

// ---------- tasks ----------

export interface AddTaskOptions {
  description?: string;
  priority?: TaskPriority | null;
  dueDate?: string;
  author?: string;
  status?: TaskStatus;
  agentReady?: boolean;
}

export function addTask(db: Db, projectId: number, title: string, opts: AddTaskOptions = {}): Task {
  const t = now();
  const task = db
    .insert(tasks)
    .values({
      projectId,
      title,
      description: opts.description ?? "",
      priority: opts.priority ?? null,
      status: opts.status ?? "todo",
      dueDate: opts.dueDate ?? null,
      author: opts.author ?? "user",
      agentReady: opts.agentReady ? 1 : 0,
      createdAt: t,
      updatedAt: t,
    })
    .returning()
    .get();
  touchProject(db, projectId);
  return task;
}

/** Unprioritized tasks sort after prioritized ones in the queue and on the board. */
const TASK_PRIORITY_RANK = sql`CASE ${tasks.priority} WHEN 'high' THEN 0 WHEN 'medium' THEN 1 WHEN 'low' THEN 2 ELSE 3 END`;

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority | null;
  dueDate?: string | null;
}

export function updateTask(db: Db, id: number, input: UpdateTaskInput): Task {
  // Reverting a claimed task to todo releases the claim so it can be queued again;
  // completing it keeps claimedBy for attribution.
  const patch = { ...input, ...(input.status === "todo" ? { claimedBy: null, claimedAt: null } : {}), updatedAt: now() };
  const task = db
    .update(tasks)
    .set(patch)
    .where(eq(tasks.id, id))
    .returning()
    .get();
  if (!task) throw new Error(`Task ${id} not found`);
  touchProject(db, task.projectId);
  return task;
}

/** Soft delete: the row is kept and can be restored from the project's "recently deleted" list. */
export function deleteTask(db: Db, id: number): void {
  db.update(tasks).set({ deletedAt: now() }).where(eq(tasks.id, id)).run();
}

export function restoreTask(db: Db, id: number): Task {
  const task = db.update(tasks).set({ deletedAt: null, updatedAt: now() }).where(eq(tasks.id, id)).returning().get();
  if (!task) throw new Error(`Task ${id} not found`);
  touchProject(db, task.projectId);
  return task;
}

// ---------- agent task queue (shared pull queue — no named assignees) ----------

/** Queue or un-queue a task. Un-queuing releases an active claim and reverts in_progress to todo. */
export function setTaskAgentReady(db: Db, id: number, ready: boolean): Task {
  const existing = db.select().from(tasks).where(eq(tasks.id, id)).get();
  if (!existing) throw new Error(`Task ${id} not found`);
  const release = !ready && existing.claimedBy ? { claimedBy: null, claimedAt: null } : {};
  const revert = !ready && existing.status === "in_progress" ? { status: "todo" as TaskStatus } : {};
  const task = db
    .update(tasks)
    .set({ agentReady: ready ? 1 : 0, ...release, ...revert, updatedAt: now() })
    .where(eq(tasks.id, id))
    .returning()
    .get();
  touchProject(db, task.projectId);
  return task;
}

/** Tasks waiting for an agent: queued, still todo, unclaimed, not deleted. Priority first (null last), FIFO within each. */
export function listQueuedTasks(db: Db, opts: { projectId?: number } = {}): Task[] {
  const conds = [eq(tasks.agentReady, 1), eq(tasks.status, "todo"), isNull(tasks.claimedAt), isNull(tasks.deletedAt)];
  if (opts.projectId !== undefined) conds.push(eq(tasks.projectId, opts.projectId));
  return db
    .select()
    .from(tasks)
    .where(and(...conds))
    .orderBy(TASK_PRIORITY_RANK, tasks.createdAt, tasks.id)
    .all();
}

/** One task plus its project — the task detail page's data. */
export function getTaskDetail(db: Db, id: number): { task: Task; project: Project } | undefined {
  const task = db.select().from(tasks).where(eq(tasks.id, id)).get();
  if (!task) return undefined;
  const project = db.select().from(projects).where(eq(projects.id, task.projectId)).get();
  if (!project) return undefined;
  return { task, project };
}

/**
 * Atomically claim a queued task: only wins when the task is still unclaimed.
 * Logs an agent_update so the timeline shows who picked the work up.
 */
export function claimTask(db: Db, id: number, claimedBy: string): Task {
  const claimed = db
    .update(tasks)
    .set({ status: "in_progress", claimedBy, claimedAt: now(), updatedAt: now() })
    .where(and(eq(tasks.id, id), eq(tasks.agentReady, 1), eq(tasks.status, "todo"), isNull(tasks.claimedAt), isNull(tasks.deletedAt)))
    .returning()
    .get();
  if (!claimed) {
    const existing = db.select().from(tasks).where(eq(tasks.id, id)).get();
    if (!existing || existing.deletedAt) throw new Error(`Task ${id} not found`);
    if (!existing.agentReady) throw new Error(`Task ${id} is not queued for agents`);
    throw new Error(`Task ${id} is already claimed by ${existing.claimedBy ?? "someone else"}`);
  }
  db.insert(updates)
    .values({
      projectId: claimed.projectId,
      type: "agent_update",
      body: `Claimed task **${claimed.title}**`,
      author: claimedBy,
      createdAt: now(),
    })
    .run();
  touchProject(db, claimed.projectId);
  return claimed;
}

// ---------- updates (activity) ----------

export function addUpdate(db: Db, projectId: number, body: string, opts: { type?: UpdateType; author?: string } = {}): Update {
  const update = db
    .insert(updates)
    .values({
      projectId,
      type: opts.type ?? "note",
      body,
      author: opts.author ?? "user",
      createdAt: now(),
    })
    .returning()
    .get();
  touchProject(db, projectId);
  return update;
}

// ---------- summaries & reports ----------

export function upsertSummary(db: Db, projectId: number, body: string, generatedBy = "agent"): Summary {
  const summary = db
    .insert(summaries)
    .values({ projectId, kind: "project_summary", body, generatedBy, createdAt: now() })
    .returning()
    .get();
  touchProject(db, projectId);
  return summary;
}

/** Past AI summaries for a project, newest first (every upsert_summary keeps history). */
export function listSummaryHistory(db: Db, projectId: number, limit = 20): Summary[] {
  return db
    .select()
    .from(summaries)
    .where(and(eq(summaries.projectId, projectId), eq(summaries.kind, "project_summary")))
    .orderBy(desc(summaries.createdAt), desc(summaries.id))
    .limit(limit)
    .all();
}

export function saveReport(db: Db, kind: "digest" | "triage" | "accomplishments", body: string, generatedBy = "agent"): Summary {
  return db.insert(summaries).values({ projectId: null, kind, body, generatedBy, createdAt: now() }).returning().get();
}

export function listReports(db: Db, kind?: "digest" | "triage" | "accomplishments", limit = 50): Summary[] {
  const cond = kind
    ? and(isNull(summaries.projectId), eq(summaries.kind, kind))
    : and(isNull(summaries.projectId), inArray(summaries.kind, ["digest", "triage", "accomplishments"]));
  return db.select().from(summaries).where(cond).orderBy(desc(summaries.createdAt)).limit(limit).all();
}

export function latestReport(db: Db, kind: "digest" | "triage" | "accomplishments"): Summary | undefined {
  return listReports(db, kind, 1)[0];
}

// ---------- links ----------

export interface AddLinkInput {
  provider: LinkProvider;
  kind: LinkKind;
  url: string;
  externalId?: string;
  title?: string;
  scope?: RepoScope;
}

const GITHUB_URL = /github\.com\/([^/]+\/[^/#?]+)(?:\/(pull|issues)\/(\d+))?/;

/** Fill provider/kind/externalId from a bare URL when the caller didn't specify them. */
export function inferLink(url: string): Pick<AddLinkInput, "provider" | "kind" | "externalId"> {
  const gh = url.match(GITHUB_URL);
  if (gh) {
    const repo = gh[1].replace(/\.git$/, "");
    if (gh[2] === "pull") return { provider: "github", kind: "pr", externalId: `${repo}#${gh[3]}` };
    if (gh[2] === "issues") return { provider: "github", kind: "issue", externalId: `${repo}#${gh[3]}` };
    return { provider: "github", kind: "repo", externalId: repo };
  }
  if (/atlassian\.net\/browse\/([A-Z][A-Z0-9]+-\d+)/.test(url)) {
    return { provider: "jira", kind: "jira_issue", externalId: url.match(/browse\/([A-Z][A-Z0-9]+-\d+)/)![1] };
  }
  if (/atlassian\.net\/.*projects?\/([A-Z][A-Z0-9]+)/.test(url)) {
    return { provider: "jira", kind: "jira_project", externalId: url.match(/projects?\/([A-Z][A-Z0-9]+)/)![1] };
  }
  const gdoc = url.match(/(?:docs|drive)\.google\.com\/(?:document|spreadsheets|presentation|file)\/d\/([\w-]+)/);
  if (gdoc) return { provider: "gdoc", kind: "doc", externalId: gdoc[1] };
  return { provider: "url", kind: "url" };
}

export function addLink(db: Db, projectId: number, input: Partial<AddLinkInput> & { url: string }): Link {
  const inferred = inferLink(input.url);
  const link = db
    .insert(links)
    .values({
      projectId,
      provider: input.provider ?? inferred.provider,
      kind: input.kind ?? inferred.kind,
      url: input.url,
      externalId: input.externalId ?? inferred.externalId ?? null,
      title: input.title ?? "",
      scope: input.scope ?? null,
      createdAt: now(),
    })
    .returning()
    .get();
  touchProject(db, projectId);
  return link;
}

/** Soft delete: snapshots and sync state are kept; the link is hidden and syncs stop. */
export function deleteLink(db: Db, id: number): void {
  db.update(links).set({ deletedAt: now() }).where(eq(links.id, id)).run();
}

export function restoreLink(db: Db, id: number): Link {
  const link = db.update(links).set({ deletedAt: null }).where(eq(links.id, id)).returning().get();
  if (!link) throw new Error(`Link ${id} not found`);
  touchProject(db, link.projectId);
  return link;
}

export interface DeletedItems {
  tasks: Task[];
  links: Link[];
}

export function listDeleted(db: Db, projectId: number): DeletedItems {
  return {
    tasks: db
      .select()
      .from(tasks)
      .where(and(eq(tasks.projectId, projectId), sql`${tasks.deletedAt} IS NOT NULL`))
      .orderBy(desc(tasks.deletedAt))
      .all(),
    links: db
      .select()
      .from(links)
      .where(and(eq(links.projectId, projectId), sql`${links.deletedAt} IS NOT NULL`))
      .orderBy(desc(links.deletedAt))
      .all(),
  };
}

export function saveSnapshot(db: Db, linkId: number, data: unknown): void {
  db.insert(snapshots)
    .values({ linkId, data, fetchedAt: now() })
    .onConflictDoUpdate({ target: snapshots.linkId, set: { data, fetchedAt: now() } })
    .run();
}

// ---------- sync health ----------

export function recordSyncResult(db: Db, linkId: number, error: string | null): void {
  const t = now();
  db.insert(syncState)
    .values({ linkId, lastAttemptAt: t, lastSuccessAt: error ? null : t, lastError: error })
    .onConflictDoUpdate({
      target: syncState.linkId,
      set: error ? { lastAttemptAt: t, lastError: error } : { lastAttemptAt: t, lastSuccessAt: t, lastError: null },
    })
    .run();
}

export interface FailingSync {
  linkId: number;
  url: string;
  title: string;
  provider: LinkProvider;
  projectSlug: string;
  projectName: string;
  error: string;
  lastAttemptAt: number;
  lastSuccessAt: number | null;
}

export interface SyncHealth {
  failing: FailingSync[];
  /** Most recent successful sync across all live links; null if nothing has ever synced. */
  lastSuccessAt: number | null;
}

export function getSyncHealth(db: Db): SyncHealth {
  const rows = db
    .select()
    .from(syncState)
    .innerJoin(links, eq(syncState.linkId, links.id))
    .innerJoin(projects, eq(links.projectId, projects.id))
    .where(and(isNull(links.deletedAt), sql`${projects.status} != 'archived'`))
    .all();
  const failing: FailingSync[] = [];
  let lastSuccessAt: number | null = null;
  for (const row of rows) {
    if (row.sync_state.lastSuccessAt && (!lastSuccessAt || row.sync_state.lastSuccessAt > lastSuccessAt)) {
      lastSuccessAt = row.sync_state.lastSuccessAt;
    }
    if (row.sync_state.lastError) {
      failing.push({
        linkId: row.links.id,
        url: row.links.url,
        title: row.links.title,
        provider: row.links.provider,
        projectSlug: row.projects.slug,
        projectName: row.projects.name,
        error: row.sync_state.lastError,
        lastAttemptAt: row.sync_state.lastAttemptAt,
        lastSuccessAt: row.sync_state.lastSuccessAt,
      });
    }
  }
  failing.sort((a, b) => b.lastAttemptAt - a.lastAttemptAt);
  return { failing, lastSuccessAt };
}

// ---------- warnings ----------

export interface RaiseWarningInput {
  severity?: WarningSeverity;
  message: string;
  suggestedAction?: string;
  raisedBy?: string;
}

export function raiseWarning(db: Db, projectId: number, input: RaiseWarningInput): Warning {
  const warning = db
    .insert(warnings)
    .values({
      projectId,
      severity: input.severity ?? "warning",
      message: input.message,
      suggestedAction: input.suggestedAction ?? null,
      raisedBy: input.raisedBy ?? "agent",
      status: "open",
      createdAt: now(),
    })
    .returning()
    .get();
  touchProject(db, projectId);
  return warning;
}

export function resolveWarning(db: Db, id: number, opts: { resolvedBy?: string; note?: string } = {}): Warning {
  const existing = db.select().from(warnings).where(eq(warnings.id, id)).get();
  if (!existing) throw new Error(`Warning ${id} not found`);
  const resolved = db
    .update(warnings)
    .set({ status: "resolved", resolvedAt: now() })
    .where(eq(warnings.id, id))
    .returning()
    .get();
  db.insert(updates)
    .values({
      projectId: existing.projectId,
      type: "note",
      body: `Resolved warning: ${existing.message}${opts.note ? ` — ${opts.note}` : ""}`,
      author: opts.resolvedBy ?? "user",
      createdAt: now(),
    })
    .run();
  return resolved;
}

/** Open warnings, most severe first. Pass projectId to scope to one project. */
export function listWarnings(db: Db, opts: { projectId?: number } = {}): Warning[] {
  const conds = [eq(warnings.status, "open")];
  if (opts.projectId !== undefined) conds.push(eq(warnings.projectId, opts.projectId));
  return db
    .select()
    .from(warnings)
    .where(and(...conds))
    .orderBy(
      sql`CASE ${warnings.severity} WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END`,
      desc(warnings.createdAt),
    )
    .all();
}

// ---------- find_project: resolve monorepo work to a project ----------

export interface FindProjectQuery {
  repo?: string; // owner/name
  prNumber?: number;
  branch?: string;
  paths?: string[];
  labels?: string[];
}

export interface ProjectMatch {
  project: Project;
  confidence: "exact" | "scoped" | "repo";
  reason: string;
}

/**
 * A repo hosts many projects, so resolution is layered:
 * exact PR/issue link > repo-link scope match (branch prefix, path prefix, label) > bare repo link.
 */
export function findProject(db: Db, query: FindProjectQuery): ProjectMatch[] {
  const matches: ProjectMatch[] = [];
  const seen = new Set<number>();
  const allLinks = db
    .select()
    .from(links)
    .innerJoin(projects, eq(links.projectId, projects.id))
    .where(and(isNull(links.deletedAt), sql`${projects.status} != 'archived'`))
    .all();

  const push = (project: Project, confidence: ProjectMatch["confidence"], reason: string) => {
    if (seen.has(project.id)) return;
    seen.add(project.id);
    matches.push({ project, confidence, reason });
  };

  if (query.repo && query.prNumber) {
    const id = `${query.repo}#${query.prNumber}`;
    for (const row of allLinks) {
      if (row.links.externalId === id) push(row.projects, "exact", `linked to ${id}`);
    }
  }

  if (query.repo) {
    for (const row of allLinks) {
      if (row.links.kind !== "repo" || row.links.externalId !== query.repo) continue;
      const scope = row.links.scope;
      if (scope) {
        if (query.branch && scope.branchPrefix && query.branch.startsWith(scope.branchPrefix)) {
          push(row.projects, "scoped", `branch matches prefix "${scope.branchPrefix}"`);
          continue;
        }
        if (query.paths?.length && scope.pathPrefixes?.length) {
          const prefix = scope.pathPrefixes.find((p) => query.paths!.some((path) => path.startsWith(p)));
          if (prefix) {
            push(row.projects, "scoped", `changed paths match prefix "${prefix}"`);
            continue;
          }
        }
        if (query.labels?.length && scope.labels?.length) {
          const label = scope.labels.find((l) => query.labels!.includes(l));
          if (label) {
            push(row.projects, "scoped", `label "${label}" matches scope`);
            continue;
          }
        }
      }
    }
    // Repo-level fallback, only when nothing better matched. Unscoped repo links
    // always qualify; scoped links qualify only when the query carried no
    // discriminators — if a branch/path/label was given and didn't match the
    // scope, that project is not a candidate.
    if (matches.length === 0) {
      const hadDiscriminators = Boolean(query.branch || query.paths?.length || query.labels?.length);
      for (const row of allLinks) {
        if (row.links.kind !== "repo" || row.links.externalId !== query.repo) continue;
        if (!row.links.scope) {
          push(row.projects, "repo", `project links repo ${query.repo} (unscoped)`);
        } else if (!hadDiscriminators) {
          push(row.projects, "repo", `project links repo ${query.repo} (scoped; pass branch/paths/labels to narrow)`);
        }
      }
    }
  }

  const rank = { exact: 0, scoped: 1, repo: 2 } as const;
  return matches.sort((a, b) => rank[a.confidence] - rank[b.confidence]);
}

/**
 * Updates-per-day buckets for the last `days` days, oldest first —
 * sparkline data for project cards. Buckets are local-midnight aligned.
 */
export function getActivityCounts(db: Db, projectId: number, days = 14): number[] {
  const end = new Date();
  end.setHours(24, 0, 0, 0); // end of today
  const startMs = end.getTime() - days * 24 * 60 * 60 * 1000;
  const rows = db
    .select({ createdAt: updates.createdAt })
    .from(updates)
    .where(and(eq(updates.projectId, projectId), gt(updates.createdAt, startMs)))
    .all();
  const counts = new Array<number>(days).fill(0);
  const dayMs = 24 * 60 * 60 * 1000;
  for (const row of rows) {
    const bucket = Math.floor((row.createdAt - startMs) / dayMs);
    if (bucket >= 0 && bucket < days) counts[bucket]++;
  }
  return counts;
}

// ---------- progress metrics (per-project reporting) ----------

export interface ProjectMetrics {
  tasksTotal: number;
  tasksDone: number;
  openPrs: number;
  mergedRecently: number;
  /** Whole days since the project last moved; 0 means today. */
  daysSinceActivity: number;
}

const RECENT_PR_MS = 7 * 24 * 60 * 60 * 1000;

interface PrLike {
  state: "open" | "closed";
  merged: boolean;
  updatedAt: string;
}

function collectSnapshotPrs(data: unknown, into: PrLike[]): void {
  if (!data || typeof data !== "object") return;
  if ((data as { type?: string }).type === "pr") {
    into.push(data as PrLike);
  } else if ((data as { type?: string }).type === "repo") {
    const prs = (data as { prs?: unknown }).prs;
    if (Array.isArray(prs)) for (const pr of prs) if (pr && typeof pr === "object") into.push(pr as PrLike);
  }
}

/** Task completion and PR throughput for a project — the reporting numbers. */
export function getProjectMetrics(db: Db, ref: number | string): ProjectMetrics | undefined {
  const detail = getProjectDetail(db, ref, { updatesLimit: 0 });
  if (!detail) return undefined;
  const tasksDone = detail.tasks.filter((t) => t.status === "done").length;
  const prs: PrLike[] = [];
  for (const link of detail.links) collectSnapshotPrs(link.snapshot?.data, prs);
  const recentCutoff = Date.now() - RECENT_PR_MS;
  let openPrs = 0;
  let mergedRecently = 0;
  for (const pr of prs) {
    if (pr.state === "open") openPrs++;
    else if (pr.merged && Date.parse(pr.updatedAt) > recentCutoff) mergedRecently++;
  }
  return {
    tasksTotal: detail.tasks.length,
    tasksDone,
    openPrs,
    mergedRecently,
    daysSinceActivity: Math.floor((now() - detail.project.lastActivityAt) / (24 * 60 * 60 * 1000)),
  };
}

// ---------- activity feed (digest raw material) ----------

export interface ActivityFeed {
  since: number;
  projects: {
    project: Project;
    latestSummary: string | null;
    updates: Update[];
    openTasks: Task[];
    openWarnings: Warning[];
    links: { url: string; kind: LinkKind; title: string; externalId: string | null; snapshot: unknown; fetchedAt: number | null }[];
  }[];
}

export function getActivity(db: Db, since: number): ActivityFeed {
  const active = listProjects(db, {});
  return {
    since,
    projects: active.map((project) => {
      const recentUpdates = db
        .select()
        .from(updates)
        .where(and(eq(updates.projectId, project.id), gt(updates.createdAt, since)))
        .orderBy(desc(updates.createdAt))
        .all();
      const openTasks = db
        .select()
        .from(tasks)
        .where(and(eq(tasks.projectId, project.id), inArray(tasks.status, ["todo", "in_progress"]), isNull(tasks.deletedAt)))
        .all();
      const latest = db
        .select()
        .from(summaries)
        .where(and(eq(summaries.projectId, project.id), eq(summaries.kind, "project_summary")))
        .orderBy(desc(summaries.createdAt))
        .limit(1)
        .get();
      const projectLinks = db
        .select()
        .from(links)
        .leftJoin(snapshots, eq(snapshots.linkId, links.id))
        .where(and(eq(links.projectId, project.id), isNull(links.deletedAt)))
        .all()
        .map((row) => ({
          url: row.links.url,
          kind: row.links.kind,
          title: row.links.title,
          externalId: row.links.externalId,
          snapshot: row.snapshots?.data ?? null,
          fetchedAt: row.snapshots?.fetchedAt ?? null,
        }));
      return {
        project,
        latestSummary: latest?.body ?? null,
        updates: recentUpdates,
        openTasks,
        openWarnings: listWarnings(db, { projectId: project.id }),
        links: projectLinks,
      };
    }),
  };
}
