/**
 * Inline activity sparkline (updates/day). Thin line, no axes or grid — context
 * viz per the dataviz mark specs; identity comes from placement, not a legend.
 * `fill` adds a soft area under the line for the larger card and hero uses.
 */
export function Sparkline({
  counts,
  width = 96,
  height = 22,
  fill = false,
  hideWhenFlat = false,
  className = "",
}: {
  counts: number[];
  width?: number;
  height?: number;
  fill?: boolean;
  /** Draw nothing at all for a dormant project: a flat line reads as data when it is really absence. */
  hideWhenFlat?: boolean;
  className?: string;
}) {
  if (counts.length < 2) return null;
  const total = counts.reduce((a, b) => a + b, 0);
  if (hideWhenFlat && total === 0) return null;
  const max = Math.max(...counts, 1);
  const pad = 2;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const xy = counts.map((c, i) => {
    const x = pad + (i / (counts.length - 1)) * innerW;
    const y = pad + innerH - (c / max) * innerH;
    return [x, y] as const;
  });
  const points = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const stroke = total === 0 ? "var(--wb-grid)" : "var(--wb-accent)";
  const label = `${total} update${total === 1 ? "" : "s"} in the last ${counts.length} days`;
  const gradientId = `wb-spark-${width}-${height}-${counts.length}`;

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
      className={`shrink-0 ${className}`}
    >
      <title>{label}</title>
      {fill && total > 0 && (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={`${pad},${height - pad} ${points} ${width - pad},${height - pad}`} fill={`url(#${gradientId})`} />
        </>
      )}
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={fill ? 1.5 : 2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
