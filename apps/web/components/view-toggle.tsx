"use client";

import Link from "next/link";
import { boardHref, type Filters } from "./filter-bar";

type BoardView = "cards" | "list";

const COOKIE_KEY = "wb-board-view";

function persist(view: BoardView) {
  document.cookie = `${COOKIE_KEY}=${view}; path=/; max-age=31536000; samesite=lax`;
}

function hrefFor(filters: Filters, view: BoardView): string {
  return boardHref({ ...filters, view });
}

/** Segmented List ⇄ Cards control. Explicit ?view= wins; otherwise the cookie picks the default. */
export function ViewToggle({ filters, view }: { filters: Filters; view: BoardView }) {
  return (
    <div className="flex items-center rounded-lg border border-hairline p-0.5" role="group" aria-label="Board layout">
      {(["list", "cards"] as const).map((option) => (
        <Link
          key={option}
          href={hrefFor(filters, option)}
          onClick={() => persist(option)}
          aria-pressed={view === option}
          className={`rounded-md px-2 py-0.5 text-xs font-medium capitalize transition-colors ${
            view === option ? "bg-accent/15 text-accent" : "text-ink-2 hover:text-ink"
          }`}
        >
          {option}
        </Link>
      ))}
    </div>
  );
}
