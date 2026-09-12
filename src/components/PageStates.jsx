import React from "react";
import { Icon } from "./icons.jsx";

export function ErrorBanner({ message }) {
  return <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><span className="mt-0.5 text-red-600"><Icon path="M12 3 2 21h20L12 3Zm0 6v4m0 4h.01" /></span><p>{message}</p></div>;
}

export function PageEmptyState({ iconPath, title, subtitle }) {
  return <div className="flex min-h-48 flex-col items-center justify-center px-6 py-12 text-center"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-sky-50 text-orac-blue"><Icon path={iconPath} /></span><h2 className="mt-4 text-base font-semibold text-orac-slate">{title}</h2>{subtitle && <p className="mt-1 max-w-md text-sm text-gray-600">{subtitle}</p>}</div>;
}
