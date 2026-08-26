"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { openPalette } from "./command-palette";
import { ACCENT_BG, ACCENT_TEXT, tileAccent, tileGlyph } from "./labels";
import { ThemeToggle } from "./theme-toggle";

export interface SidebarProject {
  id: number;
  slug: string;
  name: string;
  icon: string | null;
  accent: string | null;
  openTasks: number;
  upForGrabs: number;
  questions: number;
}

interface NavItem {
  href: string;
  label: string;
  glyph: string;
  badge?: number;
  /** Match the pathname exactly rather than by prefix (the board owns "/"). */
  exact?: boolean;
}

export function Sidebar({
  projects,
  inboxCount,
  prCount,
}: {
  projects: SidebarProject[];
  inboxCount: number;
  prCount: number;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [openProjects, setOpenProjects] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);

  // The pre-paint script already sized the rail; read back what it decided.
  // A narrow viewport overrides the saved choice — a 240px rail would bury the page.
  useEffect(() => {
    const narrow = window.matchMedia("(max-width: 640px)");
    const resolve = () => {
      const next = narrow.matches || document.documentElement.dataset.sidebar === "collapsed";
      setCollapsed(next);
      document.documentElement.dataset.sidebar = next ? "collapsed" : "expanded";
    };
    resolve();
    narrow.addEventListener("change", resolve);
    try {
      setOpenProjects(JSON.parse(localStorage.getItem("wb-sidebar-projects") ?? "[]") as string[]);
    } catch {
      setOpenProjects([]);
    }
    setMounted(true);
    return () => narrow.removeEventListener("change", resolve);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((previous) => {
      const next = !previous;
      document.documentElement.dataset.sidebar = next ? "collapsed" : "expanded";
      localStorage.setItem("wb-sidebar", next ? "collapsed" : "expanded");
      return next;
    });
  }, []);

  const toggleProject = useCallback((slug: string) => {
    setOpenProjects((previous) => {
      const next = previous.includes(slug) ? previous.filter((s) => s !== slug) : [...previous, slug];
      localStorage.setItem("wb-sidebar-projects", JSON.stringify(next));
      return next;
    });
  }, []);

  const nav: NavItem[] = [
    { href: "/", label: "Board", glyph: "▦", exact: true },
    { href: "/inbox", label: "Inbox", glyph: "✦", badge: inboxCount },
    { href: "/prs", label: "Pull requests", glyph: "⑂", badge: prCount },
  ];
  const reports: NavItem[] = [
    { href: "/reports?kind=digest", label: "Digests", glyph: "≡" },
    { href: "/reports?kind=triage", label: "Triage", glyph: "⚑" },
    { href: "/reports?kind=accomplishments", label: "Accomplishments", glyph: "✓" },
  ];

  const isActive = (item: NavItem) => {
    const [path, query] = item.href.split("?");
    if (item.exact) return pathname === path;
    if (!query) return pathname.startsWith(path);
    // The report kinds share one route, so the query string is what separates them.
    return pathname === path && typeof window !== "undefined" && window.location.search.includes(query);
  };

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-30 flex flex-col border-r border-hairline bg-surface transition-[width] duration-150 ${
        collapsed ? "w-14" : "w-60"
      }`}
    >
      <div className="flex h-14 shrink-0 items-center gap-2 px-3">
        <Link href="/" className="flex min-w-0 items-center gap-2" title="Workboard">
          <span className="grid size-6 shrink-0 place-items-center rounded-chip bg-accent text-meta font-bold text-white">W</span>
          {!collapsed && <span className="truncate text-title font-semibold tracking-tight text-ink">Workboard</span>}
        </Link>
        {!collapsed && (
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
            className="ml-auto grid size-7 place-items-center rounded-control text-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            ⇤
          </button>
        )}
      </div>

      <div className="px-2 pb-2">
        <button
          type="button"
          onClick={openPalette}
          title="Search (⌘K)"
          aria-label="Search"
          className={`flex w-full items-center gap-2 rounded-control border border-hairline px-2 py-1.5 text-meta text-muted transition-colors hover:border-muted hover:text-ink-2 ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <span aria-hidden>⌕</span>
          {!collapsed && (
            <>
              <span>Search…</span>
              <kbd className="ml-auto font-mono text-[10px] text-muted">⌘K</kbd>
            </>
          )}
        </button>
      </div>

      <div className="px-2 pb-3">
        <Link
          href="/projects/new"
          title="New project"
          className={`flex items-center gap-2 rounded-control bg-accent px-2.5 py-1.5 text-meta font-semibold text-white transition-opacity hover:opacity-90 ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <span aria-hidden>+</span>
          {!collapsed && <span>New project</span>}
        </Link>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        <ul className="flex flex-col gap-0.5">
          {nav.map((item) => (
            <li key={item.href}>
              <NavRow item={item} active={isActive(item)} collapsed={collapsed} />
            </li>
          ))}
        </ul>

        {!collapsed && <SectionLabel>Reports</SectionLabel>}
        <ul className={`flex flex-col gap-0.5 ${collapsed ? "mt-2 border-t border-hairline pt-2" : ""}`}>
          {reports.map((item) => (
            <li key={item.href}>
              <NavRow item={item} active={mounted && isActive(item)} collapsed={collapsed} />
            </li>
          ))}
        </ul>

        {!collapsed && (
          <>
            <SectionLabel>Projects</SectionLabel>
            <ul className="flex flex-col gap-0.5">
              {projects.map((project) => {
                const open = openProjects.includes(project.slug);
                const accent = tileAccent({ slug: project.slug, accent: project.accent as never });
                return (
                  <li key={project.slug}>
                    <div
                      className={`group flex items-center gap-1 rounded-control pr-1 transition-colors ${
                        pathname.startsWith(`/projects/${project.slug}`) ? "bg-surface-2" : "hover:bg-surface-2"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleProject(project.slug)}
                        aria-expanded={open}
                        aria-label={open ? `Collapse ${project.name}` : `Expand ${project.name}`}
                        className="grid size-5 shrink-0 place-items-center text-muted transition-transform hover:text-ink"
                        style={{ transform: open ? "rotate(90deg)" : undefined }}
                      >
                        ›
                      </button>
                      <Link
                        href={`/projects/${project.slug}`}
                        className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-meta text-ink-2 hover:text-ink"
                      >
                        <span
                          className={`grid size-4 shrink-0 place-items-center rounded-[4px] text-[10px] font-semibold ${ACCENT_BG[accent]} ${ACCENT_TEXT[accent]}`}
                          aria-hidden
                        >
                          {tileGlyph({ name: project.name, icon: project.icon })}
                        </span>
                        <span className="truncate">{project.name}</span>
                      </Link>
                      {project.upForGrabs > 0 && (
                        <span className="shrink-0 text-[10px] tabular-nums text-muted" title={`${project.upForGrabs} up for grabs`}>
                          {project.upForGrabs}
                        </span>
                      )}
                    </div>
                    {open && (
                      <ul className="ml-[26px] flex flex-col gap-0.5 border-l border-hairline pl-2">
                        <SubRow href={`/projects/${project.slug}`} active={pathname === `/projects/${project.slug}`}>
                          Overview
                        </SubRow>
                        <SubRow
                          href={`/projects/${project.slug}/tasks`}
                          active={pathname === `/projects/${project.slug}/tasks`}
                          count={project.openTasks}
                        >
                          Tasks
                        </SubRow>
                        <SubRow
                          href={`/projects/${project.slug}/activity`}
                          active={pathname === `/projects/${project.slug}/activity`}
                          count={project.questions}
                        >
                          Activity
                        </SubRow>
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </nav>

      <div className={`flex shrink-0 items-center gap-1 border-t border-hairline p-2 ${collapsed ? "flex-col" : ""}`}>
        <ThemeToggle />
        {collapsed && (
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label="Expand sidebar"
            title="Expand sidebar"
            className="grid size-8 place-items-center rounded-control text-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            ⇥
          </button>
        )}
      </div>
    </aside>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="px-2 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-wider text-muted">{children}</p>;
}

function NavRow({ item, active, collapsed }: { item: NavItem; active: boolean; collapsed: boolean }) {
  return (
    <Link
      href={item.href}
      title={item.label}
      className={`flex items-center gap-2 rounded-control px-2 py-1.5 text-meta transition-colors ${
        active ? "bg-surface-2 font-medium text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
      } ${collapsed ? "justify-center" : ""}`}
    >
      <span aria-hidden className="shrink-0 text-muted">
        {item.glyph}
      </span>
      {!collapsed && <span className="truncate">{item.label}</span>}
      {!collapsed && item.badge !== undefined && item.badge > 0 && (
        <span className="ml-auto shrink-0 rounded-pill bg-accent/15 px-1.5 text-[10px] font-medium tabular-nums text-accent">
          {item.badge}
        </span>
      )}
      {collapsed && item.badge !== undefined && item.badge > 0 && (
        <span className="absolute ml-5 -mt-4 size-1.5 rounded-full bg-accent" aria-hidden />
      )}
    </Link>
  );
}

function SubRow({
  href,
  active,
  count,
  children,
}: {
  href: string;
  active: boolean;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className={`flex items-center gap-2 rounded-chip px-2 py-1 text-meta transition-colors ${
          active ? "text-ink" : "text-muted hover:text-ink-2"
        }`}
      >
        <span className="truncate">{children}</span>
        {count !== undefined && count > 0 && <span className="ml-auto text-[10px] tabular-nums text-muted">{count}</span>}
      </Link>
    </li>
  );
}
