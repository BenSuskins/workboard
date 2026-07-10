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
  syncAll,
  syncProject,
  updateProject,
  updateTask,
  type ProjectHealth,
  type ProjectPriority,
  type ProjectStatus,
  type RepoScope,
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

export async function addTaskAction(formData: FormData) {
  const projectId = Number(formData.get("projectId"));
  const title = String(formData.get("title") ?? "").trim();
  const dueDate = String(formData.get("dueDate") ?? "").trim();
  if (title) addTask(db(), projectId, title, { dueDate: dueDate || undefined, author: "user" });
  revalidatePath(`/projects/${String(formData.get("slug"))}`);
}

export async function setTaskStatusAction(formData: FormData) {
  updateTask(db(), Number(formData.get("taskId")), {
    status: formData.get("status") as TaskStatus,
  });
  revalidatePath(`/projects/${String(formData.get("slug"))}`);
  revalidatePath("/");
}

export async function deleteTaskAction(formData: FormData) {
  deleteTask(db(), Number(formData.get("taskId")));
  revalidatePath(`/projects/${String(formData.get("slug"))}`);
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
