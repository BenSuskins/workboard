import { NextResponse } from "next/server";
import { listProjects } from "@workboard/core";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Lightweight project index for the ⌘K palette. */
export function GET() {
  const projects = listProjects(db(), {}).map((p) => ({
    slug: p.slug,
    name: p.name,
    category: p.category,
    status: p.status,
    health: p.health,
  }));
  return NextResponse.json({ projects });
}
