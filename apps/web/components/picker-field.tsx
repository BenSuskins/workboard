"use client";

import { useState } from "react";
import { DatePicker } from "./date-picker";
import { Picker, type PickerOption } from "./picker";

/**
 * A picker standing in for a `<select>` inside an ordinary server-rendered
 * form. The chosen value rides a hidden input, so the form still submits to its
 * server action with the same field name and nothing about the write changes —
 * only the control the person uses to set it.
 */
export function PickerField({
  name,
  defaultValue,
  options,
  label,
  placeholder,
}: {
  name: string;
  defaultValue: string;
  options: PickerOption[];
  label: string;
  placeholder?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  return (
    <span className="relative flex w-full rounded-control border border-hairline bg-surface-2 px-2 py-1.5 transition-colors hover:border-grid focus-within:border-accent">
      <input type="hidden" name={name} value={value} />
      <Picker label={label} value={value} options={options} onSelect={setValue} placeholder={placeholder} />
      <span className="pointer-events-none grid place-items-center pl-1 text-muted" aria-hidden>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="m4 6.5 4 4 4-4" />
        </svg>
      </span>
    </span>
  );
}

/** The date equivalent, for forms that carry a due date. */
export function DateField({
  name,
  defaultValue,
  label,
  placeholder,
}: {
  name: string;
  defaultValue: string;
  label: string;
  placeholder?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  return (
    <span className="relative flex w-full rounded-control border border-hairline bg-surface-2 px-2 py-1.5 transition-colors hover:border-grid focus-within:border-accent">
      <input type="hidden" name={name} value={value} />
      <DatePicker label={label} value={value} onSelect={setValue} placeholder={placeholder} />
    </span>
  );
}
