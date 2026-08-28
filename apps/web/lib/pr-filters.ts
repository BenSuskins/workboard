/**
 * The rail's queue filter. One key, and it lives in the URL rather than a
 * cookie: a filtered queue is a link you can send, and the rail is the only way
 * to reach it, so there is nothing to remember on the way back.
 */
import type { PrBucket } from "./pipeline";

export const PR_BUCKETS: readonly PrBucket[] = ["approved", "failing", "changes", "review", "draft"];

export interface PrParams {
  bucket?: string;
}

export function prsHref(bucket: PrBucket | null): string {
  return bucket ? `/prs?bucket=${bucket}` : "/prs";
}

/** Narrows rather than casts: an unknown ?bucket= shows the whole queue. */
export function resolvePrBucket(search: PrParams): PrBucket | undefined {
  return PR_BUCKETS.find((bucket) => bucket === search.bucket);
}
