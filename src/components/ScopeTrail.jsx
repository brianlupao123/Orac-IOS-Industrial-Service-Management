import React from "react";

/**
 * Operational breadcrumb trail.
 * Adapted from 1-feedback-system DashboardScopeTrail.jsx.
 * Usage: <ScopeTrail items={[{ label: "Client" }, { label: "Anglo American", active: true }]} />
 */
export default function ScopeTrail({ items = [] }) {
  if (!items.length) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-1.5 text-sm font-medium text-gray-500">
      {items.map((item, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="text-orac-border-strong" aria-hidden="true">›</span>}
          <span className={item.active ? "font-semibold text-orac-slate" : ""}>{item.label || item.value}</span>
        </React.Fragment>
      ))}
    </div>
  );
}
