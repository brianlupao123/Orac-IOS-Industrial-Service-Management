import React from "react";

const BADGE_STYLES = {
  info: "bg-orac-info-bg text-orac-info-text",
  success: "bg-orac-success-bg text-orac-success-text",
  warning: "bg-orac-warning-bg text-orac-warning-text",
  danger: "bg-orac-danger-bg text-orac-danger-text",
  neutral: "bg-orac-surface-muted text-orac-text-secondary",
  count: "bg-orac-danger-text text-orac-canvas font-bold",
};

export default function Badge({
  tone = "neutral",
  variant,
  children,
  className = "",
  ...props
}) {
  const selected = variant === "count" ? "count" : tone;
  const classes = BADGE_STYLES[selected] || BADGE_STYLES.neutral;

  return (
    <span
      data-ux="badge"
      data-tone={selected}
      className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-ux-caption font-semibold ${classes} ${className}`.trim()}
      {...props}
    >
      {children}
    </span>
  );
}

export function CountBadge({ count, className = "", ...props }) {
  return (
    <span
      data-ux="badge"
      data-tone="count"
      className={`inline-flex min-w-[1rem] items-center justify-center rounded-full bg-orac-danger-text px-1.5 py-0.5 text-ux-caption font-bold text-orac-canvas ${className}`.trim()}
      {...props}
    >
      {count}
    </span>
  );
}
