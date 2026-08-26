/**
 * Shared form controls. Inputs sit one step *above* the surface they live on
 * (surface-2 on surface), never below — bg-page inside a card reads as a hole
 * punched in it, which is what the old inputs did in the AMOLED theme.
 */

export const fieldCls =
  "w-full rounded-control border border-hairline bg-surface-2 px-3 py-2 text-body text-ink outline-none transition-colors placeholder:text-muted hover:border-grid focus:border-accent/60";

/** Native selects need the arrow re-drawn once appearance is stripped. */
export const selectCls = `${fieldCls} cursor-pointer appearance-none bg-[length:14px] bg-[right_0.6rem_center] bg-no-repeat pr-8 [background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20viewBox%3D%270%200%2016%2016%27%20fill%3D%27none%27%20stroke%3D%27%23888%27%20stroke-width%3D%271.5%27%20stroke-linecap%3D%27round%27%3E%3Cpath%20d%3D%27m4%206.5%204%204%204-4%27%2F%3E%3C%2Fsvg%3E")]`;

export const primaryButtonCls =
  "rounded-control bg-accent px-3.5 py-2 text-body font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50";

export const ghostButtonCls =
  "rounded-control border border-hairline px-3.5 py-2 text-body text-ink-2 transition-colors hover:border-grid hover:text-ink";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-meta font-medium text-ink-2">{label}</span>
      {children}
      {hint && <span className="text-meta text-muted">{hint}</span>}
    </label>
  );
}
