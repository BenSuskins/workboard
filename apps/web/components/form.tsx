/**
 * Shared form controls. Inputs sit one step *above* the surface they live on
 * (surface-2 on surface), never below — bg-page inside a card reads as a hole
 * punched in it, which is what the old inputs did in the AMOLED theme.
 */

export const fieldCls =
  "w-full rounded-control border border-hairline bg-surface-2 px-3 py-2 text-body text-ink outline-none transition-colors placeholder:text-muted hover:border-grid focus:border-accent/60";

export const primaryButtonCls =
  "rounded-control bg-accent px-3.5 py-2 text-body font-medium text-on-accent transition-opacity hover:opacity-90 disabled:opacity-50";

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

/**
 * The page container every route outside a project draws itself in. It used to
 * live on the root layout's <main>, but the project screens are a reading
 * column beside a full-height rail and cannot sit inside a centred max-width
 * box — so the container moved down one level to the pages that still want it.
 * A page that reads narrower (a form, a report) sets its own max-width and
 * carries `px-6 py-7` itself; the padding is the part that must not drift.
 */
export const pageContainerCls = "mx-auto w-full max-w-6xl px-6 py-7";
