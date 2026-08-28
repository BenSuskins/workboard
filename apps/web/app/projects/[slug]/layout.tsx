import { notFound } from "next/navigation";
import { getProject, integrationStatus } from "@workboard/core";
import { tileAccent, tileGlyph } from "@/components/labels";
import { ProjectTopBar } from "@/components/project-top-bar";
import { RefreshButton } from "@/components/refresh-button";
import { refreshProjectBySlug } from "@/lib/actions";
import { db } from "@/lib/db";

/**
 * The project shell. Every view under a project runs full-bleed beneath one
 * 48px bar — the reading column and the property rail need the whole pane, so
 * the centred container the rest of the app uses stops here.
 */
export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = getProject(db(), slug);
  if (!project) notFound();

  const integrations = integrationStatus();
  const anyConfigured = integrations.github || integrations.jira || integrations.google;

  return (
    <div className="flex min-h-screen flex-col">
      <ProjectTopBar
        project={{
          slug: project.slug,
          name: project.name,
          accent: tileAccent(project),
          glyph: tileGlyph(project),
        }}
        refresh={
          <span
            title={anyConfigured ? "Re-fetch GitHub/Jira/Docs status" : "No integrations configured — set tokens in .env"}
          >
            <RefreshButton action={refreshProjectBySlug.bind(null, project.slug)} />
          </span>
        }
      />
      {children}
    </div>
  );
}
