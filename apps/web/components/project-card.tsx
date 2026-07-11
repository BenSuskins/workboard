import Link from "next/link";
import type { ProjectDetail } from "@workboard/core";
import { prPipeline } from "@/lib/pipeline";
import { CategoryBadge, HealthBadge, PriorityBadge, StatusBadge } from "./badges";
import { DocChips, JiraChips, PipelineChip } from "./chips";
import { Markdown } from "./markdown";
import { Sparkline } from "./sparkline";
import { TimeAgo } from "./time-ago";
import { WarningStrip } from "./warnings";

// A <div>, not a <Link>: the pipeline chip's popover contains real PR links,
// which can't be nested inside an anchor. The title carries the navigation.
export function ProjectCard({ detail, activityCounts }: { detail: ProjectDetail; activityCounts?: number[] }) {
  const { project, latestSummary, links, tasks, openWarnings } = detail;
  const pipeline = prPipeline(links);
  const openTasks = tasks.filter((t) => t.status !== "done").length;
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface p-4 transition-colors hover:border-accent/50">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[15px] font-semibold leading-snug">
          <Link href={`/projects/${project.slug}`} className="text-ink hover:text-accent">
            {project.name}
          </Link>
        </h3>
        <StatusBadge status={project.status} />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <CategoryBadge category={project.category} />
        <PriorityBadge priority={project.priority} />
        <HealthBadge health={project.health} />
      </div>
      <WarningStrip warnings={openWarnings} />
      {latestSummary ? (
        <div className="line-clamp-3">
          <Markdown>{latestSummary.body}</Markdown>
        </div>
      ) : (
        <p className="text-sm text-muted">{project.description || "No summary yet — an agent will write one."}</p>
      )}
      <div className="mt-auto flex flex-wrap items-center gap-1.5">
        <PipelineChip pipeline={pipeline} />
        <JiraChips links={links} />
        <DocChips links={links} />
      </div>
      <div className="flex items-center justify-between gap-2 text-[11px] text-muted">
        <span>{openTasks > 0 ? `${openTasks} open task${openTasks === 1 ? "" : "s"}` : "no open tasks"}</span>
        {activityCounts && <Sparkline counts={activityCounts} />}
        <span>
          active <TimeAgo at={project.lastActivityAt} />
        </span>
      </div>
    </div>
  );
}
