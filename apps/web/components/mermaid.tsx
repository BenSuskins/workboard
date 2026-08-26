"use client";

import { useEffect } from "react";

/**
 * Draws any ```mermaid fences on the page. Mermaid is a large dependency, so it
 * is imported only once a diagram is actually present — a page without one
 * downloads nothing. Mount this on any page that renders user or agent markdown.
 */
export function Mermaid() {
  useEffect(() => {
    let cancelled = false;

    async function draw() {
      const nodes = Array.from(document.querySelectorAll<HTMLElement>(".wb-mermaid"));
      if (nodes.length === 0) return;

      const mermaid = (await import("mermaid")).default;
      if (cancelled) return;

      const dark = document.documentElement.dataset.theme === "dark";
      mermaid.initialize({
        startOnLoad: false,
        // Agent-authored text reaches the renderer, so labels are sanitized rather than trusted.
        securityLevel: "strict",
        theme: dark ? "dark" : "default",
        fontFamily: "var(--font-sans), ui-sans-serif, system-ui",
      });

      for (const [index, node] of nodes.entries()) {
        const source = node.dataset.src ?? node.querySelector(".wb-mermaid-src")?.textContent ?? "";
        if (!source.trim()) continue;
        node.dataset.src = source;
        try {
          const { svg } = await mermaid.render(`wb-diagram-${index}-${Date.now()}`, source);
          if (cancelled) return;
          node.innerHTML = svg;
          node.dataset.rendered = "true";
        } catch (err) {
          // A malformed diagram must not blank the post it lives in.
          node.dataset.rendered = "error";
          node.innerHTML = `<pre class="wb-mermaid-src">${source.replace(/</g, "&lt;")}</pre>`;
          console.warn("[workboard] mermaid render failed", err);
        }
      }
    }

    void draw();
    const observer = new MutationObserver(() => {
      for (const node of document.querySelectorAll<HTMLElement>(".wb-mermaid")) {
        if (node.dataset.rendered === "true") delete node.dataset.rendered;
      }
      void draw();
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, []);

  return null;
}
