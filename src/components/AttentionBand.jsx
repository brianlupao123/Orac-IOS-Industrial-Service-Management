import React from "react";
import { Icon } from "./icons.jsx";

/**
 * Purposeful priority/attention band.
 *
 * Renders a single horizontal row of restrained metrics instead of a grid of
 * decorative KPI cards. Each item is plain data the caller already has (a
 * label, a value, an optional icon) plus an optional `attention` flag the
 * caller sets from data it already computed — this component does not
 * invent any business rule about what counts as "needs attention"; it only
 * gives that state a consistent, non-decorative visual treatment (a left
 * accent bar + amber tone) so real attention items are not lost among
 * routine counters.
 *
 * No nested cards: this is one flat surface with internal dividers, per the
 * "do not nest cards inside cards" guidance from the Cloudscape/USWDS
 * benchmark used elsewhere in this patch series.
 */
// Static class maps (Tailwind cannot see dynamically built class names). The
// column count follows the item count so the 1px divider background never
// shows through as an empty grey cell.
const SM_COLS = { 1: "sm:grid-cols-1", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-2" };
const LG_COLS = { 1: "lg:grid-cols-1", 2: "lg:grid-cols-2", 3: "lg:grid-cols-3", 4: "lg:grid-cols-4" };

export default function AttentionBand({ items = [] }) {
  if (!items.length) return null;
  const n = Math.min(items.length, 4);
  return (
    <div
      role="list"
      aria-label="Key metrics"
      className={`grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-gray-200 bg-orac-border-default shadow-sm ${SM_COLS[n]} ${LG_COLS[n]}`}
    >
      {items.map((item, i) => (
        <div
          role="listitem"
          key={item.label || i}
          className={`flex items-center gap-3 px-5 py-4 ${
            item.attention ? "border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-950" : "bg-white"
          }`}
        >
          {item.iconPath && (
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${
                item.attention
                  ? "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                  : "border-gray-200 bg-gray-50 text-orac-blue"
              }`}
            >
              <Icon path={item.iconPath} />
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-600">{item.label}</p>
            <p className="mt-0.5 flex items-baseline gap-1.5 text-2xl font-semibold tabular-nums text-gray-900">
              {item.value}
              {item.attention && (
                <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">needs attention</span>
              )}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
