import React, { useEffect, useState } from "react";
import { Icon, ICONS } from "./icons.jsx";

const STORAGE_KEY = "orac-theme";

function readTheme() {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return "light";
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState(readTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const isDark = theme === "dark";
  return <button type="button" onClick={() => setTheme(isDark ? "light" : "dark")} className="theme-toggle inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 transition hover:border-orac-blue hover:text-orac-blue focus:outline-none focus:ring-2 focus:ring-orac-blue/30" aria-label={isDark ? "Use light theme" : "Use dark theme"} title={isDark ? "Use light theme" : "Use dark theme"}><Icon path={isDark ? ICONS.sun : ICONS.moon} className="h-4 w-4" /></button>;
}
