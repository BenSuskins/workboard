import Link from "next/link";
import type { ProjectDetail } from "@workboard/core";
import { setProjectPinnedAction } from "@/lib/actions";
import { hasPipeline, prPipeline } from "@/lib/pipeline";
import { ProjectMeta, StatusBadge } from "./badges";
import { DocChips, JiraChips, PipelineChip } from "./chips";
import { Markdown } from "./markdown";
import { Sparkline } from "./sparkline";
import { TimeAgo } from "./time-ago";
import { WarningStrip } from "./warnings";

// The whole card is clickable via the title link's stretched ::after (fills the
// nearest positioned ancestor, i.e. this card). The pipeline chip's popover PR
// links sit later in the DOM at the same stacking level, so they paint above the
// stretched area and stay independently clickable — no nested <a> involved.
export function ProjectCard({ detail, activityCounts }: { detail: ProjectDetail; activityCounts?: number[] }) {
  const { project, latestSummary, links, tasks, openWarnings } = detail;
  const pipeline = prPipeline(links);
  const openTasks = tasks.filter((t) => t.status !== "done").length;
  const queuedTasks = tasks.filter((t) => t.agentReady && t.status === "todo" && !t.claimedAt).length;
  const donePct =
    tasks.length > 0 ? Math.round((tasks.filter((t) => t.status === "done").length / tasks.length) * 100) : null;
  return (
    <div className="relative flex flex-col gap-2 rounded-[10px] border border-hairline bg-surface p-3.5 transition-colors hover:border-accent/50">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[14.5px] font-semibold leading-snug">
          <Link href={`/projects/${project.slug}`} className="text-ink after:absolute after:inset-0 after:content-[''] hover:text-accent">
            {project.name}
          </Link>
        </h3>
        <div className="flex items-center gap-1.5">
          <form action={setProjectPinnedAction}>
            <input type="hidden" name="projectId" value={project.id} />
            <input type="hidden" name="slug" value={project.slug} />
            <input type="hidden" name="pinned" value={project.pinned ? "0" : "1"} />
            <button
              type="submit"
              aria-label={project.pinned ? "Unpin project" : "Pin project"}
              title={project.pinned ? "Unpin" : "Pin to top of board"}
              className={`relative z-10 text-sm leading-none transition-colors ${
                project.pinned ? "text-warning" : "text-muted/40 hover:text-muted"
              }`}
            >
              ★
            </button>
          </form>
          <StatusBadge status={project.status} />
        </div>
      </div>
      <ProjectMeta category={project.category} health={project.health} priority={project.priority} />
      <WarningStrip warnings={openWarnings} />
      {latestSummary ? (
        <div className="line-clamp-3">
          <Markdown>{latestSummary.body}</Markdown>
        </div>
      ) : (
        <p className="text-[12.5px] leading-[1.45] text-ink-2">
          {project.description || "No summary yet — an agent will write one."}
        </p>
      )}
      {(hasPipeline(pipeline) || links.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5">
          <PipelineChip pipeline={pipeline} />
          <JiraChips links={links} />
          <DocChips links={links} />
        </div>
      )}
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-hairline pt-2 text-[11px] text-muted">
        <span>
          {openTasks > 0 ? `${openTasks} open task${openTasks === 1 ? "" : "s"}` : "no open tasks"}
          {queuedTasks > 0 && <span className="ml-1.5 text-accent">· {queuedTasks} queued for agents</span>}
          {donePct !== null && <span>· {donePct}% done</span>}
        </span>
        {activityCounts && <Sparkline counts={activityCounts} />}
        <span>
          active <TimeAgo at={project.lastActivityAt} />
        </span>
      </div>
    </div>
  );
}
