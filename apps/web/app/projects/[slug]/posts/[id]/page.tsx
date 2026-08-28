import { notFound } from "next/navigation";
import { getPost, getProject, listComments } from "@workboard/core";
import { ContextCard } from "@/components/context-card";
import { Mermaid } from "@/components/mermaid";
import { PostView } from "@/components/post-view";
import { POST_TYPE_LABEL } from "@/components/labels";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function PostPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const store = db();
  const post = getPost(store, Number(id));
  const project = post && getProject(store, post.projectId);
  if (!post || !project || project.slug !== slug) notFound();
  const comments = listComments(store, post.id);

  return (
    <div className="flex flex-col gap-5 px-10 py-7">
      <Mermaid />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
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
    </div>
  );
}
