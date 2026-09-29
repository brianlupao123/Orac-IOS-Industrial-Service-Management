import React from "react";
import { Icon } from "./icons.jsx";

const TONES = {
  neutral: "border-slate-300 bg-white text-orac-slate",
  blue: "border-sky-300 bg-sky-100/80 text-sky-950",
  green: "border-emerald-300 bg-emerald-100/80 text-emerald-950",
  amber: "border-amber-300 bg-amber-100/80 text-amber-950",
  red: "border-red-300 bg-red-100/80 text-red-950"
};

export default function IconStatCard({ label, value, iconPath, tone = "neutral", subtitle, onClick, evidenceTarget }) {
  // §13.4 / §14.5: Zero-value metrics must ALWAYS render neutral — never tinted.
  // This prevents misleading green/red cards when there's nothing to act on.
  const numericValue = Number(value);
  const resolvedTone = (value === 0 || value === "0" || numericValue === 0) ? "neutral" : (tone || "neutral");

  const Component = onClick ? "button" : "div";
  return (
    <Component
      {...(onClick ? { type: "button", onClick } : {})}
      id={evidenceTarget || undefined}
      data-evidence-target={evidenceTarget || undefined}
      className={`w-full rounded-lg border p-5 text-left shadow-sm transition-all duration-200 ${TONES[resolvedTone] || TONES.neutral} ${onClick ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-orac-blue/60" : ""}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800">{label}</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums sm:text-4xl">{value}</p>
          {subtitle && <p className="mt-2 text-sm leading-5 text-slate-700">{subtitle}</p>}
          {onClick && <p className="mt-2 text-sm font-semibold text-orac-blue">View details &rarr;</p>}
        </div>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white/95 text-orac-blue">
          <Icon path={iconPath} />
        </span>
      </div>
    </Component>
  );
}
