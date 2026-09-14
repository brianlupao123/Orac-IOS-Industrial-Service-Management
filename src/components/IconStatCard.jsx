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
  const Component = onClick ? "button" : "div";
  return <Component {...(onClick ? { type: "button", onClick } : {})} id={evidenceTarget || undefined} data-evidence-target={evidenceTarget || undefined} className={`w-full rounded-lg border p-5 text-left shadow-sm transition-all duration-200 ${TONES[tone] || TONES.neutral} ${onClick ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-orac-blue/40" : ""}`}>
    <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-slate-800">{label}</p><p className="mt-2 text-4xl font-light tabular-nums">{value}</p>{subtitle && <p className="mt-2 text-sm leading-5 text-slate-700">{subtitle}</p>}</div><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white/95 text-orac-blue"><Icon path={iconPath} /></span></div>
  </Component>;
}
