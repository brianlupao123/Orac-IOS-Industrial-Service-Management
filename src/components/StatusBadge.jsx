import React from "react";
import { statusLabel } from "../timesheetWorkflowFlags.js";

/**
 * Reusable status badge with semantic color.
 * Maps common Orac status strings to visual tones.
 * Uses statusLabel() from timesheetWorkflowFlags for display text,
 * with a fallback that converts underscored enums to readable labels.
 */
const STATUS_MAP = {
  // Quotes
  Draft:                   "bg-gray-100 text-gray-700",
  Submitted:               "bg-sky-100 text-sky-800",
  Under_Review:            "bg-amber-100 text-amber-800",
  Approved:                "bg-emerald-100 text-emerald-800",
  Approved_Pending_PO:     "bg-amber-100 text-amber-800",
  Rejected:                "bg-red-100 text-red-800",
  Cancelled:               "bg-gray-200 text-gray-600",
  // Worksheets
  Pending:                 "bg-amber-100 text-amber-800",
  Supervisor_Approved:     "bg-emerald-100 text-emerald-800",
  Returned_For_Correction: "bg-red-100 text-red-800",
  Client_Acknowledged:     "bg-emerald-100 text-emerald-800",
  Captured_From_Signed_Paper: "bg-emerald-100 text-emerald-800",
  Completed:               "bg-emerald-100 text-emerald-800",
  Returned:                "bg-orange-100 text-orange-800",
  // Dispatches & Tasks
  Scheduled:               "bg-sky-100 text-sky-800",
  In_Progress:             "bg-indigo-100 text-indigo-800",
  Not_Started:             "bg-slate-100 text-slate-700",
  Pending_Approval:        "bg-amber-100 text-amber-800",
  // Invoices
  Issued:                  "bg-sky-100 text-sky-800",
  Paid:                    "bg-emerald-100 text-emerald-800",
  Overdue:                 "bg-red-100 text-red-800",
  // General
  Active:                  "bg-emerald-100 text-emerald-800",
  Inactive:                "bg-gray-200 text-gray-600",
};

/** Human-readable fallback labels for statuses not in timesheetWorkflowFlags */
const LABEL_OVERRIDES = {
  Approved_Pending_PO: "Awaiting PO",
  Pending_Approval: "Pending Approval",
  In_Progress: "In Progress",
  Not_Started: "Not Started",
  Under_Review: "Under Review",
  Supervisor_Approved: "Supervisor Approved",
  Returned_For_Correction: "Returned For Correction",
  Client_Acknowledged: "Client Acknowledged",
  Captured_From_Signed_Paper: "Captured From Paper",
};

function resolveLabel(status) {
  // Primary: use statusLabel from timesheetWorkflowFlags (protected source of truth)
  const primary = statusLabel(status);
  const raw = status || "";
  // Detect when statusLabel just performed its default fallback
  // (returned the raw status, its underscore-normalised form, or its space-separated form)
  const isFallback =
    primary === raw ||
    primary === raw.replace(/\s+/g, "_") ||
    primary === raw.replace(/_/g, " ");
  if (isFallback) {
    const normalized = raw.trim().replace(/\s+/g, "_");
    if (LABEL_OVERRIDES[normalized]) return LABEL_OVERRIDES[normalized];
    // Final fallback: replace underscores and title-case
    return normalized
      .replace(/_/g, " ")
      .replace(/\b[a-z]/g, (c) => c.toUpperCase());
  }
  return primary;
}

export default function StatusBadge({ status }) {
  const normalized = (status || "").replace(/\s+/g, "_");
  const classes = STATUS_MAP[normalized] || STATUS_MAP[status] || "bg-gray-100 text-gray-700";
  const display = resolveLabel(status);
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${classes}`}
      style={{ fontVariantNumeric: "var(--orac-table-font-variant, tabular-nums)" }}
    >
      {display}
    </span>
  );
}
