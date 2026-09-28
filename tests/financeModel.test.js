import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAmendmentPayload, buildVerifyPoPayload, canApproveAmendment, canVerifyPo,
  shouldTransitionAfterVerify, validateAmendmentForm, validateVerifyPoForm
} from "../src/financeModel.js";

const FORGED_PO = { id: "po_x", status: "verified", verified_by: "u_other", verified_at: "2020-01-01", quotation_id: "q_x" };

test("verify-PO validation requires a reference and a positive amount", () => {
  assert.match(validateVerifyPoForm({ po_reference: "", po_amount: 100 }), /reference/i);
  assert.match(validateVerifyPoForm({ po_reference: "PO-1", po_amount: 0 }), /amount/i);
  assert.match(validateVerifyPoForm({ po_reference: "PO-1", po_amount: -5 }), /amount/i);
  assert.equal(validateVerifyPoForm({ po_reference: "PO-1", po_amount: 100 }), "");
});

test("the verify-PO payload copies only reference and amount, never status or identity fields", () => {
  const payload = buildVerifyPoPayload({ po_reference: "  PO-42  ", po_amount: "250", ...FORGED_PO });
  assert.deepEqual(payload, { po_reference: "PO-42", po_amount: 250 });
  for (const key of Object.keys(FORGED_PO)) assert.equal(key in payload, false, `${key} must not be sent`);
});

test("amendment validation requires the new amount to exceed the PO's current amount", () => {
  assert.match(validateAmendmentForm({ new_amount: 0 }, 100), /greater than zero/);
  assert.match(validateAmendmentForm({ new_amount: 100 }, 100), /greater than the current PO amount/);
  assert.match(validateAmendmentForm({ new_amount: 90 }, 100), /greater than the current PO amount/);
  assert.equal(validateAmendmentForm({ new_amount: 150 }, 100), "");
  assert.equal(validateAmendmentForm({ new_amount: 150 }, undefined), "", "no current amount to compare against still allows a positive amount");
});

test("the amendment payload copies only new_amount and an optional reason", () => {
  assert.deepEqual(buildAmendmentPayload({ new_amount: "150", reason: "  Extra shift hours  " }), { new_amount: 150, reason: "Extra shift hours" });
  assert.deepEqual(buildAmendmentPayload({ new_amount: "150", reason: "  " }), { new_amount: 150 }, "blank reason is omitted so the server default applies");
  assert.equal("approved_by" in buildAmendmentPayload({ new_amount: 150, approved_by: "u_x" }), false);
});

test("a PO can only be verified while pending and its quote is Approved_Pending_PO", () => {
  assert.equal(canVerifyPo({ status: "pending" }, { status: "Approved_Pending_PO" }), true);
  assert.equal(canVerifyPo({ status: "verified" }, { status: "Approved_Pending_PO" }), false, "already verified");
  assert.equal(canVerifyPo({ status: "pending" }, { status: "Draft" }), false, "quote not yet approved");
  assert.equal(canVerifyPo({ status: "pending" }, { status: "PO_Verified" }), false, "already advanced past the transition this action performs");
});

test("verifying only advances the quote when it is still Approved_Pending_PO", () => {
  assert.equal(shouldTransitionAfterVerify({ status: "Approved_Pending_PO" }), true);
  assert.equal(shouldTransitionAfterVerify({ status: "PO_Verified" }), false);
  assert.equal(shouldTransitionAfterVerify({ status: "Draft" }), false);
});

test("only a PO flagged requires_amendment offers the approve-amendment action", () => {
  assert.equal(canApproveAmendment({ requires_amendment: true }), true);
  assert.equal(canApproveAmendment({ requires_amendment: false }), false);
  assert.equal(canApproveAmendment({}), false);
});
