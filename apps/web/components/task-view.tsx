import type { Comment, Project, Task } from "@workboard/core";
import { taskLane } from "@workboard/core";
import { Avatar } from "./avatar";
import { TaskPriorityBadge } from "./badges";
import { Markdown } from "./markdown";
import { TimeAgo } from "./time-ago";
import { TASK_LANE_LABEL, TASK_LANE_ORDER, TASK_LANE_TONE } from "./labels";
import { authorLabel, fullDate } from "@/lib/format";
import { addTaskCommentAction, deleteTaskAction, moveTaskAction, updateTaskDetailAction } from "@/lib/actions";

import { fieldCls as inputCls, primaryButtonCls as btnCls, selectCls } from "./form";

/**
 * A task, its spec, its thread, and the controls that act on it. The full route
 * and the slide-over both render this, so the two never drift apart.
 */
export function TaskView({ task, project, comments }: { task: Task; project: Project; comments: Comment[] }) {
  const lane = taskLane(task);
  const tone = TASK_LANE_TONE[lane];
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div className="flex items-start gap-2.5">
          <span className={`mt-2 size-2 shrink-0 rounded-full ${tone.dot}`} aria-hidden />
          <h1
            className={`text-heading font-semibold leading-snug tracking-tight ${
              task.status === "done" ? "text-muted line-through" : "text-ink"
            }`}
          >
            {task.title}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pl-[1.125rem] text-meta text-muted">
          <span className={`font-medium ${tone.text}`}>{TASK_LANE_LABEL[lane]}</span>
          <span>·</span>
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

      {/* The same move the board's drag makes, spelled out — this view has no columns to drop into. */}
      <div className="flex flex-wrap items-center gap-3 pl-[1.125rem]">
        <form action={moveTaskAction} className="flex items-center gap-2">
          <input type="hidden" name="taskId" value={task.id} />
          <input type="hidden" name="slug" value={project.slug} />
          <label className="flex items-center gap-2 text-meta text-muted">
            Column
            <select name="lane" defaultValue={lane} className={`${selectCls} w-auto py-1.5 text-meta`}>
              {TASK_LANE_ORDER.map((option) => (
                <option key={option} value={option}>
                  {TASK_LANE_LABEL[option]}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="rounded-control border border-hairline px-3 py-1.5 text-meta text-ink-2 transition-colors hover:border-accent/40 hover:text-accent">
            Move
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

      <TaskThread task={task} project={project} comments={comments} />
    </div>
  );
}

/**
 * The conversation on a task. An agent claims the work and reports here through
 * add_task_comment; a reply left in this box reaches it back through list_answers.
 * Same shape as a post's thread, because it is the same act.
 */
function TaskThread({ task, project, comments }: { task: Task; project: Project; comments: Comment[] }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-title font-semibold text-ink">
        {comments.length === 0 ? "No replies yet" : `${comments.length} repl${comments.length === 1 ? "y" : "ies"}`}
      </h2>

      {comments.map((comment) => (
        <div key={comment.id} className="rounded-card border border-hairline bg-surface p-4">
          <div className="mb-1.5 flex items-center gap-2 text-meta text-muted">
            <Avatar author={comment.author} size="sm" />
            <span className="font-medium text-ink-2">{authorLabel(comment.author)}</span>
            <span className="ml-auto" title={fullDate(comment.createdAt)}>
              <TimeAgo at={comment.createdAt} />
            </span>
          </div>
          <Markdown>{comment.body}</Markdown>
        </div>
      ))}

      <form
        action={addTaskCommentAction}
        className="flex items-end gap-2 rounded-card border border-hairline bg-surface p-2 focus-within:border-accent/40"
      >
        <input type="hidden" name="taskId" value={task.id} />
        <input type="hidden" name="slug" value={project.slug} />
        <textarea
          name="body"
          rows={1}
          required
          aria-label="Reply"
          placeholder={task.claimedBy ? `Reply to ${authorLabel(task.claimedBy)}…` : "Add a note for whoever picks this up…"}
          className="min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-body text-ink outline-none placeholder:text-muted"
        />
        <button
          type="submit"
          title="Reply"
          className="grid size-9 shrink-0 place-items-center rounded-control bg-accent text-on-accent transition-opacity hover:opacity-90"
        >
          <span aria-hidden>➤</span>
          <span className="sr-only">Reply</span>
        </button>
      </form>
      {task.claimedBy && <p className="text-meta text-muted">Your reply reaches the agent through list_answers.</p>}
    </section>
  );
}
