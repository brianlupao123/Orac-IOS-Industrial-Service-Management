// Finance commercial actions - pure UI helpers (no React, no network).
// Covers the two Finance-side gates the backend already enforces but the
// frontend never called: verifying a client-submitted PO
// (quoteController.capturePo + stateMachine "PO_Verified") and approving a
// PO amendment (dispatchController.approveAmendment). Nothing here is a
// security control - the server re-validates every one of these.

export const EMPTY_VERIFY_FORM = Object.freeze({ po_reference: "", po_amount: "" });
export const EMPTY_AMENDMENT_FORM = Object.freeze({ new_amount: "", reason: "" });

// Returns a message for the first problem, or "" when ready to send.
// Mirrors VerifyPoSchema's shape (po_reference required, po_amount positive).
export function validateVerifyPoForm(form) {
  const reference = String(form?.po_reference ?? "").trim();
  if (!reference) return "Enter the purchase order reference.";
  const amount = Number(form?.po_amount);
  if (!Number.isFinite(amount) || amount <= 0) return "Enter a PO amount greater than zero.";
  return "";
}

// Builds a VerifyPoSchema-shaped body from a fixed whitelist. Anything else
// on `form` (status, verified_by, verified_at, quotation_id...) is never
// copied - those fields are server-owned.
export function buildVerifyPoPayload(form = {}) {
  return { po_reference: String(form.po_reference ?? "").trim(), po_amount: Number(form.po_amount) || 0 };
}

// Mirrors ApproveAmendmentSchema and the controller's own check
// (new_amount must exceed the PO's current amount - dispatchController.js
// approveAmendment). `currentAmount` is the PO's existing po_amount.
export function validateAmendmentForm(form, currentAmount) {
  const amount = Number(form?.new_amount);
  if (!Number.isFinite(amount) || amount <= 0) return "Enter a new PO amount greater than zero.";
  if (Number.isFinite(Number(currentAmount)) && amount <= Number(currentAmount)) {
    return `The amended amount must be greater than the current PO amount (${Number(currentAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}).`;
  }
  return "";
}

// Builds an ApproveAmendmentSchema-shaped body. reason is omitted when
// blank so the server's own default ("Timesheet/material variance") applies.
export function buildAmendmentPayload(form = {}) {
  const payload = { new_amount: Number(form.new_amount) || 0 };
  const reason = String(form.reason ?? "").trim();
  if (reason) payload.reason = reason;
  return payload;
}

// A PO is awaiting Finance verification once the client has submitted a
// reference/amount (status "pending") - see quoteController.submitClientPo.
// Verifying it only makes sense while the owning quote is still
// Approved_Pending_PO; anything else (Draft, already PO_Verified, etc.) is
// shown for context but without a Verify action, since the state machine
// would reject the follow-up transition (stateMachine.js allowedTransitions).
export function canVerifyPo(po, quote) {
  return po?.status === "pending" && quote?.status === "Approved_Pending_PO";
}

// Whether verifying should also advance the quote to PO_Verified in the same
// action, or just record the verified PO. If the quote is already past
// Approved_Pending_PO (e.g. a second, corrected PO on an already-verified
// quote), only the PO record itself should be updated - stateMachine.js has
// no PO_Verified -> PO_Verified transition.
export const shouldTransitionAfterVerify = (quote) => quote?.status === "Approved_Pending_PO";

export const canApproveAmendment = (po) => Boolean(po?.requires_amendment);
