import React from "react";
import { Icon } from "./icons.jsx";

export default function PageHeaderBanner({ eyebrow, title, subtitle, iconPath, aside }) {
  return <header className="border-l-4 border-orac-blue bg-white px-6 py-5 shadow-sm sm:px-7"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div className="flex items-start gap-4">{iconPath && <span className="mt-1 flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50 text-orac-blue"><Icon path={iconPath} /></span>}<div><p className="text-xs font-semibold uppercase text-orac-blue">{eyebrow}</p><h1 className="mt-1 text-3xl font-semibold text-orac-slate">{title}</h1>{subtitle && <p className="mt-1 text-base text-gray-600">{subtitle}</p>}</div></div>{aside && <div className="text-sm text-gray-500">{aside}</div>}</div></header>;
}
