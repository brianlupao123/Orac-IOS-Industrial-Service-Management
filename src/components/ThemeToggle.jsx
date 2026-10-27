import React, { useEffect, useState } from "react";
import { Icon, ICONS } from "./icons.jsx";

const STORAGE_KEY = "orac-theme";

export function readStoredTheme() {
  if (typeof window === "undefined") return "light";
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // fallback if localStorage is unavailable
  }
  return "light";
}

export function applyStoredTheme() {
  if (typeof window === "undefined" || typeof document === "undefined") return "light";
  const theme = readStoredTheme();
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle("dark", theme === "dark");
  return theme;
}

function setStoredTheme(theme) {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // fallback if localStorage is unavailable
  }
}

export default function ThemeToggle({ inMenu = false, className = "" }) {
  const [theme, setTheme] = useState(readStoredTheme);

  useEffect(() => {
    applyStoredTheme();
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setStoredTheme(nextTheme);
    setTheme(nextTheme);
  };

  const isDark = theme === "dark";
  const label = isDark ? "Switch to light theme" : "Switch to dark theme";

  if (inMenu) {
    return (
      <button
        type="button"
        role="menuitem"
        onClick={toggleTheme}
        className={`flex w-full items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-slate-100 dark:text-gray-300 dark:hover:bg-slate-800 rounded transition-colors ${className}`}
        aria-label={label}
      >
        <span className="flex items-center gap-2">
          <Icon path={isDark ? ICONS.sun : ICONS.moon} className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          <span>{isDark ? "Light Mode" : "Dark Mode"}</span>
        </span>
        <span className="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-500">
          {isDark ? "Dark" : "Light"}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`theme-toggle inline-flex h-11 w-11 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 transition hover:border-orac-blue hover:text-orac-blue focus:outline-none focus:ring-2 focus:ring-orac-blue/30 ${className}`}
      aria-label={label}
      title={label}
    >
      <Icon path={isDark ? ICONS.sun : ICONS.moon} className="h-4 w-4" />
    </button>
  );
}
