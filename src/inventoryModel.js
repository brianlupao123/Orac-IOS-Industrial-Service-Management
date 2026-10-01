// Pure helpers for the Inventory page (no React, no network) so the rules that
// matter for stock traceability can be unit-tested. The server remains the
// authority on every one of these rules; this module only avoids sending
// requests that are certain to be refused and prevents accidental duplicates.

// A receipt (stock in, no category) must name a registered supplier and the
// document that proves delivery. A client purchase order is NOT supplier
// purchase evidence (ORAC's purchase_orders collection holds client POs).
export function isSupplierReceipt(form) {
  return form.movement_type === "in" && !form.category;
}

// Extra request fields for a supplier receipt; empty for every other movement
// so issues, returns, scrap and corrections are sent exactly as before.
export function receiptFields(form) {
  if (!isSupplierReceipt(form)) return {};
  return {
    reference_type: "supplier",
    reference_id: form.supplier_id,
    source_document_ref: String(form.source_document_ref || "").trim()
  };
}

// Returns a plain-language problem, or "" when the form is worth sending.
export function movementProblem(form) {
  const quantity = Number(form.quantity);
  if (!form.stock_item_id) return "Choose the stock item.";
  if (!Number.isFinite(quantity) || quantity === 0) return "Enter a quantity that is not zero.";
  if (form.movement_type !== "adjustment" && quantity < 0) return "Enter a positive quantity; the type decides whether stock goes up or down.";
  if (!String(form.reason || "").trim()) return "Give a reason.";
  if (form.category === "scrap" && form.movement_type === "adjustment" && quantity > 0) return "Scrap must reduce stock: enter a negative quantity.";
  if (isSupplierReceipt(form)) {
    if (!form.supplier_id) return "Choose the supplier this stock was received from.";
    if (!String(form.source_document_ref || "").trim()) return "Enter the delivery note or supplier invoice number.";
  }
  return "";
}

