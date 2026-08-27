"use client";

import { useEffect, useState } from "react";
import { DarkModeIcon, LightModeIcon, ThemePendingIcon } from "./sidebar-icons";

export function applyTheme(theme: "light" | "dark") {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("wb-theme", theme);
}

export function currentTheme(): "light" | "dark" {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function toggleTheme(): "light" | "dark" {
  const next = currentTheme() === "dark" ? "light" : "dark";
  applyTheme(next);
  return next;
}

export function ThemeToggle() {
  // theme is only knowable on the client; render a stable placeholder until mounted
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);
  useEffect(() => setTheme(currentTheme()), []);

  return (
    <button
      type="button"
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(toggleTheme())}
      className="grid size-7 place-items-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-ink"
    >
      {theme === null ? <ThemePendingIcon /> : theme === "dark" ? <LightModeIcon /> : <DarkModeIcon />}
    </button>
  );
}
