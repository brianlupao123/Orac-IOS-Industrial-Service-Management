import React from "react";

const TONES = {
  slate:  "border-gray-100 bg-white text-gray-800 ring-1 ring-gray-900/5",
  blue:   "border-sky-100 bg-sky-50/50 text-sky-900 ring-1 ring-sky-900/5",
  amber:  "border-amber-100 bg-amber-50/50 text-amber-900 ring-1 ring-amber-900/5",
  green:  "border-emerald-100 bg-emerald-50/50 text-emerald-900 ring-1 ring-emerald-900/5",
  red:    "border-red-100 bg-red-50/50 text-red-900 ring-1 ring-red-900/5",
};

export default function StatCard({ label, value, tone = "slate", icon, subtitle, onClick, href }) {
  const Component = href ? "a" : onClick ? "button" : "div";
  const isInteractive = Boolean(href || onClick);
  const interactiveClasses = isInteractive
    ? "cursor-pointer hover:brightness-95 hover:shadow-lg hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orac-blue/30 text-left w-full block transition-all duration-200"
    : "transition-all duration-200";

  return (
    <Component
      {...(Component === "button" ? { type: "button" } : {})}
      href={href}
      onClick={onClick}
      className={`rounded-xl border p-5 shadow-sm ${interactiveClasses} ${TONES[tone] || TONES.slate}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex flex-col">
          <div className="text-xs font-semibold tracking-wide uppercase opacity-60 mb-1">{label}</div>
          <div className="text-3xl font-light tracking-tight">
            {value === undefined || value === null ? (
              <span className="inline-block h-8 w-16 animate-pulse rounded bg-gray-200/50" />
            ) : (
              value
            )}
          </div>
          {subtitle && <div className="mt-2 text-xs font-medium opacity-50">{subtitle}</div>}
        </div>
        {icon && (
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/80 text-xl shadow-sm backdrop-blur-sm border border-black/5">
            {icon}
          </div>
        )}
      </div>
    </Component>
  );
}
