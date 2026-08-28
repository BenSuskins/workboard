"use client";

/**
 * A form control that submits its form when its value changes. It is what turns
 * a native `<select>` or date input into a rail row you can just set — one
 * gesture, no Save button — while the write stays an ordinary server action.
 */
export function AutoSubmit({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="contents"
      onChange={(event) => {
        const target = event.target as HTMLElement & { form?: HTMLFormElement };
        target.form?.requestSubmit();
      }}
    >
      {children}
    </span>
  );
}
