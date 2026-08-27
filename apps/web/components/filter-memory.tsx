"use client";

import { useEffect } from "react";
import { FILTERS_COOKIE } from "@/lib/board-filters";

const A_YEAR = 31536000;

/**
 * Records the filter set a view is currently showing, so the next plain visit to
 * it — from the sidebar, a project page, a fresh tab — comes back to the same
 * place. One cookie per view: the board and the issues list remember separately.
 */
export function FilterMemory({ serialized, cookie = FILTERS_COOKIE }: { serialized: string; cookie?: string }) {
  useEffect(() => {
    // An empty set expires the cookie, so "no filters" is remembered as no filters.
    const maxAge = serialized ? A_YEAR : 0;
    document.cookie = `${cookie}=${encodeURIComponent(serialized)}; path=/; max-age=${maxAge}; samesite=lax`;
  }, [cookie, serialized]);
  return null;
}
