import React from "react";
import { Icon } from "./icons.jsx";

/**
 * Shared page header. `meta` is a new, optional row of short context chips
 * (e.g. role, record counts, current scope) rendered under the title/
 * subtitle — existing callers that don't pass it render exactly as before.
 */
export default function PageHeaderBanner({ eyebrow, title, subtitle, iconPath, aside, meta, className = "" }) {
  return (
    <header className={`border-l-4 border-orac-blue bg-white px-5 py-5 shadow-sm sm:px-7 sm:py-6 ${className}`}>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-start gap-4">
          {iconPath && (
            <span className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-orac-blue">
              <Icon path={iconPath} />
            </span>
          )}
          <div className="min-w-0">
            {eyebrow && <p className="text-sm font-semibold text-orac-blue">{eyebrow}</p>}
            <h1 className="mt-1 text-2xl font-semibold text-orac-slate sm:text-3xl">{title}</h1>
            {subtitle && <p className="mt-2 text-sm leading-6 text-slate-700 sm:text-base">{subtitle}</p>}
            {meta && meta.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm font-medium text-slate-600">
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
        {aside && <div className="text-sm text-slate-600 sm:text-base">{aside}</div>}
      </div>
    </header>
  );
}
