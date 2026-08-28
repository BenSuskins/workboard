"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ProjectAccent } from "@workboard/core";
import { ACCENT_BG, ACCENT_TEXT } from "./labels";

const TABS = [
  { segment: "", label: "Overview" },
  { segment: "/tasks", label: "Tasks" },
  { segment: "/activity", label: "Activity" },
] as const;

export interface TopBarProject {
  slug: string;
  name: string;
  accent: ProjectAccent;
  glyph: string;
}

/**
 * The 48px bar every project view sits under: identity, the view it is showing,
 * the tab row, and one primary action. It replaces a 150px-tall header block —
 * the project's full identity now opens the overview's reading column instead,
 * where it is read once rather than repeated above every screen.
 *
 * The active tab comes from the pathname rather than a prop because this bar
 * lives in a layout, which cannot see its child segment. `refresh` arrives as a
 * rendered element: the server action behind it has to be bound on the server.
 */
export function ProjectTopBar({ project, refresh }: { project: TopBarProject; refresh: React.ReactNode }) {
  const pathname = usePathname();
  const base = `/projects/${project.slug}`;
  const rest = pathname.startsWith(base) ? pathname.slice(base.length) : "";

  const tab = TABS.find((candidate) => candidate.segment === rest);
  const crumb = tab?.label ?? crumbFor(rest);
  const onActivity = rest === "/activity";

  return (
    <header className="sticky top-0 z-20 flex h-12 flex-none items-center gap-2.5 border-b border-hairline bg-surface px-5">
      <Link href={base} className="flex min-w-0 items-center gap-2.5 text-ink">
        <span
          className={`grid size-5 flex-none place-items-center rounded-[5px] text-[10px] font-semibold ${ACCENT_BG[project.accent]} ${ACCENT_TEXT[project.accent]}`}
          aria-hidden
        >
          {project.glyph}
        </span>
        <span className="truncate text-body font-medium">{project.name}</span>
      </Link>
      <span className="flex-none text-grid" aria-hidden>
        /
      </span>
      <span className="flex-none truncate text-body text-ink-2">{crumb}</span>

      <nav className="ml-5 flex flex-none items-center gap-0.5">
        {TABS.map((candidate) => {
          const selected = candidate.segment === rest;
          return (
            <Link
              key={candidate.label}
              href={`${base}${candidate.segment}`}
              aria-current={selected ? "page" : undefined}
              className={`rounded-chip px-2.5 py-1 text-label font-medium transition-colors ${
                selected ? "bg-surface-2 text-ink" : "text-muted hover:text-ink-2"
              }`}
            >
              {candidate.label}
            </Link>
          );
        })}
      </nav>

      <div className="ml-auto flex flex-none items-center gap-2">
        {refresh}
        <Link
          href={onActivity ? `${base}/activity#compose` : `${base}/tasks/new`}
          className="rounded-control bg-accent px-3 py-1.5 text-label font-medium text-on-accent shadow-[0_1px_2px_rgba(0,0,0,0.3)] transition-opacity hover:opacity-90"
        >
          {onActivity ? "New post" : "New task"}
        </Link>
      </div>
    </header>
  );
}

/** Sub-views the tab row has no pill for still say where you are. */
function crumbFor(rest: string): string {
  if (rest.startsWith("/tasks/new")) return "New task";
  if (rest.startsWith("/tasks/")) return "Task";
  if (rest.startsWith("/posts/")) return "Post";
  if (rest === "/settings") return "Settings";
  return "Overview";
}
