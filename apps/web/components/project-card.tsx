import Link from "next/link";
import type { ProjectDetail } from "@workboard/core";
import { setProjectPinnedAction } from "@/lib/actions";
import { hasPipeline, prPipeline } from "@/lib/pipeline";
import { toPlainText } from "@/lib/format";
import { AvatarStack } from "./avatar";
import { DocChips, JiraChips, PipelineChip } from "./chips";
import { ACCENT_BG, ACCENT_TEXT, STATUS_LABEL, STATUS_TONE, tileAccent, tileGlyph } from "./labels";
import { Sparkline } from "./sparkline";
import { WarningStrip } from "./warnings";

/** Everyone who has touched the project lately, most recent first, no repeats. */
function recentAuthors(detail: ProjectDetail): string[] {
  const seen: string[] = [];
  for (const post of detail.posts) {
    if (!seen.includes(post.author)) seen.push(post.author);
  }
  return seen;
}

// The whole card is clickable via the title link's stretched ::after (fills the
// nearest positioned ancestor, i.e. this card). The pipeline chip's popover PR
// links sit later in the DOM at the same stacking level, so they paint above the
// stretched area and stay independently clickable — no nested <a> involved.
export function ProjectCard({
  detail,
  activityCounts,
}: {
  detail: ProjectDetail;
  activityCounts?: number[];
}) {
  const { project, latestSummary, links, tasks, openWarnings } = detail;
  const pipeline = prPipeline(links);
  const moving = tasks.filter((t) => t.status === "in_progress").length;
  const blocked = tasks.filter((t) => t.status === "blocked").length;
  const upForGrabs = tasks.filter((t) => t.agentReady && t.status === "todo" && !t.claimedAt).length;
  const done = tasks.filter((t) => t.status === "done").length;
  const accent = tileAccent(project);
  const tone = STATUS_TONE[project.status];

  // Plain text, not rendered markdown: prose-wb sets a reading size and line
  // height that dwarf everything else once clamped into a card.
  const blurb = latestSummary ? toPlainText(latestSummary.body) : project.description;

  return (
    <div
      className="relative flex flex-col gap-2.5 rounded-card border border-hairline bg-surface p-4 transition-colors hover:border-accent/40"
    >
      <div className="flex items-start gap-2.5">
        <span
          className={`grid size-8 shrink-0 place-items-center rounded-control text-body font-semibold ${ACCENT_BG[accent]} ${ACCENT_TEXT[accent]}`}
          aria-hidden
        >
          {tileGlyph(project)}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-title font-semibold leading-tight">
            <Link
              href={`/projects/${project.slug}`}
              className="text-ink after:absolute after:inset-0 after:content-[''] hover:text-accent"
            >
              {project.name}
            </Link>
          </h3>
          <p className="mt-0.5 flex items-center gap-1.5 text-meta">
            <span className={`font-medium ${tone.text}`}>{STATUS_LABEL[project.status]}</span>
            {moving > 0 && <span className="text-muted">· {moving} in progress</span>}
            {blocked > 0 && <span className="text-critical">· {blocked} blocked</span>}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <form action={setProjectPinnedAction}>
            <input type="hidden" name="projectId" value={project.id} />
            <input type="hidden" name="slug" value={project.slug} />
            <input type="hidden" name="pinned" value={project.pinned ? "0" : "1"} />
            <button
              type="submit"
              aria-label={project.pinned ? "Unpin project" : "Pin project"}
              title={project.pinned ? "Unpin" : "Pin to top of board"}
              className={`relative z-10 text-body leading-none transition-colors ${
                project.pinned ? "text-warning" : "text-muted/40 hover:text-muted"
              }`}
            >
              ★
            </button>
          </form>
        </div>
      </div>

      <WarningStrip warnings={openWarnings} />

      {blurb && <p className="line-clamp-2 text-meta leading-relaxed text-ink-2">{blurb}</p>}

      {(hasPipeline(pipeline) || links.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5">
          <PipelineChip pipeline={pipeline} />
          <JiraChips links={links} />
          <DocChips links={links} />
        </div>
      )}

      <div className="mt-auto flex items-center gap-3 border-t border-hairline pt-2.5 text-meta text-muted">
        <span className="shrink-0">
          <span className="font-semibold text-ink-2">{upForGrabs}</span> up for grabs
        </span>
        <span className="shrink-0">
          <span className="font-semibold text-ink-2">{done}</span> done
        </span>
        {activityCounts && (
          <span className="min-w-0 flex-1 opacity-60">
            <Sparkline counts={activityCounts} width={90} height={16} />
          </span>
        )}
        <AvatarStack authors={recentAuthors(detail)} />
      </div>
    </div>
  );
}
