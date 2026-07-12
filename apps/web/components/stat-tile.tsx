export function StatTile({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number | string;
  tone?: "default" | "good" | "warning" | "critical";
}) {
  const toneCls =
    tone === "good" ? "text-good" : tone === "warning" ? "text-warning" : tone === "critical" ? "text-critical" : "text-ink";
  return (
    <div className="rounded-[9px] border border-hairline bg-surface px-3.5 py-[11px]">
      <div className={`text-xl font-semibold ${toneCls}`}>{value}</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted">{label}</div>
    </div>
  );
}
