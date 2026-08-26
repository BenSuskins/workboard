/**
 * The domain vocabulary — enums, entity shapes, and the value types they carry.
 * Storage-independent on purpose: nothing here imports a database driver, so the
 * store implementation can change without the domain moving with it.
 */

export const PROJECT_STATUSES = ["active", "blocked", "on_hold", "done", "archived"] as const;
export const PROJECT_HEALTHS = ["green", "amber", "red"] as const;
export const PROJECT_PRIORITIES = ["high", "medium", "low"] as const;
export const CATEGORY_PRESETS = ["coding", "platform", "hiring", "process", "other"] as const;
export const TASK_STATUSES = ["todo", "in_progress", "done"] as const;
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
  name: string;
  description: string;
  category: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  health: ProjectHealth;
  /** 0 or 1 — starred by the user; pinned projects lead the board. */
  pinned: number;
  createdAt: number;
  updatedAt: number;
  lastActivityAt: number;
}

export interface Task {
  id: number;
  projectId: number;
  title: string;
  /** Markdown spec a claiming agent works from. */
  description: string;
  status: TaskStatus;
  priority: TaskPriority | null;
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

export interface Comment {
  id: number;
  postId: number;
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
