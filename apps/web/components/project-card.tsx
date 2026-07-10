import Link from "next/link";
import type { ProjectDetail } from "@workboard/core";
import { relativeTime } from "@/lib/format";
import { prPipeline } from "@/lib/pipeline";
import { CategoryBadge, HealthBadge, PriorityBadge, StatusBadge } from "./badges";
import { DocChips, JiraChips, PipelineChip } from "./chips";
import { Markdown } from "./markdown";
import { WarningStrip } from "./warnings";

export function ProjectCard({ detail }: { detail: ProjectDetail }) {
  const { project, latestSummary, links, tasks, openWarnings } = detail;
  const pipeline = prPipeline(links);
  const openTasks = tasks.filter((t) => t.status !== "done").length;
  return (
    <Link
      href={`/projects/${project.slug}`}
      className="group flex flex-col gap-3 rounded-xl border border-hairline bg-surface p-4 transition-colors hover:border-accent/50 hover:bg-surface-2"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[15px] font-semibold leading-snug text-ink group-hover:text-accent">{project.name}</h3>
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
      <div className="flex items-center justify-between text-[11px] text-muted">
        <span>{openTasks > 0 ? `${openTasks} open task${openTasks === 1 ? "" : "s"}` : "no open tasks"}</span>
        <span>active {relativeTime(project.lastActivityAt)}</span>
      </div>
    </Link>
  );
}
