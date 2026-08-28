import Link from "next/link";
import type { ProjectDetail } from "@workboard/core";
import { setProjectPinnedAction } from "@/lib/actions";
import { staleLabel, toPlainText } from "@/lib/format";
import { AvatarStack } from "./avatar";
import { ACCENT_BG, ACCENT_TEXT, STATUS_LABEL, tileAccent, tileGlyph } from "./labels";
import { Sparkline } from "./sparkline";
import { ProjectStatusRing } from "./state-glyphs";
import { WarningNote } from "./warnings";

/** Everyone who has touched the project lately, most recent first, no repeats. */
function recentAuthors(detail: ProjectDetail): string[] {
  const seen: string[] = [];
  for (const post of detail.posts) {
    if (!seen.includes(post.author)) seen.push(post.author);
  }
  return seen;
}

// The whole card is clickable via the title link's stretched ::after (fills the
// nearest positioned ancestor, i.e. this card). The card is deliberately not an
// <a> itself: the pin control is a form button and cannot nest inside one, so it
// sits later in the DOM at z-10 and stays independently clickable.
export function ProjectCard({
  detail,
  activityCounts,
}: {
  detail: ProjectDetail;
  activityCounts?: number[];
}) {
  const { project, latestSummary, tasks, openWarnings } = detail;
  const upForGrabs = tasks.filter((t) => t.agentReady && t.status === "todo" && !t.claimedAt).length;
  const done = tasks.filter((t) => t.status === "done").length;
  const accent = tileAccent(project);
  const stale = staleLabel(project.lastActivityAt, project.status);

  // Plain text, not rendered markdown: prose-wb sets a reading size and line
  // height that dwarf everything else once clamped into a card.
  const blurb = latestSummary ? toPlainText(latestSummary.body) : project.description;

  return (
    <div className="relative flex flex-col gap-[11px] rounded-card border border-hairline bg-surface px-[17px] pb-3.5 pt-4 transition-colors duration-[130ms] hover:border-grid hover:bg-surface-2">
      <div className="flex items-start gap-2.5">
        <span
          className={`mt-px grid size-[22px] flex-none place-items-center rounded-chip text-micro font-semibold ${ACCENT_BG[accent]} ${ACCENT_TEXT[accent]}`}
          aria-hidden
        >
          {tileGlyph(project)}
        </span>
        <div className="flex min-w-0 flex-col gap-[3px]">
          {/* The name wraps rather than truncates — a project is known by its
              whole name, and two lines cost less than a clipped one. */}
          <h3 className="text-title font-medium leading-[1.35] tracking-[-0.005em] text-pretty">
            <Link href={`/projects/${project.slug}`} className="text-ink after:absolute after:inset-0 after:content-['']">
              {project.name}
            </Link>
          </h3>
          <span className="inline-flex items-center gap-[7px]">
            <ProjectStatusRing status={project.status} />
            <span className="text-caption text-muted">{STATUS_LABEL[project.status]}</span>
          </span>
        </div>
        <form action={setProjectPinnedAction} className="ml-auto mt-px flex-none">
          <input type="hidden" name="projectId" value={project.id} />
          <input type="hidden" name="slug" value={project.slug} />
          <input type="hidden" name="pinned" value={project.pinned ? "0" : "1"} />
          <button
            type="submit"
            aria-label={project.pinned ? "Unpin project" : "Pin project"}
            title={project.pinned ? "Unpin" : "Pin to top of board"}
            className={`relative z-10 flex leading-none transition-colors ${
              project.pinned ? "text-warning" : "text-grid hover:text-muted"
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden>
              <path d="M8 2.25l1.75 3.6 3.95.55-2.85 2.8.68 3.95L8 11.3l-3.53 1.85.68-3.95-2.85-2.8 3.95-.55z" />
            </svg>
          </button>
        </form>
      </div>

      {blurb && <p className="line-clamp-2 text-detail leading-[1.55] text-pretty text-muted">{blurb}</p>}

      <WarningNote warnings={openWarnings} />

      <div className="mt-auto flex items-center gap-2.5 border-t border-hairline pt-[11px]">
        <span className="flex-none text-caption tabular-nums text-muted">
          {done} done · {upForGrabs} up for grabs
        </span>
        {stale && <span className="flex-none text-caption text-serious">{stale}</span>}
        {activityCounts && (
          <span className="w-[72px] flex-none">
            <Sparkline counts={activityCounts} width={72} height={16} hideWhenFlat />
          </span>
        )}
        <span className="ml-auto flex-none">
          <AvatarStack authors={recentAuthors(detail)} size="xs" />
        </span>
      </div>
    </div>
  );
}
