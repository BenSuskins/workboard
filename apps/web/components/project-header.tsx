import Link from "next/link";
import type { Project } from "@workboard/core";
import { ProjectMeta, StatusBadge } from "./badges";
import { ACCENT_BG, ACCENT_TEXT, tileAccent, tileGlyph } from "./labels";
import { RefreshButton } from "./refresh-button";
import { TimeAgo } from "./time-ago";
import { refreshProjectBySlug } from "@/lib/actions";

const TABS = [
  { segment: "", label: "Overview" },
  { segment: "/tasks", label: "Tasks" },
  { segment: "/activity", label: "Activity" },
] as const;

/**
 * The header every project page opens with: identity, state, and the tab row
 * that moves between the project's own views.
 */
export function ProjectHeader({
  project,
  active,
  configured,
}: {
  project: Project;
  active: (typeof TABS)[number]["segment"];
  configured: boolean;
}) {
  const accent = tileAccent(project);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-meta text-muted">
        <Link href="/" className="hover:text-ink">
          Board
        </Link>
        <span>/</span>
        <span className="text-ink-2">{project.name}</span>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`flex size-11 shrink-0 items-center justify-center rounded-control text-heading font-semibold ${ACCENT_BG[accent]} ${ACCENT_TEXT[accent]}`}
            aria-hidden
          >
            {tileGlyph(project)}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-display font-semibold tracking-tight text-ink">{project.name}</h1>
            <div className="flex flex-wrap items-center gap-1.5 text-meta text-ink-2">
              <StatusBadge status={project.status} />
              <span>·</span>
              <ProjectMeta category={project.category} health={project.health} priority={project.priority} className="text-ink-2" />
              <span>·</span>
              <span className="text-muted">
                active <TimeAgo at={project.lastActivityAt} />
              </span>
            </div>
          </div>
        </div>
        <div
          className="flex items-center gap-2"
          title={configured ? "Re-fetch GitHub/Jira/Docs status" : "No integrations configured — set tokens in .env"}
        >
          <RefreshButton action={refreshProjectBySlug.bind(null, project.slug)} />
        </div>
      </div>

      <nav className="flex items-center gap-0.5 border-b border-hairline">
        {TABS.map((tab) => {
          const selected = tab.segment === active;
          return (
            <Link
              key={tab.label}
              href={`/projects/${project.slug}${tab.segment}`}
              aria-current={selected ? "page" : undefined}
              className={`-mb-px border-b-2 px-3 py-2 text-meta font-medium transition-colors ${
                selected ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink-2"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
