import Link from "next/link";
import type { Comment, Project, Task, TaskPriority } from "@workboard/core";
import { taskIdentifier, taskLane } from "@workboard/core";
import { AutoSubmit } from "./auto-submit";
import { Avatar } from "./avatar";
import { MicroLabel } from "./detail-layout";
import { Markdown } from "./markdown";
import { railControlCls, RailRow, RailValue } from "./property-rail";
import { StatusRing } from "./state-glyphs";
import { EditableDescription, EditableTitle } from "./task-editable";
import { TimeAgo } from "./time-ago";
import { TASK_LANE_LABEL, TASK_LANE_ORDER, TASK_LANE_TONE } from "./labels";
import { authorLabel, fullDate } from "@/lib/format";
import {
  addTaskCommentAction,
  deleteTaskAction,
  moveTaskAction,
  setTaskAssigneeAction,
  updateTaskDetailAction,
} from "@/lib/actions";
import { ME } from "@/lib/issue-filters";

const PRIORITIES: TaskPriority[] = ["high", "medium", "low"];

/**
 * A task's reading column: what it is, what it says, and the conversation about
 * it. What it *is* — status, priority, owner, dates — lives in the rail beside
 * this, so the column stays prose. Both the full route and the slide-over
 * render this pair, so the two never drift apart.
 */
export function TaskView({ task, project, comments }: { task: Task; project: Project; comments: Comment[] }) {
  const lane = taskLane(task);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2.5">
          <StatusRing lane={lane} />
          <span className="font-mono text-meta tabular-nums text-muted">{taskIdentifier(project, task)}</span>
          <span className="text-meta text-muted" aria-hidden>
            ·
          </span>
          <span className="text-meta font-medium text-ink-2">{TASK_LANE_LABEL[lane]}</span>
        </div>
        {/* Keyed on updatedAt so an edit made elsewhere — an agent writing
            through the MCP tools — reseeds the draft instead of leaving a
            stale one behind the next time the box is opened. */}
        <EditableTitle key={task.updatedAt} task={task} slug={project.slug} />
        <span className="text-meta text-muted">
          {authorLabel(task.author)} opened <TimeAgo at={task.createdAt} />
          {task.updatedAt !== task.createdAt && (
            <>
              {" · updated "}
              <TimeAgo at={task.updatedAt} />
            </>
          )}
        </span>
      </div>

      <EditableDescription
        key={task.updatedAt}
        task={task}
        slug={project.slug}
        rendered={<Markdown>{task.description}</Markdown>}
      />

      <div className="h-px bg-hairline" aria-hidden />

      <TaskThread task={task} project={project} comments={comments} />
    </div>
  );
}

/**
 * The task's properties, each row a control rather than a readout. Setting one
 * is a single gesture: the select posts the moment it changes, through the same
 * server actions the rest of the app writes with.
 */
