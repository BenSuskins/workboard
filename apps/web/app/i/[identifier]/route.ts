import { notFound, redirect } from "next/navigation";
import { findTaskByIdentifier } from "@workboard/core";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * `/i/ENG-12` → that issue. An identifier is only worth having if it is
 * something you can paste into a chat, a commit message, or a browser bar and
 * land on the work itself.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ identifier: string }> }) {
  const { identifier } = await params;
  const row = findTaskByIdentifier(db(), decodeURIComponent(identifier));
  if (!row) notFound();
  redirect(`/projects/${row.project.slug}/tasks/${row.task.id}`);
}
