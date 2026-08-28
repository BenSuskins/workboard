import { TimeAgo } from "./time-ago";
import type { Warning, WarningSeverity } from "@workboard/core";
import { resolveWarningAction } from "@/lib/actions";
import { authorLabel } from "@/lib/format";

/**
 * Severity is a colour and a word. The emoji that used to lead each row read as
 * decoration at a glance and as "grimacing face" to a screen reader, and it
 * said nothing the word beside it did not.
 */
export const SEVERITY: Record<WarningSeverity, { label: string; dot: string; text: string; box: string }> = {
  critical: {
    label: "Critical",
    dot: "bg-critical",
    text: "text-critical",
    box: "border-critical/35 bg-critical/[0.08]",
  },
  warning: {
    label: "Warning",
    dot: "bg-warning",
    text: "text-warning",
    box: "border-warning/35 bg-warning/[0.08]",
  },
  info: { label: "Info", dot: "bg-accent", text: "text-accent", box: "border-accent/35 bg-accent/[0.08]" },
};

/**
 * One warning on a board card, as a callout at card scale: the same 8% tint and
 * 35% border every semantic callout in the app wears, holding a dot, the
 * severity word, and the message. The card is the only place a workspace
 * warning surfaces now — the board's red strip above the grid made every warned
 * project shout at the whole page rather than at its own card.
 */
export function WarningNote({ warnings }: { warnings: Warning[] }) {
  if (warnings.length === 0) return null;
  const top = warnings[0];
  const tone = SEVERITY[top.severity];
  return (
    <div className={`flex min-w-0 items-center gap-2 rounded-control border px-2.5 py-1.5 ${tone.box}`} title={top.message}>
      <span className={`size-1.5 flex-none rounded-pill ${tone.dot}`} aria-hidden />
      <span className={`flex-none text-micro font-semibold ${tone.text}`}>{tone.label}</span>
      <span className="min-w-0 truncate text-caption text-ink-2">{top.message}</span>
      {warnings.length > 1 && <span className="flex-none text-caption text-muted">+{warnings.length - 1}</span>}
    </div>
  );
}

/**
 * A warning on the project page is one row, not a boxed panel: a dot, the
 * severity, the message, and the way to clear it. The message is truncated
 * because a warning is a pointer to work, and the work is not on this page.
 */
export function WarningsPanel({ warnings, slug }: { warnings: Warning[]; slug: string }) {
  if (warnings.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      {warnings.map((warning) => {
        const tone = SEVERITY[warning.severity];
        return (
          <div key={warning.id} className={`flex items-center gap-2.5 rounded-card border px-3 py-2.5 ${tone.box}`}>
            <span className={`size-1.5 flex-none rounded-pill ${tone.dot}`} aria-hidden />
            <span className={`flex-none text-meta font-semibold ${tone.text}`}>{tone.label}</span>
            <span
              className="min-w-0 truncate text-label text-ink-2"
              title={warning.suggestedAction ? `${warning.message}\n\nSuggested action: ${warning.suggestedAction}` : warning.message}
            >
              {warning.message}
            </span>
            <span className="flex-none text-meta text-muted">
              {authorLabel(warning.raisedBy)} · <TimeAgo at={warning.createdAt} />
            </span>
            <form action={resolveWarningAction} className="ml-auto flex-none">
              <input type="hidden" name="warningId" value={warning.id} />
              <input type="hidden" name="slug" value={slug} />
              <button
                type="submit"
                className="rounded-chip border border-hairline bg-surface px-2.5 py-0.5 text-meta text-ink-2 transition-colors hover:border-grid hover:text-ink"
              >
                Resolve
              </button>
            </form>
          </div>
        );
      })}
    </section>
  );
}
