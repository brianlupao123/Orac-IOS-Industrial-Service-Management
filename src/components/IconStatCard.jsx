import React from "react";
import { Icon } from "./icons.jsx";

const TONES = {
  neutral: {
    card: "border-orac-border-default bg-orac-surface hover:border-orac-accent",
    chip: "bg-orac-surface-muted text-orac-text-secondary",
    text: "text-orac-text-primary",
    label: "text-orac-text-secondary"
  },
  blue: {
    card: "border-orac-border-default bg-orac-surface hover:border-orac-accent",
    chip: "bg-orac-info-bg text-orac-info-text",
    text: "text-orac-text-primary",
    label: "text-orac-text-secondary"
  },
  amber: {
    card: "border-orac-border-default border-l-4 border-l-orac-warning-border bg-orac-warning-bg hover:border-orac-accent",
    chip: "bg-orac-surface text-orac-warning-text",
    text: "text-orac-text-primary",
    label: "text-orac-warning-text"
  },
  green: {
    card: "border-orac-border-default bg-orac-surface hover:border-orac-accent",
    chip: "bg-orac-success-bg text-orac-success-text",
    text: "text-orac-text-primary",
    label: "text-orac-text-secondary"
  },
  red: {
    card: "border-orac-border-default border-l-4 border-l-orac-danger-border bg-orac-danger-bg hover:border-orac-accent",
    chip: "bg-orac-surface text-orac-danger-text",
    text: "text-orac-text-primary",
    label: "text-orac-danger-text"
  }
};

// statusFirst: for workflow categories. The status name and its meaning lead; the count is a secondary pill.
// Leave it off for true quantities (totals, money, hours), which keep the large numeral.
export default function IconStatCard({ label, value, iconPath, tone = "neutral", subtitle, onClick, evidenceTarget, statusFirst = false, labelFirst = false }) {
  // Zero-value metrics render neutral — never misleadingly tinted.
  const numericValue = Number(value);
  const resolvedTone = (value === 0 || value === "0" || numericValue === 0) ? "neutral" : (tone || "neutral");
  const styling = TONES[resolvedTone] || TONES.neutral;

  const Component = onClick ? "button" : "div";
  return (
    <Component
      {...(onClick ? { type: "button", onClick } : {})}
      id={evidenceTarget || undefined}
      data-evidence-target={evidenceTarget || undefined}
      data-ux="stat-tile"
      className={`orac-metric-card w-full rounded-xl border p-6 text-left shadow-xs ${styling.card} ${onClick ? "cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-orac-focus-ring" : ""}`}
    >
      {statusFirst ? (
        <div className="flex items-start gap-3.5">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${styling.chip}`}>
            <Icon path={iconPath} className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p data-ux="stat-label" className={`text-sm font-semibold leading-snug ${styling.text}`}>{label}</p>
            {subtitle && <p className={`mt-0.5 text-xs leading-snug ${styling.label}`}>{subtitle}</p>}
          </div>
          <span data-evidence="status-count" data-ux="stat-count" className={`shrink-0 rounded-full px-2.5 py-1 text-sm font-semibold tabular-nums ${styling.chip}`}>
            {value}
            <span className="sr-only">{numericValue === 1 ? " record" : " records"}</span>
          </span>
        </div>
      ) : labelFirst ? (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p data-ux="stat-label" className={`text-lg font-bold leading-snug ${styling.text}`}>{label}</p>
            <p data-ux="stat-count" className={`mt-2 text-2xl font-semibold tabular-nums sm:text-[28px] ${styling.label}`}>{value}</p>
            {subtitle && <p className={`mt-1.5 text-sm font-medium leading-snug ${styling.label}`}>{subtitle}</p>}
          </div>
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${styling.chip}`}>
            <Icon path={iconPath} className="h-5 w-5" />
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-3.5">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${styling.chip}`}>
            <Icon path={iconPath} className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p data-ux="stat-label" className={`text-xs font-semibold leading-tight ${styling.label}`}>{label}</p>
            <p data-ux="stat-count" className={`mt-0.5 text-2xl font-bold tabular-nums sm:text-3xl ${styling.text}`}>{value}</p>
            {subtitle && <p className={`mt-0.5 text-xs truncate ${styling.label}`}>{subtitle}</p>}
          </div>
        </div>
      )}
    </Component>
  );
}
