/**
 * Board filter state. The URL stays the source of truth — every filter is
 * linkable and shareable — and the browser remembers the last set so returning
 * to the board from anywhere lands on the same view.
 *
 * The memory is a cookie rather than localStorage because the board renders on
 * the server: a cookie is readable while the HTML is built, so a remembered
 * filter never flashes the unfiltered board first.
 */

export interface Filters {
  category?: string;
  status?: string;
  health?: string;
  sort?: string;
  view?: string;
}

/** What the board filters by. `view` is layout, not a filter, and persists on its own cookie. */
export const FILTER_KEYS = ["category", "status", "health", "sort"] as const;

export const FILTERS_COOKIE = "wb-board-filters";

/**
 * "Nothing is filtered" has to be said out loud. An empty query string is also
 * what a plain link to `/` looks like, and that is exactly when the remembered
 * set should apply — so clearing the last filter says so with a sentinel.
 */
const NO_FILTERS = "none";

/** Sorting by recent activity is the default, so it never needs a param. */
function params(filters: Filters): URLSearchParams {
  const search = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = filters[key];
    if (value && !(key === "sort" && value === "activity")) search.set(key, value);
  }
  return search;
}

/** Board URL for a filter combination; every filter that is set becomes a search param. */
export function boardHref(filters: Filters): string {
  const search = params(filters);
  if ([...search.keys()].length === 0) search.set("filters", NO_FILTERS);
  if (filters.view) search.set("view", filters.view);
  return `/?${search}`;
}

/** The remembered set, as a query string. Empty when nothing is filtered. */
export function serializeFilters(filters: Filters): string {
  return params(filters).toString();
}

export function parseFilters(serialized: string | undefined): Filters {
  const search = new URLSearchParams(serialized ?? "");
  const filters: Filters = {};
  for (const key of FILTER_KEYS) {
    const value = search.get(key);
    if (value) filters[key] = value;
  }
  return filters;
}

export type BoardParams = Filters & { filters?: string };

/**
 * The URL wins whenever it says anything about filters — one filter param means
 * it is describing the whole set, and `?filters=none` says "none" explicitly.
 * A URL that mentions no filters at all is a plain visit, so the remembered set
 * fills it in.
 */
export function resolveFilters(search: BoardParams, remembered: string | undefined): Filters {
  const fromUrl: Filters = {};
  for (const key of FILTER_KEYS) {
    const value = search[key];
    if (value) fromUrl[key] = value;
  }
  const explicit = search.filters === NO_FILTERS || Object.keys(fromUrl).length > 0;
  return { ...(explicit ? fromUrl : parseFilters(remembered)), view: search.view };
}
