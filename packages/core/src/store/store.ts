/**
 * The markdown store. `openStore` returns a handle carrying a lazily-built
 * snapshot of the whole tree; every read in a request is served from it, and
 * every write invalidates it. Handles are deliberately short-lived — the web app
 * makes one per render — because a second process writes the same files and any
 * longer-lived cache would need invalidation we cannot get cheaply.
 *
 * This walks the entire tree per request. At the scale Workboard runs at
 * (tens of projects) that is well under a millisecond. Somewhere past a couple
 * of thousand posts it stops being free and wants an mtime-keyed cache.
 */
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { Comment, Link, Post, Project, Snapshot, Summary, SyncState, Task, Warning } from "../domain.js";
import { allocateId, readdirSyncSafe, readFileSyncSafe, writeFileAtomic } from "./atomic.js";
import { parse, serialize, type Fields } from "./frontmatter.js";
import * as p from "./paths.js";

export interface Store {
  readonly root: string;
  /** Lazily built, dropped on every write. */
  board?: Board;
}

export interface Board {
  projects: Project[];
  tasks: Task[];
  posts: Post[];
  comments: Comment[];
  summaries: Summary[];
  links: Link[];
  warnings: Warning[];
  syncState: SyncState[];
  snapshots: Snapshot[];
}

/**
 * Workspace processes run with different cwds (repo root, apps/web,
 * packages/mcp), so walk up to the monorepo root and share one tree.
 * WORKBOARD_DATA_DIR overrides.
 */
