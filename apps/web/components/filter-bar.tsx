import Link from "next/link";
import { STATUS_LABEL } from "./labels";

export const SORT_OPTIONS = [
  ["activity", "recent activity"],
  ["priority", "priority"],
  ["health", "health"],
  ["stale", "stalest first"],
  ["name", "name"],
] as const;

export type SortKey = (typeof SORT_OPTIONS)[number][0];

export interface Filters {
  category?: string;
  status?: string;
  health?: string;
  sort?: string;
  view?: string;
}

/** Board URL for a filter combination; every defined key becomes a search param. */
export function boardHref(filters: Filters): string {
  const params = new URLSearchParams();
  if (filters.category) params.set("category", filters.category);
  if (filters.status) params.set("status", filters.status);
  if (filters.health) params.set("health", filters.health);
  if (filters.sort && filters.sort !== "activity") params.set("sort", filters.sort);
  if (filters.view) params.set("view", filters.view);
  const s = params.toString();
  return s ? `/?${s}` : "/";
}

/** A segmented pill group — the same control language as the panel's rendered/raw switch. */
function Segmented({ options }: { options: { key: string; href: string; label: string; active: boolean }[] }) {
  return (
    <div className="flex items-center gap-0.5 rounded-pill bg-surface-2 p-0.5">
      {options.map((option) => (
        <Link
          key={option.key}
          href={option.href}
          aria-current={option.active ? "true" : undefined}
          className={`rounded-pill px-2.5 py-1 text-meta font-medium capitalize transition-colors ${
            option.active ? "bg-surface text-ink" : "text-muted hover:text-ink-2"
          }`}
        >
          {option.label}
        </Link>
      ))}
    </div>
  );
}

const HEALTH_OPTIONS = [
  ["green", "on track"],
  ["amber", "at risk"],
  ["red", "off track"],
] as const;

/**
 * One contained toolbar rather than four loose rows of chips. Status and
 * category are segmented groups; health and sort collapse into dropdowns that
 * show the active choice, so the bar stays one line at any filter count.
 */
export function FilterBar({ filters, categories }: { filters: Filters; categories: string[] }) {
  const sort = (filters.sort as SortKey) || "activity";
  const sortLabel = SORT_OPTIONS.find(([key]) => key === sort)?.[1] ?? "recent activity";
  const healthLabel = HEALTH_OPTIONS.find(([key]) => key === filters.health)?.[1];

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-card border border-hairline bg-surface p-2">
      <Segmented
        options={[
          { key: "all", href: boardHref({ ...filters, status: undefined }), label: "All", active: !filters.status },
          ...(["active", "blocked", "on_hold", "done"] as const).map((status) => ({
            key: status,
            href: boardHref({ ...filters, status: filters.status === status ? undefined : status }),
            label: STATUS_LABEL[status],
            active: filters.status === status,
          })),
        ]}
      />

      {categories.length > 1 && (
        <>
          <span className="h-5 w-px bg-hairline" aria-hidden />
          <Segmented
            options={[
              { key: "all", href: boardHref({ ...filters, category: undefined }), label: "Any", active: !filters.category },
              ...categories.map((category) => ({
                key: category,
                href: boardHref({ ...filters, category: filters.category === category ? undefined : category }),
                label: category,
                active: filters.category === category,
              })),
            ]}
          />
        </>
      )}

      <div className="ml-auto flex items-center gap-2">
        <Dropdown label="Health" value={healthLabel ?? "any"} active={Boolean(filters.health)}>
          <MenuLink href={boardHref({ ...filters, health: undefined })} active={!filters.health}>
            any
          </MenuLink>
          {HEALTH_OPTIONS.map(([key, label]) => (
            <MenuLink
              key={key}
              href={boardHref({ ...filters, health: filters.health === key ? undefined : key })}
              active={filters.health === key}
            >
              {label}
            </MenuLink>
          ))}
        </Dropdown>

        <Dropdown label="Sort" value={sortLabel} active={sort !== "activity"}>
          {SORT_OPTIONS.map(([key, label]) => (
            <MenuLink key={key} href={boardHref({ ...filters, sort: key })} active={sort === key}>
              {label}
            </MenuLink>
          ))}
        </Dropdown>
      </div>
    </div>
  );
}

/** Native disclosure, so the menu works without JavaScript like the rest of the board. */
function Dropdown({
  label,
  value,
  active,
  children,
}: {
  label: string;
  value: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className="group relative">
      <summary
        className={`flex cursor-pointer list-none items-center gap-1.5 rounded-control border border-hairline px-2.5 py-1 text-meta transition-colors hover:border-muted [&::-webkit-details-marker]:hidden ${
          active ? "text-ink" : "text-ink-2"
        }`}
      >
        <span className="text-muted">{label}</span>
        <span className="font-medium">{value}</span>
        <span aria-hidden className="text-muted transition-transform group-open:rotate-180">
          ⌄
        </span>
      </summary>
      <div className="absolute right-0 z-20 mt-1 flex min-w-40 flex-col rounded-control border border-hairline bg-surface p-1 shadow-lg">
        {children}
      </div>
    </details>
  );
}

function MenuLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`rounded-chip px-2.5 py-1.5 text-meta transition-colors ${
        active ? "bg-accent/15 text-accent" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}
