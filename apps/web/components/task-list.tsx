import type { Project, TaskLane, TaskRow } from "@workboard/core";
import { IssueRow } from "./issue-row";
import { TASK_LANE_LABEL, TASK_LANE_ORDER } from "./labels";
import { addTaskAction } from "@/lib/actions";
import { ME } from "@/lib/issue-filters";

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

      <div className="grid gap-3 border-t border-hairline px-4 py-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <Field label="Labels">
            <input
              name="labels"
              placeholder="bug, infra"
              aria-label="Labels, comma separated"
              className={inputCls}
            />
          </Field>
        </div>

        {/* One person and their agents: assignment is a checkbox, not a picker. */}
        <label className="flex items-end gap-2 pb-2 text-meta text-ink-2">
          <input type="checkbox" name="assignee" value={ME} className="size-3.5 accent-[var(--accent)]" />
          Assign to me
        </label>
      </div>

      <div className="flex justify-end border-t border-hairline px-4 py-3">
        <button type="submit" className={btnCls}>
          Add task
        </button>
      </div>
    </form>
  );
}

/** The project's tasks as rows, rendered through the same row the issues view uses. */
export function TaskList({ rows }: { rows: TaskRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-grid px-6 py-10 text-center text-body text-muted">
        No tasks yet.
      </div>
    );
  }
  return (
    <ul className="overflow-hidden rounded-card border border-hairline bg-surface">
      {rows.map((row) => (
        <IssueRow key={row.task.id} row={row} />
      ))}
    </ul>
  );
}