export function defaultDataDir(): string {
  if (process.env.WORKBOARD_DATA_DIR) return process.env.WORKBOARD_DATA_DIR;
  let dir = process.cwd();
  while (true) {
    const pkg = join(dir, "package.json");
    if (existsSync(pkg)) {
      try {
        if (JSON.parse(readFileSync(pkg, "utf8")).workspaces) return join(dir, "data/workboard");
      } catch {
        // unreadable package.json — keep walking
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(process.cwd(), "data/workboard");
}

export function openStore(root: string = defaultDataDir()): Store {
  mkdirSync(root, { recursive: true });
  return { root };
}

export function invalidate(store: Store): void {
  store.board = undefined;
}

export function board(store: Store): Board {
  return (store.board ??= loadBoard(store.root));
}

export function nextId(store: Store, entity: string): number {
  return allocateId(p.ledgerDir(store.root, entity));
}

// ---------- reading ----------

function readDoc(path: string): { fields: Fields; body: string } | undefined {
  const text = readFileSyncSafe(path);
  return text === undefined ? undefined : parse(text, path);
}

function readAll(dir: string): { fields: Fields; body: string; name: string }[] {
  return readdirSyncSafe(dir)
    .filter((name) => p.isContent(name) && name.endsWith(".md"))
    .sort()
    .flatMap((name) => {
      const doc = readDoc(join(dir, name));
      return doc ? [{ ...doc, name }] : [];
    });
}

function loadBoard(root: string): Board {
  const out: Board = { projects: [], tasks: [], posts: [], comments: [], summaries: [], links: [], warnings: [], syncState: [], snapshots: [] };

  for (const slug of readdirSyncSafe(p.projectsDir(root)).filter(p.isContent).sort()) {
    const doc = readDoc(p.projectFile(root, slug));
    if (!doc) continue;
    const project = { ...(doc.fields as unknown as Project), slug, description: doc.body };
    out.projects.push(project);
    const id = project.id;

    const claims = new Map(
      readdirSyncSafe(p.claimsDir(root, slug)).map((name) => [Number(name), readFileSyncSafe(join(p.claimsDir(root, slug), name)) ?? ""]),
    );
    for (const live of [true, false]) {
      const dir = live ? p.tasksDir(root, slug) : p.deletedTasksDir(root, slug);
      for (const { fields, body } of readAll(dir)) {
        const task = { ...(fields as unknown as Task), projectId: id, description: body };
        const claimedBy = claims.get(task.id);
        out.tasks.push(claimedBy !== undefined ? { ...task, claimedBy: claimedBy || task.claimedBy } : task);
      }
    }

    for (const dirName of readdirSyncSafe(p.postsDir(root, slug)).filter(p.isContent).sort()) {
      const doc = readDoc(join(p.postsDir(root, slug), dirName, "post.md"));
      if (!doc) continue;
      const post = { ...(doc.fields as unknown as Post), projectId: id, body: doc.body };
      out.posts.push(post);
      for (const { fields, body } of readAll(join(p.postsDir(root, slug), dirName, "comments"))) {
        out.comments.push({ ...(fields as unknown as Comment), postId: post.id, projectId: id, body });
      }
    }

    for (const { fields, body } of readAll(p.summariesDir(root, slug))) {
      out.summaries.push({ ...(fields as unknown as Summary), projectId: id, body });
    }
    for (const live of [true, false]) {
      const dir = live ? p.linksDir(root, slug) : p.deletedLinksDir(root, slug);
      for (const { fields, body } of readAll(dir)) {
        out.links.push({ ...(fields as unknown as Link), projectId: id, title: body });
      }
    }
    for (const { fields, body } of readAll(p.warningsDir(root, slug))) {
      out.warnings.push({ ...(fields as unknown as Warning), projectId: id, message: body });
    }
  }

  for (const { fields, body } of readAll(p.reportsDir(root))) {
    out.summaries.push({ ...(fields as unknown as Summary), projectId: null, body });
  }

  for (const name of readdirSyncSafe(join(p.cacheDir(root), "snapshots"))) {
    const raw = readFileSyncSafe(join(p.cacheDir(root), "snapshots", name));
    if (raw) out.snapshots.push(JSON.parse(raw) as Snapshot);
  }
  for (const name of readdirSyncSafe(join(p.cacheDir(root), "sync-state"))) {
    const raw = readFileSyncSafe(join(p.cacheDir(root), "sync-state", name));
    if (raw) out.syncState.push(JSON.parse(raw) as SyncState);
  }

  return out;
}

// ---------- writing ----------

/** Split an entity into the frontmatter fields and the one field held as the body. */
function split<T extends object, K extends keyof T>(entity: T, bodyKey: K, omit: (keyof T)[]): { fields: Fields; body: string } {
  const fields: Fields = {};
  for (const [key, value] of Object.entries(entity)) {
    if (key === bodyKey || omit.includes(key as keyof T)) continue;
    fields[key] = value;
  }
  return { fields, body: String(entity[bodyKey] ?? "") };
}

function write(path: string, doc: { fields: Fields; body: string }): void {
  writeFileAtomic(path, serialize(doc));
}

export function writeProject(store: Store, project: Project): Project {
  write(p.projectFile(store.root, project.slug), split(project, "description", ["slug"]));
  invalidate(store);
  return project;
}

export function writeTask(store: Store, slug: string, task: Task): Task {
  const dir = task.deletedAt ? p.deletedTasksDir(store.root, slug) : p.tasksDir(store.root, slug);
  const existing = p.findByIdPrefix(p.tasksDir(store.root, slug), task.id) ?? p.findByIdPrefix(p.deletedTasksDir(store.root, slug), task.id);
  const target = join(dir, `${p.pad(task.id)}-${slugify(task.title)}.md`);
  write(target, split(task, "description", ["projectId"]));
  // A retitled or (un)deleted task moves; drop the file it used to live in.
  if (existing && existing !== target) rmSync(existing, { force: true });
  invalidate(store);
  return task;
}

export function writePost(store: Store, slug: string, post: Post): Post {
  write(p.postFile(store.root, slug, post.id), split(post, "body", ["projectId"]));
  invalidate(store);
  return post;
}

export function writeComment(store: Store, slug: string, comment: Comment): Comment {
  write(
    join(p.commentsDir(store.root, slug, comment.postId), `${p.pad(comment.id)}.md`),
    split(comment, "body", ["projectId", "postId"]),
  );
  invalidate(store);
  return comment;
}

export function writeSummary(store: Store, slug: string | null, summary: Summary): Summary {
  const name = `${isoStamp(summary.createdAt)}-${p.pad(summary.id)}.md`;
  const path = slug ? join(p.summariesDir(store.root, slug), name) : join(p.reportsDir(store.root), `${isoStamp(summary.createdAt)}-${summary.kind}-${p.pad(summary.id)}.md`);
  write(path, split(summary, "body", ["projectId"]));
  invalidate(store);
  return summary;
}

export function writeLink(store: Store, slug: string, link: Link): Link {
  const dir = link.deletedAt ? p.deletedLinksDir(store.root, slug) : p.linksDir(store.root, slug);
  const existing = p.findByIdPrefix(p.linksDir(store.root, slug), link.id) ?? p.findByIdPrefix(p.deletedLinksDir(store.root, slug), link.id);
  const target = join(dir, `${p.pad(link.id)}.md`);
  write(target, split(link, "title", ["projectId"]));
  if (existing && existing !== target) rmSync(existing, { force: true });
  invalidate(store);
  return link;
}

export function writeWarning(store: Store, slug: string, warning: Warning): Warning {
  write(join(p.warningsDir(store.root, slug), `${p.pad(warning.id)}.md`), split(warning, "message", ["projectId"]));
  invalidate(store);
  return warning;
}

export function writeJson(store: Store, path: string, value: unknown): void {
  writeFileAtomic(path, `${JSON.stringify(value, null, 2)}\n`);
  invalidate(store);
}

export function isoStamp(ms: number): string {
  return new Date(ms).toISOString().replace(/[:.]/g, "-").replace("Z", "");
}

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "untitled"
  );
}
