import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  isSupplierReceipt, receiptFields, movementProblem, keyForPayload, clearAttempt,
  signedQuantityText, referenceLinkTarget, reconciliationText, newIdempotencyKey
} from "../src/inventoryModel.js";
import { canAccessRoute } from "../src/accessPolicy.js";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const base = { stock_item_id: "si-1", movement_type: "in", quantity: "5", reason: "Delivery", category: "", supplier_id: "sup-1", source_document_ref: "DN-1", override_negative: false };

// ── Receipt ──────────────────────────────────────────────────────────────────
test("a plain receipt is a supplier receipt and sends supplier + trimmed source document", () => {
  assert.equal(isSupplierReceipt(base), true);
  assert.deepEqual(receiptFields({ ...base, source_document_ref: "  DN-1  " }), { reference_type: "supplier", reference_id: "sup-1", source_document_ref: "DN-1" });
});

test("issues, returns, scrap and corrections add no receipt fields", () => {
  for (const f of [{ movement_type: "out" }, { movement_type: "in", category: "return" }, { movement_type: "adjustment", category: "scrap" }, { movement_type: "adjustment" }]) {
    assert.equal(isSupplierReceipt({ ...base, ...f }), false);
    assert.deepEqual(receiptFields({ ...base, ...f }), {});
  }
});

test("a receipt cannot be submitted without a supplier or a delivery document", () => {
  assert.match(movementProblem({ ...base, supplier_id: "" }), /supplier/i);
  assert.match(movementProblem({ ...base, source_document_ref: "  " }), /delivery note|invoice/i);
  assert.equal(movementProblem(base), "");
});

// ── Issue / return / scrap / correction wording and validation ───────────────
test("form-level checks: item, non-zero quantity, sign by type, reason, scrap direction", () => {
  const out = { ...base, movement_type: "out", supplier_id: "", source_document_ref: "" };
  assert.match(movementProblem({ ...out, stock_item_id: "" }), /item/i);
  assert.match(movementProblem({ ...out, quantity: "0" }), /not zero/);
  assert.match(movementProblem({ ...out, quantity: "-2" }), /positive/);
  assert.match(movementProblem({ ...out, reason: " " }), /reason/i);
  assert.equal(movementProblem(out), "");
  const scrap = { ...base, movement_type: "adjustment", category: "scrap" };
  assert.match(movementProblem({ ...scrap, quantity: "2" }), /reduce stock/);
  assert.equal(movementProblem({ ...scrap, quantity: "-2" }), "");
  assert.equal(movementProblem({ ...base, movement_type: "adjustment", quantity: "-3" }), "", "a signed correction is allowed");
  assert.equal(movementProblem({ ...base, category: "return", quantity: "1" }), "", "a return does not need supplier fields");
});

test("signed quantity always carries its sign and unit", () => {
  assert.equal(signedQuantityText({ quantity: 5, unit_of_measure: "each" }), "+5 each");
  assert.equal(signedQuantityText({ quantity: -3, unit_of_measure: "m2" }), "-3 m2");
  assert.equal(signedQuantityText({ quantity: -3, item_unit_of_measure: "kg" }), "-3 kg");
});

// ── Duplicate submission ─────────────────────────────────────────────────────
test("the same payload keeps one idempotency key across retries; a changed payload gets a new one", () => {
  const attempt = { signature: null, key: null };
  let n = 0;
  const make = () => `key-${++n}`;
  const p1 = { a: 1, b: "x" };
  const k1 = keyForPayload(attempt, p1, make);
  assert.equal(keyForPayload(attempt, { b: "x", a: 1 }, make), k1, "retry / double click reuses the key regardless of property order");
  assert.notEqual(keyForPayload(attempt, { a: 2, b: "x" }, make), k1, "edited request is a different request");
  const k3 = keyForPayload(attempt, { a: 2, b: "x" }, make);
  clearAttempt(attempt);
  assert.notEqual(keyForPayload(attempt, { a: 2, b: "x" }, make), k3, "after a success the next identical entry is a NEW movement");
});

test("generated keys satisfy the server's key pattern (8-128 of letters, digits . _ : -)", () => {
  for (let i = 0; i < 20; i++) assert.match(newIdempotencyKey(), /^[A-Za-z0-9._:-]{8,128}$/);
});

