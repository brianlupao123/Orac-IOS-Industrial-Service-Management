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

test("Finance page reads only Finance-readable data and never touches stock, dispatch or worksheets", () => {
  const page = read("src/pages/FinanceCommercialPage.jsx");
  const collectionsRead = [...page.matchAll(/collections\.list\("([a-z_]+)"\)/g)].map((m) => m[1]).sort();
  assert.deepEqual(collectionsRead, ["clients", "purchase_orders", "quotes"]);
  assert.match(page, /reports\.get\("invoice-ready"\)/);
  assert.doesNotMatch(page, /dispatch_cards|field_worksheets|stock_items|inventory|catalog_items/);
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
