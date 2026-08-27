/**
 * Issue filter state, the same contract the board's filters keep
 * (`lib/board-filters.ts`): the URL is the source of truth so every view is a
 * shareable link, and a cookie remembers the last set so returning to /issues
 * from anywhere lands where you left it.
 *
 * A cookie rather than localStorage because the page renders on the server — a
 * cookie is readable while the HTML is built, so a remembered filter never
 * flashes the unfiltered list first.
 */

export interface IssueFilters {
  lane?: string;
  /** `me` (yours), `none` (unassigned), or an agent name. */
  assignee?: string;
  label?: string;
  priority?: string;
  project?: string;
  /** Free-text search over identifier, title and spec. */
  q?: string;
}

export const ISSUE_FILTER_KEYS = ["lane", "assignee", "label", "priority", "project", "q"] as const;

export const ISSUE_FILTERS_COOKIE = "wb-issue-filters";

/** Says "nothing is filtered" out loud, so clearing the last filter is not read as a plain visit. */
const NO_FILTERS = "none";

/** The person using Workboard. There is one of them, so this is the whole user model. */
export const ME = "user";

function params(filters: IssueFilters): URLSearchParams {
  const search = new URLSearchParams();
  for (const key of ISSUE_FILTER_KEYS) {
    const value = filters[key];
    if (value) search.set(key, value);
  }
  return search;
}

export function issuesHref(filters: IssueFilters): string {
  const search = params(filters);
  if ([...search.keys()].length === 0) search.set("filters", NO_FILTERS);
  return `/issues?${search}`;
}

/** The remembered set, as a query string. Empty when nothing is filtered. */
export function serializeIssueFilters(filters: IssueFilters): string {
  return params(filters).toString();
}

export function parseIssueFilters(serialized: string | undefined): IssueFilters {
  const search = new URLSearchParams(serialized ?? "");
  const filters: IssueFilters = {};
  for (const key of ISSUE_FILTER_KEYS) {
    const value = search.get(key);
    if (value) filters[key] = value;
  }
  return filters;
}

export type IssueParams = IssueFilters & { filters?: string };

/**
 * The URL wins whenever it says anything about filters; a URL that mentions
 * none at all is a plain visit, so the remembered set fills it in.
 */
export function resolveIssueFilters(search: IssueParams, remembered: string | undefined): IssueFilters {
  const fromUrl: IssueFilters = {};
  for (const key of ISSUE_FILTER_KEYS) {
    const value = search[key];
    if (value) fromUrl[key] = value;
  }
  const explicit = search.filters === NO_FILTERS || Object.keys(fromUrl).length > 0;
  return explicit ? fromUrl : parseIssueFilters(remembered);
}

/**
 * The assignee the URL is asking for, in the domain's terms: a name, `null` for
 * unassigned, or undefined for "anyone". `me` is spelled out in the URL rather
 * than leaking the stored author string into every shared link.
 */
export function assigneeQuery(value: string | undefined): string | null | undefined {
  if (!value) return undefined;
  if (value === "me") return ME;
  if (value === NO_FILTERS) return null;
  return value;
}
