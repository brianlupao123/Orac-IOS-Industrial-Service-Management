import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("Reports page states its read-only boundary without touching export/calc logic", () => {
  const page = read("src/pages/ReportsPage.jsx");
  assert.match(page, /Read-only views and exports\. Reports do not change quotes, purchase orders, dispatches, stock, or invoices\./);
  // Export remains gated on actual report data rather than the active view.
  assert.match(page, /const canExport = Boolean\(data\) &&/);
  assert.match(page, /data-evidence="reports-page"/);
  assert.match(page, /csvCell\(row\[column\]\)/);
});

test("PO report identifies pre-verification dispatches as legacy exceptions, not authorization", () => {
  const page = read("src/pages/ReportsPage.jsx");
  const start = page.indexOf('<section aria-labelledby="po-summary-title"');
  const block = page.slice(start, page.indexOf('if (active === "worksheets"', start));
  assert.match(block, /Legacy dispatch exceptions/);
  assert.match(block, /does not authorize dispatch/);
  assert.match(block, /verified PO first/);
  assert.match(block, /Legacy Exceptions: Dispatch Started Before PO Verification/);
  assert.match(block, /Exception - PO unverified/);
  assert.doesNotMatch(block, /<StatusBadge status="Approved_Pending_PO"\s*\/>/);
});

test("Dispatch report renders status, timesheet progress, and a started-before-PO risk flag", () => {
  const page = read("src/pages/ReportsPage.jsx");
  const block = page.slice(page.indexOf('active === "dispatch"'), page.indexOf('active === "invoice-ready"'));
  assert.match(block, /<StatusBadge status=\{row\.status\}/);
  assert.match(block, /approved_worksheet_count/);
  assert.match(block, /data-evidence="dispatch-started-before-po"/);
});

test("Invoice-ready report renders a structured table, not raw JSON", () => {
  const page = read("src/pages/ReportsPage.jsx");
  const block = page.slice(page.indexOf('active === "invoice-ready"'), page.indexOf('active === "variance"'));
  assert.match(block, /Dispatches Ready to Invoice/);
  assert.match(block, /row\.dispatch_number \|\| row\.id/);
});

test("Variance report highlights over-budget POs distinctly from under/at-budget ones", () => {
  const page = read("src/pages/ReportsPage.jsx");
  const block = page.slice(page.indexOf('active === "variance"'), page.indexOf("return null;"));
  assert.match(block, /variance > 0 \? "text-red-600" : variance < 0 \? "text-emerald-600" : "text-gray-500"/);
  assert.match(block, /data-evidence="variance-amount"/);
  // No new calculation is introduced: variance is read directly from the report payload.
  assert.match(block, /Number\(row\.variance \|\| 0\)/);
  assert.doesNotMatch(block, /row\.po_amount\s*-\s*row\.logged_value/);
  assert.match(block, /value=\{formatMoney\(totalVariance\)\}/);
  assert.match(block, />\{formatMoney\(row\.po_amount\)\}<\/td>/);
  assert.match(block, />\{formatMoney\(row\.logged_value\)\}<\/td>/);
  assert.match(block, /\{formatSignedMoney\(variance\)\}<\/span>/);
  assert.doesNotMatch(block, /R \{formatNumber\(/);
});

test("Reports uses the shared USD formatters for all visible money", () => {
  const page = read("src/pages/ReportsPage.jsx");
  assert.match(page, /import \{ formatMoney, formatNumber, formatSignedMoney \} from "\.\.\/lib\/format\.js"/);
  assert.match(page, /\{formatMoney\(row\.total_amount\)\}/);
  assert.match(page, /\{formatMoney\(row\.po_amount\)\}/);
  assert.match(page, /\{formatMoney\(row\.logged_value\)\}/);
  assert.match(page, /\{formatSignedMoney\(variance\)\}/);
  assert.doesNotMatch(page, /R \{(?:Number|formatNumber)\(/);
});

test("new/changed Reports markup stays ASCII-only", () => {
  assert.doesNotMatch(read("src/pages/ReportsPage.jsx"), /[^\x00-\x7F]/);
});

test("report evidence actions use the matching protected PDF and respect role access", () => {
  const page = read("src/pages/ReportsPage.jsx");
  assert.match(page, /import \{ documents, reports \} from "\.\.\/api\/client\.js"/);
  assert.match(page, /evidenceAction\("quotes", row\.id\)/);
  assert.match(page, /evidenceAction\("purchase_orders", row\.id\)/);
  assert.match(page, /evidenceAction\("dispatch_cards", row\.id\)/);
  assert.match(page, /evidenceAction\("field_worksheets", row\.id\)/);
  assert.match(page, /user\.role === "Supervisor" \? <span[^>]*>Not available to this role/);
  const invoiceReady = page.slice(page.indexOf('active === "invoice-ready"'), page.indexOf('active === "variance"'));
  assert.match(invoiceReady, /Job card PDF/);
  assert.doesNotMatch(invoiceReady, /evidenceAction\("invoices"/);
  assert.match(page, /await documents\.download\(type, id\)/);
  assert.match(page, /downloadError && <ErrorBanner message=\{downloadError\}/);
});
