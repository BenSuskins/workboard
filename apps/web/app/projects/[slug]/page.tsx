import { TimeAgo } from "@/components/time-ago";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CATEGORY_PRESETS,
  getProjectDetail,
  integrationStatus,
  listDeleted,
  listSummaryHistory,
  type GdocSnapshot,
  type JiraIssueSnapshot,
  type JiraProjectSnapshot,
  type LinkWithStatus,
  type PrSnapshot,
  type RepoScopeSnapshot,
} from "@workboard/core";
import { ProjectMeta, StatusBadge, TaskPriorityDot } from "@/components/badges";
import { ciLabel, GitHubMark, JiraMark, DocMark } from "@/components/chips";
import { Markdown } from "@/components/markdown";
import { Mermaid } from "@/components/mermaid";
import { WarningsPanel } from "@/components/warnings";
import { db } from "@/lib/db";
import { authorLabel, fullDate, relativeTime, toPlainText } from "@/lib/format";
import {
  addLinkAction,
  addTaskAction,
  addPostAction,
  deleteLinkAction,
  deleteTaskAction,
  refreshProjectBySlug,
  restoreLinkAction,
  restoreTaskAction,
  setTaskAgentReadyAction,
  setTaskStatusAction,
  updateProjectAction,
} from "@/lib/actions";
import { RefreshButton } from "@/components/refresh-button";

export const dynamic = "force-dynamic";

const inputCls =
  "w-full rounded-lg border border-hairline bg-page px-2.5 py-1.5 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none";
const btnCls = "rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-deep";

function LinkSnapshot({ link }: { link: LinkWithStatus }) {
  const data = link.snapshot?.data as
    | PrSnapshot
    | RepoScopeSnapshot
    | JiraProjectSnapshot
    | JiraIssueSnapshot
    | GdocSnapshot
    | { type?: string }
    | undefined;
  if (!data || typeof data !== "object" || !("type" in data)) return null;
  if (data.type === "pr") {
    const pr = data as PrSnapshot;
    const state = pr.merged ? "merged" : pr.state === "closed" ? "closed" : pr.draft ? "draft" : (pr.reviewDecision ?? "open").replace("_", " ");
    // CI is only shown for in-flight PRs — closed/merged never carry it
    return (
      <span className="text-[11px] text-muted">
        #{pr.number} · {state}
        {pr.state === "open" && ciLabel(pr.ciStatus) && (
          <span className={pr.ciStatus === "failing" ? "font-semibold text-critical" : pr.ciStatus === "passing" ? "text-good" : ""}>
            {" "}· {ciLabel(pr.ciStatus)}
          </span>
        )}{" "}
        · updated {<TimeAgo at={pr.updatedAt} />}
      </span>
    );
  }
  if (data.type === "repo") {
    const repo = data as RepoScopeSnapshot;
    const open = repo.prs.filter((p) => p.state === "open");
    const failing = open.filter((p) => p.ciStatus === "failing").length;
    return (
      <span className="text-[11px] text-muted">
        {open.length} open PR{open.length === 1 ? "" : "s"} in scope · {repo.prs.length} tracked
        {failing > 0 && <span className="font-semibold text-critical"> · {failing} CI failing</span>}
      </span>
    );
  }
  if (data.type === "jira_project") {
    const jp = data as JiraProjectSnapshot;
    return (
      <span className="text-[11px] text-muted">
        {Object.entries(jp.byStatusCategory)
          .map(([k, v]) => `${v} ${k.toLowerCase()}`)
          .join(" · ")}
      </span>
    );
  }
  if (data.type === "jira_issue") {
    const ji = data as JiraIssueSnapshot;
    return (
      <span className="text-[11px] text-muted">
        {ji.status}
        {ji.assignee ? ` · ${ji.assignee}` : ""} · updated {<TimeAgo at={ji.updatedAt} />}
      </span>
    );
  }
  if (data.type === "gdoc") {
    const doc = data as GdocSnapshot;
    return <span className="text-[11px] text-muted">edited {<TimeAgo at={doc.modifiedAt} />}</span>;
  }
  return null;
}

