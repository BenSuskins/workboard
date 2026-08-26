"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { refreshAllAction } from "@/lib/actions";
import { toggleTheme } from "./theme-toggle";

interface PaletteProject {
  slug: string;
  name: string;
  category: string;
  status: string;
  health: string;
}

interface Item {
  key: string;
  label: string;
  hint: string;
  run: () => void | Promise<void>;
}

/** Anything can ask for the palette without owning its state. */
export const OPEN_PALETTE_EVENT = "wb:open-palette";

export function openPalette() {
  window.dispatchEvent(new Event(OPEN_PALETTE_EVENT));
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [projects, setProjects] = useState<PaletteProject[] | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setSelected(0);
  }, []);

  // global ⌘K / Ctrl+K, plus the sidebar's search field asking for it by name
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        close();
      }
    };
    const onRequest = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_PALETTE_EVENT, onRequest);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_PALETTE_EVENT, onRequest);
    };
  }, [close]);

  // lazy project index, refreshed each time the palette opens
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    fetch("/api/palette")
      .then((r) => r.json())
      .then((data: { projects: PaletteProject[] }) => setProjects(data.projects))
      .catch(() => setProjects([]));
  }, [open]);

  const go = useCallback(
    (path: string) => {
      close();
      router.push(path);
    },
    [close, router],
  );

  const commands: Item[] = [
    { key: "cmd-board", label: "Go to Board", hint: "navigate", run: () => go("/") },
    { key: "cmd-inbox", label: "Go to Inbox", hint: "navigate", run: () => go("/inbox") },
    { key: "cmd-prs", label: "Go to Pull requests", hint: "navigate", run: () => go("/prs") },
    { key: "cmd-digests", label: "Go to Digests", hint: "reports", run: () => go("/reports/digest") },
    { key: "cmd-triage", label: "Go to Triage", hint: "reports", run: () => go("/reports/triage") },
    {
      key: "cmd-accomplishments",
      label: "Go to Accomplishments",
      hint: "reports",
      run: () => go("/reports/accomplishments"),
    },
    { key: "cmd-new", label: "New project", hint: "create", run: () => go("/projects/new") },
    {
      key: "cmd-refresh",
      label: busy ? "Refreshing…" : "Refresh data",
      hint: "sync GitHub / Jira / Docs",
      run: async () => {
        setBusy(true);
        try {
          await refreshAllAction();
        } finally {
          setBusy(false);
          close();
          router.refresh();
        }
      },
    },
    { key: "cmd-theme", label: "Toggle theme", hint: "light / dark", run: () => (toggleTheme(), close()) },
  ];

  const q = query.trim().toLowerCase();
  const projectItems: Item[] = (projects ?? [])
    .filter((p) => !q || `${p.name} ${p.category} ${p.slug} ${p.status}`.toLowerCase().includes(q))
    .slice(0, 8)
    .map((p) => ({
      key: `proj-${p.slug}`,
      label: p.name,
      hint: `${p.category} · ${p.status.replace("_", " ")}`,
      run: () => go(`/projects/${p.slug}`),
    }));
  const commandItems = commands.filter((c) => !q || c.label.toLowerCase().includes(q));
  const items = q ? [...projectItems, ...commandItems] : [...commandItems, ...projectItems];
  const active = Math.min(selected, Math.max(items.length - 1, 0));

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[15vh]" onMouseDown={close} role="dialog" aria-modal>
      <div
        className="w-full max-w-lg overflow-hidden rounded-card border border-hairline bg-surface shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setSelected((s) => Math.min(s + 1, items.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setSelected((s) => Math.max(s - 1, 0));
            } else if (e.key === "Enter" && items[active]) {
              e.preventDefault();
              void items[active].run();
            }
          }}
          placeholder="Jump to a project or run a command…"
          className="w-full border-b border-hairline bg-transparent px-4 py-3 text-body text-ink placeholder:text-muted focus:outline-none"
        />
        <ul className="max-h-72 overflow-y-auto p-1.5">
          {items.length === 0 && <li className="px-3 py-6 text-center text-body text-muted">No matches.</li>}
          {items.map((item, i) => (
            <li key={item.key}>
              <button
                type="button"
                onMouseEnter={() => setSelected(i)}
                onClick={() => void item.run()}
                className={`flex w-full items-center justify-between gap-3 rounded-control px-3 py-2 text-left text-body ${
                  i === active ? "bg-accent/15 text-ink" : "text-ink-2"
                }`}
              >
                <span className="truncate">{item.label}</span>
                <span className="shrink-0 text-meta text-muted">{item.hint}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="border-t border-hairline px-3 py-1.5 text-[10px] text-muted">↑↓ navigate · Enter select · Esc close</div>
      </div>
    </div>
  );
}

