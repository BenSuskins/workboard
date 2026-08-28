"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ResizeHandle } from "./resize-handle";

/**
 * The slide-over detail view. It renders only on soft navigation, through the
 * @panel intercepting route — a hard load or the Expand control lands on the
 * real page instead, so every panel URL stays linkable and refreshable.
 */
export function Panel({
  title,
  href,
  breadcrumb,
  actions,
  children,
}: {
  title: string;
  /** The full page this panel stands in for. */
  href: string;
  breadcrumb?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);

  /**
   * A server action can redirect out from under an intercepted route — creating
   * a task sends you back to the board. Next keeps the parallel-route slot
   * mounted through that, leaving an invisible scrim over the page that eats
   * every click, so the panel drops itself once the URL has moved on.
   */
  const stale = pathname !== href.split("?")[0];

  useEffect(() => {
    if (stale) return;
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        router.back();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    // The board behind the panel must not scroll under it.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [router, stale]);

  if (stale) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button
        type="button"
        aria-label="Close panel"
        onClick={() => router.back()}
        className="wb-scrim absolute inset-0 bg-overlay backdrop-blur-[2px]"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="wb-panel relative flex h-full max-w-full flex-col border-l border-hairline bg-page outline-none"
        style={{ width: "var(--wb-panel-w)" }}
      >
        <ResizeHandle
          label="Resize panel"
          storageKey="wb-panel-width"
          cssVar="--wb-panel-w"
          defaultWidth={672}
          min={360}
          // Leave a strip of the page behind the panel to click away on.
          max={() => Math.min(1200, window.innerWidth - 120)}
          edge="left"
          className="-left-1"
        />
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-hairline px-4">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Close"
            className="grid size-8 place-items-center rounded-control text-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            ✕
          </button>
          {breadcrumb}
          <div className="ml-auto flex items-center gap-1.5">
            {actions}
            {/* A plain anchor, not <Link>: the panel already sits at `href`, so a
                soft navigation there resolves to the same route and the
                interceptor simply re-renders the panel. Only a document load
                leaves the intercepting route and reaches the real page. */}
            <a
              href={href}
              aria-label="Open full page"
              title="Open full page"
              className="grid size-8 place-items-center rounded-control text-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              ⤢
            </a>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>
  );
}
