import type { Project, Task } from "@workboard/core";
import { TaskPriorityBadge } from "./badges";
import { Markdown } from "./markdown";
import { TimeAgo } from "./time-ago";
import { UP_FOR_GRABS } from "./labels";
import { authorLabel } from "@/lib/format";
import { deleteTaskAction, setTaskAgentReadyAction, setTaskStatusAction, updateTaskDetailAction } from "@/lib/actions";

import { fieldCls as inputCls, primaryButtonCls as btnCls } from "./form";

/**
 * A task, its spec, and the controls that act on it. The full route and the
 * slide-over both render this, so the two never drift apart.
 */
export function TaskView({ task, project }: { task: Task; project: Project }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div className="flex items-start gap-2.5">
          <form action={setTaskStatusAction}>
            <input type="hidden" name="taskId" value={task.id} />
            <input type="hidden" name="slug" value={project.slug} />
            <input type="hidden" name="status" value={task.status === "done" ? "todo" : "done"} />
            <button
              type="submit"
              aria-label={task.status === "done" ? "Reopen" : "Mark done"}
              className={`mt-1.5 grid size-[18px] place-items-center rounded border text-[10px] ${
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
          <h1
            className={`text-heading font-semibold leading-snug tracking-tight ${
              task.status === "done" ? "text-muted line-through" : "text-ink"
            }`}
          >
            {task.title}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pl-7 text-meta text-muted">
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
              <span className="rounded-chip bg-accent/15 px-1.5 py-0.5 text-accent" title="Claimed via the agent queue">
                {task.claimedBy}
              </span>
            </>
          )}
        </div>
      </div>

      <section className="rounded-card border border-hairline bg-surface p-5">
        {task.description ? (
          <Markdown>{task.description}</Markdown>
        ) : (
          <p className="text-body text-muted">
            No description yet — the spec lives in the title alone. Add the problem, constraints, and acceptance criteria below.
          </p>
        )}
        <details className="mt-4 border-t border-hairline pt-3">
          <summary className="cursor-pointer select-none text-meta text-muted hover:text-ink">Edit task</summary>
          <form action={updateTaskDetailAction} className="mt-3 flex flex-col gap-3">
            <input type="hidden" name="taskId" value={task.id} />
            <input type="hidden" name="slug" value={project.slug} />
            <label className="flex flex-col gap-1 text-meta text-muted">
              Title
              <input name="title" defaultValue={task.title} className={inputCls} />
            </label>
            <label className="flex flex-col gap-1 text-meta text-muted">
              Description (markdown)
              <textarea
                name="description"
                defaultValue={task.description}
                rows={8}
                placeholder="Problem, constraints, acceptance criteria…"
                className={`${inputCls} font-mono text-[0.8125rem]`}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-meta text-muted">
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
              <label className="flex flex-col gap-1 text-meta text-muted">
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

      <div className="flex items-center gap-3 pl-7">
        <form action={setTaskAgentReadyAction}>
          <input type="hidden" name="taskId" value={task.id} />
          <input type="hidden" name="slug" value={project.slug} />
          <input type="hidden" name="ready" value={task.agentReady ? "0" : "1"} />
          <button
            type="submit"
            className={`rounded-control border px-3 py-1.5 text-meta transition-colors ${
              task.agentReady
                ? "border-accent/40 bg-accent/10 text-accent hover:bg-accent/20"
                : "border-hairline text-ink-2 hover:border-accent/40 hover:text-accent"
            }`}
          >
            {task.agentReady ? `⦿ ${UP_FOR_GRABS}` : "⦿ Put up for grabs"}
          </button>
        </form>
        <form action={deleteTaskAction}>
          <input type="hidden" name="taskId" value={task.id} />
          <input type="hidden" name="slug" value={project.slug} />
          <button type="submit" className="text-meta text-muted hover:text-critical">
            Delete task
          </button>
        </form>
      </div>
    </div>
  );
}
