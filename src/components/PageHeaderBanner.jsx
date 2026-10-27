import React from "react";
import { Icon } from "./icons.jsx";

/**
 * Shared page header banner matching ORAC_Portal_mockup_FINAL.html (.ban):
 * 4px navy left rule, title, subtitle, date/time and primary action button.
 */
export default function PageHeaderBanner({ eyebrow, title, subtitle, iconPath, aside, action, meta, className = "" }) {
  return (
    <header className={`rounded-lg border border-orac-border-default border-l-4 border-l-orac-accent bg-orac-canvas px-5 py-4 shadow-xs ${className}`}>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3.5 min-w-0">
          {iconPath && (
            <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-orac-info-bg text-orac-info-text sm:flex">
              <Icon path={iconPath} className="h-5 w-5" />
            </span>
          )}
          <div className="min-w-0">
            {eyebrow && <p className="text-sm font-semibold text-orac-accent">{eyebrow}</p>}
            <h1 className="text-2xl font-semibold leading-tight text-orac-text-primary sm:text-3xl">{title}</h1>
            {subtitle && <p className="mt-1 max-w-prose text-base leading-snug text-orac-text-secondary">{subtitle}</p>}
            {meta && meta.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium text-orac-text-muted">
                {meta.map((entry, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5">
                    {i > 0 && <span className="text-orac-text-muted" aria-hidden="true">·</span>}
                    {entry}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 self-start sm:self-center">
          {aside && <div className="text-base font-medium text-orac-text-muted">{aside}</div>}
          {action && (
            <div>
              {React.isValidElement(action) ? (
                action
              ) : (
                <button
                  type="button"
                  onClick={action.onClick}
                  className="orac-control inline-flex items-center justify-center rounded-lg bg-orac-accent-strong px-5 text-base font-semibold text-white shadow-xs hover:bg-orac-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-orac-focus-ring"
                >
                  {action.label}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
