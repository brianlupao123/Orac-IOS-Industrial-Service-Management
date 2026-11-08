import React from "react";

/**
 * Label-led status summary. The status name and what it means in the workflow
 * come first; the count is secondary information on the right. Used where a
 * page shows ordinary workflow categories (Draft, Sent, Pending review ...),
 * instead of large number-first tiles.
 *
 * items: [{ key, label, meaning, count, tone }]
 *   tone: "neutral" | "info" | "success" | "warning" | "danger"
 * Colour is a supporting cue only: the label, meaning and count are always text.
 * Presentation only. It renders what the caller already loaded.
 */
const TONE_VAR = {
  neutral: "var(--orac-border-strong)",
  info: "var(--orac-info-border)",
  success: "var(--orac-success-border)",
  warning: "var(--orac-warning-border)",
  danger: "var(--orac-danger-border)",
};

export default function StatusSummary({ items, label = "Status summary", className = "" }) {
  if (!Array.isArray(items) || items.length === 0) return null;
  const columns = items.length >= 3 ? "sm:grid-cols-2 lg:grid-cols-3" : items.length === 2 ? "sm:grid-cols-2" : "";
  return (
    <section aria-label={label} data-evidence="status-summary" className={className}>
      <ul className={`grid gap-3 ${columns}`}>
        {items.map((item) => (
          <li
            key={item.key || item.label}
            data-evidence="status-summary-item"
            data-ux="stat-tile"
            className="flex min-w-0 items-start justify-between gap-3 rounded-lg border border-orac-border-default bg-orac-surface px-4 py-3 shadow-sm"
            style={{ borderLeftWidth: "4px", borderLeftColor: TONE_VAR[item.tone] || TONE_VAR.neutral }}
          >
            <div className="min-w-0">
              <p data-ux="stat-label" className="text-base font-semibold text-orac-text-primary">{item.label}</p>
              {item.meaning && <p className="mt-0.5 text-sm text-orac-text-secondary">{item.meaning}</p>}
            </div>
            <p data-ux="stat-count" className="shrink-0 rounded-full bg-orac-surface-muted px-3 py-1 text-sm font-semibold tabular-nums text-orac-text-primary">
              {item.count === undefined || item.count === null ? "-" : item.count}
              <span className="sr-only">{typeof item.count === "number" ? (item.count === 1 ? " record" : " records") : ""}</span>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
