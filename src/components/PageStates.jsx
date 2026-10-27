import React from "react";
import { Icon } from "./icons.jsx";

export function ErrorBanner({ message }) {
  return <div data-evidence="page-error-state" className="flex gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"><span className="mt-0.5 shrink-0 text-red-600 dark:text-red-400"><Icon path="M12 3 2 21h20L12 3Zm0 6v4m0 4h.01" /></span><p>{message}</p></div>;
}

export function PageEmptyState({ iconPath, title, subtitle, compact = false }) {
  return <div data-evidence="page-empty-state" className={`flex flex-col items-center justify-center px-6 text-center ${compact ? "min-h-32 py-7" : "min-h-48 py-12"}`}><span className={`flex items-center justify-center rounded-full bg-sky-50 text-orac-blue dark:bg-sky-950/40 ${compact ? "h-9 w-9" : "h-11 w-11"}`}><Icon path={iconPath} /></span><h2 className={`${compact ? "mt-3 text-sm" : "mt-4 text-base"} font-semibold text-orac-blue`}>{title}</h2>{subtitle && <p className="mt-1 max-w-md text-sm leading-6 text-gray-600">{subtitle}</p>}</div>;
}

export function RestrictedState({
  title = "Access Restricted",
  description = "You don't have access to this page.",
}) {
  return (
    <div data-evidence="page-restricted-state" className="flex min-h-64 flex-col items-center justify-center px-6 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600 border border-amber-200 shadow-sm dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800">
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </span>
      <h2 className="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
      <p className="mt-1 max-w-md text-sm text-gray-600 dark:text-gray-400">{description}</p>
    </div>
  );
}

export function OfflineState({
  title = "Connection Lost",
  description = "You're offline. This page will load when you reconnect.",
}) {
  return (
    <div data-evidence="page-offline-state" className="flex min-h-64 flex-col items-center justify-center px-6 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500 border border-slate-200 shadow-sm dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M18.364 5.636a9 9 0 010 12.728M5.636 18.364a9 9 0 010-12.728M3 3l18 18" />
        </svg>
      </span>
      <h2 className="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
      <p className="mt-1 max-w-md text-sm text-gray-600 dark:text-gray-400">{description}</p>
    </div>
  );
}

export function SessionExpiredState({
  title = "Session Expired",
  description = "Your session has expired. Please sign in again.",
  onSignIn,
}) {
  return (
    <div data-evidence="page-session-expired-state" className="flex min-h-64 flex-col items-center justify-center px-6 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600 border border-red-200 shadow-sm dark:bg-red-950/30 dark:text-red-400 dark:border-red-800">
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </span>
      <h2 className="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
      <p className="mt-1 max-w-md text-sm text-gray-600 dark:text-gray-400">{description}</p>
      {onSignIn && (
        <button
          onClick={onSignIn}
          className="orac-control mt-4 inline-flex items-center rounded-lg bg-orac-navy px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orac-navy/90 transition-all focus:outline-none focus:ring-2 focus:ring-orac-blue/50"
        >
          Sign In
        </button>
      )}
    </div>
  );
}
