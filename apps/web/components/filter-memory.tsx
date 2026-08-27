"use client";

import { useEffect } from "react";
import { FILTERS_COOKIE } from "@/lib/board-filters";

const A_YEAR = 31536000;

/**
 * Records the filter set the board is currently showing, so the next plain
 * visit to `/` — from the sidebar, a project page, a fresh tab — comes back to
 * it. Rendered by the board alone; nothing else writes this cookie.
 */
export function FilterMemory({ serialized }: { serialized: string }) {
  useEffect(() => {
    // An empty set expires the cookie, so "no filters" is remembered as no filters.
    const maxAge = serialized ? A_YEAR : 0;
    document.cookie = `${FILTERS_COOKIE}=${encodeURIComponent(serialized)}; path=/; max-age=${maxAge}; samesite=lax`;
  }, [serialized]);
  return null;
}
