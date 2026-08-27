import Link from "next/link";
import type { ProjectDetail } from "@workboard/core";
import { toPlainText } from "@/lib/format";
import { prPipeline } from "@/lib/pipeline";
import { StatusDot } from "./badges";
import { TimeAgo } from "./time-ago";

/** Dense one-line row for the board's list view. Clickable via the same stretched-link pattern as ProjectCard. */
export function ProjectRow({ detail }: { detail: ProjectDetail }) {
  const { project, latestSummary, links, tasks, openWarnings } = detail;
  const pipeline = prPipeline(links);
  const prCount = pipeline.draft + pipeline.inReview + pipeline.approved;
  const openTasks = tasks.filter((t) => t.status !== "done").length;
  const queuedTasks = tasks.filter((t) => t.agentReady && t.status === "todo" && !t.claimedAt).length;
  const blockedTasks = tasks.filter((t) => t.status === "blocked").length;
  const context = toPlainText(latestSummary?.body ?? project.description);
  return (
    <div data-row className="relative flex items-center gap-3 px-3 py-[7px] text-body transition-colors">
      <StatusDot status={project.status} />
      <h3 className="max-w-56 shrink-0 truncate font-medium text-ink">
        <Link
          href={`/projects/${project.slug}`}
          className="after:absolute after:inset-0 after:content-[''] hover:text-accent"
        >
          {project.name}
        </Link>
      </h3>
      <p className="hidden min-w-0 flex-1 truncate text-body text-muted sm:block">
        {context || "No summary yet"}
      </p>
      <div className="flex shrink-0 items-center gap-3 whitespace-nowrap text-meta tabular-nums text-muted">
        {openWarnings.length > 0 && (
          <span className="text-warning" title={openWarnings[0].message}>
            ⚠{openWarnings.length > 1 ? ` ${openWarnings.length}` : ""}
          </span>
        )}
        {prCount > 0 && (
          <span>
            {prCount} PR{prCount === 1 ? "" : "s"}
          </span>
        )}
        {blockedTasks > 0 && <span className="font-medium text-critical">{blockedTasks} blocked</span>}
        {queuedTasks > 0 && <span className="font-medium text-accent">{queuedTasks} queued</span>}
        {openTasks > 0 && (
          <span>
            {openTasks} task{openTasks === 1 ? "" : "s"}
          </span>
        )}
        <TimeAgo at={project.lastActivityAt} />
      </div>
    </div>
  );
}
