import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import type {
  LinkKind,
  LinkProvider,
  ProjectHealth,
  ProjectPriority,
  ProjectStatus,
  RepoScope,
  SummaryKind,
  TaskPriority,
  TaskStatus,
  UpdateType,
  WarningSeverity,
  WarningStatus,
} from "../domain.js";

export const projects = sqliteTable(
  "projects",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    category: text("category").notNull().default("coding"),
    status: text("status").$type<ProjectStatus>().notNull().default("active"),
    priority: text("priority").$type<ProjectPriority>().notNull().default("medium"),
    health: text("health").$type<ProjectHealth>().notNull().default("green"),
    /** Starred by the user; pinned projects lead the board. */
    pinned: integer("pinned").notNull().default(0),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    lastActivityAt: integer("last_activity_at").notNull(),
  },
  (t) => [index("projects_status_idx").on(t.status)],
);

export const tasks = sqliteTable(
  "tasks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    /** The spec: problem, constraints, acceptance criteria (markdown). */
    description: text("description").notNull().default(""),
    status: text("status").$type<TaskStatus>().notNull().default("todo"),
    priority: text("priority").$type<TaskPriority>(),
    /** Queued for agents to claim over MCP (shared pull queue — no named assignees). */
    agentReady: integer("agent_ready").notNull().default(0),
    claimedBy: text("claimed_by"),
    claimedAt: integer("claimed_at"),
    dueDate: text("due_date"),
    author: text("author").notNull().default("user"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    deletedAt: integer("deleted_at"),
  },
  (t) => [index("tasks_project_idx").on(t.projectId)],
);

export const updates = sqliteTable(
  "updates",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    type: text("type").$type<UpdateType>().notNull().default("note"),
    body: text("body").notNull(),
    author: text("author").notNull().default("user"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("updates_project_idx").on(t.projectId), index("updates_created_idx").on(t.createdAt)],
);

export const summaries = sqliteTable(
  "summaries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    // null for cross-project digests / triage reports
    projectId: integer("project_id").references(() => projects.id, { onDelete: "cascade" }),
    kind: text("kind").$type<SummaryKind>().notNull(),
    body: text("body").notNull(),
    generatedBy: text("generated_by").notNull().default("agent"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("summaries_project_idx").on(t.projectId), index("summaries_kind_idx").on(t.kind)],
);

export const links = sqliteTable(
  "links",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    provider: text("provider").$type<LinkProvider>().notNull(),
    kind: text("kind").$type<LinkKind>().notNull(),
    url: text("url").notNull(),
    // repo full name, "owner/repo#123" for PRs/issues, Jira key, Drive file id
    externalId: text("external_id"),
    title: text("title").notNull().default(""),
    scope: text("scope", { mode: "json" }).$type<RepoScope | null>(),
    createdAt: integer("created_at").notNull(),
    deletedAt: integer("deleted_at"),
  },
  (t) => [index("links_project_idx").on(t.projectId)],
);

/** One row per link: outcome of the most recent sync attempt, kept across successes and failures. */
export const syncState = sqliteTable("sync_state", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  linkId: integer("link_id")
    .notNull()
    .unique()
    .references(() => links.id, { onDelete: "cascade" }),
  lastAttemptAt: integer("last_attempt_at").notNull(),
  lastSuccessAt: integer("last_success_at"),
  lastError: text("last_error"),
});

export const warnings = sqliteTable(
  "warnings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    severity: text("severity").$type<WarningSeverity>().notNull().default("warning"),
    message: text("message").notNull(),
    suggestedAction: text("suggested_action"),
    status: text("status").$type<WarningStatus>().notNull().default("open"),
    raisedBy: text("raised_by").notNull().default("agent"),
    createdAt: integer("created_at").notNull(),
    resolvedAt: integer("resolved_at"),
  },
  (t) => [index("warnings_project_idx").on(t.projectId), index("warnings_status_idx").on(t.status)],
);

export const snapshots = sqliteTable(
  "snapshots",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    linkId: integer("link_id")
      .notNull()
      .unique()
      .references(() => links.id, { onDelete: "cascade" }),
    data: text("data", { mode: "json" }).notNull(),
    fetchedAt: integer("fetched_at").notNull(),
  },
);

export type NewProject = typeof projects.$inferInsert;

/**
 * The domain owns the entity shapes; these tables must keep producing exactly
 * those shapes while SQLite is still the store. Mutual assignability fails the
 * build if a column and its domain field ever drift apart.
 */
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
type _RowsMatchDomain = [
  Exact<typeof projects.$inferSelect, import("../domain.js").Project>,
  Exact<typeof tasks.$inferSelect, import("../domain.js").Task>,
  Exact<typeof updates.$inferSelect, import("../domain.js").Update>,
  Exact<typeof summaries.$inferSelect, import("../domain.js").Summary>,
  Exact<typeof links.$inferSelect, import("../domain.js").Link>,
  Exact<typeof warnings.$inferSelect, import("../domain.js").Warning>,
  Exact<typeof syncState.$inferSelect, import("../domain.js").SyncState>,
  Exact<typeof snapshots.$inferSelect, import("../domain.js").Snapshot>,
];
