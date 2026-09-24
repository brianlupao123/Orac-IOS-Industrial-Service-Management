import test from "node:test";
import assert from "node:assert/strict";
import {
  COORDINATION_ONLY_NOTICE, EMPTY_INTERNAL_REQUEST_FORM, INTERNAL_REQUEST_STATUSES, PRESENTATION_RELATED_TYPE_NARROWING,
  actionButtonsFor, actionLabel, asRequestList, buildInternalRequestPayload, describeHistoryEntry, describeRelated,
  findOption, formatWhen, isForbidden, isStaleState, normaliseOptions, priorityTone, recipientFor, relatedTypeChoices,
  statusTone, validateInternalRequestForm
} from "../src/internalWorkRequestModel.js";

// Test data shaped like the documented GET /internal-work-requests/options response.
const rawOptions = () => ({
  types: [
    { request_type: "STOCK_AVAILABILITY", label: "Stock availability", related_required: false, recipients: ["Operations"], related_entity_types: [{ type: "quote", label: "Quote" }] },
    { request_type: "STOCK_FULFILMENT", label: "Stock fulfilment", related_required: true, recipients: ["Operations"], related_entity_types: [{ type: "quote", label: "Quote" }, { type: "dispatch_card", label: "Dispatch card" }, { type: "stock_item", label: "Stock item" }] },
    { request_type: "PO_AMENDMENT_CONFIRMATION", label: "PO amendment confirmation", related_required: true, recipients: ["Sales", "Operations"], related_entity_types: [{ type: "purchase_order", label: "Purchase order" }] },
    { request_type: "ADMINISTRATIVE_SUPPORT", label: "Administrative support", related_required: false, recipients: ["Admin", "Management"], related_entity_types: [] }
  ],
  priorities: ["Low", "Normal", "High", "Urgent"],
  limits: { subject: 160, description: 2000, note: 1000, relatedId: 100 }
});
const options = normaliseOptions(rawOptions());
const limits = options.limits;
const option = (code) => findOption(options, code);
const form = (overrides = {}) => ({ ...EMPTY_INTERNAL_REQUEST_FORM, ...overrides });

test("normaliseOptions returns a plain, checked copy of the server options", () => {
  assert.deepEqual(options, rawOptions());
  const again = normaliseOptions(rawOptions());
  assert.notEqual(again.types, options.types);
});

test("normaliseOptions rejects malformed responses instead of guessing", () => {
  for (const bad of [null, [], "x", {}, { types: [], priorities: [] }, { types: {}, priorities: [], limits: {} },
    { ...rawOptions(), limits: { subject: 0, description: 5, note: 5, relatedId: 5 } },
    { ...rawOptions(), limits: { subject: "160", description: 5, note: 5, relatedId: 5 } },
    { ...rawOptions(), types: [{ request_type: "X", label: "X" }] },
    { ...rawOptions(), types: [null] }]) {
    assert.throws(() => normaliseOptions(bad), /unexpected options/);
  }
});

test("normaliseOptions tolerates a missing related-record list and drops malformed entries", () => {
  const data = rawOptions();
  delete data.types[0].related_entity_types;
  data.types[1].related_entity_types.push(null, { label: "no type" });
  data.types[1].recipients.push(42);
  const result = normaliseOptions(data);
  assert.deepEqual(result.types[0].related_entity_types, []);
  assert.equal(result.types[1].related_entity_types.length, 3);
  assert.deepEqual(result.types[1].recipients, ["Operations"]);
});

test("findOption finds a server option by code and returns null otherwise", () => {
  assert.equal(findOption(options, "STOCK_FULFILMENT").label, "Stock fulfilment");
  assert.equal(findOption(options, "NOPE"), null);
  assert.equal(findOption(null, "STOCK_FULFILMENT"), null);
});

