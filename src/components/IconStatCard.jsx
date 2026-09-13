import React from "react";
import { Icon } from "./icons.jsx";

const TONES = {
  neutral: "border-gray-200 bg-white text-orac-slate",
  blue: "border-sky-200 bg-sky-50 text-sky-950",
  green: "border-emerald-200 bg-emerald-50 text-emerald-950",
  amber: "border-amber-200 bg-amber-50 text-amber-950",
  red: "border-red-200 bg-red-50 text-red-950"
};

export default function IconStatCard({ label, value, iconPath, tone = "neutral", subtitle, onClick }) {
  const Component = onClick ? "button" : "div";
  return <Component {...(onClick ? { type: "button", onClick } : {})} className={`w-full rounded-lg border p-5 text-left shadow-sm transition-all duration-200 ${TONES[tone] || TONES.neutral} ${onClick ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-orac-blue/40" : ""}`}>
    <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-slate-700">{label}</p><p className="mt-2 text-4xl font-light tabular-nums">{value}</p>{subtitle && <p className="mt-2 text-sm leading-5 text-slate-600">{subtitle}</p>}</div><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-black/5 bg-white/90 text-orac-blue"><Icon path={iconPath} /></span></div>
  </Component>;
}
