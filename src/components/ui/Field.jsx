import React from "react";

export default function Field({
  id,
  label,
  required = false,
  hint,
  error,
  children,
  className = "",
  ...props
}) {
  const hintId = hint && id ? `${id}-hint` : undefined;
  const errorId = error && id ? `${id}-error` : undefined;

  return (
    <div className={`space-y-1.5 ${className}`.trim()} {...props}>
      {label && (
        <label
          htmlFor={id}
          data-ux="label"
          className="block text-ux-label text-orac-text-primary"
        >
          {label}
          {required && (
            <span className="ml-1 font-medium text-orac-text-muted">
              (required)
            </span>
          )}
        </label>
      )}
      {children}
      {hint && (
        <p id={hintId} className="text-ux-secondary text-orac-text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={errorId}
          role="alert"
          className="flex items-center gap-1.5 text-ux-secondary font-semibold text-orac-danger-text"
        >
          <svg
            aria-hidden="true"
            className="h-4 w-4 shrink-0"
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
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