export function TaskRail({ task, project }: { task: Task; project: Project }) {
  const lane = taskLane(task);
  const hidden = (
    <>
      <input type="hidden" name="taskId" value={task.id} />
      <input type="hidden" name="slug" value={project.slug} />
    </>
  );
  // updateTaskDetailAction reads the whole task at once, so a form that sets
  // one field has to carry the others or it clears them.
  const carry = (except: string) => (
    <>
      {except !== "title" && <input type="hidden" name="title" value={task.title} />}
      {except !== "description" && <input type="hidden" name="description" value={task.description} />}
      {except !== "priority" && <input type="hidden" name="priority" value={task.priority ?? ""} />}
      {except !== "dueDate" && <input type="hidden" name="dueDate" value={task.dueDate ?? ""} />}
      {except !== "labels" && <input type="hidden" name="labels" value={task.labels.join(",")} />}
      {task.assignee && <input type="hidden" name="assignee" value={task.assignee} />}
    </>
  );

  return (
    <>
      <div className="flex flex-col gap-0.5">
        <MicroLabel className="px-2 pb-1.5">Properties</MicroLabel>

        <RailRow label="Status">
          <span className={`size-[7px] flex-none rounded-pill ${TASK_LANE_TONE[lane].dot}`} aria-hidden />
          <form action={moveTaskAction} className="min-w-0 flex-1">
            {hidden}
            <AutoSubmit>
              <select name="lane" defaultValue={lane} aria-label="Status" className={railControlCls}>
                {TASK_LANE_ORDER.map((option) => (
                  <option key={option} value={option}>
                    {TASK_LANE_LABEL[option]}
                  </option>
                ))}
              </select>
            </AutoSubmit>
          </form>
        </RailRow>

        <RailRow label="Priority">
          <form action={updateTaskDetailAction} className="min-w-0 flex-1">
            {hidden}
            {carry("priority")}
            <AutoSubmit>
              <select name="priority" defaultValue={task.priority ?? ""} aria-label="Priority" className={railControlCls}>
                <option value="">No priority</option>
                {PRIORITIES.map((option) => (
                  <option key={option} value={option}>
                    {option[0].toUpperCase() + option.slice(1)}
                  </option>
                ))}
              </select>
            </AutoSubmit>
          </form>
        </RailRow>

        <RailRow label="Assignee">
          {task.assignee ? <Avatar author={task.assignee} size="xs" /> : null}
          {/* One person and their agents, so ownership is a button, not a picker. */}
          <form action={setTaskAssigneeAction} className="min-w-0 flex-1">
            {hidden}
            <input type="hidden" name="assignee" value={task.assignee === ME ? "" : ME} />
            <button
              type="submit"
              className="w-full truncate rounded-chip border border-transparent px-1 py-0.5 text-left text-label font-medium text-ink-2 transition-colors hover:border-hairline hover:bg-surface hover:text-ink"
            >
              {task.assignee ? authorLabel(task.assignee) : "Unassigned"}
            </button>
          </form>
        </RailRow>

        {task.claimedBy && (
          <RailRow label="Claimed by">
            <RailValue dot="bg-accent">{authorLabel(task.claimedBy)}</RailValue>
          </RailRow>
        )}

        <RailRow label="Labels">
          <form action={updateTaskDetailAction} className="min-w-0 flex-1">
            {hidden}
            {carry("labels")}
            <input
              name="labels"
              defaultValue={task.labels.join(", ")}
              placeholder="None"
              title="Comma separated · Enter to save"
              aria-label="Labels, comma separated"
              className={`${railControlCls} cursor-text`}
            />
          </form>
        </RailRow>

        <RailRow label="Due date">
          <form action={updateTaskDetailAction} className="min-w-0 flex-1">
            {hidden}
            {carry("dueDate")}
            <AutoSubmit>
              <input
                type="date"
                name="dueDate"
                defaultValue={task.dueDate ?? ""}
                aria-label="Due date"
                className={`${railControlCls} ${task.dueDate ? "text-warning" : ""}`}
              />
            </AutoSubmit>
          </form>
        </RailRow>

        <RailRow label="Project">
          <Link href={`/projects/${project.slug}`} className="truncate hover:text-ink">
            {project.name}
          </Link>
        </RailRow>
      </div>

      <div className="mt-auto flex flex-col gap-1 border-t border-hairline pt-3">
        <Link
          href={`/projects/${project.slug}/tasks/${task.id}`}
          className="rounded-control px-2 py-1.5 text-label text-muted transition-colors hover:bg-surface-2 hover:text-ink"
        >
          Open full page
        </Link>
        <form action={deleteTaskAction}>
          <input type="hidden" name="taskId" value={task.id} />
          <input type="hidden" name="slug" value={project.slug} />
          <button
            type="submit"
            className="w-full rounded-control px-2 py-1.5 text-left text-label text-muted transition-colors hover:text-critical"
          >
            Delete task
          </button>
        </form>
      </div>
    </>
  );
}

/**
 * The conversation on a task. An agent claims the work and reports here through
 * add_task_comment; a reply left in this box reaches it back through list_answers.
 * Same shape as a post's thread, because it is the same act.
 */
function TaskThread({ task, project, comments }: { task: Task; project: Project; comments: Comment[] }) {
  return (
    <section className="flex flex-col gap-4">
      <MicroLabel>Activity</MicroLabel>

      {comments.map((comment) => (
        <div key={comment.id} className="flex gap-2.5">
          <Avatar author={comment.author} size="md" />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2 text-meta">
              <span className="font-medium text-ink">{authorLabel(comment.author)}</span>
              <span className="text-muted" title={fullDate(comment.createdAt)}>
                <TimeAgo at={comment.createdAt} />
              </span>
            </div>
            <div className="mt-0.5">
              <Markdown>{comment.body}</Markdown>
            </div>
          </div>
        </div>
      ))}

      <form
        action={addTaskCommentAction}
        className="flex items-end gap-2 rounded-card border border-hairline bg-surface p-2 transition-colors focus-within:border-accent"
      >
        <input type="hidden" name="taskId" value={task.id} />
        <input type="hidden" name="slug" value={project.slug} />
        <textarea
          name="body"
          rows={1}
          required
          aria-label="Reply"
          placeholder={task.claimedBy ? `Reply to ${authorLabel(task.claimedBy)}…` : "Add a note for whoever picks this up…"}
          className="min-h-8 flex-1 resize-none bg-transparent px-2 py-1.5 text-body text-ink outline-none placeholder:text-muted"
        />
        <button
          type="submit"
          className="rounded-control bg-accent px-3 py-1.5 text-label font-medium text-on-accent transition-opacity hover:opacity-90"
        >
          Reply
        </button>
      </form>
      {task.claimedBy && <p className="text-meta text-muted">Your reply reaches the agent through list_answers.</p>}
    </section>
  );
}
