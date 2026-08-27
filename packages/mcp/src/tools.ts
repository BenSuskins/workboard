import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  addLink,
  addTask,
  addTaskComment,
  addComment,
  addPost,
  claimTask,
  createProject,
  findProject,
  getActivity,
  getPost,
  getProjectDetail,
  getProject,
  getProjectMetrics,
  integrationStatus,
  listProjects,
  listAnswers,
  listOpenQuestions,
  listLabels,
  listQueuedTasks,
  listReports,
  listTasks,
  listTaskComments,
  listTaskReplies,
  listSummaryHistory,
  PROJECT_HEALTHS,
  PROJECT_ACCENTS,
  PROJECT_PRIORITIES,
  PROJECT_STATUSES,
  raiseWarning,
  resolveWarning,
  saveReport,
  syncProject,
  TASK_LANES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  taskIdentifier,
  updateProject,
  updateTask,
  upsertSummary,
  WARNING_SEVERITIES,
  type Store,
  type Project,
  type Task,
  type TaskRow,
  type Warning,
} from "@workboard/core";

const statusEnum = z.enum(PROJECT_STATUSES);
const healthEnum = z.enum(PROJECT_HEALTHS);
const priorityEnum = z.enum(PROJECT_PRIORITIES);
const accentEnum = z.enum(PROJECT_ACCENTS);
const taskStatusEnum = z.enum(TASK_STATUSES);
const taskPriorityEnum = z.enum(TASK_PRIORITIES);
const taskLaneEnum = z.enum(TASK_LANES);

