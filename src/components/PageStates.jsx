import React from "react";
import { Icon } from "./icons.jsx";
import Notice from "./ui/Notice.jsx";
import Button from "./ui/Button.jsx";

export function ErrorBanner({ message }) {
  return (
    <Notice variant="error" data-evidence="page-error-state">
      {message}
    </Notice>
  );
}

// Presentation-only loading placeholder. It preserves the visual footprint of
// cards and table rows while an existing page request is in flight; it never
// makes, retries or changes a business request.
export function PageLoadingSkeleton({ rows = 3, label = "Loading content" }) {
  return (
    <div data-evidence="page-loading-skeleton" role="status" aria-label={label} className="space-y-5" aria-busy="true">
      <span className="sr-only">{label}</span>
      {/* Banner skeleton */}
      <div className="flex items-center gap-5 rounded-xl border border-orac-border-default bg-orac-surface-muted px-6 py-5">
        <div className="h-14 w-14 shrink-0 animate-pulse rounded-2xl bg-orac-border-default" />
        <div className="flex-1 space-y-2.5">
          <span className="block h-3.5 w-28 animate-pulse rounded-md bg-orac-border-default" />
          <span className="block h-6 w-[min(300px,70%)] animate-pulse rounded-md bg-orac-border-default" />
          <span className="block h-3.5 w-[min(480px,90%)] animate-pulse rounded-md bg-orac-border-default" />
        </div>
      </div>
      {/* Tile skeletons */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="rounded-xl border border-orac-border-default bg-orac-surface p-5">
            <span className="block h-4 w-[55%] animate-pulse rounded-md bg-orac-surface-muted" />
            <span className="mt-3.5 block h-8 w-[40%] animate-pulse rounded-md bg-orac-surface-muted" />
          </div>
        ))}
      </div>
      {/* Table skeleton */}
      <div className="overflow-hidden rounded-xl border border-orac-border-default bg-orac-surface">
        <div className="border-b border-orac-border-default px-6 py-4">
          <span className="block h-5 w-44 animate-pulse rounded-md bg-orac-surface-muted" />
        </div>
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="grid grid-cols-[minmax(0,2fr)_minmax(5rem,1fr)_minmax(5rem,1fr)] gap-6 border-b border-orac-border-default px-6 py-[18px] last:border-b-0">
            <span className="h-[18px] animate-pulse rounded-md bg-orac-surface-muted" />
            <span className="h-[18px] animate-pulse rounded-md bg-orac-surface-muted" />
            <span className="h-[18px] animate-pulse rounded-md bg-orac-surface-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PageEmptyState({ iconPath, title, subtitle, compact = false }) {
  return (
    <div data-evidence="page-empty-state" className={`flex flex-col items-center justify-center px-6 text-center ${compact ? "min-h-24 py-5" : "min-h-48 py-12"}`}>
      <span className={`flex items-center justify-center rounded-full bg-orac-info-bg text-orac-accent ${compact ? "h-9 w-9" : "h-11 w-11"}`}>
        <Icon path={iconPath} />
      </span>
      <h2 className={`${compact ? "mt-2 text-ux-label" : "mt-4 text-ux-section"} font-semibold text-orac-text-primary`}>
        {title}
      </h2>
      {subtitle && <p className="mt-1 max-w-md text-ux-body text-orac-text-secondary">{subtitle}</p>}
    </div>
  );
}

export function RestrictedState({
  title = "Access Restricted",
  description = "You don't have access to this page.",
}) {
  return (
    <div data-evidence="page-restricted-state" className="flex min-h-64 flex-col items-center justify-center px-6 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-orac-warning-bg text-orac-warning-text border border-orac-warning-border shadow-sm">
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </span>
      <h2 className="mt-4 text-ux-section font-semibold text-orac-text-primary">{title}</h2>
      <p className="mt-1 max-w-md text-ux-body text-orac-text-secondary">{description}</p>
    </div>
  );
}

export function OfflineState({
  title = "Connection Lost",
  description = "You're offline. This page will load when you reconnect.",
}) {
  return (
    <div data-evidence="page-offline-state" className="flex min-h-64 flex-col items-center justify-center px-6 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-orac-warning-bg text-orac-warning-text border border-orac-warning-border shadow-sm">
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M18.364 5.636a9 9 0 010 12.728M5.636 18.364a9 9 0 010-12.728M3 3l18 18" />
        </svg>
      </span>
      <h2 className="mt-4 text-ux-section font-semibold text-orac-text-primary">{title}</h2>
      <p className="mt-1 max-w-md text-ux-body text-orac-text-secondary">{description}</p>
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
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-orac-danger-bg text-orac-danger-text border border-orac-danger-border shadow-sm">
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </span>
      <h2 className="mt-4 text-ux-section font-semibold text-orac-text-primary">{title}</h2>
      <p className="mt-1 max-w-md text-ux-body text-orac-text-secondary">{description}</p>
      {onSignIn && (
        <div className="mt-4">
          <Button variant="primary" onClick={onSignIn}>
            Sign In
          </Button>
        </div>
      )}
    </div>
  );
}
