import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const PROJECT_STATUSES = ["active", "blocked", "on_hold", "done", "archived"] as const;
export const PROJECT_HEALTHS = ["green", "amber", "red"] as const;
export const PROJECT_PRIORITIES = ["high", "medium", "low"] as const;
export const CATEGORY_PRESETS = ["coding", "platform", "hiring", "process", "other"] as const;
export const TASK_STATUSES = ["todo", "in_progress", "done"] as const;
export const UPDATE_TYPES = ["note", "status_change", "agent_update"] as const;
export const SUMMARY_KINDS = ["project_summary", "digest", "triage"] as const;
export const LINK_PROVIDERS = ["github", "jira", "gdoc", "url"] as const;
export const LINK_KINDS = ["repo", "pr", "issue", "jira_project", "jira_issue", "doc", "url"] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type ProjectHealth = (typeof PROJECT_HEALTHS)[number];
export type ProjectPriority = (typeof PROJECT_PRIORITIES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type UpdateType = (typeof UPDATE_TYPES)[number];
export type SummaryKind = (typeof SUMMARY_KINDS)[number];
export type LinkProvider = (typeof LINK_PROVIDERS)[number];
export type LinkKind = (typeof LINK_KINDS)[number];

/** Narrows a monorepo link to one project's slice of it. */
export interface RepoScope {
  labels?: string[];
  pathPrefixes?: string[];
  branchPrefix?: string;
}

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
    status: text("status").$type<TaskStatus>().notNull().default("todo"),
    dueDate: text("due_date"),
    author: text("author").notNull().default("user"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
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
  },
  (t) => [index("links_project_idx").on(t.projectId)],
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

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type Update = typeof updates.$inferSelect;
export type Summary = typeof summaries.$inferSelect;
export type Link = typeof links.$inferSelect;
export type Snapshot = typeof snapshots.$inferSelect;
