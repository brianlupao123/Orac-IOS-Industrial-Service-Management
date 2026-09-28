import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("movement-type wording is unambiguous business language, not raw In/Out/Adj shorthand", () => {
  const page = read("src/pages/InventoryPage.jsx");
  assert.match(page, /Receipt \(increases stock\)/);
  assert.match(page, /Issue \/ use \(decreases stock\)/);
  assert.match(page, /Correction \(adjustment\)/);
  // The old ambiguous labels must be gone, not just supplemented.
  assert.doesNotMatch(page, />In \(\+\)</);
  assert.doesNotMatch(page, />Out \(-\)</);
  assert.doesNotMatch(page, />Adj</);
});

test("each stock row offers a Movement History action wired to the per-item history endpoint", () => {
  const page = read("src/pages/InventoryPage.jsx");
  assert.match(page, /async function openHistory\(item\)/);
  assert.match(page, /inventory\.itemMovements\(item\.id\)/);
  assert.match(page, />\s*History\s*</);
});

test("the history modal shows quantity before/after, reason, actor/time and linked reference — never an invented one", () => {
  const page = read("src/pages/InventoryPage.jsx");
  assert.match(page, /data-evidence="inventory-history-row"/);
  assert.match(page, /m\.quantity_before/);
  assert.match(page, /m\.quantity_after/);
  assert.match(page, /m\.reason/);
  assert.match(page, /By \{m\.actor_name \|\| "Unknown user"\}/);
  // Reference is only ever shown when the server actually resolved one.
  assert.match(page, /m\.reference_label \? <> · \{m\.reference_label\}<\/> : null/);
  assert.match(page, /data-evidence="inventory-history-empty"/);
  assert.match(page, /data-evidence="inventory-history-loading"/);
});

test("reorder status is explained using only what the API returns, not a client-invented lead time", () => {
  const page = read("src/pages/InventoryPage.jsx");
  assert.match(page, /data-evidence="inventory-reorder-explanation"/);
  assert.match(page, /\{i\.reorder_explanation\}/);
  // No hard-coded lead-time text or fabricated supplier names in the page itself.
  assert.doesNotMatch(page, /typically takes \d/);
});

test("the inventory API client exposes ledger reads for both the full ledger and one item's history", () => {
  const client = read("src/api/client.js");
  assert.match(client, /listMovements\(stockItemId\)/);
  assert.match(client, /\/inventory\/movements/);
  assert.match(client, /itemMovements\(id\)/);
  assert.match(client, /\/inventory\/stock_items\/\$\{id\}\/movements/);
});

test("history uses business wording, never raw in/out/adjustment codes", () => {
  const page = read("src/pages/InventoryPage.jsx");
  assert.match(page, /function movementLabel\(m\)/);
  assert.match(page, /\{movementLabel\(m\)\}/);
  assert.doesNotMatch(page, /· \{m\.movement_type\}/);
  for (const label of ["Direct sale issue", "Return to stock", "Scrap / write-off", "Opening balance", "Service dispatch use", "Supplier receipt"]) {
    assert.ok(page.includes(label), `missing label: ${label}`);
  }
});

test("the movement form can record a return or a scrap, and sends reference_type only when chosen", () => {
  const page = read("src/pages/InventoryPage.jsx");
  assert.match(page, /data-evidence="inventory-movement-category"/);
  assert.match(page, /value="return">Return to stock/);
  assert.match(page, /value="scrap">Scrap \/ write-off/);
  assert.match(page, /\.\.\.\(form\.category \? \{ reference_type: form\.category \} : \{\}\)/);
});

test("the UI exposes no path to the direct-sale endpoint (Chat C owns that flow)", () => {
  const page = read("src/pages/InventoryPage.jsx");
  const client = read("src/api/client.js");
  assert.doesNotMatch(page, /direct-sale/);
  assert.doesNotMatch(client, /direct-sale/);
});
