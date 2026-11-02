import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCreateQuotePayload, buildUpdateQuotePayload, canApproveQuote, canSendQuote, lineTotal,
  prefillFromLead, quoteActionsFor, quoteStatusLabel, quoteTotal, validateQuoteForm
} from "../src/quoteModel.js";

const FORGED = {
  id: "q_x", quote_number: "Q-9999", status: "Invoiced", sent_by: "u_other", created_by: "u_other",
  total_amount: 999999, created_at: "2020-01-01", updated_at: "2020-01-01"
};

test("the create payload copies only whitelisted fields and never identity, status or totals", () => {
  const payload = buildCreateQuotePayload({
    client_id: "c1", equipment_tag_id: "eq1",
    lines: [{ description: "  Labour  ", quantity: 2, unit_price: 50, ...FORGED }],
    ...FORGED
  });
  assert.deepEqual(payload, {
    client_id: "c1",
    equipment_tag_id: "eq1",
    lines: [{ catalog_item_id: null, description: "Labour", quantity: 2, unit_price: 50 }]
  });
  for (const key of Object.keys(FORGED)) assert.equal(key in payload, false, `${key} must not be sent`);
  assert.equal("catalog_item_id" in payload.lines[0] && payload.lines[0].catalog_item_id, null, "lines are always free-text, never linked to a catalog item this UI cannot read");
});

test("the update payload omits client_id (not accepted by UpdateQuoteSchema) and equipment_tag_id when blank", () => {
  const payload = buildUpdateQuotePayload({ client_id: "c1", equipment_tag_id: "  ", lines: [{ description: "Materials", quantity: 1, unit_price: 10 }] });
  assert.deepEqual(payload, { lines: [{ catalog_item_id: null, description: "Materials", quantity: 1, unit_price: 10 }] });
  assert.equal("client_id" in payload, false);
});

test("form validation catches a missing client, missing lines and bad line values", () => {
  assert.match(validateQuoteForm({ client_id: "", lines: [] }), /client/i);
  assert.match(validateQuoteForm({ client_id: "c1", lines: [] }), /at least one line/i);
  assert.match(validateQuoteForm({ client_id: "c1", lines: [{ description: "", quantity: 1, unit_price: 1 }] }), /description/i);
  assert.match(validateQuoteForm({ client_id: "c1", lines: [{ description: "X", quantity: 0, unit_price: 1 }] }), /quantity/i);
  assert.match(validateQuoteForm({ client_id: "c1", lines: [{ description: "X", quantity: 1, unit_price: -1 }] }), /unit price/i);
  assert.equal(validateQuoteForm({ client_id: "c1", lines: [{ description: "X", quantity: 1, unit_price: 0 }] }), "");
});

test("line and quote totals are computed correctly and tolerate bad input", () => {
  assert.equal(lineTotal({ quantity: 3, unit_price: 25 }), 75);
  assert.equal(lineTotal({ quantity: "bad", unit_price: 25 }), 0);
  assert.equal(quoteTotal([{ quantity: 2, unit_price: 10 }, { quantity: 1, unit_price: 5 }]), 25);
  assert.equal(quoteTotal([]), 0);
  assert.equal(quoteTotal(null), 0);
});

test("only a Draft quote offers edit, send or cancel", () => {
  assert.deepEqual(quoteActionsFor({ status: "Draft" }), { canEdit: true, canCancel: true, canSend: true });
  for (const status of ["Sent", "Approved_Pending_PO", "PO_Verified", "Field_Dispatch", "Invoiced", "Cancelled"]) {
    assert.deepEqual(quoteActionsFor({ status }), { canEdit: false, canCancel: false, canSend: false }, status);
  }
});

test("a Sales actor cannot approve the quote they personally sent, mirroring the server's separation-of-duties rule", () => {
  const sentQuote = { status: "Sent", sent_by: "u_sales_1" };
  assert.equal(canApproveQuote(sentQuote, { id: "u_sales_1", role: "Sales" }), false, "same Sales sender is blocked");
  assert.equal(canApproveQuote(sentQuote, { id: "u_sales_2", role: "Sales" }), true, "a different Sales colleague can approve");
  assert.equal(canApproveQuote(sentQuote, { id: "u_sales_1", role: "Admin" }), true, "Admin approving is never blocked by this rule");
  assert.equal(canApproveQuote(sentQuote, { id: "u_sales_1", role: "Operations" }), false, "Operations has no quotation approval authority");
  assert.equal(canApproveQuote({ status: "Sent" }, { id: "u_sales_1", role: "Sales" }), true, "a legacy quote with no recorded sent_by is not blocked");
  assert.equal(canApproveQuote({ status: "Draft", sent_by: "u_sales_1" }, { id: "u_sales_1", role: "Sales" }), false, "only a Sent quote can be approved at all");
  assert.equal(canApproveQuote(sentQuote, null), false, "no actor means no approval");
});

test("a quote can be sent only when Draft, has a client and has at least one line", () => {
  assert.equal(canSendQuote({ status: "Draft", client_id: "c1" }, 1), true);
  assert.equal(canSendQuote({ status: "Draft", client_id: "c1" }, 0), false);
  assert.equal(canSendQuote({ status: "Draft", client_id: "" }, 1), false);
  assert.equal(canSendQuote({ status: "Sent", client_id: "c1" }, 1), false);
});

test("quote status labels are human-readable and fall back safely for unknown values", () => {
  assert.equal(quoteStatusLabel("Approved_Pending_PO"), "Approved, pending PO");
  assert.equal(quoteStatusLabel("Draft"), "Draft");
  assert.equal(quoteStatusLabel("Something_New"), "Something_New");
  assert.equal(quoteStatusLabel(undefined), "\u2014");
});

test("prefilling from a lead copies only client, equipment tag and a starting description; never the lead's identity", () => {
  const prefill = prefillFromLead({ id: "lead_1", client_id: "c1", equipment_tag_id: "eq1", service_need: "Replace conveyor idler", status: "New" });
  assert.equal(prefill.client_id, "c1");
  assert.equal(prefill.equipment_tag_id, "eq1");
  assert.equal(prefill.lines.length, 1);
  assert.equal(prefill.lines[0].description, "Replace conveyor idler");
  assert.equal("id" in prefill, false);
  assert.equal("status" in prefill, false);
});

test("prefilling from an empty/missing lead does not throw and returns a usable blank form", () => {
  const prefill = prefillFromLead(undefined);
  assert.equal(prefill.client_id, "");
  assert.equal(prefill.equipment_tag_id, "");
  assert.equal(prefill.lines[0].description, "");
});
