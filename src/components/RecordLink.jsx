import React from "react";
import { Link } from "react-router-dom";
import { canAccessRoute } from "../accessPolicy.js";
import { recordHref } from "../lib/deepLink.js";

/**
 * "Open" link to one record on its own page. Read-only: it only navigates.
 * Shown only when accessPolicy lets this role open the destination route, the same rule the
 * page header links use, so it can never widen who sees what.
 */
export default function RecordLink({ user, path, param, id, what, name }) {
  if (!id || !user || !canAccessRoute(user.role, path)) return null;
  return (
    <Link
      to={recordHref(path, param, String(id))}
      data-evidence="report-record-link"
      aria-label={`Open ${what} ${name || id}`}
      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-orac-border-strong px-3 text-sm font-semibold text-orac-accent hover:bg-orac-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-orac-blue/40"
    >
      Open
    </Link>
  );
}
