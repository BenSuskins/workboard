"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { openPalette } from "./command-palette";
import { ACCENT_BG, ACCENT_TEXT, tileAccent, tileGlyph } from "./labels";
import { ResizeHandle } from "./resize-handle";
import {
  AccomplishmentsIcon,
  BoardIcon,
  CollapseIcon,
  ComposeIcon,
  DigestIcon,
  InboxIcon,
  IssuesIcon,
  PullRequestIcon,
  SearchIcon,
  TriageIcon,
} from "./sidebar-icons";
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
  icon: React.ReactNode;
  badge?: number;
  /** Match the pathname exactly rather than by prefix (the board owns "/"). */
  exact?: boolean;
}

export function Sidebar({
  projects,
  inboxCount,
  openIssueCount,
  prCount,
}: {
  projects: SidebarProject[];
  inboxCount: number;
  /** Issues still to do — the badge is "work outstanding", not "issues that exist". */
  openIssueCount: number;
  prCount: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [openProjects, setOpenProjects] = useState<string[]>([]);
  const [closedSections, setClosedSections] = useState<string[]>([]);

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
      setClosedSections(JSON.parse(localStorage.getItem("wb-sidebar-sections") ?? "[]") as string[]);
    } catch {
      setOpenProjects([]);
      setClosedSections([]);
    }
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

  const toggleSection = useCallback((name: string) => {
    setClosedSections((previous) => {
      const next = previous.includes(name) ? previous.filter((s) => s !== name) : [...previous, name];
      localStorage.setItem("wb-sidebar-sections", JSON.stringify(next));
      return next;
    });
  }, []);

  const nav: NavItem[] = [
    { href: "/", label: "Board", icon: <BoardIcon />, exact: true },
    { href: "/issues", label: "Issues", icon: <IssuesIcon />, badge: openIssueCount },
    { href: "/inbox", label: "Inbox", icon: <InboxIcon />, badge: inboxCount },
    { href: "/prs", label: "Pull requests", icon: <PullRequestIcon />, badge: prCount },
  ];
  const reports: NavItem[] = [
    { href: "/reports/digest", label: "Digests", icon: <DigestIcon /> },
    { href: "/reports/triage", label: "Triage", icon: <TriageIcon /> },
    { href: "/reports/accomplishments", label: "Accomplishments", icon: <AccomplishmentsIcon /> },
  ];

  const isActive = (item: NavItem) => (item.exact ? pathname === item.href : pathname.startsWith(item.href));

  return (
    <aside
      className={`wb-sidebar fixed inset-y-0 left-0 z-30 flex flex-col bg-surface transition-[width] duration-150 ${
        collapsed ? "w-[52px]" : ""
      }`}
      style={collapsed ? undefined : { width: "var(--wb-sidebar-w)" }}
    >
      <div className={`flex h-14 shrink-0 items-center gap-1 px-3 ${collapsed ? "justify-center" : ""}`}>
        <Link href="/" className="flex min-w-0 items-center gap-2" title="Workboard">
          <span className="grid size-[22px] shrink-0 place-items-center rounded-md bg-accent text-[11px] font-bold text-on-accent">
            W
          </span>
          {!collapsed && <span className="truncate text-body font-semibold tracking-tight text-ink">Workboard</span>}
        </Link>
        {!collapsed && (
          <div className="ml-auto flex items-center gap-0.5">
            <IconButton label="Search (⌘K)" onClick={openPalette}>
              <SearchIcon />
            </IconButton>
            <IconButton label="New project" onClick={() => router.push("/projects/new")} filled>
              <ComposeIcon />
            </IconButton>
          </div>
        )}
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {collapsed && (
          <div className="mb-1 flex flex-col items-center gap-0.5">
            <IconButton label="Search (⌘K)" onClick={openPalette}>
              <SearchIcon />
            </IconButton>
            <IconButton label="New project" onClick={() => router.push("/projects/new")} filled>
              <ComposeIcon />
            </IconButton>
          </div>
        )}

        <ul className="flex flex-col gap-px">
          {nav.map((item) => (
            <li key={item.href}>
              <NavRow item={item} active={isActive(item)} collapsed={collapsed} />
            </li>
          ))}
        </ul>

        <SectionLabel
          name="reports"
          label="Reports"
          collapsed={collapsed}
          open={!closedSections.includes("reports")}
          onToggle={toggleSection}
        />
        {(collapsed || !closedSections.includes("reports")) && (
          <ul className="flex flex-col gap-px">
            {reports.map((item) => (
              <li key={item.href}>
                <NavRow item={item} active={isActive(item)} collapsed={collapsed} />
              </li>
            ))}
          </ul>
        )}

        {!collapsed && (
          <>
            <SectionLabel
              name="projects"
              label="Projects"
              collapsed={collapsed}
              open={!closedSections.includes("projects")}
              onToggle={toggleSection}
            />
            {!closedSections.includes("projects") && (
              <ul className="flex flex-col gap-px">
                {projects.map((project) => {
                  const open = openProjects.includes(project.slug);
                  const accent = tileAccent({ slug: project.slug, accent: project.accent as never });
                  const here = pathname.startsWith(`/projects/${project.slug}`);
                  return (
                    <li key={project.slug}>
                      <div
                        className={`group flex items-center gap-1 rounded-md pr-2 transition-colors ${
                          here ? "bg-surface-2" : "hover:bg-surface-2"
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
                          className={`flex min-w-0 flex-1 items-center gap-2 py-1.5 text-body ${
                            here ? "font-medium text-ink" : "text-ink-2 hover:text-ink"
                          }`}
                        >
                          <span
                            className={`grid size-[18px] shrink-0 place-items-center rounded-[5px] text-[10px] font-semibold ${ACCENT_BG[accent]} ${ACCENT_TEXT[accent]}`}
                            aria-hidden
                          >
                            {tileGlyph({ name: project.name, icon: project.icon })}
                          </span>
                          <span className="truncate">{project.name}</span>
                        </Link>
                        {project.upForGrabs > 0 && (
                          <span
                            className="shrink-0 text-[11px] tabular-nums text-muted"
                            title={`${project.upForGrabs} up for grabs`}
                          >
                            {project.upForGrabs}
                          </span>
                        )}
                      </div>
                      {open && (
                        <ul className="ml-[30px] flex flex-col gap-px border-l border-hairline pl-2">
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
            )}
          </>
        )}
      </nav>

      <div className={`flex shrink-0 items-center gap-0.5 p-2 ${collapsed ? "flex-col" : ""}`}>
        <ThemeToggle />
        <IconButton label={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={toggleCollapsed}>
          <CollapseIcon />
        </IconButton>
      </div>

      {/* A collapsed rail is a fixed 52px of icons — there is nothing to size. */}
      {!collapsed && (
        <ResizeHandle
          label="Resize sidebar"
          storageKey="wb-sidebar-width"
          cssVar="--wb-sidebar-w"
          defaultWidth={240}
          min={180}
          // Never let the rail crowd the page out on a small window.
          max={() => Math.min(420, window.innerWidth - 320)}
          edge="right"
          className="-right-1"
        />
      )}
    </aside>
  );
}

function IconButton({
  label,
  onClick,
  filled = false,
  children,
}: {
  label: string;
  onClick: () => void;
  filled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`grid size-7 place-items-center rounded-md transition-colors ${
        filled ? "bg-surface-2 text-ink-2 hover:text-ink" : "text-muted hover:bg-surface-2 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function SectionLabel({
  name,
  label,
  collapsed,
  open,
  onToggle,
}: {
  name: string;
  label: string;
  collapsed: boolean;
  open: boolean;
  onToggle: (name: string) => void;
}) {
  // A collapsed rail has no room for a label; a hairline keeps the grouping.
  if (collapsed) return <div className="my-2 border-t border-hairline" aria-hidden />;
  return (
    <button
      type="button"
      onClick={() => onToggle(name)}
      aria-expanded={open}
      className="flex w-full items-center gap-1 px-2 pb-1 pt-5 text-meta font-medium text-muted transition-colors hover:text-ink-2"
    >
      {label}
      <span aria-hidden className={`text-[9px] transition-transform ${open ? "" : "-rotate-90"}`}>
        ▾
      </span>
    </button>
  );
}

function NavRow({ item, active, collapsed }: { item: NavItem; active: boolean; collapsed: boolean }) {
  return (
    <Link
      href={item.href}
      title={item.label}
      className={`relative flex items-center gap-2.5 rounded-md px-2 py-1.5 text-body transition-colors ${
        active ? "bg-surface-2 font-medium text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
      } ${collapsed ? "justify-center" : ""}`}
    >
      <span className={active ? "text-ink" : "text-muted"}>{item.icon}</span>
      {!collapsed && <span className="truncate">{item.label}</span>}
      {!collapsed && item.badge !== undefined && item.badge > 0 && (
        <span className="ml-auto shrink-0 rounded-full bg-accent/15 px-1.5 text-[11px] font-medium tabular-nums text-accent">
          {item.badge}
        </span>
      )}
      {collapsed && item.badge !== undefined && item.badge > 0 && (
        <span className="absolute right-1 top-1 size-1.5 rounded-full bg-accent" aria-hidden />
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
        className={`flex items-center gap-2 rounded-md px-2 py-1 text-body transition-colors ${
          active ? "text-ink" : "text-muted hover:text-ink-2"
        }`}
      >
        <span className="truncate">{children}</span>
        {count !== undefined && count > 0 && <span className="ml-auto text-[11px] tabular-nums text-muted">{count}</span>}
      </Link>
    </li>
  );
}
