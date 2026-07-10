import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { links, type Link } from "../db/schema.js";
import { recordSyncResult, saveSnapshot } from "../services.js";
import { fetchGdoc, googleConfigured } from "./gdrive.js";
import { fetchIssue, fetchPr, fetchScopedRepo, githubConfigured } from "./github.js";
import { fetchJiraIssue, fetchJiraProject, jiraConfigured } from "./jira.js";

export interface SyncResult {
  linkId: number;
  url: string;
  ok: boolean;
  skipped?: "not_configured" | "no_external_id" | "plain_url";
  error?: string;
}

export function integrationStatus() {
  return { github: githubConfigured(), jira: jiraConfigured(), google: googleConfigured() };
}

async function fetchForLink(link: Link): Promise<unknown | { skipped: SyncResult["skipped"] }> {
  if (link.provider === "url") return { skipped: "plain_url" };
  if (!link.externalId) return { skipped: "no_external_id" };
  switch (link.provider) {
    case "github": {
      if (!githubConfigured()) return { skipped: "not_configured" };
      if (link.kind === "pr") return fetchPr(link.externalId);
      if (link.kind === "issue") return fetchIssue(link.externalId);
      return fetchScopedRepo(link.externalId, link.scope ?? null);
    }
    case "jira": {
      if (!jiraConfigured()) return { skipped: "not_configured" };
      if (link.kind === "jira_issue") return fetchJiraIssue(link.externalId);
      return fetchJiraProject(link.externalId);
    }
    case "gdoc": {
      if (!googleConfigured()) return { skipped: "not_configured" };
      return fetchGdoc(link.externalId);
    }
  }
}

export async function syncLink(db: Db, link: Link): Promise<SyncResult> {
  try {
    const result = await fetchForLink(link);
    if (result && typeof result === "object" && "skipped" in result) {
      // nothing was attempted, so sync_state is left untouched
      return { linkId: link.id, url: link.url, ok: true, skipped: (result as { skipped: SyncResult["skipped"] }).skipped };
    }
    saveSnapshot(db, link.id, result);
    recordSyncResult(db, link.id, null);
    return { linkId: link.id, url: link.url, ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    recordSyncResult(db, link.id, message);
    return { linkId: link.id, url: link.url, ok: false, error: message };
  }
}

export async function syncProject(db: Db, projectId: number): Promise<SyncResult[]> {
  const projectLinks = db
    .select()
    .from(links)
    .where(and(eq(links.projectId, projectId), isNull(links.deletedAt)))
    .all();
  const results: SyncResult[] = [];
  for (const link of projectLinks) results.push(await syncLink(db, link));
  return results;
}

export async function syncAll(db: Db): Promise<SyncResult[]> {
  const allLinks = db.select().from(links).where(isNull(links.deletedAt)).all();
  const results: SyncResult[] = [];
  for (const link of allLinks) results.push(await syncLink(db, link));
  return results;
}

let timer: ReturnType<typeof setInterval> | undefined;

/** Background poll — call once from the web server. No-ops if already started. */
export function startBackgroundSync(db: Db, intervalMs = 10 * 60 * 1000): void {
  if (timer) return;
  timer = setInterval(() => {
    syncAll(db).catch((err) => console.error("[workboard] background sync failed:", err));
  }, intervalMs);
  timer.unref?.();
}
