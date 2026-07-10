import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  addLink,
  addTask,
  addUpdate,
  createProject,
  findProject,
  getActivity,
  getProjectDetail,
  getProject,
  integrationStatus,
  listProjects,
  listReports,
  listSummaryHistory,
  PROJECT_HEALTHS,
  PROJECT_PRIORITIES,
  PROJECT_STATUSES,
  raiseWarning,
  resolveWarning,
  saveReport,
  syncProject,
  TASK_STATUSES,
  updateProject,
  updateTask,
  upsertSummary,
  WARNING_SEVERITIES,
  type Db,
  type Project,
  type Warning,
} from "@workboard/core";

const statusEnum = z.enum(PROJECT_STATUSES);
const healthEnum = z.enum(PROJECT_HEALTHS);
const priorityEnum = z.enum(PROJECT_PRIORITIES);
const taskStatusEnum = z.enum(TASK_STATUSES);

const projectRef = z
  .union([z.number(), z.string()])
  .describe("Project id (number) or slug (string)");

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function resolveProject(db: Db, ref: number | string): Project {
  const project = getProject(db, typeof ref === "string" && /^\d+$/.test(ref) ? Number(ref) : ref);
  if (!project) throw new Error(`No project found for "${ref}". Use list_projects to see available projects.`);
  return project;
}

function warningCard(w: Warning) {
  return {
    id: w.id,
    severity: w.severity,
    message: w.message,
    suggestedAction: w.suggestedAction,
    raisedBy: w.raisedBy,
    at: new Date(w.createdAt).toISOString(),
  };
}

function projectCard(p: Project) {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    category: p.category,
    status: p.status,
    priority: p.priority,
    health: p.health,
    description: p.description,
    lastActivityAt: new Date(p.lastActivityAt).toISOString(),
  };
}

