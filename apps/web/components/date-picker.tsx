"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** `YYYY-MM-DD` parsed as a local day. `new Date(iso)` would read it as UTC and drift. */
function parseDay(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function formatDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** The Monday on or before the 1st, so every month starts on a full week. */
function gridStart(month: Date): Date {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const weekday = (first.getDay() + 6) % 7;
  return new Date(first.getFullYear(), first.getMonth(), 1 - weekday);
}

const shift = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

/**
 * A date field that opens a month grid rather than the OS calendar.
 *
 * Keyboard is the grid's whole point: arrows move a day, PageUp/PageDown move a
 * month, Home/End jump to the ends of the week, Enter commits the focused day
 * and Backspace clears the field. Focus stays on the grid and the focused day is
 * named through `aria-activedescendant`, so a screen reader reads the date being
 * moved over rather than announcing 42 buttons.
 */
export function DatePicker({
  value,
  onSelect,
  label,
  placeholder = "No due date",
  tone = "",
}: {
  value: string;
  onSelect: (value: string) => void;
  label: string;
  placeholder?: string;
  tone?: string;
}) {
  const selected = value ? parseDay(value) : null;
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState<Date>(selected ?? new Date());
  const [rect, setRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  const openPanel = () => {
    setRect(triggerRef.current?.getBoundingClientRect() ?? null);
    setCursor(selected ?? new Date());
    setOpen(true);
  };

  const commit = (date: Date | null) => {
    close();
    onSelect(date ? formatDay(date) : "");
  };

  useLayoutEffect(() => {
    if (open) gridRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: MouseEvent) => {
      if (!gridRef.current?.closest("[data-datepanel]")?.contains(event.target as Node) && !triggerRef.current?.contains(event.target as Node)) {
        close(false);
      }
    };
    const away = () => close(false);
    document.addEventListener("mousedown", dismiss);
    window.addEventListener("scroll", away, true);
    window.addEventListener("resize", away);
    return () => {
      document.removeEventListener("mousedown", dismiss);
      window.removeEventListener("scroll", away, true);
      window.removeEventListener("resize", away);
    };
  }, [open]);

  const start = gridStart(cursor);
  const days = Array.from({ length: 42 }, (_, index) => shift(start, index));
  const today = new Date();
  const below = rect ? window.innerHeight - rect.bottom > 320 : true;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
        onClick={() => (open ? close() : openPanel())}
        className={`flex w-full min-w-0 items-center rounded-chip border border-transparent px-1 py-0.5 text-left text-label font-medium outline-none transition-colors hover:border-hairline hover:bg-surface focus-visible:border-accent focus-visible:bg-surface ${
          selected ? tone || "text-ink-2" : "text-muted"
        }`}
      >
        <span className="truncate">
          {selected
            ? selected.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
            : placeholder}
        </span>
      </button>

      {open && rect && (
        <div
          data-datepanel
          style={{
            position: "fixed",
            left: Math.min(rect.left, window.innerWidth - 260),
            top: below ? rect.bottom + 4 : undefined,
            bottom: below ? undefined : window.innerHeight - rect.top + 4,
          }}
          className="z-50 w-[244px] rounded-control border border-hairline bg-surface p-2 shadow-lg"
        >
          <div className="flex items-center gap-1 px-1 pb-1.5">
            <span className="text-meta font-medium text-ink">
              {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
            </span>
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
              className="ml-auto grid size-6 place-items-center rounded-chip text-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
              className="grid size-6 place-items-center rounded-chip text-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 gap-px pb-1" aria-hidden>
            {WEEKDAYS.map((day) => (
              <span key={day} className="grid h-6 place-items-center text-micro text-muted">
                {day}
              </span>
            ))}
          </div>

          <div
            ref={gridRef}
            role="grid"
            tabIndex={-1}
            aria-label={label}
            aria-activedescendant={`day-${formatDay(cursor)}`}
            onKeyDown={(event) => {
              const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
              if (event.key in moves) {
                event.preventDefault();
                setCursor((current) => shift(current, moves[event.key]));
              } else if (event.key === "PageUp" || event.key === "PageDown") {
                event.preventDefault();
                setCursor((current) => new Date(current.getFullYear(), current.getMonth() + (event.key === "PageUp" ? -1 : 1), current.getDate()));
              } else if (event.key === "Home" || event.key === "End") {
                event.preventDefault();
                setCursor((current) => shift(current, (event.key === "Home" ? 0 : 6) - ((current.getDay() + 6) % 7)));
              } else if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                commit(cursor);
              } else if (event.key === "Backspace" || event.key === "Delete") {
                event.preventDefault();
                commit(null);
              } else if (event.key === "Escape") {
                event.preventDefault();
                close();
              } else if (event.key === "Tab") {
                close(false);
              }
            }}
            className="grid grid-cols-7 gap-px outline-none"
          >
            {days.map((day) => {
              const outside = day.getMonth() !== cursor.getMonth();
              const isSelected = selected && sameDay(day, selected);
              const isCursor = sameDay(day, cursor);
              return (
                <button
                  key={formatDay(day)}
                  id={`day-${formatDay(day)}`}
                  type="button"
                  role="gridcell"
                  tabIndex={-1}
                  aria-selected={Boolean(isSelected)}
                  aria-label={day.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}
                  onClick={() => commit(day)}
                  className={`grid h-7 place-items-center rounded-chip text-meta tabular-nums transition-colors ${
                    isSelected
                      ? "bg-accent font-medium text-on-accent"
                      : isCursor
                        ? "bg-surface-2 text-ink ring-1 ring-accent/50"
                        : outside
                          ? "text-muted/60 hover:bg-surface-2"
                          : "text-ink-2 hover:bg-surface-2"
                  } ${!isSelected && sameDay(day, today) ? "font-semibold text-accent" : ""}`}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => commit(null)}
            className="mt-1.5 w-full rounded-chip px-2.5 py-1.5 text-left text-meta text-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            Clear
          </button>
        </div>
      )}
    </>
  );
}
