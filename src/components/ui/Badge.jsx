import React from "react";

const BADGE_STYLES = {
  info: "bg-orac-info-bg text-orac-info-text border-orac-info-border",
  success: "bg-orac-success-bg text-orac-success-text border-orac-success-border",
  warning: "bg-orac-warning-bg text-orac-warning-text border-orac-warning-border",
  danger: "bg-orac-danger-bg text-orac-danger-text border-orac-danger-border",
  neutral: "bg-orac-surface-muted text-orac-text-secondary border-orac-border-default",
  count: "bg-orac-danger-text text-orac-canvas font-bold border-transparent",
};

export default function Badge({
  tone = "neutral",
  variant,
  size = "md",
  children,
  className = "",
  ...props
}) {
  const selected = variant === "count" ? "count" : tone;
  const classes = BADGE_STYLES[selected] || BADGE_STYLES.neutral;
  const isCompact = size === "sm" || size === "compact";
  const sizeClass = isCompact ? "px-2 py-0.5 text-ux-caption gap-1" : "px-3 py-1 text-ux-secondary gap-1.5";

  return (
    <span
      data-ux="badge"
      data-tone={selected}
      className={`inline-flex items-center justify-center rounded-full border font-semibold ${sizeClass} ${classes} ${className}`.trim()}
      {...props}
    >
      {selected !== "count" && (
        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-90 shrink-0" aria-hidden="true" />
      )}
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
