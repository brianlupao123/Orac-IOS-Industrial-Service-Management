import React from "react";
import { Icon } from "./icons.jsx";
import PageTitle from "./ui/PageTitle.jsx";
import Button from "./ui/Button.jsx";

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
            {eyebrow && <p className="text-ux-caption font-semibold text-orac-accent">{eyebrow}</p>}
            <PageTitle>{title}</PageTitle>
            {subtitle && <p className="mt-1 max-w-prose text-ux-body text-orac-text-secondary">{subtitle}</p>}
            {meta && meta.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-ux-caption font-medium text-orac-text-muted">
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
          {aside && <div className="text-ux-body font-medium text-orac-text-muted">{aside}</div>}
          {action && (
            <div>
              {React.isValidElement(action) ? (
                action
              ) : (
                <Button
                  variant="primary"
                  onClick={action.onClick}
                >
                  {action.label}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