// ── Links and client isolation ───────────────────────────────────────────────
test("history links go only to roles the Worksheets route admits, and only for dispatch-related references", () => {
  const worksheetRoles = ["Admin", "Management", "Operations", "Supervisor", "Technician"];
  for (const role of ["Admin", "Management", "Operations", "Supervisor", "Technician", "Sales", "Finance", "Client Viewer"]) {
    assert.equal(canAccessRoute(role, "/worksheets"), worksheetRoles.includes(role), role);
    const target = referenceLinkTarget({ reference_type: "material_usage", reference_id: "mu-1" }, canAccessRoute(role, "/worksheets"));
    assert.equal(target, worksheetRoles.includes(role) ? "/worksheets" : null, role);
  }
  assert.equal(referenceLinkTarget({ reference_type: "supplier", reference_id: "sup-1" }, true), null);
  assert.equal(referenceLinkTarget({ reference_type: "material_usage", reference_id: null }, true), null);
});

test("the inventory route stays closed to Client Viewer and every role without inventory permission", () => {
  for (const role of ["Sales", "Finance", "Technician", "Supervisor", "Client Viewer"]) assert.equal(canAccessRoute(role, "/inventory"), false, role);
  for (const role of ["Admin", "Management", "Operations"]) assert.equal(canAccessRoute(role, "/inventory"), true, role);
});

test("every reconciliation code the server can emit has readable wording", () => {
  for (const code of ["ONHAND_DRIFT", "SUM_MISMATCH", "CHAIN_BREAK", "BALANCE_MATH", "SIGN", "MIXED_UNITS", "UNIT_MISMATCH", "NEGATIVE_WITHOUT_OVERRIDE", "UNSOURCED_RECEIPT", "CLIENT_PO_AS_RECEIPT", "SUPPLIER_NOT_FOUND", "UNMATCHED_RETURN", "DOUBLE_DEDUCTION", "UNEXPLAINED_STOCK", "USAGE_WITHOUT_MOVEMENT"]) {
    assert.notEqual(reconciliationText(code), code, `${code} has no readable text`);
  }
  assert.equal(reconciliationText("SOMETHING_NEW"), "SOMETHING_NEW");
});

// ── Page wiring (source-level, like the existing inventory tests) ────────────
test("the movement form collects supplier and source document for receipts and blocks double submits", () => {
  const page = read("src/pages/InventoryPage.jsx");
  assert.match(page, /data-evidence="inventory-receipt-supplier"/);
  assert.match(page, /data-evidence="inventory-receipt-document"/);
  assert.match(page, /\.\.\.receiptFields\(form\)/);
  assert.match(page, /idempotency_key: keyForPayload\(attempt\.current, payload\)/);
  assert.match(page, /if \(submitting\) return;/);
  assert.match(page, /disabled=\{submitting\}/);
  assert.match(page, /clearAttempt\(attempt\.current\)/);
});

test("existing movement-category payload wiring is preserved", () => {
  const page = read("src/pages/InventoryPage.jsx");
  assert.match(page, /\.\.\.\(form\.category \? \{ reference_type: form\.category \} : \{\}\)/);
  assert.match(page, /override_negative: form\.override_negative/);
});

test("history shows the source document and a Timesheets link, without inventing either", () => {
  const page = read("src/pages/InventoryPage.jsx");
  assert.match(page, /m\.source_document_ref \? <> · Source document \{m\.source_document_ref\}<\/> : null/);
  assert.match(page, /data-evidence="inventory-history-link"/);
  assert.match(page, /canAccessRoute\(user\.role, "\/worksheets"\)/);
});

test("a client purchase order reference is never labelled as a purchase receipt", () => {
  const page = read("src/pages/InventoryPage.jsx");
  assert.doesNotMatch(page, /Purchase order receipt/);
  assert.match(page, /purchase_order: "Client PO reference"/);
});

test("the Reconciliation tab is read-only, manager-only and wired to the API client", () => {
  const page = read("src/pages/InventoryPage.jsx");
  const client = read("src/api/client.js");
  assert.match(page, /\{ id: "reconciliation", label: "Reconciliation" \}/);
  assert.match(page, /activeTab === "reconciliation" && canManage/);
  assert.match(page, /inventory\.reconciliation\(\)/);
  assert.match(page, /data-evidence="inventory-reconciliation-row"/);
  assert.match(client, /reconciliation\(stockItemId\)/);
  assert.match(client, /\/inventory\/reconciliation/);
  const tab = page.slice(page.indexOf("RECONCILIATION TAB"), page.indexOf("SUPPLIERS TAB"));
  assert.doesNotMatch(tab, /recordMovement|onClick=\{.*(create|update|delete)/i, "the reconciliation view must not mutate stock");
});

test("pilot boundary: no walk-in, cash-sale or direct-sale path exists in the inventory UI or API client", () => {
  const page = read("src/pages/InventoryPage.jsx");
  const client = read("src/api/client.js");
  const model = read("src/inventoryModel.js");
  for (const [name, text] of [["page", page], ["client", client], ["model", model]]) {
    assert.doesNotMatch(text, /direct-sale|directSale|cash[_ -]?sale|counter[_ -]?sale/i, name);
  }
});
