import { TimeAgo } from "./time-ago";
import type { Warning, WarningSeverity } from "@workboard/core";
import { resolveWarningAction } from "@/lib/actions";
import { authorLabel, relativeTime } from "@/lib/format";
import { Markdown } from "./markdown";

const SEVERITY: Record<WarningSeverity, { icon: string; label: string; cls: string }> = {
  critical: { icon: "⛔", label: "Critical", cls: "border-critical/50 bg-critical/10 text-critical" },
  warning: { icon: "⚠️", label: "Warning", cls: "border-warning/50 bg-warning/10 text-warning" },
  info: { icon: "ℹ️", label: "Info", cls: "border-accent/50 bg-accent/10 text-accent" },
};

const STRIP_TONE: Record<WarningSeverity, { dot: string; text: string }> = {
  critical: { dot: "bg-critical", text: "text-critical" },
  warning: { dot: "bg-warning", text: "text-warning" },
  info: { dot: "bg-accent", text: "text-accent" },
};

/**
 * One line for a board card: a coloured dot, the severity, and the message
 * truncated. A boxed panel here competed with the card's own border and made
 * every warned project shout; the dot carries the same signal in a third of
 * the height.
 */
export function WarningStrip({ warnings }: { warnings: Warning[] }) {
  if (warnings.length === 0) return null;
  const top = warnings[0];
  const tone = STRIP_TONE[top.severity];
  return (
    <div className="flex min-w-0 items-center gap-2 text-meta" title={top.message}>
      <span className={`size-1.5 shrink-0 rounded-full ${tone.dot}`} aria-hidden />
      <span className={`shrink-0 font-medium ${tone.text}`}>{SEVERITY[top.severity].label}</span>
      <span className="truncate text-ink-2">{top.message}</span>
      {warnings.length > 1 && <span className="shrink-0 text-muted">+{warnings.length - 1}</span>}
    </div>
  );
}

/** Full panel for the project page, with resolve actions. */
export function WarningsPanel({ warnings, slug }: { warnings: Warning[]; slug: string }) {
  if (warnings.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      {warnings.map((w) => {
        const s = SEVERITY[w.severity];
        return (
          <div key={w.id} className={`rounded-card border p-3.5 ${s.cls}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-2 text-meta">
                  <span className="font-semibold uppercase tracking-wide">
                    {s.icon} {s.label}
                  </span>
                  <span className="text-muted">
                    {authorLabel(w.raisedBy)} · {<TimeAgo at={w.createdAt} />}
                  </span>
                </div>
                <Markdown>{w.message}</Markdown>
                {w.suggestedAction && (
                  <p className="mt-1.5 text-meta text-ink-2">
                    <span className="font-semibold text-ink">Suggested action:</span> {w.suggestedAction}
                  </p>
                )}
              </div>
              <form action={resolveWarningAction} className="shrink-0">
                <input type="hidden" name="warningId" value={w.id} />
                <input type="hidden" name="slug" value={slug} />
                <button
                  type="submit"
                  className="rounded-control border border-hairline px-2.5 py-1 text-meta text-ink-2 transition-colors hover:border-muted hover:text-ink"
                >
                  Resolve
                </button>
              </form>
            </div>
          </div>
        );
      })}
    </section>
  );
}
