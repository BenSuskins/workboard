import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { addComment, addPost, addTask, addTaskComment, createProject, listComments, listTaskComments } from "../services.js";
import { board, openStore, type Store } from "./store.js";
import * as p from "./paths.js";

let db: Store;
beforeEach(() => {
  db = openStore(mkdtempSync(join(tmpdir(), "wb-store-")));
});

describe("task replies on disk", () => {
  it("writes a reply beside the tasks directory, keyed by task id", () => {
    const project = createProject(db, { name: "Alpha" });
    const task = addTask(db, project.id, "work");
    const comment = addTaskComment(db, task.id, "picked this up", "agent:claude");

    const dir = p.taskCommentsDir(db.root, project.slug, task.id);
    expect(dir).toContain(join("alpha", "task-comments", "0001"));

    // The owning ids come back from the path, so they are not repeated in the file.
    const text = readFileSync(join(dir, `${String(comment.id).padStart(4, "0")}.md`), "utf8");
    expect(text).toContain("picked this up");
    expect(text).not.toContain("taskId");
    expect(text).not.toContain("projectId");
  });

  it("round-trips through a cold read of the tree", () => {
    const project = createProject(db, { name: "Alpha" });
    const task = addTask(db, project.id, "work");
    addTaskComment(db, task.id, "first", "agent:claude");
    addTaskComment(db, task.id, "second", "user");

    const reopened = board(openStore(db.root)).comments;
    expect(reopened.map((c) => [c.taskId, c.postId, c.author])).toEqual([
      [task.id, null, "agent:claude"],
      [task.id, null, "user"],
    ]);
    expect(reopened.every((c) => c.projectId === project.id)).toBe(true);
  });

  it("does not mistake a task-comment directory for a task", () => {
    const project = createProject(db, { name: "Alpha" });
    const task = addTask(db, project.id, "work");
    addTaskComment(db, task.id, "hello");
    expect(board(openStore(db.root)).tasks).toHaveLength(1);
  });

  it("keeps post replies and task replies apart in one project", () => {
    const project = createProject(db, { name: "Alpha" });
    const post = addPost(db, project.id, "a note");
    const task = addTask(db, project.id, "work");
    addComment(db, post.id, "on the post");
    addTaskComment(db, task.id, "on the task");

    expect(listComments(db, post.id).map((c) => c.body)).toEqual(["on the post"]);
    expect(listTaskComments(db, task.id).map((c) => c.body)).toEqual(["on the task"]);
  });

  it("loads a post reply written before task replies existed", () => {
    const project = createProject(db, { name: "Alpha" });
    const post = addPost(db, project.id, "a note");
    // A file from the old shape: no taskId in the frontmatter at all.
    const dir = p.commentsDir(db.root, project.slug, post.id);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "0009.md"), '---\nid: 9\nauthor: "user"\ncreatedAt: 1\n---\n\nolder reply\n');

    const [comment] = listComments(openStore(db.root), post.id);
    expect(comment.body).toBe("older reply");
    expect(comment.taskId).toBeNull();
    expect(comment.postId).toBe(post.id);
  });
});
