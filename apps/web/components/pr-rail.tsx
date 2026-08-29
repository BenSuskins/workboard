import Link from "next/link";
import { MicroLabel } from "./detail-layout";
import { PR_BUCKET_ORDER, PR_BUCKET_SHORT, PR_BUCKET_TONE } from "./labels";
import type { PrBucket } from "../lib/pipeline";
import { prsHref } from "../lib/pr-filters";

/**
 * Bucket counts that double as filters — the summary strip the page used to
 * carry above the list, moved to where selecting one narrows the queue. The
 * counts stay unfiltered, so a narrowed queue still says how much sits outside
 * it. Every row is a link, so the filter is a URL and works without JS.
 */
export function QueueRail({
  counts,
  selected,
  total,
}: {
  counts: Record<PrBucket, number>;
  selected?: PrBucket;
  total: number;
}) {
  return (
    <aside className="w-[284px] flex-none overflow-y-auto bg-surface px-[18px] pt-[22px] pb-7 shadow-[inset_1px_0_0_var(--wb-hairline)]">
      <div className="sticky top-0 flex flex-col gap-1.5">
        <MicroLabel className="px-2">Queue</MicroLabel>
        <div className="flex flex-col gap-px">
          <FilterRow href={prsHref(null)} active={!selected} dot="bg-grid" label="All open" count={total} />
          {PR_BUCKET_ORDER.map((key) => (
            <FilterRow
              key={key}
              href={prsHref(key)}
              active={selected === key}
              dot={PR_BUCKET_TONE[key].dot}
              label={PR_BUCKET_SHORT[key]}
              count={counts[key]}
            />
          ))}
        </div>
      </div>
    </aside>
  );
}

function FilterRow({
  href,
  active,
  dot,
  label,
  count,
}: {
  href: string;
  active: boolean;
  dot: string;
  label: string;
  count: number;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`flex items-center gap-2.5 rounded-control px-2 py-1.5 transition-colors duration-[130ms] hover:bg-surface-2 ${active ? "bg-surface-2" : ""}`}
    >
      <span className={`size-1.5 flex-none rounded-pill ${dot}`} aria-hidden />
      <span className={`min-w-0 flex-1 truncate text-label ${active ? "text-ink" : "text-ink-2"}`}>{label}</span>
      <span className="flex-none text-meta tabular-nums text-muted">{count}</span>
    </Link>
  );
}