export function registerTools(server: McpServer, db: Db): void {
  server.registerTool(
    "list_projects",
    {
      title: "List projects",
      description:
        "List Workboard projects (all non-archived by default). Filter by status, category, or health. Returns id, slug, name, status, priority, health, and last activity.",
      inputSchema: {
        status: statusEnum.optional(),
        category: z.string().optional(),
        health: healthEnum.optional(),
        include_archived: z.boolean().optional(),
      },
    },
    async ({ status, category, health, include_archived }) => {
      const projects = listProjects(db, { status, category, health, includeArchived: include_archived });
      return json(projects.map(projectCard));
    },
  );

  server.registerTool(
    "get_project",
    {
      title: "Get project context",
      description:
        "Full context for one project: description/goal, status, tasks, recent updates, linked PRs/tickets/docs with cached live status, the latest AI summary, and recent summary history. Use this to ground your work in what the project is about.",
      inputSchema: { project: projectRef },
    },
    async ({ project }) => {
      const detail = getProjectDetail(db, typeof project === "string" && /^\d+$/.test(project) ? Number(project) : project);
      if (!detail) throw new Error(`No project found for "${project}". Use list_projects to see available projects.`);
      const history = listSummaryHistory(db, detail.project.id, 5);
      return json({
        ...projectCard(detail.project),
        openWarnings: detail.openWarnings.map(warningCard),
        latestSummary: detail.latestSummary
          ? { body: detail.latestSummary.body, generatedAt: new Date(detail.latestSummary.createdAt).toISOString() }
          : null,
        summaryHistory: history.slice(1).map((s) => ({
          body: s.body,
          generatedBy: s.generatedBy,
          at: new Date(s.createdAt).toISOString(),
        })),
        tasks: detail.tasks.map((t) => ({ id: t.id, title: t.title, status: t.status, dueDate: t.dueDate })),
        updates: detail.updates.slice(0, 20).map((u) => ({
          type: u.type,
          author: u.author,
          body: u.body,
          at: new Date(u.createdAt).toISOString(),
        })),
        links: detail.links.map((l) => ({
          id: l.id,
          provider: l.provider,
          kind: l.kind,
          url: l.url,
          externalId: l.externalId,
          title: l.title,
          scope: l.scope,
          snapshot: l.snapshot?.data ?? null,
          snapshotFetchedAt: l.snapshot ? new Date(l.snapshot.fetchedAt).toISOString() : null,
          syncError: l.syncState?.lastError ?? null,
        })),
      });
    },
  );

  server.registerTool(
    "find_project",
    {
      title: "Find which project some work belongs to",
      description:
        "Resolve monorepo work to a Workboard project. A repo hosts many projects, so never assume repo = project — pass the PR number, branch name, changed file paths, and/or PR labels and this returns ranked candidates (exact PR link > scope match > bare repo link). If several candidates come back, ask the user which one applies.",
      inputSchema: {
        repo: z.string().describe('Repository full name, e.g. "acme/platform"'),
        pr_number: z.number().optional(),
        branch: z.string().optional().describe("Current branch name"),
        paths: z.array(z.string()).optional().describe("Changed file paths"),
        labels: z.array(z.string()).optional().describe("PR labels"),
      },
    },
    async ({ repo, pr_number, branch, paths, labels }) => {
      const matches = findProject(db, { repo, prNumber: pr_number, branch, paths, labels });
      return json({
        matches: matches.map((m) => ({ ...projectCard(m.project), confidence: m.confidence, reason: m.reason })),
        hint:
          matches.length === 0
            ? "No matching project. Use list_projects to browse, or create_project to register this work."
            : matches.length > 1
              ? "Multiple candidates — confirm with the user before posting updates."
              : undefined,
      });
    },
  );

  server.registerTool(
    "create_project",
    {
      title: "Create project",
      description:
        "Register a new project on the Workboard. Category presets: coding, platform, hiring, process, other (free-form allowed). Optionally attach initial links (PRs, repos, Jira, docs) — provider/kind are inferred from each URL.",
      inputSchema: {
        name: z.string(),
        description: z.string().optional().describe("What this project is and its goal (markdown)"),
        category: z.string().optional(),
        priority: priorityEnum.optional(),
        links: z.array(z.object({ url: z.string(), title: z.string().optional() })).optional(),
      },
    },
    async ({ name, description, category, priority, links: initialLinks }) => {
      const project = createProject(db, { name, description, category, priority });
      for (const l of initialLinks ?? []) addLink(db, project.id, { url: l.url, title: l.title });
      return json({ created: projectCard(project) });
    },
  );

  server.registerTool(
    "update_project",
    {
      title: "Update project",
      description: "Change a project's status, health, priority, name, category, or description. Status changes are logged to the activity timeline.",
      inputSchema: {
        project: projectRef,
        name: z.string().optional(),
        description: z.string().optional(),
        category: z.string().optional(),
        status: statusEnum.optional(),
        priority: priorityEnum.optional(),
        health: healthEnum.optional(),
        agent_name: z.string().optional().describe("Your agent name, for attribution"),
      },
    },
    async ({ project, agent_name, ...fields }) => {
      const target = resolveProject(db, project);
      const updated = updateProject(db, target.id, fields, agent_name ? `agent:${agent_name}` : "agent");
      return json({ updated: projectCard(updated) });
    },
  );

  server.registerTool(
    "add_update",
    {
      title: "Post a progress update",
      description:
        "Append a progress note to a project's activity timeline — what you shipped, decided, or are blocked on. Markdown supported. This is the primary way agents log work.",
      inputSchema: {
        project: projectRef,
        body: z.string().describe("The update, in markdown"),
        agent_name: z.string().optional().describe("Your agent name, for attribution"),
      },
    },
    async ({ project, body, agent_name }) => {
      const target = resolveProject(db, project);
      const update = addUpdate(db, target.id, body, {
        type: "agent_update",
        author: agent_name ? `agent:${agent_name}` : "agent",
      });
      return json({ posted: { id: update.id, project: target.slug, at: new Date(update.createdAt).toISOString() } });
    },
  );

  server.registerTool(
    "add_task",
    {
      title: "Add task",
      description: "Add a task/TODO to a project.",
      inputSchema: {
        project: projectRef,
        title: z.string(),
        due_date: z.string().optional().describe("ISO date, e.g. 2026-07-15"),
        agent_name: z.string().optional(),
      },
    },
    async ({ project, title, due_date, agent_name }) => {
      const target = resolveProject(db, project);
      const task = addTask(db, target.id, title, { dueDate: due_date, author: agent_name ? `agent:${agent_name}` : "agent" });
      return json({ created: { id: task.id, title: task.title, status: task.status, project: target.slug } });
    },
  );

  server.registerTool(
    "update_task",
    {
      title: "Update task",
      description: "Change a task's status (todo | in_progress | done), title, or due date.",
      inputSchema: {
        task_id: z.number(),
        status: taskStatusEnum.optional(),
        title: z.string().optional(),
        due_date: z.string().nullable().optional(),
      },
    },
    async ({ task_id, status, title, due_date }) => {
      const task = updateTask(db, task_id, { status, title, dueDate: due_date });
      return json({ updated: { id: task.id, title: task.title, status: task.status } });
    },
  );

  server.registerTool(
    "add_link",
    {
      title: "Link a PR, issue, repo, ticket, or doc",
      description:
        "Attach an external resource to a project. Provider and kind are inferred from the URL (GitHub PR/issue/repo, Jira, Google Doc, plain URL). For repo links in a monorepo, pass a scope (labels / path_prefixes / branch_prefix) so only this project's PRs are discovered.",
      inputSchema: {
        project: projectRef,
        url: z.string(),
        title: z.string().optional(),
        scope: z
          .object({
            labels: z.array(z.string()).optional(),
            path_prefixes: z.array(z.string()).optional(),
            branch_prefix: z.string().optional(),
          })
          .optional()
          .describe("Repo links only: narrow the monorepo to this project's slice"),
      },
    },
    async ({ project, url, title, scope }) => {
      const target = resolveProject(db, project);
      const link = addLink(db, target.id, {
        url,
        title,
        scope: scope ? { labels: scope.labels, pathPrefixes: scope.path_prefixes, branchPrefix: scope.branch_prefix } : undefined,
      });
      return json({ linked: { id: link.id, provider: link.provider, kind: link.kind, externalId: link.externalId, project: target.slug } });
    },
  );

  server.registerTool(
    "upsert_summary",
    {
      title: "Write the project's AI summary",
      description:
        "Write or refresh a project's status summary (markdown, 2–6 sentences). Shown on the project's dashboard card and page. Synthesize from the project's goal, recent updates, tasks, and linked PR/ticket status — write it after finishing a work session.",
      inputSchema: {
        project: projectRef,
        body: z.string().describe("The summary, in markdown"),
        agent_name: z.string().optional(),
      },
    },
    async ({ project, body, agent_name }) => {
      const target = resolveProject(db, project);
      const summary = upsertSummary(db, target.id, body, agent_name ? `agent:${agent_name}` : "agent");
      return json({ saved: { id: summary.id, project: target.slug, at: new Date(summary.createdAt).toISOString() } });
    },
  );

  server.registerTool(
    "raise_warning",
    {
      title: "Raise a warning on a project",
      description:
        "Flag something on a project that needs the user's attention — it appears prominently on the dashboard until resolved. Use for things you cannot fix yourself: a blocked dependency, failing CI you can't repair, a decision needed, a deadline at risk. Include a concrete suggested_action the user can take. Severities: info < warning < critical (critical = needs intervention now).",
      inputSchema: {
        project: projectRef,
        message: z.string().describe("One or two sentences: what is wrong and why it matters"),
        severity: z.enum(WARNING_SEVERITIES).optional().describe("Defaults to 'warning'"),
        suggested_action: z.string().optional().describe("The concrete action that would resolve this"),
        agent_name: z.string().optional().describe("Your agent name, for attribution"),
      },
    },
    async ({ project, message, severity, suggested_action, agent_name }) => {
      const target = resolveProject(db, project);
      const warning = raiseWarning(db, target.id, {
        message,
        severity,
        suggestedAction: suggested_action,
        raisedBy: agent_name ? `agent:${agent_name}` : "agent",
      });
      return json({ raised: { ...warningCard(warning), project: target.slug } });
    },
  );

  server.registerTool(
    "resolve_warning",
    {
      title: "Resolve a warning",
      description:
        "Mark a warning as resolved (it disappears from the dashboard; a resolution note is logged to the project's activity). Use when the condition that triggered it no longer holds. Warning ids come from get_project / get_activity.",
      inputSchema: {
        warning_id: z.number(),
        note: z.string().optional().describe("How it was resolved"),
        agent_name: z.string().optional(),
      },
    },
    async ({ warning_id, note, agent_name }) => {
      const resolved = resolveWarning(db, warning_id, {
        note,
        resolvedBy: agent_name ? `agent:${agent_name}` : "agent",
      });
      return json({ resolved: { id: resolved.id, status: resolved.status } });
    },
  );

  server.registerTool(
    "get_activity",
    {
      title: "Cross-project activity feed",
      description:
        "Raw material for digests and triage: every non-archived project with its latest summary, updates since the given time, open tasks, and cached PR/ticket/doc status. Defaults to the last 7 days.",
      inputSchema: {
        since: z.string().optional().describe("ISO timestamp; defaults to 7 days ago"),
      },
    },
    async ({ since }) => {
      const sinceMs = since ? Date.parse(since) : Date.now() - 7 * 24 * 60 * 60 * 1000;
      if (Number.isNaN(sinceMs)) throw new Error(`Could not parse "${since}" as a date`);
      const feed = getActivity(db, sinceMs);
      return json({
        since: new Date(feed.since).toISOString(),
        integrations: integrationStatus(),
        projects: feed.projects.map((p) => ({
          ...projectCard(p.project),
          latestSummary: p.latestSummary,
          openWarnings: p.openWarnings.map(warningCard),
          updates: p.updates.map((u) => ({ type: u.type, author: u.author, body: u.body, at: new Date(u.createdAt).toISOString() })),
          openTasks: p.openTasks.map((t) => ({ title: t.title, status: t.status, dueDate: t.dueDate })),
          links: p.links,
        })),
      });
    },
  );

  server.registerTool(
    "save_report",
    {
      title: "Save a digest or triage report",
      description:
        "Persist a cross-project report to the Workboard reports page. kind=digest for daily/weekly 'where everything stands' briefings; kind=triage for stale/blocked/risk analysis with suggested next actions. Markdown.",
      inputSchema: {
        kind: z.enum(["digest", "triage"]),
        body: z.string().describe("The report, in markdown"),
        agent_name: z.string().optional(),
      },
    },
    async ({ kind, body, agent_name }) => {
      const report = saveReport(db, kind, body, agent_name ? `agent:${agent_name}` : "agent");
      return json({ saved: { id: report.id, kind, at: new Date(report.createdAt).toISOString() } });
    },
  );

  server.registerTool(
    "list_reports",
    {
      title: "List past digests/triage reports",
      description: "Recent digest and triage reports, newest first.",
      inputSchema: {
        kind: z.enum(["digest", "triage"]).optional(),
        limit: z.number().optional(),
      },
    },
    async ({ kind, limit }) => {
      const reports = listReports(db, kind, limit ?? 10);
      return json(
        reports.map((r) => ({ id: r.id, kind: r.kind, generatedBy: r.generatedBy, at: new Date(r.createdAt).toISOString(), body: r.body })),
      );
    },
  );

  server.registerTool(
    "refresh_project",
    {
      title: "Refresh live integration data",
      description:
        "Re-fetch GitHub/Jira/Google Doc status for a project's links and update the cached snapshots. Integrations without credentials are skipped.",
      inputSchema: { project: projectRef },
    },
    async ({ project }) => {
      const target = resolveProject(db, project);
      const results = await syncProject(db, target.id);
      return json({ project: target.slug, integrations: integrationStatus(), results });
    },
  );
}
