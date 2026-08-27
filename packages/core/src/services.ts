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
  ProjectAccent,
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
  Comment,
  Post,
  PostType,
  Warning,
  WarningSeverity,
} from "./domain.js";
import { rmSync } from "node:fs";
import { deriveProjectKey, normalizeLabels, parseIdentifier, taskIdentifier, uniqueKey } from "./identifiers.js";
import { createExclusive, mkdirExclusive, readFileSyncSafe, withFileLock } from "./store/atomic.js";
import { taskNumberLedger } from "./store/backfill.js";
import * as p from "./store/paths.js";
import {
  board,
  invalidate,
  nextId,
  slugify,
  writeJson,
  writeLink,
  writeComment,
  writePost,
  writeProject,
  writeSummary,
  writeTask,
  writeWarning,
  type Store,
} from "./store/store.js";

export { slugify };
export { deriveProjectKey, normalizeLabels, parseIdentifier, taskIdentifier, uniqueKey } from "./identifiers.js";
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
  /** Identifier prefix. Derived from the name when omitted. */
  key?: string;
  description?: string;
  category?: string;
  status?: ProjectStatus;
  priority?: ProjectPriority;
  health?: ProjectHealth;
  icon?: string;
  accent?: ProjectAccent;
}

export function createProject(store: Store, input: CreateProjectInput): Project {
  // mkdir is atomic, so racing creators of the same name land on different slugs.
  let slug = slugify(input.name);
  for (let i = 2; !mkdirExclusive(p.projectDir(store.root, slug)); i++) slug = `${slugify(input.name)}-${i}`;
  const t = now();
  return writeProject(store, {
    id: nextId(store, "projects"),
    slug,
    // Identifiers have to name one issue board-wide, so a key is disambiguated
    // against the keys already out there, whether typed or derived from the name.
    key: input.key ? cleanKey(input.key, projectKeys(store)) : deriveProjectKey(input.name, projectKeys(store)),
    name: input.name,
    description: input.description ?? "",
    category: input.category ?? "coding",
    status: input.status ?? "active",
    priority: input.priority ?? "medium",
    health: input.health ?? "green",
    pinned: 0,
    icon: input.icon ?? null,
    accent: input.accent ?? null,
    createdAt: t,
    updatedAt: t,
    lastActivityAt: t,
  });
}

/** The keys already spoken for. A project may be excluded — its own key is not a collision. */
function projectKeys(store: Store, exceptId?: number): string[] {
  return board(store)
    .projects.filter((project) => project.id !== exceptId)
    .map((project) => project.key);
}

/**
 * A key a person typed: letters and digits only, uppercased, and kept unique —
 * two projects sharing a key would make an identifier ambiguous.
 */
function cleanKey(key: string, taken: Iterable<string>): string {
  const base = key.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, KEY_MAX_TYPED);
  if (!base) throw new Error("A project key needs at least one letter or digit");
  return uniqueKey(base, taken);
}

/** Longer than a derived key, because someone typing one has a reason. */
const KEY_MAX_TYPED = 6;

export interface UpdateProjectInput {
  name?: string;
  key?: string;
  description?: string;
  category?: string;
  status?: ProjectStatus;
  priority?: ProjectPriority;
  health?: ProjectHealth;
  icon?: string;
  accent?: ProjectAccent;
}

