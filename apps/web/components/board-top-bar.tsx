import Link from "next/link";

/**
 * The board's 48px bar, the same object the project routes wear: where you are,
 * how much of it there is, then Refresh and one primary action. It replaces the
 * heading that used to sit inside the content column, so the board opens on the
 * digest sentence rather than on the word "Board" repeated from the sidebar.
 *
 * `refresh` arrives as a rendered element because the server action behind it
 * has to be bound on the server.
 */
export function BoardTopBar({
  shown,
  total,
  refresh,
}: {
  /** Projects the current filters let through. */
  shown: number;
  total: number;
  refresh: React.ReactNode;
}) {
  // Saying "0 projects" beside a stat strip reading 5 would read as a
  // contradiction, so a filtered count names what it is a count of.
  const count = shown === total ? `${total} project${total === 1 ? "" : "s"}` : `${shown} of ${total} projects`;
  return (
    <header className="sticky top-0 z-20 flex h-12 flex-none items-center gap-2.5 border-b border-hairline bg-surface px-5">
      <span className="text-body font-medium text-ink">Board</span>
      <span className="text-label tabular-nums text-muted">{count}</span>
      <div className="ml-auto flex flex-none items-center gap-2">
        {refresh}
        <Link
          href="/projects/new"
          className="rounded-control bg-accent px-3 py-1.5 text-label font-medium text-on-accent shadow-[0_1px_2px_rgba(0,0,0,0.3)] transition-opacity hover:opacity-90"
        >
          New project
        </Link>
      </div>
    </header>
  );
}
