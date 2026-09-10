import React from "react";

/**
 * Reusable stat card with semantic tone coloring.
 * Adapted from feedback-ecosystem RoleDashboard.jsx StatCard pattern.
 *
 * @param {object} props
 * @param {string} props.label - Metric label (e.g. "Active Quotes")
 * @param {string|number} props.value - Metric value
 * @param {"slate"|"blue"|"amber"|"green"|"red"} [props.tone="slate"] - Semantic color tone
 * @param {string} [props.icon] - Optional emoji or text icon
 * @param {string} [props.subtitle] - Optional secondary text (e.g. trend info)
 */

const TONES = {
  slate:  "border-gray-200 bg-white text-orac-slate",
  blue:   "border-sky-200 bg-sky-50 text-sky-900",
  amber:  "border-amber-200 bg-amber-50 text-amber-900",
  green:  "border-emerald-200 bg-emerald-50 text-emerald-900",
  red:    "border-red-200 bg-red-50 text-red-900",
};

export default function StatCard({ label, value, tone = "slate", icon, subtitle }) {
  return (
    <div className={`rounded-lg border p-5 shadow-sm transition-shadow hover:shadow-md ${TONES[tone] || TONES.slate}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-medium opacity-75">{label}</div>
          <div className="mt-2 text-3xl font-bold">
            {value === undefined || value === null ? (
              <span className="inline-block h-8 w-16 animate-pulse rounded bg-gray-200" />
            ) : (
              value
            )}
          </div>
          {subtitle && <div className="mt-1 text-xs opacity-60">{subtitle}</div>}
        </div>
        {icon && (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/60 text-2xl shadow-sm">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