test("Sales sees only quote for stock fulfilment; nothing else is narrowed", () => {
  assert.deepEqual(relatedTypeChoices(option("STOCK_FULFILMENT"), "Sales").map((item) => item.type), ["quote"]);
  assert.deepEqual(relatedTypeChoices(option("STOCK_FULFILMENT"), "Operations").map((item) => item.type), ["quote", "dispatch_card", "stock_item"]);
  assert.deepEqual(relatedTypeChoices(option("STOCK_AVAILABILITY"), "Sales").map((item) => item.type), ["quote"]);
  assert.deepEqual(relatedTypeChoices(option("PO_AMENDMENT_CONFIRMATION"), "Finance").map((item) => item.type), ["purchase_order"]);
  assert.deepEqual(relatedTypeChoices(option("ADMINISTRATIVE_SUPPORT"), "Sales"), []);
  assert.deepEqual(relatedTypeChoices(null, "Sales"), []);
});

test("the presentation narrowing can only remove choices the server offered, never add", () => {
  const dispatchOnly = { ...option("STOCK_FULFILMENT"), related_entity_types: [{ type: "dispatch_card", label: "Dispatch card" }, { type: "stock_item", label: "Stock item" }] };
  assert.deepEqual(relatedTypeChoices(dispatchOnly, "Sales"), [], "no quote offered by the server means no quote shown");
  assert.deepEqual(relatedTypeChoices(dispatchOnly, "Operations").map((item) => item.type), ["dispatch_card", "stock_item"]);
});

test("the owner's narrowing rule is exactly one entry and cannot be edited at run time", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(PRESENTATION_RELATED_TYPE_NARROWING)), { Sales: { STOCK_FULFILMENT: ["quote"] } });
  assert.ok(Object.isFrozen(PRESENTATION_RELATED_TYPE_NARROWING));
  assert.ok(Object.isFrozen(PRESENTATION_RELATED_TYPE_NARROWING.Sales));
  assert.ok(Object.isFrozen(PRESENTATION_RELATED_TYPE_NARROWING.Sales.STOCK_FULFILMENT));
});

test("actionButtonsFor renders only server-provided actions, in server order, and ignores anything unknown", () => {
  assert.deepEqual(actionButtonsFor(["acknowledge", "reject"]).map((button) => button.action), ["acknowledge", "reject"]);
  assert.deepEqual(actionButtonsFor(["cancel", "start", "start", "complete"]).map((button) => button.action), ["cancel", "start", "complete"]);
  assert.deepEqual(actionButtonsFor(["approve_invoice", "issue_stock", "constructor", 7, null, "complete"]).map((button) => button.action), ["complete"]);
  assert.deepEqual(actionButtonsFor([]), []);
  assert.deepEqual(actionButtonsFor(undefined), []);
  assert.deepEqual(actionButtonsFor("complete"), []);
});

test("action buttons have plain labels and reject/cancel are styled as destructive", () => {
  const byAction = Object.fromEntries(actionButtonsFor(["acknowledge", "start", "complete", "reject", "cancel"]).map((button) => [button.action, button]));
  assert.equal(byAction.acknowledge.label, "Acknowledge");
  assert.equal(byAction.reject.tone, "danger");
  assert.equal(byAction.cancel.tone, "danger");
  assert.equal(byAction.complete.tone, "primary");
  assert.equal(actionLabel("nope"), "");
});

test("recipient is fixed when the server offers exactly one and must be chosen otherwise", () => {
  assert.equal(recipientFor(form(), option("STOCK_AVAILABILITY")), "Operations");
  assert.equal(recipientFor(form(), option("ADMINISTRATIVE_SUPPORT")), "");
  assert.equal(recipientFor(form({ recipient_role: "Management" }), option("ADMINISTRATIVE_SUPPORT")), "Management");
  assert.equal(recipientFor(form({ recipient_role: "Finance" }), option("ADMINISTRATIVE_SUPPORT")), "", "a role the server did not offer is never used");
  assert.equal(recipientFor(form(), null), "");
});