// Duplicate-submission key. The same payload keeps the same key (so a double
// click or a retry after a timeout is recognised by the server as ONE request);
// a changed payload gets a new key. Call clearAttempt() after a success.
export function newIdempotencyKey() {
  if (typeof globalThis.crypto?.randomUUID === "function") return `ui-${globalThis.crypto.randomUUID()}`;
  return `ui-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function payloadSignature(payload) {
  return JSON.stringify(Object.keys(payload).sort().map((k) => [k, payload[k]]));
}

export function keyForPayload(attempt, payload, makeKey = newIdempotencyKey) {
  const signature = payloadSignature(payload);
  if (attempt.signature !== signature || !attempt.key) {
    attempt.signature = signature;
    attempt.key = makeKey();
  }
  return attempt.key;
}

export function clearAttempt(attempt) {
  attempt.signature = null;
  attempt.key = null;
}

// "+5 each" / "-3 each": the sign comes from the stored signed quantity, never
// from wording, and the unit always travels with the number.
export function signedQuantityText(movement) {
  const quantity = Number(movement.quantity);
  const unit = movement.unit_of_measure || movement.item_unit_of_measure || "";
  return `${quantity > 0 ? "+" : quantity < 0 ? "-" : ""}${Math.abs(quantity)} ${unit}`.trim();
}

// Movements that point at a dispatch or worksheet record can offer a link to
// the Worksheets page - but only to roles that route actually admits.
export function referenceLinkTarget(movement, canOpenWorksheets) {
  if (!canOpenWorksheets) return null;
  return ["dispatch_card", "material_usage", "return"].includes(movement.reference_type) && movement.reference_id
    ? "/worksheets"
    : null;
}

export const RECONCILIATION_CODE_TEXT = Object.freeze({
  ONHAND_DRIFT: "Stored balance differs from the ledger",
  SUM_MISMATCH: "Movements do not add up to the balance",
  CHAIN_BREAK: "A movement does not start where the previous one ended",
  BALANCE_MATH: "Before + quantity does not equal after",
  SIGN: "Direction and quantity sign disagree",
  MIXED_UNITS: "More than one unit of measure on this item",
  UNIT_MISMATCH: "Movement unit differs from the item's unit",
  NEGATIVE_WITHOUT_OVERRIDE: "Negative balance without an authorised override",
  UNSOURCED_RECEIPT: "Stock increase with no supplier, return or opening-balance source",
  CLIENT_PO_AS_RECEIPT: "Receipt points at a client purchase order",
  SUPPLIER_NOT_FOUND: "Receipt points at a supplier that no longer exists",
  UNMATCHED_RETURN: "Return is not matched to a known dispatch",
  DOUBLE_DEDUCTION: "Worksheet usage deducted stock more than once",
  UNEXPLAINED_STOCK: "Stock on hand with no movement explaining it",
  USAGE_WITHOUT_MOVEMENT: "Worksheet usage never reached the ledger"
});

export function reconciliationText(code) {
  return RECONCILIATION_CODE_TEXT[code] || code;
}

// ── Field material entry helper - BLOCKED, NOT WIRED TO ANY PAGE ───────────────
// The server currently takes unit_cost from the caller and offers no technician-safe item lookup,
// so no screen may call this yet (see CONTRACT_FIELD_MATERIAL_ENTRY.md in the Task 02 packet).
// It is kept, tested, for the day the server supplies BOTH the item list and the cost:
//   - `item` must come from a server endpoint that already authorised this role for this dispatch;
//   - `item.unit_cost` must be the server-supplied cost; the user never types or edits a cost;
//   - an item without a usable cost is refused locally, never defaulted to zero.
export function materialUsageProblem(form, item) {
  if (!item) return "Choose the material used.";
  const quantity = String(form.quantity_used ?? "").trim();
  if (quantity === "" || !Number.isFinite(Number(quantity)) || Number(quantity) <= 0) return "Enter a quantity greater than zero.";
  if (item.unit_cost === null || item.unit_cost === undefined || !Number.isFinite(Number(item.unit_cost)) || Number(item.unit_cost) <= 0) {
    return "This item has no recorded cost, so it cannot be used yet. Ask inventory to set it.";
  }
  return "";
}

// Idempotency key bound to (dispatch + payload):
//  - the same entry sent again (double click, retry after a timeout or error) keeps its key,
//    so the server records and deducts it once;
//  - any change to the entry, or a new entry after clearAttempt() on success, gets a new key.
export function materialSubmission(attempt, dispatchId, form, item, makeKey = newIdempotencyKey) {
  const payload = {
    catalog_item_id: item.catalog_item_id,
    description: item.item_name,
    quantity_used: Number(form.quantity_used),
    unit_cost: Number(item.unit_cost),
    unit_of_measure: item.unit_of_measure
  };
  const idempotency_key = keyForPayload(attempt, { dispatch_card_id: dispatchId, ...payload }, makeKey);
  return { ...payload, idempotency_key };
}

// One submission step. `flight` blocks a second click while a request is in flight; `attempt`
// carries the key between tries.
//  saved   -> key cleared, so the next entry is a NEW submission (new key)
//  failed  -> key kept, so pressing Save again retries the SAME entry (server dedupes)
export async function submitMaterialUsage({ attempt, flight, dispatchId, form, item, send, makeKey = newIdempotencyKey }) {
  if (flight.active) return { status: "blocked" };
  if (!dispatchId) return { status: "invalid", problem: "Select a dispatch card." };
  const problem = materialUsageProblem(form, item);
  if (problem) return { status: "invalid", problem };
  flight.active = true;
  try {
    const body = materialSubmission(attempt, dispatchId, form, item, makeKey);
    await send(dispatchId, body);
    clearAttempt(attempt);
    return { status: "saved", body };
  } catch (error) {
    return { status: "failed", error };
  } finally {
    flight.active = false;
  }
}
