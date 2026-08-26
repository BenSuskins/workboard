import Link from "next/link";
import { boardHref, type Filters } from "./filter-bar";

export interface BoardAlerts {
  blocked: number;
  warnings: number;
  stale: number;
  ciFailing: number;
}

/**
 * What is going wrong, and only that. The stat strip carries the headline
 * counts; these appear solely when non-zero, so an empty row means nothing
 * needs you — the signal is the row existing at all.
 */
export function AlertRow({ filters, alerts }: { filters: Filters; alerts: BoardAlerts }) {
  const items = [
    {
      label: alerts.blocked === 1 ? "project blocked" : "projects blocked",
      value: alerts.blocked,
      tone: "text-critical",
      dot: "bg-critical",
      href: boardHref({ ...filters, status: "blocked" }),
    },
    {
      label: alerts.ciFailing === 1 ? "CI failure" : "CI failures",
      value: alerts.ciFailing,
      tone: "text-critical",
      dot: "bg-critical",
    },
    {
      label: alerts.warnings === 1 ? "open warning" : "open warnings",
      value: alerts.warnings,
      tone: "text-warning",
      dot: "bg-warning",
    },
    {
      label: "stale 7d+",
      value: alerts.stale,
      tone: "text-warning",
      dot: "bg-warning",
      href: boardHref({ ...filters, sort: "stale" }),
    },
  ].filter((item) => item.value > 0);

  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-card border border-critical/25 bg-critical/[0.06] px-4 py-3 text-meta">
      {items.map((item) => {
        const body = (
          <span className="inline-flex items-center gap-2">
            <span className={`size-1.5 rounded-full ${item.dot}`} aria-hidden />
            <span className={`font-semibold tabular-nums ${item.tone}`}>{item.value}</span>
            <span className="text-ink-2">{item.label}</span>
          </span>
        );
        return item.href ? (
          <Link key={item.label} href={item.href} className="transition-opacity hover:opacity-70">
            {body}
          </Link>
        ) : (
          <span key={item.label}>{body}</span>
        );
      })}
    </div>
  );
}
