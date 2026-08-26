/**
 * Domain operations over the markdown store. Reads come from a per-handle
 * snapshot of the tree; writes go through the store's atomic helpers and drop
 * that snapshot. Function names, arguments and return shapes match the SQLite
 * implementation this replaces, so the MCP tools and web app are unaffected.
 */
import type {
  Link,
  LinkKind,
  LinkProvider,
  Project,
  ProjectHealth,
  ProjectPriority,
  ProjectStatus,
  RepoScope,
  Snapshot,
  Summary,
  SummaryKind,
  SyncState,
  Task,
  TaskPriority,
  TaskStatus,
  Update,
  UpdateType,
  Warning,
  WarningSeverity,
} from "./domain.js";
import { rmSync } from "node:fs";
import { createExclusive, mkdirExclusive, readFileSyncSafe, withFileLock } from "./store/atomic.js";
import * as p from "./store/paths.js";
import {
  board,
  invalidate,
  nextId,
  slugify,
  writeJson,
  writeLink,
  writePost,
  writeProject,
  writeSummary,
  writeTask,
  writeWarning,
  type Store,
} from "./store/store.js";

export { slugify };
export type { Store };

const now = () => Date.now();

/**
 * Drop keys explicitly set to undefined. Callers build patches with every
 * optional field present, and a bare spread would blank the fields they left
 * out — the SQL builder this replaced ignored them.
 */
function defined<T extends object>(patch: T): Partial<T> {
  return Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)) as Partial<T>;
}
const byNewest = <T extends { createdAt: number; id: number }>(a: T, b: T) => b.createdAt - a.createdAt || b.id - a.id;

function projectSlug(store: Store, projectId: number): string {
  const project = board(store).projects.find((candidate) => candidate.id === projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);
  return project.slug;
}