test("validation reports the first problem in plain words and uses the server's limits", () => {
  const admin = option("ADMINISTRATIVE_SUPPORT");
  assert.equal(validateInternalRequestForm(form(), null, limits, "Sales"), "Choose a request type.");
  assert.equal(validateInternalRequestForm(form({ subject: "S", description: "D" }), admin, limits, "Sales"), "Choose who this request is for.");
  assert.equal(validateInternalRequestForm(form({ recipient_role: "Admin", subject: "  ", description: "D" }), admin, limits, "Sales"), "Enter a short subject.");
  assert.equal(validateInternalRequestForm(form({ recipient_role: "Admin", subject: "S", description: " " }), admin, limits, "Sales"), "Describe what you need.");
  assert.equal(validateInternalRequestForm(form({ recipient_role: "Admin", subject: "S", description: "D" }), admin, limits, "Sales"), "");
  const tiny = { subject: 5, description: 8, note: 3, relatedId: 4 };
  assert.match(validateInternalRequestForm(form({ recipient_role: "Admin", subject: "123456", description: "D" }), admin, tiny, "Sales"), /subject cannot be longer than 5/);
  assert.match(validateInternalRequestForm(form({ recipient_role: "Admin", subject: "12345", description: "123456789" }), admin, tiny, "Sales"), /description cannot be longer than 8/);
  assert.equal(validateInternalRequestForm(form({ recipient_role: "Admin", subject: "12345", description: "12345678" }), admin, tiny, "Sales"), "", "limits are inclusive");
});

test("related-record validation follows the server option, including the Sales presentation rule", () => {
  const stock = option("STOCK_FULFILMENT");
  const base = { subject: "S", description: "D" };
  assert.equal(validateInternalRequestForm(form(base), stock, limits, "Sales"), "Choose the related record this request is about.");
  assert.equal(validateInternalRequestForm(form({ ...base, related_entity_type: "quote" }), stock, limits, "Sales"), "Enter the ID of the related record, or clear the record type.");
  assert.equal(validateInternalRequestForm(form({ ...base, related_entity_type: "quote", related_entity_id: "q_1" }), stock, limits, "Sales"), "");
  assert.equal(validateInternalRequestForm(form({ ...base, related_entity_type: "dispatch_card", related_entity_id: "d_1" }), stock, limits, "Sales"), "Choose one of the listed related record types.");
  assert.equal(validateInternalRequestForm(form({ ...base, related_entity_type: "dispatch_card", related_entity_id: "d_1" }), stock, limits, "Operations"), "");
  assert.equal(validateInternalRequestForm(form({ ...base, related_entity_id: "q_1" }), stock, limits, "Sales"), "Choose the type of the related record.");
  assert.match(validateInternalRequestForm(form({ ...base, related_entity_type: "quote", related_entity_id: "x".repeat(101) }), stock, limits, "Sales"), /ID cannot be longer than 100/);
  const optional = option("STOCK_AVAILABILITY");
  assert.equal(validateInternalRequestForm(form(base), optional, limits, "Sales"), "", "an optional related record may be left out");
});

test("a required related record with no available type blocks sending with a clear message", () => {
  const none = { ...option("STOCK_FULFILMENT"), related_entity_types: [] };
  assert.match(validateInternalRequestForm(form({ subject: "S", description: "D" }), none, limits, "Operations"), /none is available to you/);
});

test("the payload is built from a fixed whitelist and never copies identity, tenant, status or history", () => {
  const forged = {
    subject: "  Need stock  ", description: "  Ten units  ", priority: "Urgent", related_entity_type: "quote", related_entity_id: "  q_7  ",
    created_by_user_id: "u_1", created_by_role: "Admin", client_id: "c_1", status: "Completed", assigned_to_user_id: "u_2",
    history: [], created_at: "x", request_type: "ADMINISTRATIVE_SUPPORT", recipient_role: "Admin"
  };
  const payload = buildInternalRequestPayload(forged, option("STOCK_FULFILMENT"));
  assert.deepEqual(payload, {
    request_type: "STOCK_FULFILMENT", subject: "Need stock", description: "Ten units", recipient_role: "Operations",
    priority: "Urgent", related_entity_type: "quote", related_entity_id: "q_7"
  });
});

