"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

export interface PickerOption {
  value: string;
  label: string;
  /** A background class for the 7px state dot, when the value carries state. */
  dot?: string;
}

/**
 * A value picker: a quiet trigger that opens a designed panel of options.
 *
 * This is the ARIA listbox pattern rather than a menu — the control names a
 * value and the panel is that value's alternatives, so options carry
 * `aria-selected` and the active one is tracked by `aria-activedescendant`
 * while focus stays on the list.
 *
 * The panel is `position: fixed` and placed from the trigger's rect, because
 * the rail it lives in is a scroll container and an absolutely positioned
 * panel would be clipped by it. Scrolling or resizing closes the panel rather
 * than chasing the trigger — a picker is open for a moment, not a session.
 *
 * It wears the chrome of `filter-controls.tsx`'s Dropdown deliberately. That
 * one stays a `<details>` of links, because a filter is a URL and its menu
 * must work without JavaScript; this one sets a value. Two mechanisms, one
 * appearance — a menu should not look like two different things.
 */
export function Picker({
  value,
  options,
  onSelect,
  label,
  placeholder = "None",
  tone = "",
}: {
  value: string;
  options: PickerOption[];
  onSelect: (value: string) => void;
  /** Names the control for screen readers — the rail's visible label is separate. */
  label: string;
  placeholder?: string;
  /** Extra classes for the trigger's text, e.g. a due date in `text-warning`. */
  tone?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const selected = options.find((option) => option.value === value);

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  const openPanel = () => {
    setRect(triggerRef.current?.getBoundingClientRect() ?? null);
    setActive(Math.max(0, options.findIndex((option) => option.value === value)));
    setOpen(true);
  };

  const choose = (index: number) => {
    const option = options[index];
    close();
    if (option && option.value !== value) onSelect(option.value);
  };

  // Focus the list once it exists, so the arrow keys land somewhere.
  useLayoutEffect(() => {
    if (open) listRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: MouseEvent) => {
      if (
        !listRef.current?.contains(event.target as Node) &&
        !triggerRef.current?.contains(event.target as Node)
      ) {
        close(false);
      }
    };
    const away = () => close(false);
    document.addEventListener("mousedown", dismiss);
    // Capture: the rail scrolls, not the window, so a bubbling listener misses it.
    window.addEventListener("scroll", away, true);
    window.addEventListener("resize", away);
    return () => {
      document.removeEventListener("mousedown", dismiss);
      window.removeEventListener("scroll", away, true);
      window.removeEventListener("resize", away);
    };
  }, [open]);

  // Below the trigger, unless the panel would run off the bottom.
  const height = Math.min(options.length, 8) * 30 + 8;
  const below = rect ? window.innerHeight - rect.bottom > height + 8 : true;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => (open ? close() : openPanel())}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            openPanel();
          }
        }}
        className={`flex w-full min-w-0 items-center gap-1.5 rounded-chip border border-transparent px-1 py-0.5 text-left text-label font-medium outline-none transition-colors hover:border-hairline hover:bg-surface focus-visible:border-accent focus-visible:bg-surface ${
          selected ? "text-ink-2" : "text-muted"
        } ${tone}`}
      >
        {selected?.dot && <span className={`size-[7px] flex-none rounded-pill ${selected.dot}`} aria-hidden />}
        <span className="truncate">{selected?.label ?? placeholder}</span>
      </button>

      {open && rect && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-label={label}
          aria-activedescendant={`${listId}-${active}`}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              close();
            } else if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((current) => (current + 1) % options.length);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((current) => (current - 1 + options.length) % options.length);
            } else if (event.key === "Home") {
              event.preventDefault();
              setActive(0);
            } else if (event.key === "End") {
              event.preventDefault();
              setActive(options.length - 1);
            } else if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              choose(active);
            } else if (event.key === "Tab") {
              close(false);
            }
          }}
          style={{
            position: "fixed",
            left: Math.min(rect.left, window.innerWidth - Math.max(rect.width, 168) - 8),
            top: below ? rect.bottom + 4 : undefined,
            bottom: below ? undefined : window.innerHeight - rect.top + 4,
            minWidth: Math.max(rect.width, 168),
          }}
          className="z-50 flex max-h-72 flex-col overflow-y-auto rounded-control border border-hairline bg-surface p-1 shadow-lg outline-none"
        >
          {options.map((option, index) => (
            <li
              key={option.value}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={option.value === value}
              onMouseEnter={() => setActive(index)}
              onClick={() => choose(index)}
              className={`flex cursor-pointer items-center gap-2 rounded-chip px-2.5 py-1.5 text-meta transition-colors ${
                index === active ? "bg-surface-2" : ""
              } ${option.value === value ? "font-medium text-accent" : "text-ink-2"}`}
            >
              {option.dot ? (
                <span className={`size-[7px] flex-none rounded-pill ${option.dot}`} aria-hidden />
              ) : (
                <span className="size-[7px] flex-none" aria-hidden />
              )}
              <span className="truncate">{option.label}</span>
              {option.value === value && (
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="ml-auto flex-none text-accent"
                  aria-hidden
                >
                  <path d="m3.5 8.5 3 3 6-7" />
                </svg>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
