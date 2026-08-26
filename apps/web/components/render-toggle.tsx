"use client";

import { useState } from "react";
import { Markdown } from "./markdown";

/**
 * Rendered / raw switch for a post body. Agents write this markdown, so seeing
 * the source is how you tell a rendering problem from an authoring one.
 */
export function RenderToggle({ body }: { body: string }) {
  const [raw, setRaw] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <div className="inline-flex rounded-pill border border-hairline bg-surface-2 p-0.5 text-meta">
          {[
            { label: "rendered", value: false },
            { label: "raw", value: true },
          ].map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={() => setRaw(option.value)}
              aria-pressed={raw === option.value}
              className={`rounded-pill px-3 py-1 transition-colors ${
                raw === option.value ? "bg-surface text-ink" : "text-muted hover:text-ink-2"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      {raw ? (
        <pre className="overflow-x-auto rounded-control border border-hairline bg-surface-2 p-4 font-mono text-[0.8125rem] leading-relaxed text-ink-2">
          {body}
        </pre>
      ) : (
        <div className="prose-wb">
          <Markdown>{body}</Markdown>
        </div>
      )}
    </div>
  );
}