test("the payload leaves out empty optional fields and unpaired related fields", () => {
  const payload = buildInternalRequestPayload(form({ subject: "S", description: "D", recipient_role: "Management", related_entity_type: "quote" }), option("ADMINISTRATIVE_SUPPORT"));
  assert.deepEqual(payload, { request_type: "ADMINISTRATIVE_SUPPORT", subject: "S", description: "D", recipient_role: "Management" });
});

test("related-record text shows the label only when the server says it is viewable", () => {
  assert.equal(describeRelated({ type: "quote", type_label: "Quote", id: "q_1", label: "Q-0042", viewable: true }), "Quote: Q-0042");
  assert.equal(describeRelated({ type: "dispatch_card", type_label: "Dispatch card", id: null, label: null, viewable: false }), "Dispatch card (details not available to you)");
  assert.equal(describeRelated(null), "");
  assert.equal(describeRelated(undefined), "");
});

test("history entries read as a plain sentence and tolerate missing parts", () => {
  assert.equal(describeHistoryEntry({ actor_name: "Ana", actor_role: "Operations", action: "acknowledge", from_status: "Submitted", to_status: "Acknowledged" }), "Ana (Operations): acknowledge, Submitted to Acknowledged");
  assert.equal(describeHistoryEntry({ action: "submit", to_status: "Submitted" }), "Someone: submit, Submitted");
  assert.equal(describeHistoryEntry(null), "");
});

test("dates fall back to a dash instead of showing Invalid Date", () => {
  assert.equal(formatWhen(""), "-");
  assert.equal(formatWhen("not a date"), "-");
  assert.notEqual(formatWhen("2026-09-24T08:00:00.000Z"), "-");
});

test("error helpers read the HTTP status, not the message text", () => {
  assert.equal(isForbidden({ status: 403 }), true);
  assert.equal(isForbidden({ status: 404 }), false);
  assert.equal(isForbidden(new Error("Forbidden")), false);
  assert.equal(isForbidden(null), false);
  assert.equal(isStaleState({ status: 409 }), true);
  assert.equal(isStaleState({ status: 404 }), true);
  assert.equal(isStaleState({ status: 403 }), false);
  assert.equal(isStaleState(undefined), false);
});

test("list responses are checked, not assumed", () => {
  assert.deepEqual(asRequestList([{ id: "a" }], "your requests"), [{ id: "a" }]);
  assert.deepEqual(asRequestList([], "your requests"), []);
  for (const bad of [null, undefined, {}, "x", { data: [] }]) assert.throws(() => asRequestList(bad, "your requests"), /unexpected response for your requests/);
});

test("statuses and priorities have tones with a safe fallback", () => {
  assert.deepEqual([...INTERNAL_REQUEST_STATUSES], ["Submitted", "Acknowledged", "In Progress", "Completed", "Rejected", "Cancelled"]);
  for (const status of INTERNAL_REQUEST_STATUSES) assert.match(statusTone(status), /^bg-/);
  for (const priority of ["Low", "Normal", "High", "Urgent"]) assert.match(priorityTone(priority), /^bg-/);
  assert.equal(statusTone("Something else"), "bg-gray-100 text-gray-700");
  assert.equal(priorityTone(undefined), "bg-gray-100 text-gray-700");
});

test("prototype-style keys never match a tone, label or narrowing entry", () => {
  for (const key of ["constructor", "__proto__", "toString", "hasOwnProperty"]) {
    assert.equal(statusTone(key), "bg-gray-100 text-gray-700", key);
    assert.equal(priorityTone(key), "bg-gray-100 text-gray-700", key);
    assert.equal(actionLabel(key), "", key);
    assert.deepEqual(relatedTypeChoices(option("STOCK_FULFILMENT"), key).map((item) => item.type), ["quote", "dispatch_card", "stock_item"], key);
    assert.deepEqual(relatedTypeChoices({ ...option("STOCK_FULFILMENT"), request_type: key }, "Sales").map((item) => item.type), ["quote", "dispatch_card", "stock_item"], key);
  }
});

test("the coordination-only notice states what a request never does", () => {
  for (const phrase of [/coordination only/i, /stock/i, /purchase order/i, /invoice/i, /access/i]) assert.match(COORDINATION_ONLY_NOTICE, phrase);
});
