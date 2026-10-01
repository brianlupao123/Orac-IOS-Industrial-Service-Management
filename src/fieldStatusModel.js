// Field-work status model (Task 03). Pure functions only: plain-language labels,
// tones and "what happens next" text for worksheet (Timesheet) and kiosk entries.
//
// Two separate chains are kept separate on purpose:
//   - CLIENT acknowledgement: the authenticated client representative confirms the
//     work. A client never approves ORAC's internal review.
//   - INTERNAL approval: an ORAC Supervisor reviews. Kiosk entries skip the client
//     step and need Supervisor review only.
// Nothing in this file reads, computes or shows a rate or a cost.

export const WORKSHEET_STATUS_LABEL = Object.freeze({
  Draft: "Draft",
  Submitted: "Awaiting client acknowledgement",
  Client_Acknowledged: "Client acknowledged, awaiting Supervisor review",
  Returned_For_Correction: "Returned for correction",
  Supervisor_Approved: "Supervisor approved"
});

export function worksheetStatusLabel(status) {
  return WORKSHEET_STATUS_LABEL[status] || String(status || "Unknown").replace(/_/g, " ");
}

const WORKSHEET_TONE = Object.freeze({
  Draft: "slate",
  Submitted: "sky",
  Client_Acknowledged: "amber",
  Returned_For_Correction: "red",
  Supervisor_Approved: "green"
});
export function worksheetTone(status) { return WORKSHEET_TONE[status] || "slate"; }

const FIELD_AUTHOR_ROLES = ["Admin", "Operations", "Technician", "Supervisor"];
const INTERNAL_REVIEW_ROLES = ["Admin", "Operations", "Supervisor"];

// The one sentence that tells this role what happens next for this entry.
export function worksheetNextAction(role, worksheet) {
  const status = worksheet?.status;
  const isClient = role === "Client Viewer";
  switch (status) {
    case "Draft":
      return FIELD_AUTHOR_ROLES.includes(role)
        ? "Submit it so the client representative can acknowledge it."
        : "Waiting for the technician to submit it.";
    case "Submitted":
      return isClient
        ? "Please review the work and acknowledge it below."
        : "Waiting for the client representative to acknowledge it. Supervisor review starts after that.";
    case "Client_Acknowledged":
      if (isClient) return "Acknowledged. Waiting for ORAC's internal Supervisor review.";
      return INTERNAL_REVIEW_ROLES.includes(role)
        ? "Review it and approve it, or return it with a reason."
        : "Waiting for Supervisor review.";
    case "Returned_For_Correction":
      return FIELD_AUTHOR_ROLES.includes(role)
        ? "Read the return reason, correct the entry and submit it again."
        : "Returned to the technician for correction.";
    case "Supervisor_Approved":
      return isClient ? "Approved by ORAC. Nothing more to do." : "Complete. It is included in the approved period export.";
    default:
      return "";
  }
}

// A worksheet can be revised (a new linked draft) only after acknowledgement or
// approval, and only while it is the current revision. Signed data is never edited in place.
export function canReviseWorksheet(role, worksheet) {
  return FIELD_AUTHOR_ROLES.includes(role) &&
    ["Client_Acknowledged", "Supervisor_Approved"].includes(worksheet?.status) &&
    !worksheet?.superseded_by;
}
export function canEditWorksheet(role, worksheet) {
  return FIELD_AUTHOR_ROLES.includes(role) && ["Draft", "Returned_For_Correction"].includes(worksheet?.status);
}
// Supervisor review is offered only once the client has acknowledged. This
// mirrors the server gate; the server is still the authority.
export function canReviewWorksheet(role, worksheet) {
  return INTERNAL_REVIEW_ROLES.includes(role) && worksheet?.status === "Client_Acknowledged";
}
export function canAcknowledgeWorksheet(role, worksheet) {
  return role === "Client Viewer" && worksheet?.status === "Submitted";
}

// ---- Kiosk entries ----
export const KIOSK_REVIEW_LABEL = Object.freeze({
  pending_review: "Pending Supervisor review",
  approved: "Approved by Supervisor",
  rejected: "Rejected by Supervisor"
});
export function kioskReviewLabel(status) {
  return KIOSK_REVIEW_LABEL[status] || KIOSK_REVIEW_LABEL.pending_review; // unknown fails closed to pending
}
export function kioskReviewTone(status) {
  return status === "approved" ? "green" : status === "rejected" ? "red" : "amber";
}
export function kioskCountsText(status) {
  return status === "approved"
    ? "These hours count as approved."
    : "These hours do not count as approved hours yet. They are not in billing, variance or exports.";
}
export function kioskNextAction(role, row) {
  if (row?.review_status === "approved") return "Approved. The hours now count.";
  if (row?.review_status === "rejected") return "Rejected. Submit a corrected kiosk entry if the time was real.";
  if (row?.review_blocked_reason) {
    return ["Admin", "Operations"].includes(role)
      ? "No Supervisor is assigned to this dispatch. Assign one so this can be reviewed."
      : "Waiting for a Supervisor to be assigned to this dispatch.";
  }
  if (role === "Supervisor") return row?.can_review ? "Approve it, or reject it with a reason." : "You cannot review this entry (it is your own time, or you recorded it).";
  return "Waiting for the assigned Supervisor to review it.";
}

// ---- Materials on the assigned job ----
// Plain-language stock status from the assigned-job endpoint only (never the stock catalog).
export function materialStockLabel(item) {
  const onHand = Number(item?.quantity_on_hand);
  if (!Number.isFinite(onHand)) return "Stock level unknown";
  if (onHand <= 0) return "Out of stock";
  return item?.is_low_stock ? "Low stock" : "In stock";
}
export function materialStockTone(item) {
  const label = materialStockLabel(item);
  return label === "In stock" ? "green" : label === "Low stock" ? "amber" : label === "Out of stock" ? "red" : "slate";
}

// ---- Kiosk hours ----
// Existing behaviour, kept as is and NOT a pay policy: overtime hours are folded
// into hours_logged as normal + 1.5 x OT1.5 + 2.0 x OT2.0. Whether that folding is
// right (and whether the breakdown is hours or pay) is decided by the controlled-
// rates work. The real hours are always sent as evidence in hours_breakdown.
export function foldKioskHours(entry) {
  return Number(entry.normal || 0) + Number(entry.ot15 || 0) * 1.5 + Number(entry.ot20 || 0) * 2.0;
}
export function kioskBreakdown(entry) {
  return { normal: Number(entry.normal || 0), ot_1_5: Number(entry.ot15 || 0), ot_2_0: Number(entry.ot20 || 0) };
}
export function hasKioskHours(entry) {
  return Number(entry?.normal || 0) > 0 || Number(entry?.ot15 || 0) > 0 || Number(entry?.ot20 || 0) > 0;
}
