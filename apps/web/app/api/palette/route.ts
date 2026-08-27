import { NextResponse } from "next/server";
import { listProjects, listTasks } from "@workboard/core";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** How many issues ⌘K holds in memory. Well past a board you can read, short of a payload. */
const ISSUE_LIMIT = 500;

/** Lightweight project and issue index for the ⌘K palette. */
export function GET() {
  const database = db();
  const projects = listProjects(database, {}).map((p) => ({
    slug: p.slug,
    name: p.name,
    category: p.category,
    status: p.status,
    health: p.health,
  }));
  // Ordered by the same work order the issues view uses, so a truncated index
  // keeps the issues actually in flight rather than an arbitrary slice.
  const issues = listTasks(database, { limit: ISSUE_LIMIT }).map((row) => ({
    id: row.task.id,
    identifier: row.identifier,
    title: row.task.title,
    slug: row.project.slug,
    project: row.project.name,
    lane: row.lane,
  }));
  return NextResponse.json({ projects, issues });
}
