import Link from "next/link";
import type { TaskRow } from "@workboard/core";
import { Avatar } from "./avatar";
import { rowCls } from "./list";
import { LabelChip, StatusRing } from "./state-glyphs";
import { deleteTaskAction, setTaskAgentReadyAction } from "@/lib/actions";
import { issuesHref } from "@/lib/issue-filters";
import { toPlainText } from "@/lib/format";

/**
 * One issue as a row. The project page's task list and the cross-project issues
 * view both render through this, so an issue reads the same wherever you meet
 * it — same identifier, same labels, same controls.
 *
 * The status ring is display-only here: marking work done happens on the task
 * page or the project kanban, not by clicking a glyph in a flat list.
 */
export function IssueRow({
  row,
  showProject = false,
  returnTo,
}: {
  row: TaskRow;
  /** The issues view lists several projects, so it names the one each row belongs to. */
  showProject?: boolean;
  /** Where a delete should land. Defaults to the project page. */
  returnTo?: string;
}) {
  const { task, project, identifier, lane } = row;
  const done = task.status === "done";
  const href = `/projects/${project.slug}/tasks/${task.id}`;

  return (
    <li className={rowCls}>
      <span className="mt-[3px]">
        <StatusRing lane={lane} />
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-[9px]">
          <span className="flex-none font-mono text-[11.5px] tabular-nums text-muted" title={`${project.name} issue`}>
            {identifier}
          </span>
          <Link
            href={href}
            className={`min-w-0 truncate text-body font-medium tracking-[-0.003em] hover:text-accent ${
              done ? "text-muted line-through" : "text-ink"
            }`}
          >
            {task.title}
          </Link>
          <LabelChips labels={task.labels} />
          {task.dueDate && <span className="flex-none text-meta text-warning">due {task.dueDate}</span>}
        </div>
        <div className="flex min-w-0 items-center gap-2">
          {showProject && (
            <>
              <Link href={`/projects/${project.slug}`} className="flex-none text-meta text-ink-2 hover:text-ink">
                {project.name}
              </Link>
              {task.description && <span className="text-grid">·</span>}
            </>
          )}
          {task.description && <span className="min-w-0 truncate text-meta text-muted">{toPlainText(task.description)}</span>}
        </div>
      </div>

      <div className="flex flex-none items-center gap-2 pt-px">
        {task.assignee ? (
          <Avatar author={task.assignee} size="sm" />
        ) : (
          // A dashed ring rather than a glyph: 12px is the smallest text the app
          // renders, and this slot is avatar-sized.
          <span className="size-5 rounded-full border border-dashed border-grid" title="Unassigned">
            <span className="sr-only">Unassigned</span>
          </span>
        )}
        <form action={setTaskAgentReadyAction}>
          <input type="hidden" name="taskId" value={task.id} />
          <input type="hidden" name="slug" value={project.slug} />
          <input type="hidden" name="ready" value={task.agentReady ? "0" : "1"} />
          <button
            type="submit"
            aria-label={task.agentReady ? "Take out of the queue" : "Put up for grabs"}
            title={task.agentReady ? "Take out of the queue" : "Put up for grabs"}
            className={`grid size-[22px] place-items-center rounded-chip transition-colors hover:bg-surface-2 ${
              task.agentReady ? "text-accent" : "text-grid hover:text-accent"
            }`}
          >
            <UpForGrabsIcon />
          </button>
        </form>
        <form action={deleteTaskAction}>
          <input type="hidden" name="taskId" value={task.id} />
          <input type="hidden" name="slug" value={project.slug} />
          {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
          <button
            type="submit"
            aria-label="Delete task"
            title="Delete task"
            className="grid size-[22px] place-items-center rounded-chip text-muted transition-colors hover:bg-surface-2 hover:text-critical"
          >
            <DeleteIcon />
          </button>
        </form>
      </div>
    </li>
  );
}

function UpForGrabsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <circle cx="8" cy="8" r="5.5" />
      <circle cx="8" cy="8" r="1.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

/**
 * A label is the outlined-square chip, in the label's own hue, that
 * `state-glyphs` draws everywhere else — wrapped in a link here so clicking
 * one narrows the issues view to it.
 */
export function LabelChips({ labels, max = 3 }: { labels: string[]; max?: number }) {
  if (labels.length === 0) return null;
  const shown = labels.slice(0, max);
  return (
    <span className="flex flex-none flex-wrap items-center gap-1.5">
      {shown.map((label) => (
        <Link
          key={label}
          href={issuesHref({ label })}
          title={`Show issues labelled ${label}`}
          className="flex-none transition-colors hover:text-ink-2"
        >
          <LabelChip label={label} />
        </Link>
      ))}
      {labels.length > shown.length && (
        <span className="flex-none text-caption text-muted">+{labels.length - shown.length}</span>
      )}
    </span>
  );
}
