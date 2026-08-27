import { mkdtempSync, readFileSync, readdirSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { addTask, createProject, listTasks, taskIdentifier } from "../services.js";
import { backfillIdentifiers, backfillIdentifiersIfNeeded } from "./backfill.js";
import { board, openStore, writeProject, writeTask, type Store } from "./store.js";

let root: string;
let db: Store;

/** A board as an older Workboard wrote it: no project key, no task numbers. */
function seedLegacyBoard(): void {
  const project = createProject(db, { name: "Engineering Platform" });
  const first = addTask(db, project.id, "filed first");
  const second = addTask(db, project.id, "filed second");
  writeProject(db, { ...project, key: "" });
  writeTask(db, project.slug, { ...first, number: 0, createdAt: 1_000 });
  writeTask(db, project.slug, { ...second, number: 0, createdAt: 2_000 });
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "workboard-backfill-"));
  db = openStore(root);
});

describe("identifier backfill", () => {
  it("keys every project and numbers its tasks in the order they were filed", () => {
    seedLegacyBoard();
    expect(backfillIdentifiers(db)).toBe(2);

    const rows = listTasks(db);
    expect(rows.map((row) => row.identifier).sort()).toEqual(["EP-1", "EP-2"]);
    expect(rows.find((row) => row.task.title === "filed first")!.identifier).toBe("EP-1");
  });

  it("changes nothing on a second run", () => {
    seedLegacyBoard();
    backfillIdentifiers(db);
    const before = listTasks(db).map((row) => row.identifier);

    expect(backfillIdentifiers(db)).toBe(0);
    expect(listTasks(db).map((row) => row.identifier)).toEqual(before);
  });

  it("continues the sequence for tasks filed after it, rather than colliding", () => {
    seedLegacyBoard();
    backfillIdentifiers(db);
    const project = board(db).projects[0];

    const next = addTask(db, project.id, "filed later");
    expect(taskIdentifier(project, next)).toBe("EP-3");
  });

  it("stamps the tree so the work is not repeated, and skips an empty board", () => {
    backfillIdentifiersIfNeeded(root);
    expect(readFileSync(join(root, ".identifiers"), "utf8")).toContain("v1");

    // A board created after the stamp still gets a key at creation time.
    expect(createProject(openStore(root), { name: "Later Project" }).key).toBe("LP");
  });

  it("leaves an already-identified board's files untouched", () => {
    createProject(db, { name: "Alpha" });
    const dir = join(root, "projects", "alpha", "tasks");
    addTask(db, board(db).projects[0].id, "already named");
    const before = readdirSync(dir).map((name) => statSync(join(dir, name)).mtimeMs);

    expect(backfillIdentifiers(db)).toBe(0);
    expect(readdirSync(dir).map((name) => statSync(join(dir, name)).mtimeMs)).toEqual(before);
  });

  it("breaks a lock a crashed writer left behind rather than wedging the board", () => {
    const fresh = mkdtempSync(join(tmpdir(), "workboard-backfill-"));
    // A lock old enough to have outlived the process that took it.
    writeFileSync(join(fresh, ".identifiers.lock"), "999999");
    utimesSync(join(fresh, ".identifiers.lock"), new Date(), new Date(Date.now() - 60_000));

    backfillIdentifiersIfNeeded(fresh);
    expect(readFileSync(join(fresh, ".identifiers"), "utf8")).toContain("v1");
  });
});