function ProviderMark({ provider }: { provider: string }) {
  if (provider === "github") return <GitHubMark />;
  if (provider === "jira") return <JiraMark />;
  if (provider === "gdoc") return <DocMark />;
  return <span className="size-3 rounded-full border border-hairline" aria-hidden />;
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const detail = getProjectDetail(db(), slug);
  if (!detail) notFound();
  const { project, tasks, posts, comments, links, latestSummary, openWarnings } = detail;
  const integrations = integrationStatus();
  const anyConfigured = integrations.github || integrations.jira || integrations.google;
  const summaryHistory = listSummaryHistory(db(), project.id, 11).slice(1);
  const deleted = listDeleted(db(), project.id);
  const deletedCount = deleted.tasks.length + deleted.links.length;

  return (
    <div className="flex flex-col gap-6">
      <Mermaid />
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-xs text-muted">
          <Link href="/" className="hover:text-ink">
            Board
          </Link>
          <span>/</span>
          <span className="text-ink-2">{project.name}</span>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-2">
            <h1 className="text-[22px] font-semibold tracking-tight text-ink">{project.name}</h1>
            <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-ink-2">
              <StatusBadge status={project.status} />
              <span>·</span>
              <ProjectMeta category={project.category} health={project.health} priority={project.priority} className="text-ink-2" />
              <span>·</span>
              <span className="text-muted">
                active {<TimeAgo at={project.lastActivityAt} />}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2" title={anyConfigured ? "Re-fetch GitHub/Jira/Docs status" : "No integrations configured — set tokens in .env"}>
            <RefreshButton action={refreshProjectBySlug.bind(null, project.slug)} />
          </div>
        </div>
        {project.description && <Markdown className="max-w-3xl">{project.description}</Markdown>}
      </div>

      <WarningsPanel warnings={openWarnings} slug={project.slug} />

      <details className="rounded-[10px] border border-hairline bg-surface">
        <summary className="cursor-pointer select-none px-4 py-2.5 text-sm text-ink-2 hover:text-ink">Edit project</summary>
        <form action={updateProjectAction} className="grid gap-3 border-t border-hairline p-4 sm:grid-cols-2">
          <input type="hidden" name="id" value={project.id} />
          <input type="hidden" name="slug" value={project.slug} />
          <label className="flex flex-col gap-1 text-xs text-muted">
            Name
            <input name="name" defaultValue={project.name} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Category
            <input name="category" defaultValue={project.category} list="category-presets" className={inputCls} />
            <datalist id="category-presets">
              {CATEGORY_PRESETS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted sm:col-span-2">
            Description / goal (markdown)
            <textarea name="description" defaultValue={project.description} rows={3} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Status
            <select name="status" defaultValue={project.status} className={inputCls}>
              {["active", "blocked", "on_hold", "done", "archived"].map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs text-muted">
              Priority
              <select name="priority" defaultValue={project.priority} className={inputCls}>
                {["high", "medium", "low"].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Health
              <select name="health" defaultValue={project.health} className={inputCls}>
                <option value="green">on track</option>
                <option value="amber">at risk</option>
                <option value="red">off track</option>
              </select>
            </label>
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className={btnCls}>
              Save
            </button>
          </div>
        </form>
      </details>

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(280px,0.7fr)]">
        <div className="flex flex-col gap-6">
          <section className="rounded-[10px] border border-hairline bg-surface p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">AI summary</h2>
              {latestSummary && (
                <span className="text-[11px] text-muted">
                  {authorLabel(latestSummary.generatedBy)} · {<TimeAgo at={latestSummary.createdAt} />}
                </span>
              )}
            </div>
            {latestSummary ? (
              <Markdown>{latestSummary.body}</Markdown>
            ) : (
              <p className="text-sm text-muted">
                No summary yet. A coding agent connected to the Workboard MCP can write one with <code>upsert_summary</code>.
              </p>
            )}
            {summaryHistory.length > 0 && (
              <details className="mt-3 border-t border-hairline pt-2">
                <summary className="cursor-pointer select-none text-xs text-muted hover:text-ink">
                  History ({summaryHistory.length} previous)
                </summary>
                <ol className="mt-2 flex flex-col gap-3">
                  {summaryHistory.map((s) => (
                    <li key={s.id} className="border-l border-grid pl-3">
                      <div className="mb-1 text-[11px] text-muted">
                        {authorLabel(s.generatedBy)} · {fullDate(s.createdAt)}
                      </div>
                      <Markdown>{s.body}</Markdown>
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </section>

          <section className="rounded-[10px] border border-hairline bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold text-ink">Activity</h2>
            <form action={addPostAction} className="mb-4 flex flex-col gap-2">
              <input type="hidden" name="projectId" value={project.id} />
              <input type="hidden" name="slug" value={project.slug} />
              <input name="title" placeholder="Title (optional)" className={inputCls} />
              <textarea name="body" rows={2} placeholder="Write a post (markdown, mermaid)…" className={inputCls} />
              <div>
                <button type="submit" className={btnCls}>
                  Post
                </button>
              </div>
            </form>
            {posts.length === 0 ? (
              <p className="text-sm text-muted">No activity yet.</p>
            ) : (
              <ol className="flex flex-col">
                {posts.map((post) => {
                  const threadSize = comments.filter((comment) => comment.postId === post.id).length;
                  return (
                    <li key={post.id} className="relative border-l border-grid py-2 pl-4">
                      <span
                        className={`absolute -left-[4.5px] top-4 size-2 rounded-full ${
                          post.type === "question"
                            ? post.answeredAt
                              ? "bg-good"
                              : "bg-serious"
                            : post.type === "agent_update"
                              ? "bg-accent"
                              : post.type === "status_change"
                                ? "bg-warning"
                                : "bg-muted"
                        }`}
                        aria-hidden
                      />
                      <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] text-muted">
                        <span className="font-medium text-ink-2">{authorLabel(post.author)}</span>
                        {post.type === "question" ? (
                          <span className={post.answeredAt ? "text-good" : "font-medium text-serious"}>
                            {post.answeredAt ? "answered" : "open question"}
                          </span>
                        ) : (
                          <span>{post.type.replace("_", " ")}</span>
                        )}
                        <span>· {<TimeAgo at={post.createdAt} />}</span>
                        {threadSize > 0 && <span>· {threadSize} repl{threadSize === 1 ? "y" : "ies"}</span>}
                      </div>
                      <Link href={`/projects/${project.slug}/posts/${post.id}`} className="group block">
                        {post.title && (
                          <span className="text-[13.5px] font-medium text-ink group-hover:text-accent">{post.title}</span>
                        )}
                        <p className="line-clamp-2 text-[13px] text-ink-2">{toPlainText(post.body)}</p>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-6">
          <section className="rounded-[10px] border border-hairline bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold text-ink">Tasks</h2>
            <form action={addTaskAction} className="mb-3 flex flex-col gap-2">
              <div className="flex gap-2">
                <input type="hidden" name="projectId" value={project.id} />
                <input type="hidden" name="slug" value={project.slug} />
                <input name="title" placeholder="Add a task…" className={inputCls} required />
                <button type="submit" className={btnCls}>
                  Add
                </button>
              </div>
              <details>
                <summary className="cursor-pointer select-none text-xs text-muted hover:text-ink">Description &amp; priority (optional)</summary>
                <div className="mt-2 flex flex-col gap-2">
                  <textarea
                    name="description"
                    rows={3}
                    placeholder="Spec for whoever picks this up — problem, constraints, acceptance criteria (markdown)…"
                    className={inputCls}
                  />
                  <div className="flex items-center justify-between gap-2">
                    <select name="priority" defaultValue="" className={`${inputCls} w-auto`}>
                      <option value="">no priority</option>
                      {["high", "medium", "low"].map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                    <label className="flex items-center gap-1.5 whitespace-nowrap text-xs text-muted">
                      <input type="checkbox" name="agentReady" className="size-3 accent-accent" />
                      Queue for agents
                    </label>
                  </div>
                </div>
              </details>
            </form>
            {tasks.length === 0 ? (
              <p className="text-sm text-muted">No tasks.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {tasks.map((t) => (
                  <li key={t.id} className="group flex items-start gap-2 text-sm">
                    <form action={setTaskStatusAction} className="pt-0.5">
                      <input type="hidden" name="taskId" value={t.id} />
                      <input type="hidden" name="slug" value={project.slug} />
                      <input type="hidden" name="status" value={t.status === "done" ? "todo" : "done"} />
                      <button
                        type="submit"
                        aria-label={t.status === "done" ? "Reopen" : "Mark done"}
                        className={`grid size-4 place-items-center rounded border text-[10px] ${
                          t.status === "done"
                            ? "border-good bg-good/20 text-good"
                            : t.status === "in_progress"
                              ? "border-accent text-accent"
                              : "border-hairline text-transparent hover:text-muted"
                        }`}
                      >
                        {t.status === "done" ? "✓" : t.status === "in_progress" ? "◐" : "✓"}
                      </button>
                    </form>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <TaskPriorityDot priority={t.priority} />
                        <Link
                          href={`/projects/${project.slug}/tasks/${t.id}`}
                          className={`truncate hover:text-accent hover:underline ${t.status === "done" ? "text-muted line-through" : "text-ink-2"}`}
                        >
                          {t.title}
                        </Link>
                        {t.dueDate && <span className="shrink-0 text-[11px] text-warning">due {t.dueDate}</span>}
                        {t.claimedBy && (
                          <span className="shrink-0 rounded bg-accent/15 px-1.5 py-0.5 text-[10px] text-accent" title="Claimed via the agent queue">
                            {t.claimedBy}
                          </span>
                        )}
                      </div>
                      {t.description && (
                        <p className="mt-0.5 truncate pl-3.5 text-xs text-muted">{toPlainText(t.description)}</p>
                      )}
                    </div>
                    <form action={setTaskAgentReadyAction} className="ml-auto pt-0.5">
                      <input type="hidden" name="taskId" value={t.id} />
                      <input type="hidden" name="slug" value={project.slug} />
                      <input type="hidden" name="ready" value={t.agentReady ? "0" : "1"} />
                      <button
                        type="submit"
                        aria-label={t.agentReady ? "Remove from agent queue" : "Queue for agents"}
                        title={t.agentReady ? "Remove from agent queue" : "Queue for agents"}
                        className={`text-xs opacity-0 transition-opacity group-hover:opacity-100 ${
                          t.agentReady ? "text-accent" : "text-muted hover:text-accent"
                        }`}
                      >
                        {t.agentReady ? "⦿ queued" : "⦿"}
                      </button>
                    </form>
                    <form action={deleteTaskAction} className="opacity-0 transition-opacity group-hover:opacity-100">
                      <input type="hidden" name="taskId" value={t.id} />
                      <input type="hidden" name="slug" value={project.slug} />
                      <button type="submit" aria-label="Delete task" className="text-muted hover:text-critical">
                        ×
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-[10px] border border-hairline bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold text-ink">Linked resources</h2>
            {links.length === 0 ? (
              <p className="mb-3 text-sm text-muted">Nothing linked yet.</p>
            ) : (
              <ul className="mb-3 flex flex-col gap-2.5">
                {links.map((l) => (
                  <li key={l.id} className="group flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <ProviderMark provider={l.provider} />
                      <a
                        href={l.url}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate text-sm text-ink-2 hover:text-accent hover:underline"
                      >
                        {l.title || l.externalId || l.url}
                      </a>
                      <form action={deleteLinkAction} className="ml-auto opacity-0 transition-opacity group-hover:opacity-100">
                        <input type="hidden" name="linkId" value={l.id} />
                        <input type="hidden" name="slug" value={project.slug} />
                        <button type="submit" aria-label="Remove link" className="text-muted hover:text-critical">
                          ×
                        </button>
                      </form>
                    </div>
                    <div className="pl-5">
                      <LinkSnapshot link={l} />
                      {l.syncState?.lastError && (
                        <div className="text-[11px] font-medium text-critical">
                          ⚠ sync failing ({<TimeAgo at={l.syncState.lastAttemptAt} />}): {l.syncState.lastError.slice(0, 140)}
                          {l.syncState.lastSuccessAt && (
                            <span className="font-normal text-muted"> — showing data from {<TimeAgo at={l.syncState.lastSuccessAt} />}</span>
                          )}
                        </div>
                      )}
                      {!l.syncState?.lastError && l.snapshot && (
                        <div className="text-[11px] text-muted">synced {<TimeAgo at={l.snapshot.fetchedAt} />}</div>
                      )}
                      {l.kind === "repo" && l.scope && (
                        <div className="text-[11px] text-muted">
                          scope:{" "}
                          {[
                            l.scope.branchPrefix && `branch ${l.scope.branchPrefix}*`,
                            l.scope.pathPrefixes?.length && `paths ${l.scope.pathPrefixes.join(", ")}`,
                            l.scope.labels?.length && `labels ${l.scope.labels.join(", ")}`,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <details className="mb-1">
              <summary className="cursor-pointer select-none text-xs text-accent hover:underline">+ Add link</summary>
              <form action={addLinkAction} className="mt-3 flex flex-col gap-2">
                <input type="hidden" name="projectId" value={project.id} />
                <input type="hidden" name="slug" value={project.slug} />
                <input name="url" placeholder="URL (GitHub PR/repo, Jira, Google Doc…)" className={inputCls} required />
                <input name="title" placeholder="Title (optional)" className={inputCls} />
                <p className="text-[11px] text-muted">Monorepo scope (repo links only, optional):</p>
                <input name="branchPrefix" placeholder="Branch prefix, e.g. payments-v2/" className={inputCls} />
                <input name="pathPrefixes" placeholder="Path prefixes, comma-separated" className={inputCls} />
                <input name="labels" placeholder="PR labels, comma-separated" className={inputCls} />
                <div>
                  <button type="submit" className={btnCls}>
                    Link
                  </button>
                </div>
              </form>
            </details>
          </section>

          {deletedCount > 0 && (
            <details className="rounded-[10px] border border-hairline bg-surface">
              <summary className="cursor-pointer select-none px-4 py-2.5 text-xs text-muted hover:text-ink">
                Recently deleted ({deletedCount})
              </summary>
              <div className="flex flex-col gap-1.5 border-t border-hairline p-4">
                {deleted.tasks.map((t) => (
                  <div key={`t-${t.id}`} className="flex items-center gap-2 text-sm">
                    <span className="truncate text-muted line-through">{t.title}</span>
                    <span className="text-[11px] text-muted">task · {<TimeAgo at={t.deletedAt!} />}</span>
                    <form action={restoreTaskAction} className="ml-auto">
                      <input type="hidden" name="taskId" value={t.id} />
                      <input type="hidden" name="slug" value={project.slug} />
                      <button type="submit" className="text-xs text-accent hover:underline">
                        Restore
                      </button>
                    </form>
                  </div>
                ))}
                {deleted.links.map((l) => (
                  <div key={`l-${l.id}`} className="flex items-center gap-2 text-sm">
                    <span className="truncate text-muted line-through">{l.title || l.externalId || l.url}</span>
                    <span className="text-[11px] text-muted">link · {<TimeAgo at={l.deletedAt!} />}</span>
                    <form action={restoreLinkAction} className="ml-auto">
                      <input type="hidden" name="linkId" value={l.id} />
                      <input type="hidden" name="slug" value={project.slug} />
                      <button type="submit" className="text-xs text-accent hover:underline">
                        Restore
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
