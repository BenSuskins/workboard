/**
 * The domain vocabulary — enums, entity shapes, and the value types they carry.
 * Storage-independent on purpose: nothing here imports a database driver, so the
 * store implementation can change without the domain moving with it.
 */

export const PROJECT_STATUSES = ["active", "blocked", "on_hold", "done", "archived"] as const;
export const PROJECT_HEALTHS = ["green", "amber", "red"] as const;
export const PROJECT_PRIORITIES = ["high", "medium", "low"] as const;
export const CATEGORY_PRESETS = ["coding", "platform", "hiring", "process", "other"] as const;
/** Identity hues a project tile can take. A fixed set, so every tile stays legible in both themes. */
export const PROJECT_ACCENTS = ["orange", "purple", "green", "blue", "pink", "amber", "teal", "red"] as const;
/** `blocked` is work an agent picked up and could not finish — it stays attributed, out of the queue. */
export const TASK_STATUSES = ["todo", "in_progress", "blocked", "done"] as const;
/** Null priority sorts last — unprioritized work trails prioritized work in the queue. */
export const TASK_PRIORITIES = ["high", "medium", "low"] as const;
/** A question expects an answer from the user; everything else is a report of work. */
export const POST_TYPES = ["note", "status_change", "agent_update", "question"] as const;
export const SUMMARY_KINDS = ["project_summary", "digest", "triage", "accomplishments"] as const;
export const LINK_PROVIDERS = ["github", "jira", "gdoc", "url"] as const;
export const LINK_KINDS = ["repo", "pr", "issue", "jira_project", "jira_issue", "doc", "url"] as const;
export const WARNING_SEVERITIES = ["info", "warning", "critical"] as const;
export const WARNING_STATUSES = ["open", "resolved"] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type ProjectHealth = (typeof PROJECT_HEALTHS)[number];
export type ProjectPriority = (typeof PROJECT_PRIORITIES)[number];
export type ProjectAccent = (typeof PROJECT_ACCENTS)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export type PostType = (typeof POST_TYPES)[number];
export type SummaryKind = (typeof SUMMARY_KINDS)[number];
export type LinkProvider = (typeof LINK_PROVIDERS)[number];
export type LinkKind = (typeof LINK_KINDS)[number];
export type WarningSeverity = (typeof WARNING_SEVERITIES)[number];
export type WarningStatus = (typeof WARNING_STATUSES)[number];

/** Narrows a monorepo link to one project's slice of it. */
export interface RepoScope {
  labels?: string[];
  pathPrefixes?: string[];
  branchPrefix?: string;
}

export interface Project {
  id: number;
  slug: string;
  /**
   * Short uppercase prefix on every issue identifier in this project — `ENG` in
   * `ENG-12`. Unique across the board, so an identifier names exactly one issue.
   */
  key: string;
  name: string;
  description: string;
  category: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  health: ProjectHealth;
  /** 0 or 1 — starred by the user; pinned projects lead the board. */
  pinned: number;
  /** One emoji shown on the project tile. Null falls back to the project's initial. */
  icon: string | null;
  /** Tile hue. Null derives a stable hue from the slug, so every project still reads apart. */
  accent: ProjectAccent | null;
  createdAt: number;
  updatedAt: number;
  lastActivityAt: number;
}

export interface Task {
  /** Board-wide, and what every file and API takes. */
  id: number;
  projectId: number;
  /**
   * Position in this project's own sequence — the `12` in `ENG-12`. Separate
   * from `id` so the name a person says stays short and stays with the project.
   */
  number: number;
  title: string;
  /** Markdown spec a claiming agent works from. */
  description: string;
  status: TaskStatus;
  priority: TaskPriority | null;
  /**
   * Who owns this — `"user"` for you, or an agent's name. Workboard is one
   * person plus agents, so this is a plain name rather than a member reference.
   * A claim sets it, which is why `claimedBy` and this never disagree.
   */
  assignee: string | null;
  /** Free-form tags, normalized lowercase and deduped. No label entity to keep in sync. */
  labels: string[];
  /** 0 or 1 — queued for agents to claim. */
  agentReady: number;
  claimedBy: string | null;
  claimedAt: number | null;
  dueDate: string | null;
  author: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface Post {
  id: number;
  projectId: number;
  type: PostType;
  /** Long-form posts carry a headline; short notes and status changes leave it empty. */
  title: string;
  body: string;
  author: string;
  createdAt: number;
  /** Set on a question once someone other than its author replies. */
  answeredAt: number | null;
}

/** A reply, on either a post or a task. Exactly one of `postId` / `taskId` is set. */
export interface Comment {
  id: number;
  postId: number | null;
  taskId: number | null;
  projectId: number;
  body: string;
  author: string;
  createdAt: number;
}

export interface Summary {
  /** Null project means a cross-project report (digest / triage / accomplishments). */
  id: number;
  projectId: number | null;
  kind: SummaryKind;
  body: string;
  generatedBy: string;
  createdAt: number;
}

export interface Link {
  id: number;
  projectId: number;
  provider: LinkProvider;
  kind: LinkKind;
  url: string;
  externalId: string | null;
  title: string;
  scope: RepoScope | null;
  createdAt: number;
  deletedAt: number | null;
}

export interface Warning {
  id: number;
  projectId: number;
  severity: WarningSeverity;
  message: string;
  suggestedAction: string | null;
  status: WarningStatus;
  raisedBy: string;
  createdAt: number;
  resolvedAt: number | null;
}

export interface SyncState {
  id: number;
  linkId: number;
  lastAttemptAt: number;
  lastSuccessAt: number | null;
  lastError: string | null;
}

export interface Snapshot {
  id: number;
  linkId: number;
  data: unknown;
  fetchedAt: number;
}
