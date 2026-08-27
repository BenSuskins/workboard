import Link from "next/link";
import type { TaskRow } from "@workboard/core";
import { Avatar } from "./avatar";
import { TaskPriorityDot } from "./badges";
import { ACCENT_BG, ACCENT_TEXT, labelAccent, TASK_LANE_LABEL, TASK_LANE_TONE, UP_FOR_GRABS } from "./labels";
import { deleteTaskAction, setTaskAgentReadyAction, setTaskStatusAction } from "@/lib/actions";
import { issuesHref } from "@/lib/issue-filters";
import { toPlainText } from "@/lib/format";

/**
 * One issue as a row. The project page's task list and the cross-project issues
 * view both render through this, so an issue reads the same wherever you meet
 * it — same identifier, same labels, same controls.
 */
export function IssueRow({
  row,
  showProject = false,
  showLane = false,
  returnTo,
}: {
  row: TaskRow;
  /** The issues view lists several projects, so it names the one each row belongs to. */
  showProject?: boolean;
  showLane?: boolean;
  /** Where a delete should land. Defaults to the project page. */
  returnTo?: string;
}) {
  const { task, project, identifier, lane } = row;
  const done = task.status === "done";
  const href = `/projects/${project.slug}/tasks/${task.id}`;

  return (
    <li
      data-row
      className="group flex items-start gap-3 border-b border-hairline px-4 py-3 last:border-b-0 hover:bg-surface-2"
    >
      <form action={setTaskStatusAction} className="pt-0.5">
        <input type="hidden" name="taskId" value={task.id} />
        <input type="hidden" name="slug" value={project.slug} />
        <input type="hidden" name="status" value={done ? "todo" : "done"} />
        <button
          type="submit"
          aria-label={done ? "Reopen" : "Mark done"}
          className={`grid size-[18px] place-items-center rounded border text-[10px] ${
            done
              ? "border-good bg-good/20 text-good"
              : task.status === "in_progress"
                ? "border-accent text-accent"
                : task.status === "blocked"
                  ? "border-critical text-critical"
                  : "border-hairline text-transparent hover:text-muted"
          }`}
        >
          {done ? "✓" : task.status === "in_progress" ? "◐" : task.status === "blocked" ? "!" : "✓"}
        </button>
      </form>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="shrink-0 font-mono text-meta tabular-nums text-muted" title={`${project.name} issue`}>
            {identifier}
          </span>
          <TaskPriorityDot priority={task.priority} />
          <Link
            href={href}
            className={`truncate text-body hover:text-accent ${done ? "text-muted line-through" : "text-ink"}`}
          >
            {task.title}
          </Link>
          {showLane && (
            <span className={`shrink-0 text-meta ${TASK_LANE_TONE[lane].text}`}>{TASK_LANE_LABEL[lane]}</span>
          )}
          {/* agentReady is 0 or 1 from the store, so it needs coercing — a bare
              `&&` renders the 0. */}
          {Boolean(task.agentReady) && !task.claimedBy && (
            <span className="shrink-0 rounded-chip bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium text-accent">
              {UP_FOR_GRABS}
            </span>
          )}
          <LabelChips labels={task.labels} />
          {task.dueDate && <span className="shrink-0 text-meta text-warning">due {task.dueDate}</span>}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-meta text-muted">
          {showProject && (
            <Link href={`/projects/${project.slug}`} className="shrink-0 hover:text-ink-2">
              {project.name}
            </Link>
          )}
          {task.description && <span className="truncate">{toPlainText(task.description)}</span>}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {task.assignee ? (
          <Avatar author={task.assignee} size="sm" />
        ) : (
          <span
            className="grid size-5 place-items-center rounded-full border border-dashed border-grid text-[9px] text-muted"
            title="Unassigned"
            aria-label="Unassigned"
          >
            ?
          </span>
        )}
        <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
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
            {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
            <button type="submit" aria-label="Delete task" className="text-muted hover:text-critical">
              ×
            </button>
          </form>
        </div>
      </div>
    </li>
  );
}

/** A label is a filter you can see: clicking one narrows the issues view to it. */
export function LabelChips({ labels, max = 3 }: { labels: string[]; max?: number }) {
  if (labels.length === 0) return null;
  const shown = labels.slice(0, max);
  return (
    <span className="flex shrink-0 flex-wrap items-center gap-1">
      {shown.map((label) => {
        const accent = labelAccent(label);
        return (
          <Link
            key={label}
            href={issuesHref({ label })}
            title={`Show issues labelled ${label}`}
            className={`rounded-chip px-1.5 py-0.5 text-[10px] font-medium ${ACCENT_BG[accent]} ${ACCENT_TEXT[accent]}`}
          >
            {label}
          </Link>
        );
      })}
      {labels.length > shown.length && (
        <span className="text-[10px] text-muted">+{labels.length - shown.length}</span>
      )}
    </span>
  );
}