export function updateProject(store: Store, id: number, input: UpdateProjectInput, author = "user"): Project {
  const existing = getProject(store, id);
  if (!existing) throw new Error(`Project ${id} not found`);
  const t = now();
  const key = input.key === undefined ? undefined : cleanKey(input.key, projectKeys(store, id));
  const updated = writeProject(store, { ...existing, ...defined({ ...input, key }), updatedAt: t, lastActivityAt: t });
  if (input.status && input.status !== existing.status) {
    addPost(store, id, `Status changed from **${existing.status}** to **${input.status}**`, {
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
  posts: Post[];
  comments: Comment[];
  links: LinkWithStatus[];
  latestSummary: Summary | null;
  openWarnings: Warning[];
}

const TASK_STATUS_RANK = { in_progress: 0, blocked: 1, todo: 2, done: 3 } as const;
/** Unprioritized tasks sort after prioritized ones in the queue and on the board. */
const TASK_PRIORITY_RANK = { high: 0, medium: 1, low: 2 } as const;
const taskPriorityRank = (priority: TaskPriority | null) => (priority ? TASK_PRIORITY_RANK[priority] : 3);

/** In-flight work first, then priority, then most recently touched. */
const byWorkOrder = (a: Task, b: Task): number =>
  TASK_STATUS_RANK[a.status] - TASK_STATUS_RANK[b.status] ||
  taskPriorityRank(a.priority) - taskPriorityRank(b.priority) ||
  b.updatedAt - a.updatedAt;

export function getProjectDetail(store: Store, ref: number | string, opts: { postsLimit?: number } = {}): ProjectDetail | undefined {
  const project = getProject(store, ref);
  if (!project) return undefined;
  const data = board(store);

  const projectTasks = data.tasks.filter((task) => task.projectId === project.id && !task.deletedAt).sort(byWorkOrder);

  const projectPosts = data.posts
    .filter((post) => post.projectId === project.id)
    .sort(byNewest)
    .slice(0, opts.postsLimit ?? 50);
  const postIds = new Set(projectPosts.map((post) => post.id));
  const projectComments = data.comments
    .filter((comment) => comment.postId !== null && postIds.has(comment.postId))
    .sort((a, b) => a.createdAt - b.createdAt);

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
    posts: projectPosts,
    comments: projectComments,
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
  /** `"user"` for you, or an agent name. */
  assignee?: string | null;
  labels?: string[];
}

export function addTask(store: Store, projectId: number, title: string, opts: AddTaskOptions = {}): Task {
  const t = now();
  const task: Task = {
    id: nextId(store, "tasks"),
    projectId,
    // Numbers come from the project's own ledger, so `ENG-1` is the first task
    // filed in that project however many exist elsewhere on the board.
    number: nextId(store, taskNumberLedger(projectId)),
    title,
    description: opts.description ?? "",
    status: opts.status ?? "todo",
    priority: opts.priority ?? null,
    assignee: opts.assignee ?? null,
    labels: normalizeLabels(opts.labels),
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
  assignee?: string | null;
  labels?: string[];
}

export function updateTask(store: Store, id: number, input: UpdateTaskInput): Task {
  // Reverting a claimed task to todo releases the claim so it can be queued again;
  // completing it keeps claimedBy for attribution.
  const task = mutateTask(store, id, (current) => {
    if (input.status === "todo") releaseClaim(store, projectSlug(store, current.projectId), id);
    return {
      ...current,
      ...defined({ ...input, labels: input.labels && normalizeLabels(input.labels) }),
      ...(input.status === "todo"
        ? { claimedBy: null, claimedAt: null, assignee: releasedAssignee(current, input.assignee) }
        : {}),
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

/**
 * Who owns a task once its claim is dropped. An agent's ownership goes with the
 * claim; ownership you set yourself is yours to keep, and an explicit assignee
 * in the same edit wins over both.
 */
function releasedAssignee(current: Task, explicit: string | null | undefined): string | null {
  if (explicit !== undefined) return explicit;
  return current.assignee === current.claimedBy ? null : current.assignee;
}

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
      ...(!ready && current.claimedBy
        ? { claimedBy: null, claimedAt: null, assignee: releasedAssignee(current, undefined) }
        : {}),
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

/** One task, its project, and its reply thread — the task detail page's data. */
export function getTaskDetail(
  store: Store,
  id: number,
): { task: Task; project: Project; comments: Comment[] } | undefined {
  const task = getTask(store, id);
  if (!task) return undefined;
  const project = getProject(store, task.projectId);
  return project ? { task, project, comments: listTaskComments(store, id) } : undefined;
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
  // The claim is the ownership, so the field a person reads and the marker the
  // queue enforces are written together and cannot disagree.
  const claimed = writeTask(store, slug, {
    ...existing,
    status: "in_progress",
    claimedBy,
    claimedAt: t,
    assignee: claimedBy,
    updatedAt: t,
  });
  addPost(store, claimed.projectId, `Claimed task **${claimed.title}**`, { type: "agent_update", author: claimedBy });
  return claimed;
}

// ---------- board lanes ----------

/**
 * The columns the board shows. Four of them are views over fields that already
 * exist — a lane is not stored, it is derived — so the queue an agent pulls from
 * and the column a person drags a card into can never disagree.
 */
export const TASK_LANES = ["backlog", "queued", "moving", "blocked", "done"] as const;
export type TaskLane = (typeof TASK_LANES)[number];

export function taskLane(task: Task): TaskLane {
  if (task.status === "done") return "done";
  if (task.status === "blocked") return "blocked";
  if (task.status === "in_progress") return "moving";
  return task.agentReady && !task.claimedAt ? "queued" : "backlog";
}

/**
 * Move a task into a lane. The order of the two writes is load-bearing:
 * `updateTask({ status: "todo" })` releases a claim, and `setTaskAgentReady(false)`
 * drags `in_progress` back to `todo`, so the status write goes last for the lanes
 * that are a status and first for the lanes that are a queue position.
 */
export function setTaskLane(store: Store, id: number, lane: TaskLane): Task {
  switch (lane) {
    case "backlog":
      updateTask(store, id, { status: "todo" });
      return setTaskAgentReady(store, id, false);
    case "queued":
      updateTask(store, id, { status: "todo" });
      return setTaskAgentReady(store, id, true);
    case "moving":
      return updateTask(store, id, { status: "in_progress" });
    case "blocked":
      return updateTask(store, id, { status: "blocked" });
    case "done":
      return updateTask(store, id, { status: "done" });
  }
}

// ---------- issues across the board ----------

/** A task with everything a row needs to render without resolving the project again. */
export interface TaskRow {
  task: Task;
  project: Project;
  identifier: string;
  lane: TaskLane;
}

export interface ListTasksFilter {
  projectId?: number;
  /** One lane or a set of them — the board's columns are how work is filtered. */
  lane?: TaskLane | TaskLane[];
  /** `"user"` for yours, an agent name for theirs, `null` for unassigned. */
  assignee?: string | null;
  label?: string;
  priority?: TaskPriority;
  /** Substring over identifier, title and description. */
  query?: string;
  limit?: number;
}

/**
 * Every task on the board, filtered. One query behind the issues view, its
 * filters, the ⌘K index and the `list_tasks` MCP tool, so what a person sees and
 * what an agent is told can never be assembled two different ways.
 */
export function listTasks(store: Store, filter: ListTasksFilter = {}): TaskRow[] {
  const data = board(store);
  const projects = new Map(data.projects.map((project) => [project.id, project]));
  const lanes = filter.lane ? new Set(Array.isArray(filter.lane) ? filter.lane : [filter.lane]) : undefined;
  const label = filter.label?.trim().toLowerCase();
  const query = filter.query?.trim().toLowerCase();

  const rows = data.tasks
    .filter((task) => !task.deletedAt)
    .filter((task) => filter.projectId === undefined || task.projectId === filter.projectId)
    .filter((task) => !lanes || lanes.has(taskLane(task)))
    .filter((task) => filter.assignee === undefined || task.assignee === filter.assignee)
    .filter((task) => !label || task.labels.includes(label))
    .filter((task) => !filter.priority || task.priority === filter.priority)
    .sort(byWorkOrder)
    .flatMap((task) => {
      const project = projects.get(task.projectId);
      if (!project) return [];
      const row: TaskRow = { task, project, identifier: taskIdentifier(project, task), lane: taskLane(task) };
      if (query && !`${row.identifier} ${task.title} ${task.description}`.toLowerCase().includes(query)) return [];
      return [row];
    });

  return filter.limit === undefined ? rows : rows.slice(0, filter.limit);
}

/** Every label in use, most-used first — what the label filter offers. */
export function listLabels(store: Store, opts: { projectId?: number } = {}): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const task of board(store).tasks) {
    if (task.deletedAt) continue;
    if (opts.projectId !== undefined && task.projectId !== opts.projectId) continue;
    for (const label of task.labels) counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** Resolve `ENG-12` — what the ⌘K palette and the /i/ shortcut look up. */
export function findTaskByIdentifier(store: Store, text: string): TaskRow | undefined {
  const parsed = parseIdentifier(text);
  if (!parsed) return undefined;
  const data = board(store);
  const project = data.projects.find((candidate) => candidate.key.toUpperCase() === parsed.key);
  if (!project) return undefined;
  const task = data.tasks.find(
    (candidate) => candidate.projectId === project.id && candidate.number === parsed.number && !candidate.deletedAt,
  );
  return task ? { task, project, identifier: taskIdentifier(project, task), lane: taskLane(task) } : undefined;
}

// ---------- posts, comments, questions ----------

export interface AddPostOptions {
  type?: PostType;
  title?: string;
  author?: string;
}

export function addPost(store: Store, projectId: number, body: string, opts: AddPostOptions = {}): Post {
  const post: Post = {
    id: nextId(store, "posts"),
    projectId,
    type: opts.type ?? "note",
    title: opts.title ?? "",
    body,
    author: opts.author ?? "user",
    createdAt: now(),
    answeredAt: null,
  };
  writePost(store, projectSlug(store, projectId), post);
  touchProject(store, projectId);
  return post;
}

export function getPost(store: Store, id: number): Post | undefined {
  return board(store).posts.find((post) => post.id === id);
}

export function listComments(store: Store, postId: number): Comment[] {
  return board(store)
    .comments.filter((comment) => comment.postId === postId)
    .sort((a, b) => a.createdAt - b.createdAt || a.id - b.id);
}

/**
 * Reply to a post. A reply from anyone but the asker marks a question answered,
 * which is what takes it off the board's open-questions count.
 */
export function addComment(store: Store, postId: number, body: string, author = "user"): Comment {
  const post = getPost(store, postId);
  if (!post) throw new Error(`Post ${postId} not found`);
  const slug = projectSlug(store, post.projectId);
  const comment: Comment = {
    id: nextId(store, "comments"),
    postId,
    taskId: null,
    projectId: post.projectId,
    body,
    author,
    createdAt: now(),
  };
  writeComment(store, slug, comment);
  if (post.type === "question" && !post.answeredAt && author !== post.author) {
    writePost(store, slug, { ...post, answeredAt: comment.createdAt });
  }
  touchProject(store, post.projectId);
  return comment;
}

/** Questions still waiting on the user, oldest first — the ones blocking an agent. */
export function listOpenQuestions(store: Store, opts: { projectId?: number } = {}): Post[] {
  const live = new Set(listProjects(store, {}).map((project) => project.id));
  return board(store)
    .posts.filter(
      (post) =>
        post.type === "question" &&
        !post.answeredAt &&
        live.has(post.projectId) &&
        (opts.projectId === undefined || post.projectId === opts.projectId),
    )
    .sort((a, b) => a.createdAt - b.createdAt);
}

export interface Answer {
  comment: Comment;
  post: Post;
  projectSlug: string;
}

/**
 * Replies waiting for an agent: comments by somebody else on the posts and
 * questions that agent wrote. This is the return path that closes the loop —
 * an agent posts, the user replies, and the agent reads the reply next session.
 */
export function listAnswers(store: Store, opts: { agentName?: string; since?: number } = {}): Answer[] {
  const data = board(store);
  const mine = opts.agentName ? new Set([opts.agentName, `agent:${opts.agentName}`]) : undefined;
  const since = opts.since ?? 0;
  return data.comments
    .filter((comment) => comment.createdAt > since)
    .flatMap((comment) => {
      const post = data.posts.find((candidate) => candidate.id === comment.postId);
      if (!post) return [];
      if (mine && !mine.has(post.author)) return [];
      if (mine && mine.has(comment.author)) return [];
      const project = data.projects.find((candidate) => candidate.id === post.projectId);
      return project ? [{ comment, post, projectSlug: project.slug }] : [];
    })
    .sort((a, b) => a.comment.createdAt - b.comment.createdAt);
}

// ---------- task replies ----------

export function listTaskComments(store: Store, taskId: number): Comment[] {
  return board(store)
    .comments.filter((comment) => comment.taskId === taskId)
    .sort((a, b) => a.createdAt - b.createdAt || a.id - b.id);
}

/**
 * Reply on a task. Unlike a question post there is no `answeredAt` to stamp —
 * a task already says where it stands through its lane, so a reply is just the
 * conversation between whoever filed the work and whoever picked it up.
 */
export function addTaskComment(store: Store, taskId: number, body: string, author = "user"): Comment {
  const task = getTask(store, taskId);
  if (!task) throw new Error(`Task ${taskId} not found`);
  const comment: Comment = {
    id: nextId(store, "comments"),
    postId: null,
    taskId,
    projectId: task.projectId,
    body,
    author,
    createdAt: now(),
  };
  writeComment(store, projectSlug(store, task.projectId), comment);
  touchProject(store, task.projectId);
  return comment;
}

/**
 * Reply counts for every task in a project, in one pass. The board needs all of
 * them at once, and calling `listTaskComments` per card would re-scan the
 * comment list once per task.
 */
export function taskReplyCounts(store: Store, projectId: number): Map<number, number> {
  const counts = new Map<number, number>();
  for (const comment of board(store).comments) {
    if (comment.taskId === null || comment.projectId !== projectId) continue;
    counts.set(comment.taskId, (counts.get(comment.taskId) ?? 0) + 1);
  }
  return counts;
}

export interface TaskReply {
  comment: Comment;
  task: Task;
  projectSlug: string;
}

/**
 * Replies waiting for an agent on the tasks it claimed — the task-side twin of
 * `listAnswers`. An agent that claims work, reports a blocker, and comes back
 * next session reads what the user said here.
 */
export function listTaskReplies(store: Store, opts: { agentName?: string; since?: number } = {}): TaskReply[] {
  const data = board(store);
  const mine = opts.agentName ? new Set([opts.agentName, `agent:${opts.agentName}`]) : undefined;
  const since = opts.since ?? 0;
  return data.comments
    .filter((comment) => comment.taskId !== null && comment.createdAt > since)
    .flatMap((comment) => {
      const task = data.tasks.find((candidate) => candidate.id === comment.taskId);
      if (!task || task.deletedAt) return [];
      if (mine && !(task.claimedBy !== null && mine.has(task.claimedBy))) return [];
      if (mine && mine.has(comment.author)) return [];
      const project = data.projects.find((candidate) => candidate.id === task.projectId);
      return project ? [{ comment, task, projectSlug: project.slug }] : [];
    })
    .sort((a, b) => a.comment.createdAt - b.comment.createdAt);
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
  addPost(store, existing.projectId, `Resolved warning: ${existing.message}${opts.note ? ` — ${opts.note}` : ""}`, {
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

/** Local-midnight-aligned day buckets, oldest first. Shared by the card and board charts. */
function bucketByDay(posts: Post[], days: number, projectId?: number): number[] {
  const end = new Date();
  end.setHours(24, 0, 0, 0); // end of today
  const startMs = end.getTime() - days * 24 * 60 * 60 * 1000;
  const counts = new Array<number>(days).fill(0);
  const dayMs = 24 * 60 * 60 * 1000;
  for (const post of posts) {
    if (projectId !== undefined && post.projectId !== projectId) continue;
    if (post.createdAt <= startMs) continue;
    const bucket = Math.floor((post.createdAt - startMs) / dayMs);
    if (bucket >= 0 && bucket < days) counts[bucket]++;
  }
  return counts;
}

/**
 * Updates-per-day buckets for the last `days` days, oldest first —
 * sparkline data for project cards. Buckets are local-midnight aligned.
 */
export function getActivityCounts(store: Store, projectId: number, days = 14): number[] {
  return bucketByDay(board(store).posts, days, projectId);
}

/** The same buckets across every project — the board's pulse chart. */
export function getWorkspaceActivityCounts(store: Store, days = 30): number[] {
  return bucketByDay(board(store).posts, days);
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
  const detail = getProjectDetail(store, ref, { postsLimit: 0 });
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
    posts: Post[];
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
      posts: data.posts.filter((post) => post.projectId === project.id && post.createdAt > since).sort(byNewest),
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
