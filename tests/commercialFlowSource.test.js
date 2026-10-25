import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("Quotations page reads only collections the Sales role is already allowed to read", () => {
  const page = read("src/pages/QuotationsPage.jsx");
  const collectionsRead = [...page.matchAll(/collections\.list\("([a-z_]+)"\)/g)].map((m) => m[1]).sort();
  assert.deepEqual(collectionsRead, ["clients", "leads", "quote_lines", "quotes"]);
  assert.doesNotMatch(page, /catalog_items|equipment_tags|stock_items|inventory/, "no catalog/equipment/inventory data is pulled in for a price lookup");
});

test("Quotations page gates Approve through canApproveQuote and always sends null catalog ids", () => {
  const page = read("src/pages/QuotationsPage.jsx");
  assert.match(page, /canApproveQuote\(quote, user\)/);
  assert.match(page, /quotesApi\.transition\(quote\.id, "Approved_Pending_PO"\)/);
  assert.match(read("src/quoteModel.js"), /catalog_item_id: null/);
});

test("Quote cards show only recorded quote, revision and client-acceptance evidence", () => {
  const page = read("src/pages/QuotationsPage.jsx");
  assert.match(page, /data-evidence="quote-summary"/);
  assert.match(page, /revision_of_quote_id/);
  assert.match(page, /amended_po_evidence/);
  assert.match(page, /No revision or client-acceptance evidence recorded on this quote/);
  assert.doesNotMatch(page, /collections\.list\("purchase_orders"\)/);
});

test("Quote evidence analysis is separately flag-gated and remains a typed read-only request", () => {
  const page = read("src/pages/QuotationsPage.jsx");
  const client = read("src/api/client.js");
  assert.match(page, /recordAnalysisVisible\(\)/);
  assert.match(page, /assistant\.recordAnalysis\("quote", quote\.id\)/);
  assert.match(read("src/components/RecordAnalysisModal.jsx"), /does not approve, verify, authorize or change a record/);
  assert.match(client, /recordAnalysis\(recordType, recordId\)/);
  assert.match(client, /\/ai\/record-analysis/);
  assert.match(read("src/recordAnalysisFlags.js"), /VITE_ORAC_RECORD_TRAIL_V1/);
});

test("Finance page reads only Finance-readable data and never touches stock, dispatch or worksheets", () => {
  const page = read("src/pages/FinanceCommercialPage.jsx");
  const collectionsRead = [...page.matchAll(/collections\.list\("([a-z_]+)"\)/g)].map((m) => m[1]).sort();
  assert.deepEqual(collectionsRead, ["clients", "purchase_orders", "quotes"]);
  assert.match(page, /reports\.get\("invoice-ready"\)/);
  assert.doesNotMatch(page, /dispatch_cards|field_worksheets|stock_items|inventory|catalog_items/);
});

test("Finance PO cards identify stored authority, verification and amendment evidence without reading audit logs", () => {
  const page = read("src/pages/FinanceCommercialPage.jsx");
  assert.match(page, /data-evidence="purchase-order-summary"/);
  assert.match(page, /verified_by/);
  assert.match(page, /verified_at/);
  assert.match(page, /logged_value/);
  assert.match(page, /Written amendment required before invoicing/);
  assert.doesNotMatch(page, /collections\.list\("audit_logs"\)/);
});

test("Finance PO analysis is separately flag-gated and uses only the typed record-analysis request", () => {
  const page = read("src/pages/FinanceCommercialPage.jsx");
  assert.match(page, /recordAnalysisVisible\(\)/);
  assert.match(page, /assistant\.recordAnalysis\("purchase_order", po\.id\)/);
  assert.match(page, /Purchase order evidence analysis/);
  assert.match(read("src/components/RecordAnalysisModal.jsx"), /source-backed summary/);
});

test("Finance page performs exactly the three server-gated actions and verifies before advancing the quote", () => {
  const page = read("src/pages/FinanceCommercialPage.jsx");
  assert.match(page, /quotesApi\.verifyPo\(/);
  assert.match(page, /shouldTransitionAfterVerify\(quote\)/);
  assert.match(page, /quotesApi\.transition\(po\.quotation_id, "PO_Verified"\)/);
  assert.match(page, /poApi\.approveAmendment\(/);
  assert.match(page, /quotesApi\.transition\(row\.quotation_id, "Invoiced"\)/);
  assert.ok(page.indexOf("quotesApi.verifyPo(") < page.indexOf('"PO_Verified"'), "PO is recorded before the state transition");
});

test("Reports page stays read-only: it gained no commercial write calls", () => {
  const page = read("src/pages/ReportsPage.jsx");
  assert.doesNotMatch(page, /verifyPo|approveAmendment|\.transition\(|quotesApi|poApi/);
});

test("purchaseOrders.approveAmendment posts only new_amount and an optional reason", () => {
  const client = read("src/api/client.js");
  const block = client.slice(client.indexOf("export const purchaseOrders"), client.indexOf("export const dispatch"));
  assert.match(block, /\/purchase_orders\/\$\{encodeURIComponent\(poId\)\}\/amendments/);
  assert.doesNotMatch(block, /approved_by|approved_at|previous_amount/);
});
