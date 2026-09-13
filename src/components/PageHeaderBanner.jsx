import React from "react";
import { Icon } from "./icons.jsx";

export default function PageHeaderBanner({ eyebrow, title, subtitle, iconPath, aside }) {
  return <header className="border-l-4 border-orac-blue bg-white px-6 py-6 shadow-sm sm:px-7"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div className="flex items-start gap-4">{iconPath && <span className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-orac-blue"><Icon path={iconPath} /></span>}<div><p className="text-sm font-semibold text-orac-blue">{eyebrow}</p><h1 className="mt-1 text-3xl font-semibold text-orac-slate">{title}</h1>{subtitle && <p className="mt-2 text-base leading-6 text-slate-700">{subtitle}</p>}</div></div>{aside && <div className="text-base text-slate-600">{aside}</div>}</div></header>;
}
