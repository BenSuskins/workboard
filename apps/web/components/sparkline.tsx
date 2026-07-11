/**
 * Tiny inline activity sparkline (updates/day). Thin 2px line, no axes or grid —
 * context viz per the dataviz mark specs; identity comes from placement, not a legend.
 */
export function Sparkline({ counts, width = 96, height = 22 }: { counts: number[]; width?: number; height?: number }) {
  if (counts.length < 2) return null;
  const total = counts.reduce((a, b) => a + b, 0);
  const max = Math.max(...counts, 1);
  const pad = 2;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const points = counts
    .map((c, i) => {
      const x = pad + (i / (counts.length - 1)) * innerW;
      const y = pad + innerH - (c / max) * innerH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const label = `${total} update${total === 1 ? "" : "s"} in the last ${counts.length} days`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className="shrink-0">
      <title>{label}</title>
      <polyline
        points={points}
        fill="none"
        stroke={total === 0 ? "var(--wb-grid)" : "var(--wb-accent)"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
