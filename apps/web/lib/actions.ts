"use server";

import {
  addLink,
  addTask,
  addUpdate,
  createProject,
  deleteLink,
  deleteTask,
  getProject,
  resolveWarning,
  restoreLink,
  restoreTask,
  setProjectPinned,
  setTaskAgentReady,
  syncAll,
  syncProject,
  TASK_PRIORITIES,
  updateProject,
  updateTask,
  type ProjectHealth,
  type ProjectPriority,
  type ProjectStatus,
  type RepoScope,
  type TaskPriority,
  type TaskStatus,
} from "@workboard/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "./db";

function csv(value: FormDataEntryValue | null): string[] | undefined {
  const items = String(value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return items.length ? items : undefined;
}

export async function createProjectAction(formData: FormData) {
  const project = createProject(db(), {
    name: String(formData.get("name") ?? "").trim() || "Untitled project",
    description: String(formData.get("description") ?? ""),
    category: String(formData.get("category") ?? "coding"),
    priority: (formData.get("priority") as ProjectPriority) || "medium",
  });
  revalidatePath("/");
  redirect(`/projects/${project.slug}`);
}

export async function updateProjectAction(formData: FormData) {
  const id = Number(formData.get("id"));
  updateProject(db(), id, {
    name: String(formData.get("name") ?? "").trim() || undefined,
    description: String(formData.get("description") ?? ""),
    category: String(formData.get("category") ?? "") || undefined,
    status: (formData.get("status") as ProjectStatus) || undefined,
    priority: (formData.get("priority") as ProjectPriority) || undefined,
    health: (formData.get("health") as ProjectHealth) || undefined,
  });
  revalidatePath("/");
  revalidatePath(`/projects/${String(formData.get("slug"))}`);
}

export async function addUpdateAction(formData: FormData) {
  const projectId = Number(formData.get("projectId"));
  const body = String(formData.get("body") ?? "").trim();
  if (body) addUpdate(db(), projectId, body, { type: "note", author: "user" });
  revalidatePath(`/projects/${String(formData.get("slug"))}`);
  revalidatePath("/");
}

/** Empty/absent select value means "no priority"; anything else must be a known level. */
function taskPriority(value: FormDataEntryValue | null): TaskPriority | null {
  const raw = String(value ?? "").trim();
  return (TASK_PRIORITIES as readonly string[]).includes(raw) ? (raw as TaskPriority) : null;
}

export async function addTaskAction(formData: FormData) {
  const projectId = Number(formData.get("projectId"));
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const dueDate = String(formData.get("dueDate") ?? "").trim();
  if (title)
    addTask(db(), projectId, title, {
      description,
      priority: taskPriority(formData.get("priority")),
      dueDate: dueDate || undefined,
      author: "user",
      agentReady: formData.get("agentReady") === "on",
    });
  revalidatePath(`/projects/${String(formData.get("slug"))}`);
  revalidatePath("/");
}

export async function updateTaskDetailAction(formData: FormData) {
  const taskId = Number(formData.get("taskId"));
  updateTask(db(), taskId, {
    title: String(formData.get("title") ?? "").trim() || undefined,
    description: String(formData.get("description") ?? ""),
    priority: taskPriority(formData.get("priority")),
    dueDate: String(formData.get("dueDate") ?? "").trim() || null,
  });
  const slug = String(formData.get("slug"));
  revalidatePath(`/projects/${slug}/tasks/${taskId}`);
  revalidatePath(`/projects/${slug}`);
  revalidatePath("/");
}

export async function setTaskAgentReadyAction(formData: FormData) {
  const taskId = Number(formData.get("taskId"));
  setTaskAgentReady(db(), taskId, formData.get("ready") === "1");
  const slug = String(formData.get("slug"));
  revalidatePath(`/projects/${slug}/tasks/${taskId}`);
  revalidatePath(`/projects/${slug}`);
  revalidatePath("/");
}

export async function setTaskStatusAction(formData: FormData) {
  const taskId = Number(formData.get("taskId"));
  updateTask(db(), taskId, {
    status: formData.get("status") as TaskStatus,
  });
  const slug = String(formData.get("slug"));
  revalidatePath(`/projects/${slug}/tasks/${taskId}`);
  revalidatePath(`/projects/${slug}`);
  revalidatePath("/");
}

export async function deleteTaskAction(formData: FormData) {
  deleteTask(db(), Number(formData.get("taskId")));
  // Redirecting also covers deletion from the task's own page.
  redirect(`/projects/${String(formData.get("slug"))}`);
}

export async function restoreTaskAction(formData: FormData) {
  restoreTask(db(), Number(formData.get("taskId")));
  revalidatePath(`/projects/${String(formData.get("slug"))}`);
}

export async function restoreLinkAction(formData: FormData) {
  restoreLink(db(), Number(formData.get("linkId")));
  revalidatePath(`/projects/${String(formData.get("slug"))}`);
  revalidatePath("/");
}

export async function addLinkAction(formData: FormData) {
  const projectId = Number(formData.get("projectId"));
  const url = String(formData.get("url") ?? "").trim();
  if (!url) return;
  const scope: RepoScope = {
    labels: csv(formData.get("labels")),
    pathPrefixes: csv(formData.get("pathPrefixes")),
    branchPrefix: String(formData.get("branchPrefix") ?? "").trim() || undefined,
  };
  const hasScope = scope.labels || scope.pathPrefixes || scope.branchPrefix;
  addLink(db(), projectId, {
    url,
    title: String(formData.get("title") ?? "").trim(),
    scope: hasScope ? scope : undefined,
  });
  revalidatePath(`/projects/${String(formData.get("slug"))}`);
}

export async function deleteLinkAction(formData: FormData) {
  deleteLink(db(), Number(formData.get("linkId")));
  revalidatePath(`/projects/${String(formData.get("slug"))}`);
}

export async function resolveWarningAction(formData: FormData) {
  resolveWarning(db(), Number(formData.get("warningId")), { resolvedBy: "user" });
  revalidatePath(`/projects/${String(formData.get("slug"))}`);
  revalidatePath("/");
}

export async function setProjectPinnedAction(formData: FormData) {
  setProjectPinned(db(), Number(formData.get("projectId")), formData.get("pinned") === "1");
  revalidatePath("/");
  revalidatePath(`/projects/${String(formData.get("slug"))}`);
}

/** Bring a shelved (done or archived) project back onto the active board. */
export async function restoreProjectAction(formData: FormData) {
  updateProject(db(), Number(formData.get("projectId")), { status: "active" });
  revalidatePath("/archive");
  revalidatePath("/");
}

export async function refreshProjectAction(formData: FormData) {
  const slug = String(formData.get("slug"));
  const project = getProject(db(), slug);
  if (project) await syncProject(db(), project.id);
  revalidatePath(`/projects/${slug}`);
  revalidatePath("/");
}

export async function refreshAllAction() {
  await syncAll(db());
  revalidatePath("/");
}

/** Bindable variant for the RefreshButton: refreshProjectBySlug.bind(null, slug). */
export async function refreshProjectBySlug(slug: string) {
  const project = getProject(db(), slug);
  if (project) await syncProject(db(), project.id);
  revalidatePath(`/projects/${slug}`);
  revalidatePath("/");
}
