/**
 * Filesystem primitives the markdown store relies on for correctness. The web
 * and MCP servers are separate processes writing one tree, so nothing here may
 * assume it is the only writer.
 *
 * Two POSIX guarantees carry the weight:
 *   - `rename` within a filesystem is atomic: a reader sees the old file or the
 *     new one, never a half-written one.
 *   - `open` with O_CREAT|O_EXCL ("wx") succeeds for exactly one caller.
 */
import {
  closeSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { dirname, join } from "node:path";

function isErrno(err: unknown, code: string): boolean {
  return (err as NodeJS.ErrnoException)?.code === code;
}

/** Write via a temp file and rename, so a concurrent reader never sees a torn file. */
export function writeFileAtomic(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.tmp-${process.pid}-${Math.random().toString(36).slice(2, 10)}`;
  const fd = openSync(temp, "wx");
  try {
    writeSync(fd, contents);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  try {
    renameSync(temp, path);
  } catch (err) {
    rmSync(temp, { force: true });
    throw err;
  }
}

/**
 * Create `path` exclusively. Returns false when it already exists, which is how
 * every exactly-once decision in the store is made.
 */
export function createExclusive(path: string, contents = ""): boolean {
  mkdirSync(dirname(path), { recursive: true });
  let fd: number;
  try {
    fd = openSync(path, "wx");
  } catch (err) {
    if (isErrno(err, "EEXIST")) return false;
    throw err;
  }
  try {
    if (contents) writeSync(fd, contents);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  return true;
}

/**
 * Claim the next free integer id by creating a marker in `ledgerDir`. Racing
 * callers collide on the same candidate; the loser sees EEXIST and moves on, so
 * no two callers ever leave with the same id.
 */
export function allocateId(ledgerDir: string, contents = ""): number {
  mkdirSync(ledgerDir, { recursive: true });
  let candidate = highestId(ledgerDir) + 1;
  while (!createExclusive(join(ledgerDir, String(candidate)), contents)) candidate++;
  return candidate;
}

export function highestId(ledgerDir: string): number {
  let highest = 0;
  for (const name of readdirSyncSafe(ledgerDir)) {
    const value = Number(name);
    if (Number.isInteger(value) && value > highest) highest = value;
  }
  return highest;
}

export function readdirSyncSafe(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch (err) {
    if (isErrno(err, "ENOENT")) return [];
    throw err;
  }
}

export function readFileSyncSafe(path: string): string | undefined {
  try {
    return readFileSync(path, "utf8");
  } catch (err) {
    if (isErrno(err, "ENOENT")) return undefined;
    throw err;
  }
}

/** Create a directory, reporting whether this caller made it. Atomic without `recursive`. */
export function mkdirExclusive(path: string): boolean {
  mkdirSync(dirname(path), { recursive: true });
  try {
    mkdirSync(path);
    return true;
  } catch (err) {
    if (isErrno(err, "EEXIST")) return false;
    throw err;
  }
}

const LOCK_TIMEOUT_MS = 10_000;
const LOCK_RETRY_MS = 5;

/**
 * Serialize a read-modify-write against one file across processes. A lock older
 * than LOCK_TIMEOUT_MS is treated as abandoned by a crashed writer and broken,
 * so a dead process cannot wedge the board permanently.
 */
export function withFileLock<T>(path: string, fn: () => T): T {
  const lock = `${path}.lock`;
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  while (!createExclusive(lock, String(process.pid))) {
    if (lockAge(lock) > LOCK_TIMEOUT_MS) {
      rmSync(lock, { force: true });
      continue;
    }
    if (Date.now() > deadline) throw new Error(`Timed out waiting for lock on ${path}`);
    sleepSync(LOCK_RETRY_MS);
  }
  try {
    return fn();
  } finally {
    try {
      unlinkSync(lock);
    } catch (err) {
      if (!isErrno(err, "ENOENT")) throw err;
    }
  }
}

function lockAge(lock: string): number {
  try {
    return Date.now() - statSync(lock).mtimeMs;
  } catch {
    return 0;
  }
}

/** Blocking sleep — the store API is synchronous, matching the SQLite calls it replaces. */
function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

export { writeFileSync, renameSync, statSync };
