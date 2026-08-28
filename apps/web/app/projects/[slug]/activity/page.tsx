import { notFound } from "next/navigation";
import { getActivityCounts, getProjectDetail, integrationStatus } from "@workboard/core";
import { ActivityFeed, PostComposer } from "@/components/activity-feed";
import { Mermaid } from "@/components/mermaid";
import { SectionHeading } from "@/components/section";
import { Sparkline } from "@/components/sparkline";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ProjectActivityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const database = db();
  const detail = getProjectDetail(database, slug, { postsLimit: 200 });
  if (!detail) notFound();
  const { project, posts, comments } = detail;
  const integrations = integrationStatus();
  const anyConfigured = integrations.github || integrations.jira || integrations.google;
  const activity = getActivityCounts(database, project.id, 30);
  const openQuestions = posts.filter((post) => post.type === "question" && !post.answeredAt).length;

  return (
    <div className="flex flex-col gap-6">
      <Mermaid />

      <section className="flex flex-col gap-2 rounded-card border border-hairline bg-surface p-5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-meta text-muted">posts · 30 days</p>
          {openQuestions > 0 && (
            <p className="text-meta font-medium text-serious">
              {openQuestions} open question{openQuestions === 1 ? "" : "s"}
            </p>
          )}
        </div>
        <Sparkline counts={activity} width={640} height={56} fill className="w-full" />
      </section>

      <PostComposer project={project} />

      <section className="flex flex-col gap-3">
        <SectionHeading title="Timeline" count={posts.length} />
        <ActivityFeed posts={posts} comments={comments} project={project} />
      </section>
    </div>
  );
}
