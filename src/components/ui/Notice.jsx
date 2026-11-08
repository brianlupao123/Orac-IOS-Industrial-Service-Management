import React from "react";

const NOTICE_VARIANTS = {
  error: {
    container: "border-orac-danger-border bg-orac-danger-bg text-orac-danger-text",
    icon: (
      <svg
        aria-hidden="true"
        className="h-5 w-5 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
    ),
  },
  warning: {
    container: "border-orac-warning-border bg-orac-warning-bg text-orac-warning-text",
    icon: (
      <svg
        aria-hidden="true"
        className="h-5 w-5 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
  info: {
    container: "border-orac-info-border bg-orac-info-bg text-orac-info-text",
    icon: (
      <svg
        aria-hidden="true"
        className="h-5 w-5 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
  success: {
    container: "border-orac-success-border bg-orac-success-bg text-orac-success-text",
    icon: (
      <svg
        aria-hidden="true"
        className="h-5 w-5 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
};

export default function Notice({
  variant = "info",
  title,
  children,
  className = "",
  ...props
}) {
  const config = NOTICE_VARIANTS[variant] || NOTICE_VARIANTS.info;
  const role = variant === "error" ? "alert" : "status";

  return (
    <div
      role={role}
      data-ux="notice"
      data-variant={variant}
      className={`flex items-start gap-3 rounded-lg border p-4 text-ux-body ${config.container} ${className}`.trim()}
      {...props}
    >
      {config.icon}
      <div className="min-w-0 flex-1">
        {title && (
          <h4 className="font-semibold text-ux-label mb-1">
            {title}
          </h4>
        )}
        <div>{children}</div>
      </div>
    </div>
  );
}