const projectRef = z
  .union([z.number(), z.string()])
  .describe("Project id (number) or slug (string)");

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function resolveProject(db: Store, ref: number | string): Project {
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

/**
 * The shape every tool reports a task in. `identifier` is the name a person uses
 * for it — put it in branch names, commit messages and PR titles so the work and
 * the board can be matched up later.
 */
function taskCard(db: Store, t: Task) {
  const project = getProject(db, t.projectId);
  return {
    id: t.id,
    identifier: project ? taskIdentifier(project, t) : null,
    project: t.projectId,
    project_slug: project?.slug ?? null,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    assignee: t.assignee,
    labels: t.labels,
    agent_ready: Boolean(t.agentReady),
    claimed_by: t.claimedBy,
    due_date: t.dueDate,
    updated_at: new Date(t.updatedAt).toISOString(),
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

export function registerTools(server: McpServer, db: Store): void {
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
      const metrics = getProjectMetrics(db, detail.project.id);
      return json({
        ...projectCard(detail.project),
        pinned: Boolean(detail.project.pinned),
        metrics: metrics && {
          tasksTotal: metrics.tasksTotal,
          tasksDone: metrics.tasksDone,
          openPrs: metrics.openPrs,
          mergedRecently: metrics.mergedRecently,
          daysSinceActivity: metrics.daysSinceActivity,
        },
        openWarnings: detail.openWarnings.map(warningCard),
        latestSummary: detail.latestSummary
          ? { body: detail.latestSummary.body, generatedAt: new Date(detail.latestSummary.createdAt).toISOString() }
          : null,
        summaryHistory: history.slice(1).map((s) => ({
          body: s.body,
          generatedBy: s.generatedBy,
          at: new Date(s.createdAt).toISOString(),
        })),
        tasks: detail.tasks.map((t) => ({ id: t.id, title: t.title, description: t.description, status: t.status, priority: t.priority, dueDate: t.dueDate })),
        posts: detail.posts.slice(0, 20).map((post) => ({
          id: post.id,
          type: post.type,
          title: post.title,
          author: post.author,
          body: post.body,
          at: new Date(post.createdAt).toISOString(),
          answeredAt: post.answeredAt ? new Date(post.answeredAt).toISOString() : null,
          comments: detail.comments
            .filter((comment) => comment.postId === post.id)
            .map((comment) => ({ id: comment.id, author: comment.author, body: comment.body, at: new Date(comment.createdAt).toISOString() })),
        })),
        openQuestions: listOpenQuestions(db, { projectId: detail.project.id }).map((q) => ({
          id: q.id,
          title: q.title || q.body.slice(0, 80),
          askedBy: q.author,
          at: new Date(q.createdAt).toISOString(),
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
        icon: z.string().optional().describe("One emoji for the project tile"),
        accent: accentEnum.optional().describe("Tile hue; omit to derive one from the name"),
        links: z.array(z.object({ url: z.string(), title: z.string().optional() })).optional(),
      },
    },
    async ({ name, description, category, priority, icon, accent, links: initialLinks }) => {
      const project = createProject(db, { name, description, category, priority, icon, accent });
      for (const l of initialLinks ?? []) addLink(db, project.id, { url: l.url, title: l.title });
      return json({ created: projectCard(project) });
    },
  );

  server.registerTool(
    "update_project",
    {
      title: "Update project",
      description:
        "Change a project's status, health, priority, name, category, description, or tile identity (icon and accent). Status changes are logged to the activity timeline.",
      inputSchema: {
        project: projectRef,
        name: z.string().optional(),
        description: z.string().optional(),
        category: z.string().optional(),
        status: statusEnum.optional(),
        priority: priorityEnum.optional(),
        health: healthEnum.optional(),
        icon: z.string().optional().describe("One emoji for the project tile"),
        accent: accentEnum.optional().describe("Tile hue; omit to derive one from the name"),
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
    "add_post",
    {
      title: "Post a progress update",
      description:
        "Post to a project's timeline — what you shipped, decided, or are blocked on. This is the primary way agents log work. " +
        "Write a real document, not a commit log: a headline title, then markdown with sections, tables, and ```mermaid diagrams where they " +
        "make the state clearer than prose. The board shows the title and an excerpt; the full post has its own page.",
      inputSchema: {
        project: projectRef,
        title: z.string().describe("Headline — what a reader should take away at a glance"),
        body: z.string().describe("The post, in markdown. Tables, fenced code, and ```mermaid diagrams all render."),
        agent_name: z.string().optional().describe("Your agent name, for attribution"),
      },
    },
    async ({ project, title, body, agent_name }) => {
      const target = resolveProject(db, project);
      const post = addPost(db, target.id, body, {
        type: "agent_update",
        title,
        author: agent_name ? `agent:${agent_name}` : "agent",
      });
      return json({ posted: { id: post.id, project: target.slug, at: new Date(post.createdAt).toISOString() } });
    },
  );

  server.registerTool(
    "ask_question",
    {
      title: "Ask the user a question",
      description:
        "Ask something only the user can answer — a decision, a missing credential, a judgement call. The question shows on the board until " +
        "answered, and their reply comes back to you through list_answers. Use this instead of raise_warning when you need a decision rather " +
        "than reporting a problem. State the options and your recommendation so a one-word reply is enough.",
      inputSchema: {
        project: projectRef,
        title: z.string().describe("The question itself, in one line"),
        body: z.string().describe("Context, the options you see, and your recommendation — markdown"),
        agent_name: z.string().optional().describe("Your agent name, so the answer reaches you"),
      },
    },
    async ({ project, title, body, agent_name }) => {
      const target = resolveProject(db, project);
      const post = addPost(db, target.id, body, {
        type: "question",
        title,
        author: agent_name ? `agent:${agent_name}` : "agent",
      });
      return json({ asked: { id: post.id, project: target.slug, at: new Date(post.createdAt).toISOString() } });
    },
  );

  server.registerTool(
    "add_comment",
    {
      title: "Reply to a post",
      description:
        "Reply in a post's thread — answer a question another agent asked, or follow up on your own post. Replying to a question from someone " +
        "else marks it answered.",
      inputSchema: {
        post_id: z.number().describe("The post to reply to (from get_project or list_answers)"),
        body: z.string().describe("Your reply, in markdown"),
        agent_name: z.string().optional().describe("Your agent name, for attribution"),
      },
    },
    async ({ post_id, body, agent_name }) => {
      const comment = addComment(db, post_id, body, agent_name ? `agent:${agent_name}` : "agent");
      const post = getPost(db, post_id);
      return json({
        replied: { id: comment.id, postId: post_id, at: new Date(comment.createdAt).toISOString(), answeredQuestion: Boolean(post?.answeredAt) },
      });
    },
  );

  server.registerTool(
    "list_answers",
    {
      title: "Read replies waiting for you",
      description:
        "Replies other people left on your posts and questions, plus replies on tasks you claimed. Call this at the start of a session, before " +
        "starting new work: it is how the user's feedback reaches you. Pass `since` with the timestamp you last checked to see only what is new.",
      inputSchema: {
        agent_name: z.string().optional().describe("Your agent name. Omit to see every reply across the board."),
        since: z.string().optional().describe("ISO timestamp; only replies after it are returned"),
      },
    },
    async ({ agent_name, since }) => {
      const answers = listAnswers(db, {
        agentName: agent_name ? `agent:${agent_name}` : undefined,
        since: since ? Date.parse(since) : undefined,
      });
      const taskReplies = listTaskReplies(db, {
        agentName: agent_name ? `agent:${agent_name}` : undefined,
        since: since ? Date.parse(since) : undefined,
      });
      return json({
        answers: answers.map(({ comment, post, projectSlug }) => ({
          project: projectSlug,
          postId: post.id,
          postTitle: post.title || post.body.slice(0, 80),
          postType: post.type,
          from: comment.author,
          reply: comment.body,
          at: new Date(comment.createdAt).toISOString(),
        })),
        taskReplies: taskReplies.map(({ comment, task, projectSlug }) => ({
          project: projectSlug,
          taskId: task.id,
          taskTitle: task.title,
          taskStatus: task.status,
          from: comment.author,
          reply: comment.body,
          at: new Date(comment.createdAt).toISOString(),
        })),
      });
    },
  );

  server.registerTool(
    "list_open_questions",
    {
      title: "List unanswered questions",
      description: "Questions still waiting on the user, oldest first — work that is blocked until they reply.",
      inputSchema: { project: projectRef.optional() },
    },
    async ({ project }) => {
      const target = project === undefined ? undefined : resolveProject(db, project);
      return json({
        questions: listOpenQuestions(db, { projectId: target?.id }).map((q) => ({
          id: q.id,
          project: target?.slug,
          title: q.title || q.body.slice(0, 80),
          body: q.body,
          askedBy: q.author,
          at: new Date(q.createdAt).toISOString(),
        })),
      });
    },
  );

  server.registerTool(
    "add_task",
    {
      title: "Add task",
      description:
        "Add a task/TODO to a project. Give it a description (markdown) with the problem, constraints, and acceptance criteria — queued tasks are claimed by agents who work from that spec, not from the title alone.",
      inputSchema: {
        project: projectRef,
        title: z.string(),
        description: z.string().optional().describe("The spec an implementing agent will work from (markdown)"),
        priority: taskPriorityEnum.nullable().optional().describe("Queue order: high before medium before low before unprioritized"),
        due_date: z.string().optional().describe("ISO date, e.g. 2026-07-15"),
        agent_ready: z.boolean().optional().describe("Queue the task for agents to claim (list_queued_tasks / claim_task)"),
        assignee: z.string().nullable().optional().describe("Who owns it: \"user\" for the person, or an agent name"),
        labels: z.array(z.string()).optional().describe("Free-form tags, e.g. [\"bug\", \"infra\"]"),
        agent_name: z.string().optional(),
      },
    },
    async ({ project, title, description, priority, due_date, agent_ready, assignee, labels, agent_name }) => {
      const target = resolveProject(db, project);
      const task = addTask(db, target.id, title, {
        description,
        priority,
        dueDate: due_date,
        author: agent_name ? `agent:${agent_name}` : "agent",
        agentReady: agent_ready,
        assignee,
        labels,
      });
      return json({ created: taskCard(db, task) });
    },
  );

  server.registerTool(
    "update_task",
    {
      title: "Update task",
      description:
        "Change a task's status (todo | in_progress | blocked | done), title, description, priority, or due date. Use blocked when you picked " +
        "the work up and cannot finish it — the task keeps your name and leaves the queue, and it shows in the board's Blocked column. Agents " +
        "refining a spec as they learn should update the description rather than leaving it stale.",
      inputSchema: {
        task_id: z.number(),
        status: taskStatusEnum.optional(),
        title: z.string().optional(),
        description: z.string().optional(),
        priority: taskPriorityEnum.nullable().optional(),
        due_date: z.string().nullable().optional(),
        assignee: z.string().nullable().optional().describe("Who owns it. null unassigns"),
        labels: z.array(z.string()).optional().describe("Replaces the task's labels"),
      },
    },
    async ({ task_id, status, title, description, priority, due_date, assignee, labels }) => {
      const task = updateTask(db, task_id, { status, title, description, priority, dueDate: due_date, assignee, labels });
      return json({ updated: taskCard(db, task) });
    },
  );

  server.registerTool(
    "list_queued_tasks",
    {
      title: "List queued tasks",
      description:
        "List tasks queued for agents (the shared pull queue). Pass project to scope to one project; omit it to see the queue across all projects. Claim with claim_task before starting work.",
      inputSchema: {
        project: projectRef.optional().describe("Scope to one project (id or slug); omit for the global queue"),
      },
    },
    async ({ project }) => {
      const projectId = project !== undefined ? resolveProject(db, project).id : undefined;
      const queued = listQueuedTasks(db, { projectId });
      return json({
        queued: queued.map((t) => ({ ...taskCard(db, t), queued_at: new Date(t.createdAt).toISOString() })),
      });
    },
  );

  server.registerTool(
    "list_tasks",
    {
      title: "List tasks",
      description:
        "Search tasks across the whole board — not just the agent queue. Filter by project, board column (backlog | queued | moving | blocked | done), " +
        "assignee, label, or priority, or pass query to match an identifier, title, or spec. Use this to find the issue a piece of work belongs to " +
        "before starting; use list_queued_tasks when you want work to claim.",
      inputSchema: {
        project: projectRef.optional().describe("Scope to one project (id or slug)"),
        lane: taskLaneEnum.optional().describe("Board column: backlog | queued | moving | blocked | done"),
        assignee: z.string().nullable().optional().describe("\"user\" for the person's own, an agent name, or null for unassigned"),
        label: z.string().optional(),
        priority: taskPriorityEnum.optional(),
        query: z.string().optional().describe("Substring of an identifier (ENG-12), title, or description"),
        limit: z.number().optional().describe("Defaults to 50"),
      },
    },
    async ({ project, lane, assignee, label, priority, query, limit }) => {
      const projectId = project !== undefined ? resolveProject(db, project).id : undefined;
      const rows: TaskRow[] = listTasks(db, {
        projectId,
        lane,
        assignee,
        label,
        priority,
        query,
        limit: limit ?? 50,
      });
      return json({
        tasks: rows.map((row) => ({ ...taskCard(db, row.task), identifier: row.identifier, lane: row.lane })),
        labels_in_use: listLabels(db, { projectId }).map((entry) => entry.label),
      });
    },
  );

  server.registerTool(
    "claim_task",
    {
      title: "Claim a queued task",
      description:
        "Atomically claim a queued task: marks it in_progress, stamps you as the claimer, and logs to the project timeline. Fails if another agent claimed it first. Call this before starting the work.",
      inputSchema: {
        task_id: z.number(),
        agent_name: z.string().describe("Your agent name, e.g. \"claude\" — shown on the board"),
      },
    },
    async ({ task_id, agent_name }) => {
      const task = claimTask(db, task_id, `agent:${agent_name}`);
      return json({ claimed: taskCard(db, task) });
    },
  );

  server.registerTool(
    "add_task_comment",
    {
      title: "Reply on a task",
      description:
        "Post in a task's thread — report progress, ask the person who filed it something, or say why you moved it to blocked. The thread is " +
        "what they see when they open the task on the board, and their reply comes back to you through list_answers.",
      inputSchema: {
        task_id: z.number().describe("The task to reply on (from claim_task or list_queued_tasks)"),
        body: z.string().describe("Your reply, in markdown"),
        agent_name: z.string().optional().describe("Your agent name, for attribution"),
      },
    },
    async ({ task_id, body, agent_name }) => {
      const comment = addTaskComment(db, task_id, body, agent_name ? `agent:${agent_name}` : "agent");
      return json({ replied: { id: comment.id, taskId: task_id, at: new Date(comment.createdAt).toISOString() } });
    },
  );

  server.registerTool(
    "list_task_comments",
    {
      title: "Read a task's thread",
      description:
        "The full reply thread on one task, oldest first. Read this after claiming a task: the spec is the description, but the thread carries " +
        "everything said since it was filed.",
      inputSchema: { task_id: z.number() },
    },
    async ({ task_id }) => {
      return json({
        comments: listTaskComments(db, task_id).map((comment) => ({
          id: comment.id,
          from: comment.author,
          body: comment.body,
          at: new Date(comment.createdAt).toISOString(),
        })),
      });
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
        suggested_action: z.string().optional().describe("The concrete action that would resolve this, one sentence"),
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
          posts: p.posts.map((post) => ({ type: post.type, title: post.title, author: post.author, body: post.body, at: new Date(post.createdAt).toISOString() })),
          openTasks: p.openTasks.map((t) => ({ title: t.title, status: t.status, dueDate: t.dueDate })),
          links: p.links,
        })),
      });
    },
  );

  server.registerTool(
    "save_report",
    {
      title: "Save a report (digest, triage, or accomplishments)",
      description:
        "Persist a cross-project report to the Workboard reports page. kind=digest for daily/weekly 'where everything stands' briefings; kind=triage for stale/blocked/risk analysis with suggested next actions; kind=accomplishments for 'what shipped' summaries of the user's and agents' completed work. Markdown.",
      inputSchema: {
        kind: z.enum(["digest", "triage", "accomplishments"]),
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
      title: "List past digest/triage/accomplishments reports",
      description: "Recent cross-project reports, newest first.",
      inputSchema: {
        kind: z.enum(["digest", "triage", "accomplishments"]).optional(),
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
