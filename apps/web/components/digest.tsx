import { digestLead, digestState, type DigestCounts, type DigestState } from "@/lib/digest";

/** The state word takes the tone of what it describes; the rest of the line is neutral. */
const STATE_TONE: Record<DigestState, string> = {
  blocked: "text-critical",
  quiet: "text-muted",
  moving: "text-good",
  waiting: "text-warning",
};

/**
 * The board's opening block: a date, one sentence naming the state, and one
 * paragraph of what that means. No card, no border, no chart — the workspace
 * chart moved onto the cards, where a line belongs to the project that owns it.
 */
export function Digest({ counts, week }: { counts: DigestCounts; week: number }) {
  const state = digestState({ blocked: counts.blocked, movingProjects: counts.movingProjects, week });
  const date = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="flex flex-col gap-[7px]">
      <span className="text-micro font-semibold uppercase tracking-[0.04em] text-muted">{date}</span>
      <h1 className="text-page-title font-semibold leading-[1.3] tracking-[-0.018em] text-ink">
        The workspace is <span className={STATE_TONE[state]}>{state}</span>
      </h1>
      <p className="max-w-[640px] text-prose leading-[1.7] text-pretty text-ink-2">{digestLead(counts)}</p>
    </div>
  );
}
