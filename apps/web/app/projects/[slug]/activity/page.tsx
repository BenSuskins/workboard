import Link from "next/link";
import { notFound } from "next/navigation";
import { getActivityCounts, getProjectDetail, type PostType } from "@workboard/core";
import { ActivityFeed, PostComposer } from "@/components/activity-feed";
import { DetailLayout, MicroLabel, ReadingColumn } from "@/components/detail-layout";
import { POST_TYPE_LABEL } from "@/components/labels";
import { Mermaid } from "@/components/mermaid";
import { Sparkline } from "@/components/sparkline";
import { TypeMark } from "@/components/state-glyphs";
import { db } from "@/lib/db";
import { countByType, postsHref, postTypeParam } from "@/lib/post-filters";

export const dynamic = "force-dynamic";

const FILTER_ORDER: PostType[] = ["agent_update", "question", "status_change", "note"];

export default async function ProjectActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { slug } = await params;
  const database = db();
  const detail = getProjectDetail(database, slug, { postsLimit: 200 });
  if (!detail) notFound();
  const { project, posts, comments } = detail;
  const activity = getActivityCounts(database, project.id, 30);

  const active = postTypeParam((await searchParams).type);
  const counts = countByType(posts);
  const shown = active ? posts.filter((post) => post.type === active) : posts;
  const thisWeek = activity.slice(-7).reduce((sum, count) => sum + count, 0);
  const firstOpenQuestion = posts.find((post) => post.type === "question" && !post.answeredAt);

  const rail = (
    <>
      <div className="flex flex-col gap-2">
        <MicroLabel>Pulse · 30 days</MicroLabel>
        <Sparkline counts={activity} width={256} height={44} fill className="w-full" />
        <span className="text-caption text-muted">
          {posts.length} post{posts.length === 1 ? "" : "s"} · {thisWeek} this week
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <MicroLabel className="px-2">Filter</MicroLabel>
        <FilterRow href={postsHref(project.slug, null)} active={!active} label="All posts" count={counts.all} />
        {FILTER_ORDER.map((type) => (
          <FilterRow
            key={type}
            href={postsHref(project.slug, type)}
            active={active === type}
            label={`${POST_TYPE_LABEL[type]}s`}
            count={counts[type]}
            mark={<TypeMark type={type} />}
          />
        ))}
      </div>

      {firstOpenQuestion && (
        <div className="flex flex-col gap-2 rounded-card border border-serious/35 bg-serious/[0.08] px-3 py-2.5">
          <span className="text-meta font-semibold text-serious">
            {counts.openQuestions} open question{counts.openQuestions === 1 ? "" : "s"}
          </span>
          <span className="line-clamp-3 text-caption text-ink-2">
            {firstOpenQuestion.title || firstOpenQuestion.body}
          </span>
          <Link
            href={`/projects/${project.slug}/posts/${firstOpenQuestion.id}`}
            className="text-caption text-accent hover:underline"
          >
            Answer it
          </Link>
        </div>
      )}
    </>
  );

  return (
    <DetailLayout rail={rail} wide>
      <Mermaid />
      <ReadingColumn>
        <div className="flex flex-col gap-6">
          <PostComposer project={project} />
          <ActivityFeed posts={shown} comments={comments} project={project} grouped />
        </div>
      </ReadingColumn>
    </DetailLayout>
  );
}

/** One filter, its mark, and how many posts it would leave on the page. */
function FilterRow({
  href,
  active,
  label,
  count,
  mark,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
  mark?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`flex items-center gap-2.5 rounded-control px-2 py-1.5 transition-colors duration-[130ms] hover:bg-surface-2 ${
        active ? "bg-surface-2" : ""
      }`}
    >
      {mark ?? <span className="size-[9px] flex-none" aria-hidden />}
      <span className={`text-label ${active ? "text-ink" : "text-ink-2"}`}>{label}</span>
      <span className="ml-auto text-meta tabular-nums text-muted">{count}</span>
    </Link>
  );
}
