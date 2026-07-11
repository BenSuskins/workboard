import Link from "next/link";

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
}

function chip(href: string, label: string, active: boolean, key?: string) {
  return (
    <Link
      key={key ?? label}
      href={href}
      className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
        active ? "border-accent bg-accent/15 text-accent" : "border-hairline text-ink-2 hover:border-muted hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );
}

function qs(filters: Filters): string {
  const params = new URLSearchParams();
  if (filters.category) params.set("category", filters.category);
  if (filters.status) params.set("status", filters.status);
  if (filters.health) params.set("health", filters.health);
  if (filters.sort && filters.sort !== "activity") params.set("sort", filters.sort);
  const s = params.toString();
  return s ? `/?${s}` : "/";
}

export function FilterBar({ filters, categories }: { filters: Filters; categories: string[] }) {
  const sort = (filters.sort as SortKey) || "activity";
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {chip(qs({ ...filters, category: undefined }), "All", !filters.category)}
          {categories.map((c) =>
            chip(qs({ ...filters, category: filters.category === c ? undefined : c }), c, filters.category === c, `cat-${c}`),
          )}
        </div>
        <div className="h-4 w-px bg-grid" aria-hidden />
        <div className="flex flex-wrap items-center gap-1.5">
          {(["active", "blocked", "on_hold", "done"] as const).map((s) =>
            chip(
              qs({ ...filters, status: filters.status === s ? undefined : s }),
              s.replace("_", " "),
              filters.status === s,
              `status-${s}`,
            ),
          )}
        </div>
        <div className="h-4 w-px bg-grid" aria-hidden />
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              ["green", "on track"],
              ["amber", "at risk"],
              ["red", "off track"],
            ] as const
          ).map(([h, label]) =>
            chip(qs({ ...filters, health: filters.health === h ? undefined : h }), label, filters.health === h, `health-${h}`),
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] uppercase tracking-wide text-muted">Sort</span>
        {SORT_OPTIONS.map(([key, label]) =>
          chip(qs({ ...filters, sort: key }), label, sort === key, `sort-${key}`),
        )}
      </div>
    </div>
  );
}
