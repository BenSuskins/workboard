"use client";

import { useFormStatus } from "react-dom";

function Inner({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-lg border border-hairline px-3 py-1.5 text-sm text-ink-2 transition-colors hover:border-muted hover:text-ink disabled:cursor-wait disabled:opacity-60"
    >
      <span className={pending ? "inline-block animate-spin" : ""} aria-hidden>
        ↻
      </span>
      {pending ? "Refreshing…" : label}
    </button>
  );
}

/** Submit button with a pending spinner — syncs can take a few seconds against real APIs. */
export function RefreshButton({ action, label = "Refresh" }: { action: () => Promise<void>; label?: string }) {
  return (
    <form action={action}>
      <Inner label={label} />
    </form>
  );
}
