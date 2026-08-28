import Link from "next/link";
import { PageTopBar, topBarPrimaryCls } from "./page-top-bar";

/**
 * The board's bar, in `PageTopBar`'s terms: Refresh and "New project" as its
 * action slot. `refresh` arrives as a rendered element because the server
 * action behind it has to be bound on the server.
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
    <PageTopBar
      name="Board"
      count={count}
      action={
        <>
          {refresh}
          <Link href="/projects/new" className={topBarPrimaryCls}>
            New project
          </Link>
        </>
      }
    />
  );
}
