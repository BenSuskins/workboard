import { MicroLabel } from "./detail-layout";

/**
 * The rail is a column of key/value rows. Every row is the same shape — a fixed
 * label column, then the value — so the values line up and the eye reads down
 * one edge rather than hunting across a form.
 */
export function RailRow({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: React.ReactNode;
  /** The project rail's labels ("Last active") need more room than a task's. */
  wide?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-control px-2 py-1.5 transition-colors duration-[130ms] hover:bg-surface-2">
      <span className={`flex-none text-meta text-muted ${wide ? "w-[82px]" : "w-[78px]"}`}>{label}</span>
      <span className="flex min-w-0 flex-1 items-center gap-1.5 text-label font-medium text-ink-2">{children}</span>
    </div>
  );
}

/** A value that carries state, so the dot repeats what the word already says. */
export function RailValue({ dot, children }: { dot?: string; children: React.ReactNode }) {
  return (
    <>
      {dot && <span className={`size-[7px] flex-none rounded-pill ${dot}`} aria-hidden />}
      <span className="truncate">{children}</span>
    </>
  );
}

export function RailSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <MicroLabel className="px-2">{label}</MicroLabel>
      {children}
    </div>
  );
}

/**
 * Controls in the rail are native form controls with their chrome stripped, not
 * a custom popover. A `<select>` gets keyboard support, screen-reader support
 * and touch behaviour from the platform, and it posts from a server form with
 * no client component at all — see AutoSubmitSelect for the one line of JS
 * that makes choosing an option submit it.
 */
export const railControlCls =
  "w-full min-w-0 cursor-pointer appearance-none truncate rounded-chip border border-transparent bg-transparent px-1 py-0.5 text-label font-medium text-ink-2 outline-none transition-colors hover:border-hairline hover:bg-surface focus:border-accent focus:bg-surface";