/** Every write that represents work on a project bumps its activity clock. */
function touchProject(store: Store, projectId: number): void {
  const project = board(store).projects.find((candidate) => candidate.id === projectId);
  if (project) writeProject(store, { ...project, lastActivityAt: now() });
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

export function createProject(store: Store, input: CreateProjectInput): Project {
  // mkdir is atomic, so racing creators of the same name land on different slugs.
  let slug = slugify(input.name);
  for (let i = 2; !mkdirExclusive(p.projectDir(store.root, slug)); i++) slug = `${slugify(input.name)}-${i}`;
  const t = now();
  return writeProject(store, {
    id: nextId(store, "projects"),
    slug,
    name: input.name,
    description: input.description ?? "",
    category: input.category ?? "coding",
    status: input.status ?? "active",
    priority: input.priority ?? "medium",
    health: input.health ?? "green",
    pinned: 0,
    createdAt: t,
    updatedAt: t,
    lastActivityAt: t,
  });
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  category?: string;
  status?: ProjectStatus;
  priority?: ProjectPriority;
  health?: ProjectHealth;
}

export function updateProject(store: Store, id: number, input: UpdateProjectInput, author = "user"): Project {
  const existing = getProject(store, id);
  if (!existing) throw new Error(`Project ${id} not found`);
  const t = now();
  const updated = writeProject(store, { ...existing, ...defined(input), updatedAt: t, lastActivityAt: t });
  if (input.status && input.status !== existing.status) {
    addUpdate(store, id, `Status changed from **${existing.status}** to **${input.status}**`, {
      type: "status_change",
      author,
    });
  }
  return updated;
}

export interface ListProjectsFilter {
  status?: ProjectStatus | ProjectStatus[];
  category?: string;
  health?: ProjectHealth;
  includeArchived?: boolean;
}

/** Pinned projects lead the board; recency orders within each group. */
export function listProjects(store: Store, filter: ListProjectsFilter = {}): Project[] {
  const statuses = filter.status ? (Array.isArray(filter.status) ? filter.status : [filter.status]) : undefined;
  return board(store)
    .projects.filter((project) => {
      if (statuses) {
        if (!statuses.includes(project.status)) return false;
      } else if (!filter.includeArchived && project.status === "archived") return false;
      if (filter.category && project.category !== filter.category) return false;
      if (filter.health && project.health !== filter.health) return false;
      return true;
    })
    .sort((a, b) => b.pinned - a.pinned || b.lastActivityAt - a.lastActivityAt);
}

export function getProject(store: Store, ref: number | string): Project | undefined {
  return board(store).projects.find((project) => (typeof ref === "number" ? project.id === ref : project.slug === ref));
}

export function setProjectPinned(store: Store, id: number, pinned: boolean): Project {
  const project = getProject(store, id);
  if (!project) throw new Error(`Project ${id} not found`);
  return writeProject(store, { ...project, pinned: pinned ? 1 : 0, updatedAt: now() });
}

/** Projects resting off the main board: finished (done) and archived. */
export function listShelvedProjects(store: Store): Project[] {
  return board(store)
    .projects.filter((project) => project.status === "done" || project.status === "archived")
    .sort((a, b) => b.lastActivityAt - a.lastActivityAt);
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

const TASK_STATUS_RANK = { in_progress: 0, todo: 1, done: 2 } as const;
/** Unprioritized tasks sort after prioritized ones in the queue and on the board. */
const TASK_PRIORITY_RANK = { high: 0, medium: 1, low: 2 } as const;
const taskPriorityRank = (priority: TaskPriority | null) => (priority ? TASK_PRIORITY_RANK[priority] : 3);

export function getProjectDetail(store: Store, ref: number | string, opts: { updatesLimit?: number } = {}): ProjectDetail | undefined {
  const project = getProject(store, ref);
  if (!project) return undefined;
  const data = board(store);

  const projectTasks = data.tasks
    .filter((task) => task.projectId === project.id && !task.deletedAt)
    .sort(
      (a, b) =>
        TASK_STATUS_RANK[a.status] - TASK_STATUS_RANK[b.status] ||
        taskPriorityRank(a.priority) - taskPriorityRank(b.priority) ||
        b.updatedAt - a.updatedAt,
    );

  const projectUpdates = data.updates
    .filter((update) => update.projectId === project.id)
    .sort(byNewest)
    .slice(0, opts.updatesLimit ?? 50);

  const projectLinks = data.links
    .filter((link) => link.projectId === project.id && !link.deletedAt)
    .map((link) => ({
      ...link,
      snapshot: data.snapshots.find((snapshot) => snapshot.linkId === link.id) ?? null,
      syncState: data.syncState.find((state) => state.linkId === link.id) ?? null,
    }));

  const latestSummary =
    data.summaries.filter((s) => s.projectId === project.id && s.kind === "project_summary").sort(byNewest)[0] ?? null;

  return {
    project,
    tasks: projectTasks,
    updates: projectUpdates,
    links: projectLinks,
    latestSummary,
    openWarnings: listWarnings(store, { projectId: project.id }),
  };
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

export function addTask(store: Store, projectId: number, title: string, opts: AddTaskOptions = {}): Task {
  const t = now();
  const task: Task = {
    id: nextId(store, "tasks"),
    projectId,
    title,
    description: opts.description ?? "",
    status: opts.status ?? "todo",
    priority: opts.priority ?? null,
    agentReady: opts.agentReady ? 1 : 0,
    claimedBy: null,
    claimedAt: null,
    dueDate: opts.dueDate ?? null,
    author: opts.author ?? "user",
    createdAt: t,
    updatedAt: t,
    deletedAt: null,
  };
  writeTask(store, projectSlug(store, projectId), task);
  touchProject(store, projectId);
  return task;
}

function getTask(store: Store, id: number): Task | undefined {
  return board(store).tasks.find((task) => task.id === id);
}

/** Read-modify-write a task under a lock so two processes cannot lose one another's edit. */
function mutateTask(store: Store, id: number, patch: (task: Task) => Task): Task {
  const existing = getTask(store, id);
  if (!existing) throw new Error(`Task ${id} not found`);
  const slug = projectSlug(store, existing.projectId);
  return withFileLock(p.tasksDir(store.root, slug), () => {
    invalidate(store);
    const current = getTask(store, id);
    if (!current) throw new Error(`Task ${id} not found`);
    return writeTask(store, slug, patch(current));
  });
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority | null;
  dueDate?: string | null;
}

export function updateTask(store: Store, id: number, input: UpdateTaskInput): Task {
  // Reverting a claimed task to todo releases the claim so it can be queued again;
  // completing it keeps claimedBy for attribution.
  const task = mutateTask(store, id, (current) => {
    if (input.status === "todo") releaseClaim(store, projectSlug(store, current.projectId), id);
    return {
      ...current,
      ...defined(input),
      ...(input.status === "todo" ? { claimedBy: null, claimedAt: null } : {}),
      updatedAt: now(),
    };
  });
  touchProject(store, task.projectId);
  return task;
}

/** Soft delete: the file moves to `.deleted/` and can be restored from the project page. */
export function deleteTask(store: Store, id: number): void {
  const task = getTask(store, id);
  if (!task) return;
  mutateTask(store, id, (current) => ({ ...current, deletedAt: now() }));
}

export function restoreTask(store: Store, id: number): Task {
  const task = mutateTask(store, id, (current) => ({ ...current, deletedAt: null, updatedAt: now() }));
  touchProject(store, task.projectId);
  return task;
}

// ---------- agent task queue (shared pull queue — no named assignees) ----------

/** Drop the claim marker so the task can be queued and claimed again. */
function releaseClaim(store: Store, slug: string, id: number): void {
  rmSync(p.claimFile(store.root, slug, id), { force: true });
  invalidate(store);
}

/** Queue or un-queue a task. Un-queuing releases an active claim and reverts in_progress to todo. */
export function setTaskAgentReady(store: Store, id: number, ready: boolean): Task {
  const task = mutateTask(store, id, (current) => {
    if (!ready && current.claimedBy) releaseClaim(store, projectSlug(store, current.projectId), id);
    return {
      ...current,
      agentReady: ready ? 1 : 0,
      ...(!ready && current.claimedBy ? { claimedBy: null, claimedAt: null } : {}),
      ...(!ready && current.status === "in_progress" ? { status: "todo" as TaskStatus } : {}),
      updatedAt: now(),
    };
  });
  touchProject(store, task.projectId);
  return task;
}

/** Tasks waiting for an agent: queued, still todo, unclaimed, not deleted. Priority first (null last), FIFO within each. */
export function listQueuedTasks(store: Store, opts: { projectId?: number } = {}): Task[] {
  return board(store)
    .tasks.filter(
      (task) =>
        task.agentReady === 1 &&
        task.status === "todo" &&
        task.claimedAt === null &&
        !task.deletedAt &&
        (opts.projectId === undefined || task.projectId === opts.projectId),
    )
    .sort((a, b) => taskPriorityRank(a.priority) - taskPriorityRank(b.priority) || a.createdAt - b.createdAt || a.id - b.id);
}

/** One task plus its project — the task detail page's data. */
export function getTaskDetail(store: Store, id: number): { task: Task; project: Project } | undefined {
  const task = getTask(store, id);
  if (!task) return undefined;
  const project = getProject(store, task.projectId);
  return project ? { task, project } : undefined;
}

/**
 * Atomically claim a queued task. The claim marker is created with O_EXCL, so
 * exactly one caller wins even across processes; everyone else fails loudly
 * rather than starting duplicate work.
 */
export function claimTask(store: Store, id: number, claimedBy: string): Task {
  const existing = getTask(store, id);
  if (!existing || existing.deletedAt) throw new Error(`Task ${id} not found`);
  if (!existing.agentReady) throw new Error(`Task ${id} is not queued for agents`);
  const slug = projectSlug(store, existing.projectId);

  if (!createExclusive(p.claimFile(store.root, slug, id), claimedBy)) {
    const holder = readFileSyncSafe(p.claimFile(store.root, slug, id));
    throw new Error(`Task ${id} is already claimed by ${holder || "someone else"}`);
  }
  if (existing.status !== "todo") {
    rmSync(p.claimFile(store.root, slug, id), { force: true });
    throw new Error(`Task ${id} is already claimed by ${existing.claimedBy ?? "someone else"}`);
  }

  invalidate(store);
  const t = now();
  const claimed = writeTask(store, slug, { ...existing, status: "in_progress", claimedBy, claimedAt: t, updatedAt: t });
  addUpdate(store, claimed.projectId, `Claimed task **${claimed.title}**`, { type: "agent_update", author: claimedBy });
  return claimed;
}

// ---------- updates ----------

export function addUpdate(store: Store, projectId: number, body: string, opts: { type?: UpdateType; author?: string } = {}): Update {
  const update: Update = {
    id: nextId(store, "updates"),
    projectId,
    type: opts.type ?? "note",
    body,
    author: opts.author ?? "user",
    createdAt: now(),
  };
  writePost(store, projectSlug(store, projectId), update);
  touchProject(store, projectId);
  return update;
}

// ---------- summaries & reports ----------

export function upsertSummary(store: Store, projectId: number, body: string, generatedBy = "agent"): Summary {
  const summary: Summary = {
    id: nextId(store, "summaries"),
    projectId,
    kind: "project_summary",
    body,
    generatedBy,
    createdAt: now(),
  };
  writeSummary(store, projectSlug(store, projectId), summary);
  touchProject(store, projectId);
  return summary;
}

/** Past AI summaries for a project, newest first (every upsert_summary keeps history). */
export function listSummaryHistory(store: Store, projectId: number, limit = 20): Summary[] {
  return board(store)
    .summaries.filter((summary) => summary.projectId === projectId && summary.kind === "project_summary")
    .sort(byNewest)
    .slice(0, limit);
}

export function saveReport(store: Store, kind: "digest" | "triage" | "accomplishments", body: string, generatedBy = "agent"): Summary {
  const report: Summary = { id: nextId(store, "summaries"), projectId: null, kind, body, generatedBy, createdAt: now() };
  return writeSummary(store, null, report);
}

const REPORT_KINDS: SummaryKind[] = ["digest", "triage", "accomplishments"];

export function listReports(store: Store, kind?: "digest" | "triage" | "accomplishments", limit = 50): Summary[] {
  return board(store)
    .summaries.filter((s) => s.projectId === null && (kind ? s.kind === kind : REPORT_KINDS.includes(s.kind)))
    .sort(byNewest)
    .slice(0, limit);
}

export function latestReport(store: Store, kind: "digest" | "triage" | "accomplishments"): Summary | undefined {
  return listReports(store, kind, 1)[0];
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

export function addLink(store: Store, projectId: number, input: Partial<AddLinkInput> & { url: string }): Link {
  const inferred = inferLink(input.url);
  const link: Link = {
    id: nextId(store, "links"),
    projectId,
    provider: input.provider ?? inferred.provider,
    kind: input.kind ?? inferred.kind,
    url: input.url,
    externalId: input.externalId ?? inferred.externalId ?? null,
    title: input.title ?? "",
    scope: input.scope ?? null,
    createdAt: now(),
    deletedAt: null,
  };
  writeLink(store, projectSlug(store, projectId), link);
  touchProject(store, projectId);
  return link;
}

function getLink(store: Store, id: number): Link | undefined {
  return board(store).links.find((link) => link.id === id);
}

/** Soft delete: snapshots and sync state are kept; the link is hidden and syncs stop. */
export function deleteLink(store: Store, id: number): void {
  const link = getLink(store, id);
  if (link) writeLink(store, projectSlug(store, link.projectId), { ...link, deletedAt: now() });
}

export function restoreLink(store: Store, id: number): Link {
  const link = getLink(store, id);
  if (!link) throw new Error(`Link ${id} not found`);
  const restored = writeLink(store, projectSlug(store, link.projectId), { ...link, deletedAt: null });
  touchProject(store, link.projectId);
  return restored;
}

export interface DeletedItems {
  tasks: Task[];
  links: Link[];
}

export function listDeleted(store: Store, projectId: number): DeletedItems {
  const data = board(store);
  return {
    tasks: data.tasks
      .filter((task) => task.projectId === projectId && task.deletedAt !== null)
      .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0)),
    links: data.links
      .filter((link) => link.projectId === projectId && link.deletedAt !== null)
      .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0)),
  };
}

