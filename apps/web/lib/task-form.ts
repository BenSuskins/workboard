import type { Task } from "@workboard/core";

/**
 * `updateTaskDetailAction` reads every field at once and treats an absent one
 * as empty, so an update carrying only a title would clear the labels and the
 * due date. Every caller sends the whole task back and changes one field of it.
 *
 * Client-safe: it takes a Task as a type only and touches no store.
 */
export interface TaskChanges {
  title?: string;
  description?: string;
  priority?: string;
  dueDate?: string;
  labels?: string;
}

export function detailForm(task: Task, changes: TaskChanges, slug: string): FormData {
  const form = new FormData();
  form.set("taskId", String(task.id));
  form.set("slug", slug);
  form.set("title", changes.title ?? task.title);
  form.set("description", changes.description ?? task.description);
  form.set("priority", changes.priority ?? task.priority ?? "");
  form.set("dueDate", changes.dueDate ?? task.dueDate ?? "");
  form.set("labels", changes.labels ?? task.labels.join(","));
  if (task.assignee) form.set("assignee", task.assignee);
  return form;
}
