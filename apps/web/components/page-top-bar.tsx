/**
 * The 48px bar every top-level route wears: where you are, how much of it there
 * is, then one action slot. `BoardTopBar` and `ProjectTopBar` both grew their
 * own copy of this shell before the redesign folded the five list-and-report
 * routes into it too — this is the one implementation the rest draw from.
 */
export function PageTopBar({
  name,
  count,
  action,
}: {
  name: string;
  count: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-12 flex-none items-center gap-2.5 border-b border-hairline bg-surface px-5">
      <span className="text-body font-medium text-ink">{name}</span>
      <span className="text-label tabular-nums text-muted">{count}</span>
      {action && <div className="ml-auto flex flex-none items-center gap-2">{action}</div>}
    </header>
  );
}

/** A primary action in the bar — the accent link the board's "New project" wears. */
export const topBarPrimaryCls =
  "rounded-control bg-accent px-3 py-1.5 text-label font-medium text-on-accent shadow-[0_1px_2px_rgba(0,0,0,0.3)] transition-opacity hover:opacity-90";

/** A secondary action in the bar — quieter than the primary, still its own button. */
export const topBarGhostCls =
  "rounded-control border border-hairline bg-surface-2 px-3 py-1.5 text-label font-medium text-ink-2 transition-colors hover:border-grid hover:text-ink";
