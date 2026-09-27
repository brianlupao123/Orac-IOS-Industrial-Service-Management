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
});

test("new/changed Reports markup stays ASCII-only", () => {
  assert.doesNotMatch(read("src/pages/ReportsPage.jsx"), /[^\x00-\x7F]/);
});
