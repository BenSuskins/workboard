import Link from "next/link";
import type { Project, Task } from "@workboard/core";
import { TaskPriorityDot } from "./badges";
import { UP_FOR_GRABS } from "./labels";
import { addTaskAction, deleteTaskAction, setTaskAgentReadyAction, setTaskStatusAction } from "@/lib/actions";
import { toPlainText } from "@/lib/format";

const inputCls =
  "w-full rounded-control border border-hairline bg-page px-2.5 py-1.5 text-body text-ink placeholder:text-muted focus:border-accent focus:outline-none";
const btnCls = "rounded-control bg-accent px-3.5 py-1.5 text-meta font-medium text-white transition-colors hover:bg-accent-deep";

export function TaskComposer({ project }: { project: Project }) {
  return (
    <form action={addTaskAction} className="flex flex-col gap-2 rounded-card border border-hairline bg-surface p-3">
      <div className="flex gap-2">
        <input type="hidden" name="projectId" value={project.id} />
        <input type="hidden" name="slug" value={project.slug} />
        <input name="title" placeholder="Add a task…" className={inputCls} required />
        <button type="submit" className={btnCls}>
          Add
        </button>
      </div>
      <details>
        <summary className="cursor-pointer select-none text-meta text-muted hover:text-ink">
          Description &amp; priority (optional)
        </summary>
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
            <label className="flex items-center gap-1.5 whitespace-nowrap text-meta text-muted">
              <input type="checkbox" name="agentReady" className="size-3 accent-accent" />
              Put up for grabs
            </label>
          </div>
        </div>
      </details>
    </form>
  );
}

/** The project's tasks as rows. Shared by the overview and the tasks tab. */
export function TaskList({ tasks, project }: { tasks: Task[]; project: Project }) {
  if (tasks.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-grid px-6 py-10 text-center text-body text-muted">
        No tasks yet.
      </div>
    );
  }
  return (
    <ul className="overflow-hidden rounded-card border border-hairline bg-surface">
      {tasks.map((task) => (
        <li
          key={task.id}
          className="group flex items-start gap-3 border-b border-hairline px-4 py-3 last:border-b-0 hover:bg-surface-2"
        >
          <form action={setTaskStatusAction} className="pt-0.5">
            <input type="hidden" name="taskId" value={task.id} />
            <input type="hidden" name="slug" value={project.slug} />
            <input type="hidden" name="status" value={task.status === "done" ? "todo" : "done"} />
            <button
              type="submit"
              aria-label={task.status === "done" ? "Reopen" : "Mark done"}
              className={`grid size-[18px] place-items-center rounded border text-[10px] ${
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
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <TaskPriorityDot priority={task.priority} />
              <Link
                href={`/projects/${project.slug}/tasks/${task.id}`}
                className={`truncate text-body hover:text-accent ${
                  task.status === "done" ? "text-muted line-through" : "text-ink"
                }`}
              >
                {task.title}
              </Link>
              {task.agentReady && !task.claimedBy && (
                <span className="shrink-0 rounded-chip bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                  {UP_FOR_GRABS}
                </span>
              )}
              {task.claimedBy && (
                <span
                  className="shrink-0 rounded-chip bg-surface-2 px-1.5 py-0.5 text-[10px] text-ink-2"
                  title="Claimed via the agent queue"
                >
                  {task.claimedBy}
                </span>
              )}
              {task.dueDate && <span className="shrink-0 text-meta text-warning">due {task.dueDate}</span>}
            </div>
            {task.description && <p className="mt-0.5 truncate text-meta text-muted">{toPlainText(task.description)}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            <form action={setTaskAgentReadyAction}>
              <input type="hidden" name="taskId" value={task.id} />
              <input type="hidden" name="slug" value={project.slug} />
              <input type="hidden" name="ready" value={task.agentReady ? "0" : "1"} />
              <button
                type="submit"
                aria-label={task.agentReady ? "Take out of the queue" : "Put up for grabs"}
                title={task.agentReady ? "Take out of the queue" : "Put up for grabs"}
                className={`text-meta ${task.agentReady ? "text-accent" : "text-muted hover:text-accent"}`}
              >
                ⦿
              </button>
            </form>
            <form action={deleteTaskAction}>
              <input type="hidden" name="taskId" value={task.id} />
              <input type="hidden" name="slug" value={project.slug} />
              <button type="submit" aria-label="Delete task" className="text-muted hover:text-critical">
                ×
              </button>
            </form>
          </div>
        </li>
      ))}
    </ul>
  );
}
