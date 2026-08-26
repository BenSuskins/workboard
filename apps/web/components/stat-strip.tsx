import Link from "next/link";
import { boardHref, type Filters } from "./filter-bar";

interface BoardStats {
  active: number;
  blocked: number;
  questions: number;
  warnings: number;
  stale: number;
  openPrs: number;
  ciFailing: number;
}

const TONE_CLS = {
  critical: "text-critical",
  serious: "text-serious",
  warning: "text-warning",
} as const;

type Tone = keyof typeof TONE_CLS;

interface Item {
  label: string;
  value: number;
  tone?: Tone;
  href?: string;
}

/** One-line metric strip replacing the stat tile grid; linked entries jump to their filter. */
export function StatStrip({ filters, stats }: { filters: Filters; stats: BoardStats }) {
  const items: Item[] = [
    { label: "active", value: stats.active },
    {
      label: "blocked",
      value: stats.blocked,
      tone: stats.blocked > 0 ? "critical" : undefined,
      href: boardHref({ ...filters, status: "blocked" }),
    },
    {
      label: stats.questions === 1 ? "open question" : "open questions",
      value: stats.questions,
      // A question blocks an agent until the user replies, so it reads as work, not noise.
      tone: stats.questions > 0 ? "serious" : undefined,
    },
    { label: "warnings", value: stats.warnings, tone: stats.warnings > 0 ? "warning" : undefined },
    {
      label: "stale 7d+",
      value: stats.stale,
      tone: stats.stale > 0 ? "warning" : undefined,
      href: boardHref({ ...filters, sort: "stale" }),
    },
    { label: "open PRs", value: stats.openPrs },
    { label: "CI failing", value: stats.ciFailing, tone: stats.ciFailing > 0 ? "critical" : undefined },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
      {items.map((item) => {
        const toneCls = item.tone ? TONE_CLS[item.tone] : "";
        const content = (
          <>
            <span className={`font-semibold tabular-nums ${toneCls || "text-ink"}`}>{item.value}</span>{" "}
            <span className={toneCls || "text-muted"}>{item.label}</span>
          </>
        );
        return item.href ? (
          <Link key={item.label} href={item.href} className="transition-opacity hover:opacity-70">
            {content}
          </Link>
        ) : (
          <span key={item.label}>{content}</span>
        );
      })}
    </div>
  );
}
