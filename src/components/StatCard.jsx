import React from "react";
import { Icon } from "./icons.jsx";

const TONES = {
  slate:  "border-orac-border-default bg-orac-surface text-orac-text-primary",
  blue:   "border-orac-border-default bg-orac-surface text-orac-text-primary",
  amber:  "border-orac-border-default border-l-4 border-l-orac-warning-border bg-orac-warning-bg text-orac-text-primary",
  green:  "border-orac-border-default bg-orac-surface text-orac-text-primary",
  red:    "border-orac-border-default border-l-4 border-l-orac-danger-border bg-orac-danger-bg text-orac-text-primary",
};

export default function StatCard({ label, value, tone = "slate", icon, iconPath, subtitle, onClick, href }) {
  const isZero = value !== null && value !== undefined && String(value).trim() !== "" && Number(value) === 0;
  const resolvedTone = isZero ? "slate" : tone;
  const Component = href ? "a" : onClick ? "button" : "div";
  const isInteractive = Boolean(href || onClick);
  const interactiveClasses = isInteractive
    ? "cursor-pointer hover:border-orac-accent hover:shadow-md hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orac-focus-ring text-left w-full block transition-all duration-150"
    : "transition-all duration-150";

  return (
    <Component
      {...(Component === "button" ? { type: "button" } : {})}
      href={href}
      onClick={onClick}
      data-ux="stat-tile"
      className={`orac-metric-card rounded-xl border p-6 shadow-xs ${interactiveClasses} ${TONES[resolvedTone] || TONES.slate}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div data-ux="stat-label" className="text-lg font-bold leading-snug text-orac-text-primary">{label}</div>
        {(iconPath || icon) && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orac-info-bg text-orac-accent">
            {iconPath ? <Icon path={iconPath} className="h-5 w-5" /> : icon}
          </div>
        )}
      </div>
      <div data-ux="stat-count" className={`mt-2 text-2xl font-semibold tabular-nums opacity-75 sm:text-[28px] ${isZero ? "text-orac-text-muted" : "text-orac-text-secondary"}`}>
        {value === undefined || value === null ? (
          <span className="inline-block h-8 w-16 animate-pulse rounded bg-orac-surface-muted" />
        ) : (
          value
        )}
      </div>
      {subtitle && <div className="mt-1.5 text-sm font-medium text-orac-text-secondary">{subtitle}</div>}
    </Component>
  );
}
