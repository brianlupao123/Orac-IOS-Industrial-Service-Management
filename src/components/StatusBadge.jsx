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
  Draft:                   "bg-orac-surface-muted text-orac-text-secondary",
  Submitted:               "bg-orac-info-bg text-orac-info-text",
  Under_Review:            "bg-orac-warning-bg text-orac-warning-text",
  Approved:                "bg-orac-success-bg text-orac-success-text",
  Approved_Pending_PO:     "bg-orac-warning-bg text-orac-warning-text",
  Rejected:                "bg-orac-danger-bg text-orac-danger-text",
  Cancelled:               "bg-orac-surface-muted text-orac-text-muted",
  // Worksheets
  Pending:                 "bg-orac-warning-bg text-orac-warning-text",
  Supervisor_Approved:     "bg-orac-success-bg text-orac-success-text",
  Returned_For_Correction: "bg-orac-danger-bg text-orac-danger-text",
  Client_Acknowledged:     "bg-orac-success-bg text-orac-success-text",
  Captured_From_Signed_Paper: "bg-orac-success-bg text-orac-success-text",
  Completed:               "bg-orac-success-bg text-orac-success-text",
  Returned:                "bg-orac-warning-bg text-orac-warning-text",
  // Dispatches & Tasks
  Scheduled:               "bg-orac-info-bg text-orac-info-text",
  In_Progress:             "bg-orac-info-bg text-orac-info-text",
  Not_Started:             "bg-orac-surface-muted text-orac-text-secondary",
  Pending_Approval:        "bg-orac-warning-bg text-orac-warning-text",
  // Invoices
  Issued:                  "bg-orac-info-bg text-orac-info-text",
  Paid:                    "bg-orac-success-bg text-orac-success-text",
  Overdue:                 "bg-orac-danger-bg text-orac-danger-text",
  // General
  Active:                  "bg-orac-success-bg text-orac-success-text",
  Inactive:                "bg-orac-surface-muted text-orac-text-muted",
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
  const classes = STATUS_MAP[normalized] || STATUS_MAP[status] || "bg-orac-surface-muted text-orac-text-secondary";
  const display = resolveLabel(status);
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-sm font-semibold ${classes}`}
      style={{ fontVariantNumeric: "var(--orac-table-font-variant, tabular-nums)" }}
    >
      {display}
    </span>
  );
}
