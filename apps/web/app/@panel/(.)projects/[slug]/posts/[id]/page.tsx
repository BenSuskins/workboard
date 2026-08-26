import { notFound } from "next/navigation";
import { getPost, getProject, listComments } from "@workboard/core";
import { ContextCard } from "@/components/context-card";
import { Mermaid } from "@/components/mermaid";
import { Panel } from "@/components/panel";
import { PostView } from "@/components/post-view";
import { POST_TYPE_LABEL } from "@/components/labels";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function PostPanel({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const store = db();
  const post = getPost(store, Number(id));
  const project = post && getProject(store, post.projectId);
  if (!post || !project || project.slug !== slug) notFound();
  const comments = listComments(store, post.id);

  return (
    <Panel
      title={post.title || `Post #${post.id}`}
      href={`/projects/${project.slug}/posts/${post.id}`}
      breadcrumb={<span className="truncate text-meta text-ink-2">{project.name}</span>}
    >
      <Mermaid />
      <div className="flex flex-col gap-6">
        <PostView post={post} project={project} comments={comments} />
        <ContextCard
          project={project}
          author={post.author}
          createdAt={post.createdAt}
          extra={[
            { label: "Kind", value: POST_TYPE_LABEL[post.type] },
            { label: "Replies", value: comments.length },
          ]}
        />
      </div>
    </Panel>
  );
}
