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
    <div className="rounded-xl border border-hairline bg-surface px-4 py-3">
      <div className={`text-2xl font-semibold ${toneCls}`}>{value}</div>
      <div className="mt-0.5 text-[11px] uppercase tracking-wide text-muted">{label}</div>
    </div>
  );
}
