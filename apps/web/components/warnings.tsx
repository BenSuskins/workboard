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

/** Compact strip for dashboard cards: severity icon + label + message, worst first. */
export function WarningStrip({ warnings }: { warnings: Warning[] }) {
  if (warnings.length === 0) return null;
  const top = warnings[0];
  const s = SEVERITY[top.severity];
  return (
    <div className={`flex items-start gap-1.5 rounded-lg border px-2 py-1.5 text-[12px] leading-snug ${s.cls}`}>
      <span aria-hidden>{s.icon}</span>
      <span className="min-w-0">
        <span className="font-semibold">{s.label}: </span>
        <span className="text-ink-2">{top.message}</span>
        {warnings.length > 1 && <span className="text-muted"> · +{warnings.length - 1} more</span>}
      </span>
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
          <div key={w.id} className={`rounded-[10px] border p-3.5 ${s.cls}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="font-semibold uppercase tracking-wide">
                    {s.icon} {s.label}
                  </span>
                  <span className="text-muted">
                    {authorLabel(w.raisedBy)} · {<TimeAgo at={w.createdAt} />}
                  </span>
                </div>
                <Markdown>{w.message}</Markdown>
                {w.suggestedAction && (
                  <p className="mt-1.5 text-[12px] text-ink-2">
                    <span className="font-semibold text-ink">Suggested action:</span> {w.suggestedAction}
                  </p>
                )}
              </div>
              <form action={resolveWarningAction} className="shrink-0">
                <input type="hidden" name="warningId" value={w.id} />
                <input type="hidden" name="slug" value={slug} />
                <button
                  type="submit"
                  className="rounded-lg border border-hairline px-2.5 py-1 text-xs text-ink-2 transition-colors hover:border-muted hover:text-ink"
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
