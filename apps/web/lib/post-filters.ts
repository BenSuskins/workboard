import type { Post, PostType } from "@workboard/core";

/**
 * Which kinds of post the activity feed is showing. The same contract the
 * board and issue filters keep (`lib/board-filters.ts`, `lib/issue-filters.ts`):
 * the URL is the source of truth, so a filtered feed is a shareable link.
 *
 * No cookie here. A filter you set on one project's feed should not silently
 * apply to the next project you open — unlike /issues, this view is per project
 * and you arrive at it from the top bar, not from wherever you last were.
 */
const TYPES: PostType[] = ["agent_update", "question", "status_change", "note"];

/** Validates untrusted text, returning null rather than guessing a type. */
export function postTypeParam(value: string | undefined): PostType | null {
  return TYPES.includes(value as PostType) ? (value as PostType) : null;
}

export function postsHref(slug: string, type: PostType | null): string {
  const base = `/projects/${slug}/activity`;
  return type ? `${base}?type=${type}` : base;
}

export interface PostCounts extends Record<PostType, number> {
  all: number;
  /** A question nobody has answered blocks an agent, so it is counted apart. */
  openQuestions: number;
}

export function countByType(posts: Post[]): PostCounts {
  const counts: PostCounts = {
    agent_update: 0,
    question: 0,
    status_change: 0,
    note: 0,
    all: posts.length,
    openQuestions: 0,
  };
  for (const post of posts) {
    counts[post.type] += 1;
    if (post.type === "question" && !post.answeredAt) counts.openQuestions += 1;
  }
  return counts;
}
