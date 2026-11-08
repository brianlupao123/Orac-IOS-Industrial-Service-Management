import React from "react";
import { Icon } from "./icons.jsx";

const TONES = {
  neutral: {
    card: "border-gray-200 bg-white hover:border-orac-blue",
    chip: "bg-sky-100 text-orac-blue",
    text: "text-slate-900",
    label: "text-slate-500"
  },
  blue: {
    card: "border-sky-300 bg-sky-50 hover:border-sky-500",
    chip: "bg-sky-100 text-sky-800",
    text: "text-sky-950",
    label: "text-sky-700"
  },
  amber: {
    card: "border-amber-300 border-l-4 border-amber-500 bg-amber-50 hover:border-amber-500",
    chip: "bg-amber-100 text-amber-800",
    text: "text-amber-950",
    label: "text-amber-800"
  },
  green: {
    card: "border-emerald-300 bg-emerald-50 hover:border-emerald-500",
    chip: "bg-emerald-100 text-emerald-800",
    text: "text-emerald-950",
    label: "text-emerald-700"
  },
  red: {
    card: "border-red-300 border-l-4 border-red-400 bg-red-50 hover:border-red-400",
    chip: "bg-red-100 text-red-800",
    text: "text-red-950",
    label: "text-red-800"
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
      className={`orac-metric-card w-full rounded-lg border p-4 sm:p-5 text-left ${styling.card} ${onClick ? "cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-orac-blue/60" : ""}`}
    >
      {statusFirst ? (
        <div className="flex items-start gap-3.5">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${styling.chip}`}>
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
        <div className="flex items-start gap-3.5">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${styling.chip}`}>
            <Icon path={iconPath} className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p data-ux="stat-label" className={`text-lg font-bold leading-snug ${styling.text}`}>{label}</p>
            <p data-ux="stat-count" className={`mt-1 text-2xl font-semibold tabular-nums sm:text-[28px] ${styling.label}`}>{value}</p>
            {subtitle && <p className={`mt-1 text-sm leading-snug ${styling.label}`}>{subtitle}</p>}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3.5">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${styling.chip}`}>
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
