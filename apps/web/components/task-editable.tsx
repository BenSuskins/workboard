"use client";

import { useState, useTransition } from "react";
import type { Task } from "@workboard/core";
import { updateTaskDetailAction } from "@/lib/actions";

/**
 * Click-to-edit for a task's title and description. This is the only new client
 * state in the redesign: everything else on this page is still a server
 * component posting a form.
 *
 * `updateTaskDetailAction` reads every field at once and treats an absent one
 * as empty — an update carrying only a title would clear the labels and the due
 * date. So both editors send the whole task back, changing one field of it.
 */
function detailForm(task: Task, changes: { title?: string; description?: string }, slug: string): FormData {
  const form = new FormData();
  form.set("taskId", String(task.id));
  form.set("slug", slug);
  form.set("title", changes.title ?? task.title);
  form.set("description", changes.description ?? task.description);
  form.set("priority", task.priority ?? "");
  form.set("dueDate", task.dueDate ?? "");
  form.set("labels", task.labels.join(","));
  if (task.assignee) form.set("assignee", task.assignee);
  return form;
}

/** Read mode and edit mode occupy the same box, so committing does not reflow. */
const BOX = "rounded-control border px-2 py-1.5 -mx-[9px] -my-[7px]";

export function EditableTitle({ task, slug }: { task: Task; slug: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const [, startTransition] = useTransition();

  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    // An empty title is a slip, not an instruction: the action would ignore it
    // anyway, so put the old one back rather than leave the box lying.
    if (!next || next === task.title) return setDraft(task.title);
    startTransition(async () => {
      await updateTaskDetailAction(detailForm(task, { title: next }, slug));
    });
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") {
            setDraft(task.title);
            setEditing(false);
          }
        }}
        aria-label="Task title"
        className={`${BOX} w-full border-accent bg-surface text-page font-semibold tracking-[-0.018em] text-ink shadow-[0_0_0_3px_color-mix(in_srgb,var(--wb-accent)_18%,transparent)] outline-none`}
      />
    );
  }

  return (
    <h1
      tabIndex={0}
      role="button"
      title="Click to edit"
      onClick={() => setEditing(true)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setEditing(true);
        }
      }}
      className={`${BOX} cursor-text text-pretty border-transparent text-page font-semibold tracking-[-0.018em] text-ink transition-colors duration-[130ms] hover:border-hairline hover:bg-surface-2`}
    >
      {draft}
    </h1>
  );
}

/**
 * The rendered markdown arrives as a prop rather than being built here: it is
 * produced by a server-only renderer, which cannot be imported into a client
 * bundle. Read mode shows what the server drew; edit mode swaps in the source.
 */
export function EditableDescription({
  task,
  slug,
  rendered,
}: {
  task: Task;
  slug: string;
  rendered: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.description);
  const [, startTransition] = useTransition();

  const commit = () => {
    setEditing(false);
    if (draft === task.description) return;
    startTransition(async () => {
      await updateTaskDetailAction(detailForm(task, { description: draft }, slug));
    });
  };

  const cancel = () => {
    setDraft(task.description);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex flex-col gap-2">
        <textarea
          autoFocus
          rows={14}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") cancel();
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) commit();
          }}
          aria-label="Task description"
          className="w-full resize-y rounded-card border border-accent bg-surface px-3.5 py-3 font-mono text-label leading-relaxed text-ink shadow-[0_0_0_3px_color-mix(in_srgb,var(--wb-accent)_18%,transparent)] outline-none"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={commit}
            className="rounded-control bg-accent px-3 py-1.5 text-label font-medium text-on-accent transition-opacity hover:opacity-90"
          >
            Save
          </button>
          <button
            type="button"
            onClick={cancel}
            className="rounded-control border border-hairline px-3 py-1.5 text-label text-ink-2 transition-colors hover:border-grid hover:text-ink"
          >
            Cancel
          </button>
          <span className="text-micro text-muted">Markdown supported · ⌘↵ to save</span>
        </div>
      </div>
    );
  }

  return (
    <div
      tabIndex={0}
      role="button"
      title="Click to edit"
      onClick={() => setEditing(true)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          setEditing(true);
        }
      }}
      className="-mx-3.5 cursor-text rounded-card border border-transparent px-3.5 py-3 text-prose text-ink-2 transition-colors duration-[130ms] hover:border-hairline hover:bg-surface-2"
    >
      {task.description ? rendered : <span className="text-muted">Add a description…</span>}
    </div>
  );
}
