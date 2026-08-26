/**
 * Where each entity lives in the markdown tree. Ids are authoritative; the slug
 * in a filename is a convenience for hand-browsing and may go stale after a
 * rename, so every lookup matches on the `<id>-` prefix.
 */
import { join } from "node:path";
import { readdirSyncSafe } from "./atomic.js";

export const pad = (id: number): string => String(id).padStart(4, "0");

export const projectsDir = (root: string): string => join(root, "projects");
export const projectDir = (root: string, slug: string): string => join(projectsDir(root), slug);
export const projectFile = (root: string, slug: string): string => join(projectDir(root, slug), "project.md");

export const tasksDir = (root: string, slug: string): string => join(projectDir(root, slug), "tasks");
export const deletedTasksDir = (root: string, slug: string): string => join(tasksDir(root, slug), ".deleted");
export const claimsDir = (root: string, slug: string): string => join(tasksDir(root, slug), ".claims");
export const claimFile = (root: string, slug: string, id: number): string => join(claimsDir(root, slug), pad(id));

export const postsDir = (root: string, slug: string): string => join(projectDir(root, slug), "posts");
export const postDir = (root: string, slug: string, id: number): string => join(postsDir(root, slug), pad(id));
export const postFile = (root: string, slug: string, id: number): string => join(postDir(root, slug, id), "post.md");
export const commentsDir = (root: string, slug: string, id: number): string => join(postDir(root, slug, id), "comments");

export const summariesDir = (root: string, slug: string): string => join(projectDir(root, slug), "summaries");
export const linksDir = (root: string, slug: string): string => join(projectDir(root, slug), "links");
export const deletedLinksDir = (root: string, slug: string): string => join(linksDir(root, slug), ".deleted");
export const warningsDir = (root: string, slug: string): string => join(projectDir(root, slug), "warnings");

export const reportsDir = (root: string): string => join(root, "reports");
export const cacheDir = (root: string): string => join(root, ".cache");
export const snapshotFile = (root: string, linkId: number): string => join(cacheDir(root), "snapshots", `${linkId}.json`);
export const syncStateFile = (root: string, linkId: number): string => join(cacheDir(root), "sync-state", `${linkId}.json`);
export const ledgerDir = (root: string, entity: string): string => join(root, ".seq", entity);

/** Directories whose names start with a dot carry machinery, not board content. */
export const isContent = (name: string): boolean => !name.startsWith(".");

export function findByIdPrefix(dir: string, id: number): string | undefined {
  const prefix = `${pad(id)}-`;
  const match = readdirSyncSafe(dir).find((name) => name.startsWith(prefix) || name === `${pad(id)}.md`);
  return match ? join(dir, match) : undefined;
}
