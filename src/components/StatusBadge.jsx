import React from "react";
import { statusLabel } from "../timesheetWorkflowFlags.js";

/**
 * Reusable status badge with semantic color.
 * Maps common Orac status strings to visual tones.
 */
const STATUS_MAP = {
  // Quotes
  Draft:                "bg-gray-100 text-gray-700",
  Submitted:            "bg-sky-100 text-sky-800",
  Under_Review:         "bg-amber-100 text-amber-800",
  Approved:             "bg-emerald-100 text-emerald-800",
  Approved_Pending_PO:  "bg-amber-100 text-amber-800",
  Rejected:             "bg-red-100 text-red-800",
  Cancelled:            "bg-gray-200 text-gray-600",
  // Worksheets
  Pending:              "bg-amber-100 text-amber-800",
  // Real backend worksheet values (field_worksheets.status) - previously
  // missing entirely, which made every Supervisor-approved or returned
  // worksheet render as the default gray badge.
  Supervisor_Approved:     "bg-emerald-100 text-emerald-800",
  Returned_For_Correction: "bg-red-100 text-red-800",
  Client_Acknowledged:    "bg-emerald-100 text-emerald-800",
  Captured_From_Signed_Paper: "bg-emerald-100 text-emerald-800",
  Completed:            "bg-emerald-100 text-emerald-800",
  Returned:             "bg-orange-100 text-orange-800",
  // Dispatches
  Scheduled:            "bg-sky-100 text-sky-800",
  In_Progress:          "bg-indigo-100 text-indigo-800",
  // Invoices
  Issued:               "bg-sky-100 text-sky-800",
  Paid:                 "bg-emerald-100 text-emerald-800",
  Overdue:              "bg-red-100 text-red-800",
  // General
  Active:               "bg-emerald-100 text-emerald-800",
  Inactive:             "bg-gray-200 text-gray-600",
};

export default function StatusBadge({ status }) {
  const normalized = (status || "").replace(/\s+/g, "_");
  const classes = STATUS_MAP[normalized] || STATUS_MAP[status] || "bg-gray-100 text-gray-700";
  const display = statusLabel(status);
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${classes}`}>
      {display}
    </span>
  );
}
