import Link from "next/link";
import { boardHref, type Filters } from "@/lib/board-filters";

interface StatCell {
  label: string;
  value: number;
  /** The lane hue this count belongs to. Projects has none — it counts everything. */
  dot?: string;
  href?: string;
}

export interface BoardStats {
  projects: number;
  moving: number;
  upForGrabs: number;
  blocked: number;
  questions: number;
  done: number;
}

/**
 * The board's headline numbers, bounded by two hairlines rather than boxed into
 * a bordered grid. Every count but the first counts *tasks*: one unit across the
 * strip, and the digest sentence above names it, so no cell can be misread.
 *
 * A zero is drawn in `muted` so an empty count recedes instead of competing with
 * the numbers that mean something.
 */
export function StatStrip({ filters, stats }: { filters: Filters; stats: BoardStats }) {
  const cells: StatCell[] = [
    { label: "Projects", value: stats.projects, href: boardHref({ ...filters, status: undefined }) },
    { label: "Moving", value: stats.moving, dot: "bg-good", href: boardHref({ ...filters, status: "active" }) },
    { label: "Up for grabs", value: stats.upForGrabs, dot: "bg-accent" },
    { label: "Blocked", value: stats.blocked, dot: "bg-critical", href: boardHref({ ...filters, status: "blocked" }) },
    // A question blocks an agent until you reply, so it reads as work, not noise.
    { label: "Open questions", value: stats.questions, dot: "bg-serious" },
    { label: "Done", value: stats.done, dot: "bg-ink-2" },
  ];

  return (
    <div className="flex items-stretch border-y border-hairline py-3.5">
      {cells.map((cell, index) => {
        const body = (
          <>
            {/* The label wraps rather than truncates, and reserves two lines, so
                every value in the row sits on one baseline. */}
            <span className="flex min-h-[30px] items-start gap-1.5">
              {cell.dot && <span className={`mt-1 size-1.5 flex-none rounded-pill ${cell.dot}`} aria-hidden />}
              <span className="text-micro font-semibold uppercase tracking-[0.04em] text-pretty text-muted">
                {cell.label}
              </span>
            </span>
            <span
              className={`text-stat font-semibold tracking-[-0.02em] tabular-nums ${
                cell.value === 0 ? "text-muted" : "text-ink"
              }`}
            >
              {cell.value}
            </span>
          </>
        );
        // The outer edge of the first and last cell is flush, so the strip lines
        // up with the headline above it rather than sitting inset from it.
        const cls = `flex min-w-0 flex-1 flex-col gap-[5px] ${
          index === 0 ? "pr-[18px]" : index === cells.length - 1 ? "pl-[18px]" : "px-[18px]"
        } ${index === 0 ? "" : "shadow-[inset_1px_0_0_var(--wb-hairline)]"}`;
        return cell.href ? (
          <Link key={cell.label} href={cell.href} className={cls}>
            {body}
          </Link>
        ) : (
          <span key={cell.label} className={cls}>
            {body}
          </span>
        );
      })}
    </div>
  );
}
