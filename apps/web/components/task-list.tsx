import Link from "next/link";
import type { Project, Task, TaskLane } from "@workboard/core";
import { TaskPriorityDot } from "./badges";
import { TASK_LANE_LABEL, TASK_LANE_ORDER, UP_FOR_GRABS } from "./labels";
import { addTaskAction, deleteTaskAction, setTaskAgentReadyAction, setTaskStatusAction } from "@/lib/actions";
import { toPlainText } from "@/lib/format";

import { Field, fieldCls as inputCls, primaryButtonCls as btnCls, selectCls } from "./form";

/**
 * Writing a task is the main thing this form is for, so it keeps the shape of a
 * document rather than a toolbar: the title leads at reading size with no box
 * around it, the spec sits directly under it, and the metadata is a quiet
 * footer. An agent works from the description, so it must be easy to write.
 *
 * `lane` is the column the composer was opened from — it preselects the picker
 * without locking it, so "+ Add task" under Up for grabs queues by default and
 * you can still change your mind here.
 */
export function TaskComposer({ project, lane = "backlog" }: { project: Project; lane?: TaskLane }) {
  return (
    <form
      action={addTaskAction}
      className="flex flex-col rounded-card border border-hairline bg-surface transition-colors focus-within:border-accent/40"
    >
      <input type="hidden" name="projectId" value={project.id} />
      <input type="hidden" name="slug" value={project.slug} />

      <div className="flex flex-col gap-1 p-4 pb-3">
        <input
          name="title"
          required
          autoFocus
          placeholder="Task title"
          aria-label="Task title"
          className="w-full bg-transparent text-title font-medium text-ink outline-none placeholder:font-normal placeholder:text-muted"
        />
        <textarea
          name="description"
          rows={6}
          placeholder="Spec for whoever picks this up — problem, constraints, acceptance criteria. Markdown works."
          aria-label="Task description"
          className="w-full resize-y bg-transparent text-body leading-relaxed text-ink-2 outline-none placeholder:text-muted"
        />
      </div>

      <div className="grid gap-3 border-t border-hairline px-4 py-3 sm:grid-cols-3">
        <Field label="Column">
          <select name="lane" defaultValue={lane} className={selectCls}>
            {TASK_LANE_ORDER.map((option) => (
              <option key={option} value={option}>
                {TASK_LANE_LABEL[option]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Priority">
          <select name="priority" defaultValue="" className={selectCls}>
            <option value="">No priority</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </Field>

        <Field label="Due date">
          <input type="date" name="dueDate" className={inputCls} />
        </Field>
      </div>

      <div className="flex justify-end border-t border-hairline px-4 py-3">
        <button type="submit" className={btnCls}>
          Add task
        </button>
      </div>
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
                    : task.status === "blocked"
                      ? "border-critical text-critical"
                      : "border-hairline text-transparent hover:text-muted"
              }`}
            >
              {task.status === "done" ? "✓" : task.status === "in_progress" ? "◐" : task.status === "blocked" ? "!" : "✓"}
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
