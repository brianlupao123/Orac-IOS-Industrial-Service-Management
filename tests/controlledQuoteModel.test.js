import test from "node:test";
import assert from "node:assert/strict";
import {
  APPROVED_UNITS_OF_MEASURE,
  CANONICAL_UNITS_OF_MEASURE,
  COST_TYPES,
  ITEM_TYPES,
  TAX_STATUSES,
  DEFAULT_PROVISIONAL_VAT_RATE,
  APPROVAL_THRESHOLD_USD,
  CLIENT_VISIBLE_QUOTE_STATUSES,
  canApproveQuote,
  canSendQuote,
  formatUSD,
  calculateQuoteBreakdown,
  buildCreateQuotePayload,
  buildUpdateQuotePayload
} from "../src/quoteModel.js";

test("quoteModel exports confirmed business constants", () => {
  assert.equal(DEFAULT_PROVISIONAL_VAT_RATE, 0.15);
  assert.equal(APPROVAL_THRESHOLD_USD, 5000);
  assert.ok(APPROVED_UNITS_OF_MEASURE.includes("hours"));
  assert.ok(APPROVED_UNITS_OF_MEASURE.includes("tonnes"));
  assert.ok(APPROVED_UNITS_OF_MEASURE.includes("m²"));
  assert.ok(COST_TYPES.includes("labour"));
  assert.ok(COST_TYPES.includes("material"));
  assert.ok(TAX_STATUSES.includes("taxable"));
  assert.ok(TAX_STATUSES.includes("provisional"));
  assert.ok(TAX_STATUSES.includes("unconfigured"));
  assert.ok(CLIENT_VISIBLE_QUOTE_STATUSES.includes("Sent"));
  assert.ok(!CLIENT_VISIBLE_QUOTE_STATUSES.includes("Draft"));
});

test("canApproveQuote enforces $5k and discount gates", () => {
  const sales = { id: "s1", role: "Sales" };
  const sales2 = { id: "s2", role: "Sales" };
  const mgmt = { id: "m1", role: "Management" };
  const admin = { id: "a1", role: "Admin" };

  // Sales cannot approve if over $5,000
  const highQuote = { status: "Sent", grand_total_cents: 600000, sent_by: "other" };
  assert.equal(canApproveQuote(highQuote, sales), false);
  assert.equal(canApproveQuote(highQuote, mgmt), true);
  assert.equal(canApproveQuote(highQuote, admin), true);

  // Sales cannot approve if discount > 0
  const discountQuote = { status: "Sent", grand_total_cents: 100000, discount_percent: 5, sent_by: "other" };
  assert.equal(canApproveQuote(discountQuote, sales), false);
  assert.equal(canApproveQuote(discountQuote, mgmt), true);
  assert.equal(canApproveQuote(discountQuote, admin), true);

  // Sales cannot approve own quote
  const ownQuote = { status: "Sent", grand_total_cents: 100000, discount_percent: 0, sent_by: "s1" };
  assert.equal(canApproveQuote(ownQuote, sales), false);
  assert.equal(canApproveQuote(ownQuote, sales2), true);

  // Non-Sent quote cannot be approved
  const draftQuote = { status: "Draft", grand_total_cents: 100000 };
  assert.equal(canApproveQuote(draftQuote, mgmt), false);
});

test("calculateQuoteBreakdown computes pre-tax, discount, tax, and grand total", () => {
  const lines = [
    { description: "Item 1", quantity: 2, unit_price: 100, item_type: "standard" },
    { description: "Item 2", quantity: 1, unit_price: 200, item_type: "standard" }
  ];
  const b = calculateQuoteBreakdown(lines, 10, "provisional", 0.15);
  assert.equal(b.preTax, 400);
  assert.equal(b.discount, 40);
  assert.equal(b.netSubtotal, 360);
  assert.equal(b.taxRate, 0.15);
  assert.equal(b.tax, 54);
  assert.equal(b.grandTotal, 414);
});

test("buildCreateQuotePayload includes USD currency and work packages", () => {
  const form = {
    client_id: "c_01",
    tax_status: "provisional",
    discount_percent: 5,
    scope_summary: "Main shaft refurb",
    lines: [
      {
        description: "Bearing replacement",
        quantity: 2,
        unit_price: 500,
        unit_of_measure: "each",
        cost_type: "material",
        work_package_id: "wp_01"
      }
    ]
  };
  const payload = buildCreateQuotePayload(form);
  assert.equal(payload.currency, "USD");
  assert.equal(payload.tax_status, "provisional");
  assert.equal(payload.discount_percent, 5);
  assert.equal(payload.scope_summary, "Main shaft refurb");
  assert.equal(payload.lines[0].unit_of_measure, "each");
  assert.equal(payload.lines[0].cost_type, "material");

  form.work_packages = [{ id: "wp_01", name: "General Scope" }];
  const payloadWithWp = buildCreateQuotePayload(form);
  assert.equal(payloadWithWp.work_packages[0].title, "General Scope");
  assert.equal(payloadWithWp.work_packages[0].name, "General Scope");
});

test("formatUSD formats currency with $ prefix and commas", () => {
  assert.equal(formatUSD(1234.5), "$1,234.50");
  assert.equal(formatUSD(0), "$0.00");
});
