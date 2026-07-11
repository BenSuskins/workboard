"use client";

import { useEffect, useState } from "react";
import { relativeTime } from "@/lib/format";

/** Relative timestamp that stays honest: re-renders every 30 s after mount. */
export function TimeAgo({ at }: { at: number | string }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);
  const ms = typeof at === "string" ? Date.parse(at) : at;
  return (
    <time dateTime={new Date(ms).toISOString()} title={new Date(ms).toLocaleString()} suppressHydrationWarning>
      {relativeTime(ms)}
    </time>
  );
}
