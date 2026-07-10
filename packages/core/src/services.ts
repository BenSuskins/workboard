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
  type Task,
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

export interface ProjectDetail {
  project: Project;
  tasks: Task[];
  updates: Update[];
  links: (Link & { snapshot: Snapshot | null })[];
  latestSummary: Summary | null;
  openWarnings: Warning[];
}

export function getProjectDetail(db: Db, ref: number | string, opts: { updatesLimit?: number } = {}): ProjectDetail | undefined {
  const project = getProject(db, ref);
  if (!project) return undefined;
  const projectTasks = db
    .select()
    .from(tasks)
    .where(eq(tasks.projectId, project.id))
    .orderBy(sql`CASE ${tasks.status} WHEN 'in_progress' THEN 0 WHEN 'todo' THEN 1 ELSE 2 END`, desc(tasks.updatedAt))
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
    .where(eq(links.projectId, project.id))
    .all()
    .map((row) => ({ ...row.links, snapshot: row.snapshots }));
  const latestSummary =
    db
      .select()
      .from(summaries)
      .where(and(eq(summaries.projectId, project.id), eq(summaries.kind, "project_summary")))
      .orderBy(desc(summaries.createdAt))
      .limit(1)
      .get() ?? null;
  const openWarnings = listWarnings(db, { projectId: project.id });
  return { project, tasks: projectTasks, updates: projectUpdates, links: projectLinks, latestSummary, openWarnings };
}

function touchProject(db: Db, projectId: number) {
  db.update(projects).set({ lastActivityAt: now() }).where(eq(projects.id, projectId)).run();
}

// ---------- tasks ----------

export function addTask(db: Db, projectId: number, title: string, opts: { dueDate?: string; author?: string; status?: TaskStatus } = {}): Task {
  const t = now();
  const task = db
    .insert(tasks)
    .values({
      projectId,
      title,
      status: opts.status ?? "todo",
      dueDate: opts.dueDate ?? null,
      author: opts.author ?? "user",
      createdAt: t,
      updatedAt: t,
    })
    .returning()
    .get();
  touchProject(db, projectId);
  return task;
}

export function updateTask(db: Db, id: number, input: { title?: string; status?: TaskStatus; dueDate?: string | null }): Task {
  const task = db
    .update(tasks)
    .set({ ...input, updatedAt: now() })
    .where(eq(tasks.id, id))
    .returning()
    .get();
  if (!task) throw new Error(`Task ${id} not found`);
  touchProject(db, task.projectId);
  return task;
}

export function deleteTask(db: Db, id: number): void {
  db.delete(tasks).where(eq(tasks.id, id)).run();
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

export function saveReport(db: Db, kind: "digest" | "triage", body: string, generatedBy = "agent"): Summary {
  return db.insert(summaries).values({ projectId: null, kind, body, generatedBy, createdAt: now() }).returning().get();
}

export function listReports(db: Db, kind?: "digest" | "triage", limit = 50): Summary[] {
  const cond = kind
    ? and(isNull(summaries.projectId), eq(summaries.kind, kind))
    : and(isNull(summaries.projectId), inArray(summaries.kind, ["digest", "triage"]));
  return db.select().from(summaries).where(cond).orderBy(desc(summaries.createdAt)).limit(limit).all();
}

export function latestReport(db: Db, kind: "digest" | "triage"): Summary | undefined {
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

export function deleteLink(db: Db, id: number): void {
  db.delete(links).where(eq(links.id, id)).run();
}

export function saveSnapshot(db: Db, linkId: number, data: unknown): void {
  db.insert(snapshots)
    .values({ linkId, data, fetchedAt: now() })
    .onConflictDoUpdate({ target: snapshots.linkId, set: { data, fetchedAt: now() } })
    .run();
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
    .where(sql`${projects.status} != 'archived'`)
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
        .where(and(eq(tasks.projectId, project.id), inArray(tasks.status, ["todo", "in_progress"])))
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
        .where(eq(links.projectId, project.id))
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
