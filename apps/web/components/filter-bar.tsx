import { Dropdown, MenuLink, Segmented } from "./filter-controls";
import { boardHref, type Filters } from "@/lib/board-filters";
import { STATUS_LABEL } from "./labels";

export const SORT_OPTIONS = [
  ["activity", "recent activity"],
  ["priority", "priority"],
  ["health", "health"],
  ["stale", "stalest first"],
  ["name", "name"],
] as const;

export type SortKey = (typeof SORT_OPTIONS)[number][0];

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
