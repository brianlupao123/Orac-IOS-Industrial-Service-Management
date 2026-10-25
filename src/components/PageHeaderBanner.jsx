import React from "react";
import { Icon } from "./icons.jsx";

/**
 * Shared page header banner matching ORAC_Portal_mockup_FINAL.html (.ban):
 * 4px navy left rule, title, subtitle, date/time and primary action button.
 */
export default function PageHeaderBanner({ eyebrow, title, subtitle, iconPath, aside, action, meta, className = "" }) {
  return (
    <header className={`rounded-lg border border-gray-200 border-l-4 border-l-orac-navy bg-white px-5 py-4 shadow-xs dark:bg-slate-900 dark:border-slate-800 dark:border-l-sky-400 ${className}`}>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3.5 min-w-0">
          {iconPath && (
            <span className="hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-orac-blue dark:bg-slate-800 dark:text-sky-300">
              <Icon path={iconPath} className="h-5 w-5" />
            </span>
          )}
          <div className="min-w-0">
            {eyebrow && <p className="text-xs font-semibold text-orac-blue dark:text-sky-400">{eyebrow}</p>}
            <h1 className="text-2xl font-bold text-orac-slate sm:text-3xl leading-tight dark:text-white">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-slate-600 leading-snug dark:text-slate-300">{subtitle}</p>}
            {meta && meta.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-slate-500">
                {meta.map((entry, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5">
                    {i > 0 && <span className="text-slate-300" aria-hidden="true">·</span>}
                    {entry}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 self-start sm:self-center">
          {aside && <div className="text-sm font-medium text-slate-500 dark:text-slate-400">{aside}</div>}
          {action && (
            <div>
              {React.isValidElement(action) ? (
                action
              ) : (
                <button
                  type="button"
                  onClick={action.onClick}
                  className="inline-flex h-10 items-center justify-center rounded-lg bg-orac-navy px-4 text-sm font-semibold text-white shadow-xs hover:bg-orac-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-orac-blue/50"
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
