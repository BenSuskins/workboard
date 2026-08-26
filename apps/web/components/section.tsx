/**
 * A section heading with an optional count on the right — the same shape as the
 * board's "Projects 4" line, so every list on every page opens the same way.
 */
export function SectionHeading({
  title,
  count,
  action,
}: {
  title: string;
  count?: number;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="text-title font-semibold text-ink">{title}</h2>
      <div className="flex items-center gap-3">
        {action}
        {count !== undefined && <span className="text-meta tabular-nums text-muted">{count}</span>}
      </div>
    </div>
  );
}
