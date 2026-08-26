import Link from "next/link";
import { notFound } from "next/navigation";
import { getTaskDetail } from "@workboard/core";
import { TaskPriorityBadge } from "@/components/badges";
import { Markdown } from "@/components/markdown";
import { Mermaid } from "@/components/mermaid";
import { TimeAgo } from "@/components/time-ago";
import { db } from "@/lib/db";
import { authorLabel } from "@/lib/format";
import {
  deleteTaskAction,
  setTaskAgentReadyAction,
  setTaskStatusAction,
  updateTaskDetailAction,
} from "@/lib/actions";

export const dynamic = "force-dynamic";

const inputCls =
  "w-full rounded-lg border border-hairline bg-page px-2.5 py-1.5 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none";
const btnCls = "rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-deep";

export default async function TaskPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const detail = getTaskDetail(db(), Number(id));
  if (!detail || detail.project.slug !== slug) notFound();
  const { task, project } = detail;

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <Mermaid />
      <div className="flex items-center gap-2 text-xs text-muted">
        <Link href="/" className="hover:text-ink">
          Board
        </Link>
        <span>/</span>
        <Link href={`/projects/${project.slug}`} className="hover:text-ink">
          {project.name}
        </Link>
        <span>/</span>
        <span className="text-ink-2">task #{task.id}</span>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-start gap-2">
          <form action={setTaskStatusAction}>
            <input type="hidden" name="taskId" value={task.id} />
            <input type="hidden" name="slug" value={project.slug} />
            <input type="hidden" name="status" value={task.status === "done" ? "todo" : "done"} />
            <button
              type="submit"
              aria-label={task.status === "done" ? "Reopen" : "Mark done"}
              className={`mt-1 grid size-4 place-items-center rounded border text-[10px] ${
                task.status === "done"
                  ? "border-good bg-good/20 text-good"
                  : task.status === "in_progress"
                    ? "border-accent text-accent"
                    : "border-hairline text-transparent hover:text-muted"
              }`}
            >
              {task.status === "done" ? "✓" : task.status === "in_progress" ? "◐" : "✓"}
            </button>
          </form>
          <h1 className={`text-[20px] font-semibold leading-snug tracking-tight ${task.status === "done" ? "text-muted line-through" : "text-ink"}`}>
            {task.title}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pl-6 text-[11px] text-muted">
          <TaskPriorityBadge priority={task.priority} />
          <span>·</span>
          <span>{authorLabel(task.author)} opened {<TimeAgo at={task.createdAt} />}</span>
          <span>·</span>
          <span>updated {<TimeAgo at={task.updatedAt} />}</span>
          {task.dueDate && (
            <>
              <span>·</span>
              <span className="text-warning">due {task.dueDate}</span>
            </>
          )}
          {task.claimedBy && (
            <>
              <span>·</span>
              <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] text-accent" title="Claimed via the agent queue">
                {task.claimedBy}
              </span>
            </>
          )}
        </div>
      </div>

      <section className="rounded-[10px] border border-hairline bg-surface p-4">
        {task.description ? (
          <Markdown>{task.description}</Markdown>
        ) : (
          <p className="text-sm text-muted">
            No description yet — the spec lives in the title alone. Add the problem, constraints, and acceptance criteria below.
          </p>
        )}
        <details className="mt-3 border-t border-hairline pt-2">
          <summary className="cursor-pointer select-none text-xs text-muted hover:text-ink">Edit task</summary>
          <form action={updateTaskDetailAction} className="mt-3 flex flex-col gap-3">
            <input type="hidden" name="taskId" value={task.id} />
            <input type="hidden" name="slug" value={project.slug} />
            <label className="flex flex-col gap-1 text-xs text-muted">
              Title
              <input name="title" defaultValue={task.title} className={inputCls} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Description (markdown)
              <textarea name="description" defaultValue={task.description} rows={8} placeholder="Problem, constraints, acceptance criteria…" className={`${inputCls} font-mono text-xs`} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-xs text-muted">
                Priority
                <select name="priority" defaultValue={task.priority ?? ""} className={inputCls}>
                  <option value="">no priority</option>
                  {["high", "medium", "low"].map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted">
                Due date
                <input name="dueDate" type="date" defaultValue={task.dueDate ?? ""} className={inputCls} />
              </label>
            </div>
            <div>
              <button type="submit" className={btnCls}>
                Save
              </button>
            </div>
          </form>
        </details>
      </section>

      <div className="flex items-center gap-3 pl-6">
        <form action={setTaskAgentReadyAction}>
          <input type="hidden" name="taskId" value={task.id} />
          <input type="hidden" name="slug" value={project.slug} />
          <input type="hidden" name="ready" value={task.agentReady ? "0" : "1"} />
          <button
            type="submit"
            className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
              task.agentReady ? "border-accent/40 bg-accent/10 text-accent hover:bg-accent/20" : "border-hairline text-ink-2 hover:border-accent/40 hover:text-accent"
            }`}
          >
            {task.agentReady ? "⦿ Queued for agents" : "⦿ Queue for agents"}
          </button>
        </form>
        <form action={deleteTaskAction}>
          <input type="hidden" name="taskId" value={task.id} />
          <input type="hidden" name="slug" value={project.slug} />
          <button type="submit" className="text-xs text-muted hover:text-critical">
            Delete task
          </button>
        </form>
      </div>
    </div>
  );
}
