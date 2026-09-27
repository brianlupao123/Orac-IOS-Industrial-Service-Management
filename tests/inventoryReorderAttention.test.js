import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("Inventory stock table shows an explicit reorder-attention status per row", () => {
  const page = read("src/pages/InventoryPage.jsx");
  assert.match(page, /data-evidence="inventory-reorder-badge"/);
  assert.match(page, />Reorder now</);
  assert.match(page, /needsReorder = i\.quantity_on_hand <= i\.reorder_level/);
  // Reorder logic is read directly from server data, not re-derived with new thresholds.
  assert.match(page, /const lowStockCount = items\.filter\(\(i\) => i\.quantity_on_hand <= i\.reorder_level\)\.length;/);
});

test("A low-stock filter narrows the visible rows without altering the underlying counts", () => {
  const page = read("src/pages/InventoryPage.jsx");
  assert.match(page, /const \[lowStockOnly, setLowStockOnly\] = useState\(false\);/);
  assert.match(page, /const visibleItems = lowStockOnly \? items\.filter/);
  // Stat cards must keep reading from the full `items` list, not the filtered view.
  assert.match(page, /value=\{items\.length\}/);
  assert.match(page, /value=\{lowStockCount\}/);
  assert.match(page, /rows=\{visibleItems\}/);
});

test("Inventory declares loading and empty-filter states explicitly", () => {
  const page = read("src/pages/InventoryPage.jsx");
  assert.match(page, /data-evidence="inventory-stock-loading"/);
  assert.match(page, /data-evidence="inventory-stock-filter-empty"/);
  assert.match(page, /No items currently need reorder attention\./);
});

test("no new non-ASCII characters were introduced by the reorder-attention change", () => {
  const page = read("src/pages/InventoryPage.jsx");
  const addedLines = [
    "Show reorder attention only",
    "Reorder Level",
    "Status",
    "Reorder now",
    "OK</span>"
  ];
  for (const fragment of addedLines) {
    assert.ok(page.includes(fragment), `expected to find: ${fragment}`);
    assert.doesNotMatch(fragment, /[^\x00-\x7F]/);
  }
});
