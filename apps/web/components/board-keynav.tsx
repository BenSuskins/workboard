"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/** j/k moves a highlight across [data-row] children, Enter opens the highlighted row, Esc clears. */
export function BoardKeynav({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const listRef = useRef<HTMLDivElement>(null);
  const indexRef = useRef(-1);

  useEffect(() => {
    const rows = () => Array.from(listRef.current?.querySelectorAll<HTMLElement>("[data-row]") ?? []);
    const paint = () => {
      rows().forEach((el, i) => el.classList.toggle("keynav-active", i === indexRef.current));
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      if (rows().length === 0) return;
      let next = indexRef.current;
      if (event.key === "j") next = Math.min(indexRef.current + 1, rows().length - 1);
      else if (event.key === "k") next = Math.max(indexRef.current - 1, 0);
      else if (event.key === "Escape") next = -1;
      else if (event.key === "Enter" && indexRef.current >= 0) {
        const link = rows()[indexRef.current]?.querySelector<HTMLAnchorElement>("a[href]");
        if (!link) return;
        event.preventDefault();
        router.push(link.getAttribute("href") ?? "/");
        return;
      } else return;
      event.preventDefault();
      indexRef.current = next;
      paint();
      rows()[next]?.scrollIntoView({ block: "nearest" });
    };
    window.addEventListener("keydown", onKeyDown);
    paint();
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      rows().forEach((el) => el.classList.remove("keynav-active"));
    };
  }, [router]);

  return (
    <div ref={listRef} className="divide-y divide-hairline">
      {children}
    </div>
  );
}
