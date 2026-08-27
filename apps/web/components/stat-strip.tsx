import Link from "next/link";
import { boardHref, type Filters } from "@/lib/board-filters";

export interface StatCell {
  label: string;
  value: number | string;
  href?: string;
  tone?: string;
}

/**
 * A row of headline numbers in divided cells. The board and a project page both
 * open with one, so the two read as the same kind of surface.
 */
export function StatCells({ items }: { items: StatCell[] }) {
  return (
    <div
      className="grid grid-cols-2 divide-x divide-y divide-hairline overflow-hidden rounded-card border border-hairline bg-surface sm:grid-cols-3 lg:divide-y-0"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((item) => {
        const body = (
          <>
            <span className="text-meta text-muted">{item.label}</span>
            <span className={`text-heading font-semibold tabular-nums ${item.tone ?? "text-ink"}`}>{item.value}</span>
          </>
        );
        const cls = "flex flex-col items-center gap-1 px-4 py-3.5 text-center";
        return item.href ? (
          <Link key={item.label} href={item.href} className={`${cls} transition-colors hover:bg-surface-2`}>
            {body}
          </Link>
        ) : (
          <span key={item.label} className={cls}>
            {body}
          </span>
        );
      })}
    </div>
  );
}

export interface BoardStats {
  projects: number;
  moving: number;
  upForGrabs: number;
  questions: number;
  done: number;
}

/**
 * The board's headline numbers. Anything that means something is *wrong* lives
 * in AlertRow instead, so a problem stands out rather than hiding in a row of
 * counts.
 */
export function StatStrip({ filters, stats }: { filters: Filters; stats: BoardStats }) {
  return (
    <StatCells
      items={[
        { label: "Projects", value: stats.projects, href: boardHref({ ...filters, status: undefined }) },
        { label: "Moving", value: stats.moving, href: boardHref({ ...filters, status: "active" }) },
        { label: "Up for grabs", value: stats.upForGrabs },
        // A question blocks an agent until the user replies, so it reads as work, not noise.
        { label: "Open questions", value: stats.questions, tone: stats.questions > 0 ? "text-serious" : undefined },
        { label: "Done", value: stats.done },
      ]}
    />
  );
}
