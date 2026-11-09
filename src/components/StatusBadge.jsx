import React from "react";
import Badge from "./ui/Badge.jsx";
import { statusLabel } from "../timesheetWorkflowFlags.js";

/**
 * Reusable status badge with semantic color built on P3 Badge primitive.
 * Maps all Orac status strings to semantic visual tones.
 * Uses statusLabel() from timesheetWorkflowFlags for display text,
 * with fallbacks that convert underscored enums to readable labels.
 */
const STATUS_TONE_MAP = {
  // Quotes
  Draft: "neutral",
  Sent: "info",
  Submitted: "info",
  Under_Review: "warning",
  Approved: "success",
  Approved_Pending_PO: "warning",
  PO_Verified: "success",
  Rejected: "danger",
  Cancelled: "neutral",
  // Worksheets & Field Jobs
  Pending: "warning",
  Supervisor_Approved: "success",
  Returned_For_Correction: "danger",
  Client_Acknowledged: "success",
  Captured_From_Signed_Paper: "success",
  Completed: "success",
  Returned: "warning",
  Scheduled: "info",
  In_Progress: "info",
  Not_Started: "neutral",
  Field_Dispatch: "info",
  // Invoices
  Prepared: "info",
  Issued: "info",
  Paid: "success",
  Invoiced: "success",
  Overdue: "danger",
  // Contracts
  Active: "success",
  Inactive: "neutral",
  Expired: "neutral",
  // Internal / Service Requests & Triage
  Pending_Approval: "warning",
  Triage: "warning",
  Converted_To_Quote: "success",
  Converted_To_Dispatch: "success",
};

/** Human-readable fallback labels for statuses not in timesheetWorkflowFlags */
const LABEL_OVERRIDES = {
  Approved_Pending_PO: "Awaiting PO",
  PO_Verified: "PO Verified",
  Pending_Approval: "Pending Approval",
  In_Progress: "In Progress",
  Not_Started: "Not Started",
  Under_Review: "Under Review",
  Supervisor_Approved: "Supervisor Approved",
  Returned_For_Correction: "Returned For Correction",
  Client_Acknowledged: "Client Acknowledged",
  Captured_From_Signed_Paper: "Captured From Paper",
  Field_Dispatch: "Field Dispatch",
  Converted_To_Quote: "Converted To Quote",
  Converted_To_Dispatch: "Converted To Dispatch",
};

function resolveLabel(status) {
  // Primary: use statusLabel from timesheetWorkflowFlags (protected source of truth)
  const primary = statusLabel(status);
  const raw = status || "";
  // Detect when statusLabel just performed its default fallback
  const isFallback =
    primary === raw ||
    primary === raw.replace(/\s+/g, "_") ||
    primary === raw.replace(/_/g, " ");
  if (isFallback) {
    const normalized = raw.trim().replace(/\s+/g, "_");
    if (LABEL_OVERRIDES[normalized]) return LABEL_OVERRIDES[normalized];
    return normalized
      .replace(/_/g, " ")
      .replace(/\b[a-z]/g, (c) => c.toUpperCase());
  }
  return primary;
}

export default function StatusBadge({ status, className = "" }) {
  const normalized = (status || "").replace(/\s+/g, "_");
  const tone = STATUS_TONE_MAP[normalized] || STATUS_TONE_MAP[status] || "neutral";
  const display = resolveLabel(status);
  return (
    <Badge
      tone={tone}
      className={`font-semibold ${className}`.trim()}
      style={{ fontVariantNumeric: "var(--orac-table-font-variant, tabular-nums)" }}
    >
      {display}
    </Badge>
  );
}