export function saveSnapshot(store: Store, linkId: number, data: unknown): void {
  const existing = board(store).snapshots.find((snapshot) => snapshot.linkId === linkId);
  writeJson(store, p.snapshotFile(store.root, linkId), {
    id: existing?.id ?? nextId(store, "snapshots"),
    linkId,
    data,
    fetchedAt: now(),
  } satisfies Snapshot);
}

// ---------- sync health ----------

export function recordSyncResult(store: Store, linkId: number, error: string | null): void {
  const t = now();
  const existing = board(store).syncState.find((state) => state.linkId === linkId);
  writeJson(store, p.syncStateFile(store.root, linkId), {
    id: existing?.id ?? nextId(store, "syncState"),
    linkId,
    lastAttemptAt: t,
    lastSuccessAt: error ? (existing?.lastSuccessAt ?? null) : t,
    lastError: error,
  } satisfies SyncState);
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

export function getSyncHealth(store: Store): SyncHealth {
  const data = board(store);
  const failing: FailingSync[] = [];
  let lastSuccessAt: number | null = null;

  for (const state of data.syncState) {
    const link = data.links.find((candidate) => candidate.id === state.linkId);
    if (!link || link.deletedAt) continue;
    const project = data.projects.find((candidate) => candidate.id === link.projectId);
    if (!project || project.status === "archived") continue;

    if (state.lastSuccessAt && (!lastSuccessAt || state.lastSuccessAt > lastSuccessAt)) lastSuccessAt = state.lastSuccessAt;
    if (state.lastError) {
      failing.push({
        linkId: link.id,
        url: link.url,
        title: link.title,
        provider: link.provider,
        projectSlug: project.slug,
        projectName: project.name,
        error: state.lastError,
        lastAttemptAt: state.lastAttemptAt,
        lastSuccessAt: state.lastSuccessAt,
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

export function raiseWarning(store: Store, projectId: number, input: RaiseWarningInput): Warning {
  const warning: Warning = {
    id: nextId(store, "warnings"),
    projectId,
    severity: input.severity ?? "warning",
    message: input.message,
    suggestedAction: input.suggestedAction ?? null,
    status: "open",
    raisedBy: input.raisedBy ?? "agent",
    createdAt: now(),
    resolvedAt: null,
  };
  writeWarning(store, projectSlug(store, projectId), warning);
  touchProject(store, projectId);
  return warning;
}

export function resolveWarning(store: Store, id: number, opts: { resolvedBy?: string; note?: string } = {}): Warning {
  const existing = board(store).warnings.find((warning) => warning.id === id);
  if (!existing) throw new Error(`Warning ${id} not found`);
  const resolved = writeWarning(store, projectSlug(store, existing.projectId), {
    ...existing,
    status: "resolved",
    resolvedAt: now(),
  });
  addUpdate(store, existing.projectId, `Resolved warning: ${existing.message}${opts.note ? ` — ${opts.note}` : ""}`, {
    type: "note",
    author: opts.resolvedBy ?? "user",
  });
  return resolved;
}

const WARNING_SEVERITY_RANK = { critical: 0, warning: 1, info: 2 } as const;

/** Open warnings, most severe first. Pass projectId to scope to one project. */
export function listWarnings(store: Store, opts: { projectId?: number } = {}): Warning[] {
  return board(store)
    .warnings.filter(
      (warning) => warning.status === "open" && (opts.projectId === undefined || warning.projectId === opts.projectId),
    )
    .sort((a, b) => WARNING_SEVERITY_RANK[a.severity] - WARNING_SEVERITY_RANK[b.severity] || b.createdAt - a.createdAt);
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
export function findProject(store: Store, query: FindProjectQuery): ProjectMatch[] {
  const data = board(store);
  const matches: ProjectMatch[] = [];
  const seen = new Set<number>();
  const allLinks = data.links.flatMap((link) => {
    if (link.deletedAt) return [];
    const project = data.projects.find((candidate) => candidate.id === link.projectId);
    return project && project.status !== "archived" ? [{ link, project }] : [];
  });

  const push = (project: Project, confidence: ProjectMatch["confidence"], reason: string) => {
    if (seen.has(project.id)) return;
    seen.add(project.id);
    matches.push({ project, confidence, reason });
  };

  if (query.repo && query.prNumber) {
    const id = `${query.repo}#${query.prNumber}`;
    for (const { link, project } of allLinks) {
      if (link.externalId === id) push(project, "exact", `linked to ${id}`);
    }
  }

  if (query.repo) {
    for (const { link, project } of allLinks) {
      if (link.kind !== "repo" || link.externalId !== query.repo) continue;
      const scope = link.scope;
      if (scope) {
        if (query.branch && scope.branchPrefix && query.branch.startsWith(scope.branchPrefix)) {
          push(project, "scoped", `branch matches prefix "${scope.branchPrefix}"`);
          continue;
        }
        if (query.paths?.length && scope.pathPrefixes?.length) {
          const prefix = scope.pathPrefixes.find((candidate) => query.paths!.some((path) => path.startsWith(candidate)));
          if (prefix) {
            push(project, "scoped", `changed paths match prefix "${prefix}"`);
            continue;
          }
        }
        if (query.labels?.length && scope.labels?.length) {
          const label = scope.labels.find((candidate) => query.labels!.includes(candidate));
          if (label) {
            push(project, "scoped", `label "${label}" matches scope`);
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
      for (const { link, project } of allLinks) {
        if (link.kind !== "repo" || link.externalId !== query.repo) continue;
        if (!link.scope) {
          push(project, "repo", `project links repo ${query.repo} (unscoped)`);
        } else if (!hadDiscriminators) {
          push(project, "repo", `project links repo ${query.repo} (scoped; pass branch/paths/labels to narrow)`);
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
export function getActivityCounts(store: Store, projectId: number, days = 14): number[] {
  const end = new Date();
  end.setHours(24, 0, 0, 0); // end of today
  const startMs = end.getTime() - days * 24 * 60 * 60 * 1000;
  const counts = new Array<number>(days).fill(0);
  const dayMs = 24 * 60 * 60 * 1000;
  for (const update of board(store).updates) {
    if (update.projectId !== projectId || update.createdAt <= startMs) continue;
    const bucket = Math.floor((update.createdAt - startMs) / dayMs);
    if (bucket >= 0 && bucket < days) counts[bucket]++;
  }
  return counts;
}

export interface ProjectMetrics {
  tasksTotal: number;
  tasksDone: number;
  openPrs: number;
  mergedRecently: number;
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
export function getProjectMetrics(store: Store, ref: number | string): ProjectMetrics | undefined {
  const detail = getProjectDetail(store, ref, { updatesLimit: 0 });
  if (!detail) return undefined;
  const tasksDone = detail.tasks.filter((task) => task.status === "done").length;
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

export function getActivity(store: Store, since: number): ActivityFeed {
  const data = board(store);
  return {
    since,
    projects: listProjects(store, {}).map((project) => ({
      project,
      latestSummary:
        data.summaries.filter((s) => s.projectId === project.id && s.kind === "project_summary").sort(byNewest)[0]?.body ?? null,
      updates: data.updates.filter((u) => u.projectId === project.id && u.createdAt > since).sort(byNewest),
      openTasks: data.tasks.filter(
        (task) => task.projectId === project.id && !task.deletedAt && (task.status === "todo" || task.status === "in_progress"),
      ),
      openWarnings: listWarnings(store, { projectId: project.id }),
      links: data.links
        .filter((link) => link.projectId === project.id && !link.deletedAt)
        .map((link) => {
          const snapshot = data.snapshots.find((candidate) => candidate.linkId === link.id);
          return {
            url: link.url,
            kind: link.kind,
            title: link.title,
            externalId: link.externalId,
            snapshot: snapshot?.data ?? null,
            fetchedAt: snapshot?.fetchedAt ?? null,
          };
        }),
    })),
  };
}
