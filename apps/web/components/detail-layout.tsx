/**
 * The shape every detail view takes: a 680px reading column beside a rail of
 * small key/value rows. Metadata lives in the rail, prose lives in the column.
 *
 * The split is a container query, not a viewport one, because the same view
 * renders full-page and inside the 672px slide-over panel. At panel width the
 * rail stacks under the column instead of squeezing it to nothing.
 */
export function DetailLayout({
  children,
  rail,
  wide = false,
}: {
  children: React.ReactNode;
  rail?: React.ReactNode;
  /** The overview rail carries more than a task's does: 288px rather than 268px. */
  wide?: boolean;
}) {
  if (!rail) return <div className="@container flex-1">{children}</div>;
  return (
    <div className="@container flex flex-1 flex-col items-stretch @[948px]:flex-row">
      <div className="min-w-0 flex-1">{children}</div>
      <aside
        className={`flex flex-none flex-col gap-[22px] border-t border-hairline bg-surface px-4 py-5 @[948px]:sticky @[948px]:top-12 @[948px]:h-[calc(100vh-3rem)] @[948px]:overflow-y-auto @[948px]:border-l @[948px]:border-t-0 ${
          wide ? "@[948px]:w-72" : "@[948px]:w-[268px]"
        }`}
      >
        {rail}
      </aside>
    </div>
  );
}

/**
 * The reading measure. 680px is where a 14.5px line lands near 75 characters.
 * The padding is a prop rather than a class to override, because two padding
 * utilities on one element resolve by stylesheet order, not by which was
 * written last — the panel supplies its own and would otherwise lose the race.
 */
export function ReadingColumn({ children, padding = "px-10 py-7" }: { children: React.ReactNode; padding?: string }) {
  return <div className={`mx-auto flex w-full max-w-[680px] flex-col ${padding}`}>{children}</div>;
}

/**
 * Section headings are uppercase micro-labels rather than 15px bold headings —
 * the content is the heading, and the label only has to say which content.
 */
export function MicroLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`text-micro font-semibold uppercase tracking-[0.04em] text-muted ${className}`}>{children}</span>
  );
}

/** A micro-label with a hairline rule filling the rest of the row. */
export function RuledLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 px-2 pb-2">
      <MicroLabel>{children}</MicroLabel>
      <span className="h-px flex-1 bg-hairline" aria-hidden />
    </div>
  );
}
