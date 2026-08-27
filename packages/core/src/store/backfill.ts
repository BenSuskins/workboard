/**
 * Gives an existing board the fields identifiers are built from: a `key` on
 * every project and a `number` on every task. Boards written before identifiers
 * existed have neither, and both must be *stable* — an identifier that changes
 * between boots is worse than no identifier — so they are assigned once, in
 * creation order, and written to disk rather than derived at read time.
 *
 * `openStore` calls this on every open, which is why the guard is a single
 * `existsSync` on a stamp file: once a tree is stamped, this costs one stat.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Project, Task } from "../domain.js";
import { deriveProjectKey } from "../identifiers.js";
import { withFileLock, writeFileAtomic } from "./atomic.js";
import * as p from "./paths.js";
// Same call-time cycle as migrate.ts: both modules only reach into store.ts
// from inside a function, and function declarations are hoisted.
import { board, writeProject, writeTask, type Store } from "./store.js";

const STAMP = ".identifiers";

/** The ledger a project's task numbers are allocated from. */
export function taskNumberLedger(projectId: number): string {
  return `task-numbers/${projectId}`;
}

export function backfillIdentifiersIfNeeded(root: string): void {
  const stamp = join(root, STAMP);
  if (existsSync(stamp)) return;
  mkdirSync(root, { recursive: true });

  // Two processes cold-booting together must not number the same tasks twice.
  // The store's own lock already breaks the lock a crashed writer left behind,
  // so an interrupted backfill delays the next boot rather than wedging it.
  withFileLock(stamp, () => {
    // The other process may have finished while this one waited for the lock.
    if (existsSync(stamp)) return;
    const assigned = backfillIdentifiers({ root });
    writeFileAtomic(stamp, "v1\n");
    if (assigned > 0) {
      // stderr, never stdout: the MCP stdio transport owns stdout.
      console.error(`[workboard] assigned identifiers to ${assigned} task${assigned === 1 ? "" : "s"}`);
    }
  });
}

/**
 * Assign the missing keys and numbers. Idempotent: a project that already has a
 * key keeps it, a task that already has a number keeps it, and a run with
 * nothing to do writes nothing. Returns how many tasks were numbered.
 */
export function backfillIdentifiers(store: Store): number {
  const data = board(store);
  const projects = [...data.projects];
  const tasks = [...data.tasks];
  if (projects.length === 0) return 0;

  const keyed = keyProjects(store, projects);
  let numbered = 0;
  for (const project of projects) {
    numbered += numberTasks(
      store,
      keyed.get(project.id) ?? project,
      tasks.filter((task) => task.projectId === project.id),
    );
  }
  return numbered;
}

/** Every project ends up with a unique key; the ones that had one are left alone. */
function keyProjects(store: Store, projects: Project[]): Map<number, Project> {
  const taken = new Set(projects.map((project) => project.key).filter(Boolean));
  const written = new Map<number, Project>();
  for (const project of [...projects].sort((a, b) => a.id - b.id)) {
    if (project.key) continue;
    const key = deriveProjectKey(project.name, taken);
    taken.add(key);
    written.set(project.id, writeProject(store, { ...project, key }));
  }
  return written;
}

/**
 * Numbers run from 1 in creation order, deleted tasks included — a restored task
 * should come back with the name it had. The ledger is seeded with every number
 * in use so a task added after the backfill continues the sequence instead of
 * colliding with it.
 */
function numberTasks(store: Store, project: Project, tasks: Task[]): number {
  const ledger = p.ledgerDir(store.root, taskNumberLedger(project.id));
  const used = new Set(tasks.map((task) => task.number).filter(Boolean));
  let next = Math.max(0, ...used) + 1;
  let assigned = 0;

  for (const task of [...tasks].sort((a, b) => a.createdAt - b.createdAt || a.id - b.id)) {
    if (task.number) continue;
    const number = next++;
    used.add(number);
    writeTask(store, project.slug, { ...task, number });
    assigned++;
  }

  if (used.size > 0) {
    mkdirSync(ledger, { recursive: true });
    for (const number of used) writeFileSync(join(ledger, String(number)), "");
  }
  return assigned;
}
