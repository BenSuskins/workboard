import Link from "next/link";

/**
 * The controls a filter bar is built from. The board's bar and the issues bar
 * both draw from here rather than each carrying its own copy: a filter has to
 * read the same wherever it is offered, and the tones are held to the palette's
 * contrast policy in one place instead of two.
 *
 * Every option is a link, so a filtered view is a URL and the menus work without
 * JavaScript — `<details>` is the disclosure, not React state.
 */

export interface FilterOption {
  key: string;
  href: string;
  label: string;
  active: boolean;
}

/** A segmented pill group — the same control language as the panel's rendered/raw switch. */
export function Segmented({ options, capitalize = true }: { options: FilterOption[]; capitalize?: boolean }) {
  return (
    <div className="flex items-center gap-0.5 rounded-pill bg-surface-2 p-0.5">
      {options.map((option) => (
        <Link
          key={option.key}
          href={option.href}
          aria-current={option.active ? "true" : undefined}
          className={`rounded-pill px-2.5 py-1 text-meta font-medium transition-colors ${
            capitalize ? "capitalize" : ""
          } ${option.active ? "bg-surface text-ink" : "text-muted hover:text-ink-2"}`}
        >
          {option.label}
        </Link>
      ))}
    </div>
  );
}

/**
 * The same options with no container at all: the board's filter row is one line
 * of text on the page, so a segmented track around the pills would be a second
 * boundary saying what the active fill already says.
 */
export function PillGroup({ options }: { options: FilterOption[] }) {
  return (
    <div className="flex items-center gap-0.5">
      {options.map((option) => (
        <Link
          key={option.key}
          href={option.href}
          aria-current={option.active ? "true" : undefined}
          className={`rounded-chip px-[11px] py-[5px] text-label font-medium capitalize transition-colors duration-[120ms] ${
            option.active ? "bg-surface-2 text-ink" : "text-muted hover:text-ink"
          }`}
        >
          {option.label}
        </Link>
      ))}
    </div>
  );
}

/** Native disclosure, so the menu works without JavaScript like the rest of the board. */
export function Dropdown({
  label,
  value,
  active,
  ghost = false,
  children,
}: {
  label: string;
  value: string;
  active: boolean;
  /** Borderless, value only — for a filter row that carries no chrome of its own. */
  ghost?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className="group relative">
      <summary
        className={
          ghost
            ? "flex cursor-pointer list-none items-center gap-1.5 rounded-chip px-2 py-[5px] text-label text-muted transition-colors hover:bg-surface-2 hover:text-ink [&::-webkit-details-marker]:hidden"
            : `flex cursor-pointer list-none items-center gap-1.5 rounded-control border border-hairline px-2.5 py-1 text-meta transition-colors hover:border-muted [&::-webkit-details-marker]:hidden ${
                active ? "text-ink" : "text-ink-2"
              }`
        }
      >
        {ghost ? <span className="sr-only">{label}</span> : <span className="text-muted">{label}</span>}
        <span className={ghost ? "capitalize" : "font-medium"}>{value}</span>
        <span aria-hidden className={`transition-transform group-open:rotate-180 ${ghost ? "text-grid" : "text-muted"}`}>
          ⌄
        </span>
      </summary>
      <div className="absolute right-0 z-20 mt-1 flex max-h-72 min-w-40 flex-col overflow-y-auto rounded-control border border-hairline bg-surface p-1 shadow-lg">
        {children}
      </div>
    </details>
  );
}

export function MenuLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`truncate rounded-chip px-2.5 py-1.5 text-meta transition-colors ${
        active ? "bg-accent/15 text-accent" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}

/**
 * A dropdown over a list of filter values. The "any" entry that clears the
 * filter is drawn here rather than passed in, so every filter offers the same
 * way out and the summary only reads as active when something is chosen.
 */
export function OptionsDropdown({
  label,
  anyLabel,
  clearHref,
  options,
  ghost = false,
}: {
  label: string;
  /** The value shown, and the entry offered, when nothing is chosen. */
  anyLabel: string;
  clearHref: string;
  options: FilterOption[];
  /** Borderless, value only — for a filter row that carries no chrome of its own. */
  ghost?: boolean;
}) {
  const chosen = options.find((option) => option.active);
  return (
    <Dropdown label={label} value={chosen?.label ?? anyLabel} active={Boolean(chosen)} ghost={ghost}>
      <MenuLink href={clearHref} active={!chosen}>
        {anyLabel}
      </MenuLink>
      {options.map((option) => (
        <MenuLink key={option.key} href={option.href} active={option.active}>
          {option.label}
        </MenuLink>
      ))}
    </Dropdown>
  );
}
