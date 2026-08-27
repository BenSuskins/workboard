"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface ResizeSpec {
  /** localStorage key holding the last width, in px. */
  storageKey: string;
  /** Custom property on <html> that the layout sizes itself from. */
  cssVar: string;
  /** Width to fall back to, and to return to on a double-click. */
  defaultWidth: number;
  min: number;
  /** Upper bound — a function when it depends on the viewport. */
  max: number | (() => number);
  /** The edge the handle sits on, which decides which way a drag grows the pane. */
  edge: "left" | "right";
  label: string;
  /** Positioning for the hit area; the rest of the styling is fixed. */
  className?: string;
}

/**
 * A drag handle that sizes a pane through a CSS custom property rather than
 * React state: only this component re-renders while you drag, and the pane it
 * sizes keeps whatever width the pre-paint script already gave it.
 */
export function ResizeHandle({ className = "", ...spec }: ResizeSpec) {
  const specRef = useRef(spec);
  specRef.current = spec;
  const ceilingRef = useRef(typeof spec.max === "number" ? spec.max : spec.defaultWidth);
  const widthRef = useRef(spec.defaultWidth);
  const [width, setWidth] = useState(spec.defaultWidth);
  const [ceiling, setCeiling] = useState(ceilingRef.current);
  const draggingRef = useRef(false);
  const [dragging, setDragging] = useState(false);

  const clamp = useCallback((value: number) => {
    const { min, max } = specRef.current;
    ceilingRef.current = Math.max(min, typeof max === "function" ? max() : max);
    return Math.min(Math.max(Math.round(value), min), ceilingRef.current);
  }, []);

  const apply = useCallback(
    (value: number, remember: boolean) => {
      const next = clamp(value);
      document.documentElement.style.setProperty(specRef.current.cssVar, `${next}px`);
      widthRef.current = next;
      setWidth(next);
      setCeiling(ceilingRef.current);
      try {
        if (remember) localStorage.setItem(specRef.current.storageKey, String(next));
      } catch {
        // A blocked store costs the memory of the width, not the drag.
      }
      return next;
    },
    [clamp],
  );

  // The pre-paint script already applied the saved width; read it back, and
  // re-clamp when the viewport shrinks under what was saved on a wider screen.
  useEffect(() => {
    let saved = specRef.current.defaultWidth;
    try {
      const stored = Number.parseInt(localStorage.getItem(specRef.current.storageKey) ?? "", 10);
      if (Number.isFinite(stored) && stored > 0) saved = stored;
    } catch {
      // Fall through to the default.
    }
    apply(saved, false);
    const onResize = () => apply(widthRef.current, false);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [apply]);

  /** Pointer x → pane width, measured from whichever screen edge the pane is pinned to. */
  const widthAt = useCallback((clientX: number) => {
    return specRef.current.edge === "right" ? clientX : window.innerWidth - clientX;
  }, []);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      const handle = event.currentTarget;
      handle.setPointerCapture(event.pointerId);
      draggingRef.current = true;
      setDragging(true);
      // Suppresses the width transition and text selection for the whole drag.
      document.documentElement.dataset.resizing = "true";

      const onMove = (moveEvent: PointerEvent) => apply(widthAt(moveEvent.clientX), true);
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        delete document.documentElement.dataset.resizing;
        draggingRef.current = false;
        setDragging(false);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [apply, widthAt],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      // Arrows move the handle itself, so "grow" is left for a pane on the right.
      const towardsWider = specRef.current.edge === "right" ? "ArrowRight" : "ArrowLeft";
      const towardsNarrower = specRef.current.edge === "right" ? "ArrowLeft" : "ArrowRight";
      const step = event.shiftKey ? 48 : 12;
      // Held arrows would otherwise smear through the collapse transition.
      document.documentElement.dataset.resizing = "true";
      if (event.key === towardsWider) apply(widthRef.current + step, true);
      else if (event.key === towardsNarrower) apply(widthRef.current - step, true);
      else if (event.key === "Home") apply(specRef.current.min, true);
      else if (event.key === "End") apply(ceilingRef.current, true);
      else if (event.key === "Enter" || event.key === " ") apply(specRef.current.defaultWidth, true);
      else {
        delete document.documentElement.dataset.resizing;
        return;
      }
      event.preventDefault();
    },
    [apply],
  );

  /** The rail animates again once the keys are done — the collapse toggle still wants it. */
  const endKeyboardResize = useCallback(() => {
    if (!draggingRef.current) delete document.documentElement.dataset.resizing;
  }, []);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={spec.label}
      aria-valuenow={width}
      aria-valuemin={spec.min}
      aria-valuemax={ceiling}
      tabIndex={0}
      title={`${spec.label} — drag, or double-click to reset`}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      onKeyUp={endKeyboardResize}
      onBlur={endKeyboardResize}
      onDoubleClick={() => apply(specRef.current.defaultWidth, true)}
      className={`group absolute inset-y-0 z-20 w-2 cursor-col-resize touch-none outline-none ${className}`}
    >
      <span
        aria-hidden
        className={`absolute inset-y-0 w-[2px] transition-colors ${spec.edge === "right" ? "right-0" : "left-0"} ${
          dragging ? "bg-accent" : "bg-transparent group-hover:bg-accent/60 group-focus-visible:bg-accent"
        }`}
      />
    </div>
  );
}
