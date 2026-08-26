"use server";

import {
  addLink,
  addTask,
  addComment,
  addPost,
  createProject,
  PROJECT_ACCENTS,
  type ProjectAccent,
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

/**
 * A project now spans three routes, and the sidebar counts render in the root
 * layout, so any write to a project has to refresh all of them together.
 */
function revalidateProject(slug: string): void {
  if (!slug) return;
  revalidatePath(`/projects/${slug}`);
  revalidatePath(`/projects/${slug}/tasks`);
  revalidatePath(`/projects/${slug}/activity`);
  revalidatePath("/", "layout");
}

function csv(value: FormDataEntryValue | null): string[] | undefined {
  const items = String(value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return items.length ? items : undefined;
}

/** One emoji at most; an empty field leaves the tile on its initial-letter fallback. */
function projectIcon(value: FormDataEntryValue | null): string | undefined {
  const raw = String(value ?? "").trim();
  return raw ? [...raw][0] : undefined;
}

/** Empty or unknown means "derive a hue from the slug", so the field stays null. */
function projectAccent(value: FormDataEntryValue | null): ProjectAccent | undefined {
  const raw = String(value ?? "").trim();
  return (PROJECT_ACCENTS as readonly string[]).includes(raw) ? (raw as ProjectAccent) : undefined;
}

export async function createProjectAction(formData: FormData) {
  const project = createProject(db(), {
    name: String(formData.get("name") ?? "").trim() || "Untitled project",
    description: String(formData.get("description") ?? ""),
    category: String(formData.get("category") ?? "coding"),
    priority: (formData.get("priority") as ProjectPriority) || "medium",
    icon: projectIcon(formData.get("icon")),
    accent: projectAccent(formData.get("accent")),
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
    icon: projectIcon(formData.get("icon")),
    accent: projectAccent(formData.get("accent")),
  });
  revalidatePath("/");
  revalidateProject(String(formData.get("slug")));
}

export async function addPostAction(formData: FormData) {
  const projectId = Number(formData.get("projectId"));
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const database = db();
  if (body || title) addPost(database, projectId, body, { type: "note", title, author: "user" });
  // The board composer posts without knowing the slug, so resolve it here.
  const slug = String(formData.get("slug") ?? "") || getProject(database, projectId)?.slug;
  if (slug) revalidateProject(slug);
  revalidatePath("/");
}

export async function addCommentAction(formData: FormData) {
  const postId = Number(formData.get("postId"));
  const body = String(formData.get("body") ?? "").trim();
  if (body) addComment(db(), postId, body, "user");
  const slug = String(formData.get("slug"));
  revalidatePath(`/projects/${slug}/posts/${postId}`);
  revalidateProject(slug);
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
  revalidateProject(String(formData.get("slug")));
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
  revalidateProject(slug);
  revalidatePath("/");
}

export async function setTaskAgentReadyAction(formData: FormData) {
  const taskId = Number(formData.get("taskId"));
  setTaskAgentReady(db(), taskId, formData.get("ready") === "1");
  const slug = String(formData.get("slug"));
  revalidatePath(`/projects/${slug}/tasks/${taskId}`);
  revalidateProject(slug);
  revalidatePath("/");
}

export async function setTaskStatusAction(formData: FormData) {
  const taskId = Number(formData.get("taskId"));
  updateTask(db(), taskId, {
    status: formData.get("status") as TaskStatus,
  });
  const slug = String(formData.get("slug"));
  revalidatePath(`/projects/${slug}/tasks/${taskId}`);
  revalidateProject(slug);
  revalidatePath("/");
}

export async function deleteTaskAction(formData: FormData) {
  deleteTask(db(), Number(formData.get("taskId")));
  // Redirecting also covers deletion from the task's own page.
  redirect(`/projects/${String(formData.get("slug"))}`);
}

export async function restoreTaskAction(formData: FormData) {
  restoreTask(db(), Number(formData.get("taskId")));
  revalidateProject(String(formData.get("slug")));
}

export async function restoreLinkAction(formData: FormData) {
  restoreLink(db(), Number(formData.get("linkId")));
  revalidateProject(String(formData.get("slug")));
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
  revalidateProject(String(formData.get("slug")));
}

export async function deleteLinkAction(formData: FormData) {
  deleteLink(db(), Number(formData.get("linkId")));
  revalidateProject(String(formData.get("slug")));
}

export async function resolveWarningAction(formData: FormData) {
  resolveWarning(db(), Number(formData.get("warningId")), { resolvedBy: "user" });
  revalidateProject(String(formData.get("slug")));
  revalidatePath("/");
  // Resolving here empties a row of the inbox and decrements the sidebar badge.
  revalidatePath("/inbox");
}

export async function setProjectPinnedAction(formData: FormData) {
  setProjectPinned(db(), Number(formData.get("projectId")), formData.get("pinned") === "1");
  revalidatePath("/");
  revalidateProject(String(formData.get("slug")));
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
  revalidateProject(slug);
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
  revalidateProject(slug);
  revalidatePath("/");
}
