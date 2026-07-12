import Link from "next/link";
import { getSyncHealth, integrationStatus } from "@workboard/core";
import { TimeAgo } from "./time-ago";
import { db } from "@/lib/db";

const STALE_AFTER_MS = 30 * 60 * 1000; // 3× the background poll interval

/**
 * Shows when live data can't be trusted: any link's last sync failed, or
 * integrations are configured but nothing has synced recently. Silent otherwise.
 */
export function SyncBanner() {
  const health = getSyncHealth(db());
  const integrations = integrationStatus();
  const anyConfigured = integrations.github || integrations.jira || integrations.google;

  if (health.failing.length > 0) {
    const first = health.failing[0];
    return (
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-[10px] border border-critical/50 bg-critical/10 px-4 py-2.5 text-[13px]">
        <span className="font-semibold text-critical">
          ⚠ Live data sync failing for {health.failing.length} link{health.failing.length === 1 ? "" : "s"}
        </span>
        <span className="text-ink-2">
          <Link href={`/projects/${first.projectSlug}`} className="underline hover:text-ink">
            {first.projectName}
          </Link>
          : {first.error.length > 120 ? `${first.error.slice(0, 120)}…` : first.error}
        </span>
        <span className="text-muted">
          — PR/ticket/doc status may be stale
          {health.lastSuccessAt && (
            <>
              {" (last good sync "}
              <TimeAgo at={health.lastSuccessAt} />
              {")"}
            </>
          )}
        </span>
      </div>
    );
  }

  if (anyConfigured && health.lastSuccessAt && Date.now() - health.lastSuccessAt > STALE_AFTER_MS) {
    return (
      <div className="rounded-[10px] border border-warning/50 bg-warning/10 px-4 py-2.5 text-[13px]">
        <span className="font-semibold text-warning">⚠ Live data is stale</span>{" "}
        <span className="text-ink-2">
          — last successful sync {<TimeAgo at={health.lastSuccessAt} />}. Refresh a project or check the server logs.
        </span>
      </div>
    );
  }

  return null;
}
