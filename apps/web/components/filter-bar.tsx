import { Dropdown, MenuLink, PillGroup } from "./filter-controls";
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

/** The lanes a project can be in, in the order work moves through them. */
const LANES = ["active", "blocked", "on_hold", "done"] as const;

/**
 * One row of plain pills, no toolbar around them: lanes, then the categories a
 * project can be scoped to, then the sort pushed right as a quiet ghost menu.
 * Every option is still a link, so a filtered board is a URL and the row works
 * without JavaScript.
 */
export function FilterBar({ filters, categories }: { filters: Filters; categories: string[] }) {
  const sort = (filters.sort as SortKey) || "activity";
  const sortLabel = SORT_OPTIONS.find(([key]) => key === sort)?.[1] ?? "recent activity";

  return (
    <div className="flex items-center gap-3.5">
      <PillGroup
        options={[
          { key: "all", href: boardHref({ ...filters, status: undefined }), label: "All", active: !filters.status },
          ...LANES.map((status) => ({
            key: status,
            href: boardHref({ ...filters, status: filters.status === status ? undefined : status }),
            label: STATUS_LABEL[status],
            active: filters.status === status,
          })),
        ]}
      />

      {categories.length > 1 && (
        <>
          <span className="h-[18px] w-px flex-none bg-hairline" aria-hidden />
          <PillGroup
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

      <div className="ml-auto flex items-center">
        <Dropdown label="Sort" value={sortLabel} active={sort !== "activity"} ghost>
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
