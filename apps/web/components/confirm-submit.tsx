"use client";

/**
 * A submit button for a destructive, irreversible action. The repo has no
 * confirm helper yet — this is the first one, kept generic enough to reuse
 * wherever a form write cannot be undone.
 */
export function ConfirmSubmit({
  message,
  className,
  children,
}: {
  message: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(event) => {
        if (!confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
