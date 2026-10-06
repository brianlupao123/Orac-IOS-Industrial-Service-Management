import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  EMPTY_TIMESHEET_FORM, totalHours, reviewHints, validateTimesheetForm, buildTimesheetPayload, formFromTimesheet, hoursSummary, signoffProgress, isTimesheetV2
} from "../src/lib/timesheetFormLogic.js";
import { enqueueTimesheet, listOutbox, syncOutbox, retryItem, removeFromOutbox, pendingCount, attentionCount, isNetworkError, cacheDispatchOptions, loadDispatchOptions } from "../src/offlineTimesheetOutbox.js";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
function memoryStorage(limit = Infinity) {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), removeItem: (k) => m.delete(k), setItem: (k, v) => { if ([...m.values()].join("").length + String(v).length > limit) throw new Error("QuotaExceededError"); m.set(k, String(v)); }, _m: m };
}
const goodForm = (over = {}) => ({ ...EMPTY_TIMESHEET_FORM(), dispatch_card_id: "dc_1", work_date: "2026-09-02", activity: "Replaced a bearing", normal: "8", ot_15: "1", employee_name: "A Worker", employee_attest: true, client_request_id: "ts-fixed-0001", ...over });

test("the Timesheet form carries every field of the one record: job, worker, description, materials, N/1.5/2.0, times, sign-off", () => {
  const body = buildTimesheetPayload(goodForm({ start_time: "07:00", end_time: "16:00", worker_category: "Fitter", outcomes: "Done", materials: [{ description: "Bearing", quantity: "2", unit: "each" }, { description: "", quantity: "", unit: "" }] }), { submit: true });
  assert.deepEqual(body.hours_breakdown, { normal: 8, ot_15: 1, ot_20: 0 });
  assert.deepEqual(body.materials_used, [{ description: "Bearing", quantity: 2, unit: "each" }], "blank material rows are dropped");
  assert.deepEqual([body.start_time, body.end_time, body.worker_category, body.outcomes, body.submit], ["07:00", "16:00", "Fitter", "Done", true]);
  assert.deepEqual(body.signatures.employee, { name: "A Worker", date: "2026-09-02", method: "on_device", attest: true });
  assert.equal(body.client_request_id, "ts-fixed-0001");
  assert.equal(totalHours(goodForm()), 9);
});

test("no rate, amount or cost can be sent from the form, whatever the form object contains", () => {
  const body = buildTimesheetPayload({ ...goodForm(), hourly_rate: 45, rate: 1, amount: 2, cost: 3 }, { submit: true });
  assert.doesNotMatch(JSON.stringify(body), /rate|amount|cost|price/i);
});

test("validation: job, date, description, hours 0-24, times, contractor name, materials, and sign-off only when submitting", () => {
  assert.deepEqual(validateTimesheetForm(goodForm(), { submit: true }), []);
  const bad = (over, opts) => validateTimesheetForm(goodForm(over), opts).join(" | ");
  assert.match(bad({ dispatch_card_id: "" }), /Choose the job/);
  assert.match(bad({ activity: " " }), /Describe the work/);
  assert.match(bad({ normal: "", ot_15: "", ot_20: "" }), /Enter the hours/);
  assert.match(bad({ normal: "20", ot_15: "5" }), /more than 24/);
  assert.match(bad({ normal: "-1" }), /0 to 24/);
  assert.match(bad({ start_time: "10:00", end_time: "09:00" }), /End time must be after/);
  assert.match(bad({ start_time: "10:00" }), /both start and end/);
  assert.match(bad({ worker_type: "contractor", worker_name: "" }, { role: "Operations" }), /contractor's name/);
  assert.match(bad({ materials: [{ description: "x", quantity: "0" }] }), /quantity/);
  assert.equal(validateTimesheetForm(goodForm({ employee_name: "", employee_attest: false }), { submit: false }).length, 0, "a draft needs no sign-off");
  assert.match(bad({ employee_name: "" }, { submit: true }), /enter the worker's name/);
  assert.match(bad({ employee_attest: false }, { submit: true }), /confirm the declaration, or attach the signed paper copy/);
  assert.equal(validateTimesheetForm(goodForm({ employee_attest: false, signed_copy_image: "data:image/png;base64,AAAA" }), { submit: true }).length, 0, "a signed paper copy is enough");
});

test("the 3-hour weekday 1.5 threshold is a hint to the worker, never a block", () => {
  const weekday = goodForm({ work_date: "2026-09-02", ot_15: "3.5" });
  assert.equal(reviewHints(weekday).length, 1);
  assert.deepEqual(validateTimesheetForm(weekday, { submit: true }), []);
  assert.equal(reviewHints(goodForm({ work_date: "2026-09-02", ot_15: "3" })).length, 0);
  assert.equal(reviewHints(goodForm({ work_date: "2026-09-05", ot_15: "6" })).length, 0, "Saturday has no threshold");
});

test("a contractor entered by staff carries a name; a Technician's contractor flag is ignored", () => {
  assert.equal(buildTimesheetPayload(goodForm({ worker_type: "contractor", worker_name: " Walk In " }), { role: "Operations" }).worker_name, "Walk In");
  assert.equal(buildTimesheetPayload(goodForm({ worker_type: "contractor", worker_name: "X" }), { role: "Technician" }).worker_name, undefined);
});

test("the display helpers describe hours and the three sign-offs in plain words", () => {
  const ws = { timesheet_version: 2, hours: 11, hours_breakdown: { normal: 9, ot_15: 2, ot_20: 0 }, signatures: { employee: { name: "A", attested_at: "t" } }, client_acknowledgement: { acknowledged_at: "t" }, approved_by: null };
  assert.equal(hoursSummary(ws), "11 h (9 N + 2 @1.5)");
  assert.deepEqual(signoffProgress(ws).map((p) => [p.party, p.done]), [["Worker", true], ["Customer representative", true], ["Foreman / Supervisor", false]]);
  assert.match(hoursSummary({ hours: 8 }), /no Normal\/1.5\/2.0 breakdown/);
  assert.equal(isTimesheetV2({ hours: 8 }), false);
  assert.equal(formFromTimesheet(ws).normal, "9");
});

// ---------------- offline outbox ----------------
const send = (log, behaviour) => async (dispatchId, body) => { log.push([dispatchId, body.client_request_id]); return behaviour(dispatchId, body); };

test("offline create is kept on the device with its reference, sign-off and capture time; nothing is lost on a second tap", () => {
  const st = memoryStorage();
  const body = buildTimesheetPayload(goodForm(), { submit: true });
  const r = enqueueTimesheet(st, "u1", { dispatchId: "dc_1", body, now: new Date("2026-09-02T18:00:00Z") });
  assert.equal(r.ok, true);
  const [item] = listOutbox(st, "u1");
  assert.equal(item.state, "pending"); assert.equal(item.body.captured_offline_at, "2026-09-02T18:00:00.000Z");
  assert.equal(item.body.signatures.employee.name, "A Worker", "the worker's sign-off is kept so the Timesheet can still be submitted");
  assert.equal(enqueueTimesheet(st, "u1", { dispatchId: "dc_1", body }).duplicate, true);
  assert.equal(listOutbox(st, "u1").length, 1);
  assert.deepEqual(listOutbox(st, "u2"), [], "per user");
});

test("secrets and any money field are stripped before anything is stored", () => {
  const st = memoryStorage();
  enqueueTimesheet(st, "u1", { dispatchId: "dc_1", body: { ...buildTimesheetPayload(goodForm()), token: "abc", hourly_rate: 45, password: "x", amount: 9 } });
  assert.doesNotMatch(JSON.stringify([...st._m.values()]), /token|hourly_rate|password|amount/);
});

test("a full device is reported honestly, and an oversized photo is refused instead of silently dropped", () => {
  const full = memoryStorage(50);
  const r = enqueueTimesheet(full, "u1", { dispatchId: "dc_1", body: buildTimesheetPayload(goodForm()) });
  assert.equal(r.ok, false); assert.match(r.error, /no room left/);
  const big = enqueueTimesheet(memoryStorage(), "u1", { dispatchId: "dc_1", body: { ...buildTimesheetPayload(goodForm()), signed_copy_image: "x".repeat(1_600_000) } });
  assert.equal(big.ok, false); assert.match(big.error, /too large/);
  assert.equal(enqueueTimesheet(null, "u1", { dispatchId: "d", body: { client_request_id: "x" } }).ok, false);
});

test("sync sends once, in order, and removes only what the server accepted; the same reference is reused on a retry", async () => {
  const st = memoryStorage(); const log = [];
  for (const id of ["ts-a-0001", "ts-b-0002"]) enqueueTimesheet(st, "u1", { dispatchId: "dc_1", body: buildTimesheetPayload(goodForm({ client_request_id: id, work_date: id === "ts-a-0001" ? "2026-09-01" : "2026-09-02" }), { submit: true }) });
  const offline = Object.assign(new Error("Could not reach the server."), { network: true });
  let results = await syncOutbox(st, "u1", send(log, () => { throw offline; }));
  assert.deepEqual(results.map((r) => r.outcome), ["still_pending"], "stops at the first failure instead of hammering");
  assert.equal(pendingCount(st, "u1"), 2);
  results = await syncOutbox(st, "u1", send(log, () => ({ id: "ws_1" })));
  assert.deepEqual(results.map((r) => r.outcome), ["sent", "sent"]);
  assert.equal(listOutbox(st, "u1").length, 0);
  assert.deepEqual(log.map((l) => l[1]), ["ts-a-0001", "ts-a-0001", "ts-b-0002"], "the first item was retried with its own reference, never a new one");
});

test("a server replay (already received) counts as sent; a refusal is kept with the reason and is not retried silently", async () => {
  const st = memoryStorage(); const log = [];
  enqueueTimesheet(st, "u1", { dispatchId: "dc_1", body: buildTimesheetPayload(goodForm({ client_request_id: "ts-r-0001" })) });
  enqueueTimesheet(st, "u1", { dispatchId: "dc_1", body: buildTimesheetPayload(goodForm({ client_request_id: "ts-d-0002", work_date: "2026-09-03" })) });
  const results = await syncOutbox(st, "u1", send(log, (_d, b) => { if (b.client_request_id === "ts-r-0001") return { replayed: true }; throw Object.assign(new Error("A Timesheet for this worker, date and dispatch already exists."), { status: 409 }); }));
  assert.deepEqual(results.map((r) => r.outcome), ["sent", "needs_attention"]);
  assert.equal(results[0].replayed, true);
  assert.equal(attentionCount(st, "u1"), 1);
  assert.match(listOutbox(st, "u1")[0].last_error, /already exists/);
  await syncOutbox(st, "u1", send(log, () => ({})));
  assert.equal(log.filter((l) => l[1] === "ts-d-0002").length, 1, "needs_attention is never re-sent without the worker choosing to");
  retryItem(st, "u1", "ts-d-0002");
  assert.equal(pendingCount(st, "u1"), 1);
  removeFromOutbox(st, "u1", "ts-d-0002");
  assert.equal(listOutbox(st, "u1").length, 0);
});

test("an expired session or a dropped connection keeps the Timesheet; it is never treated as a refusal", async () => {
  assert.equal(isNetworkError(Object.assign(new Error("x"), { network: true })), true);
  assert.equal(isNetworkError(Object.assign(new Error("x"), { sessionExpired: true, status: 401 })), true);
  assert.equal(isNetworkError(Object.assign(new Error("x"), { status: 409 })), false);
  const st = memoryStorage();
  enqueueTimesheet(st, "u1", { dispatchId: "dc_1", body: buildTimesheetPayload(goodForm()) });
  const out = await syncOutbox(st, "u1", async () => { throw Object.assign(new Error("Session expired"), { sessionExpired: true, status: 401 }); });
  assert.equal(out[0].outcome, "still_pending");
  assert.equal(pendingCount(st, "u1"), 1);
});

test("jobs are cached so a Timesheet can be started offline", () => {
  const st = memoryStorage();
  cacheDispatchOptions(st, "u1", [{ id: "dc_1", dispatch_number: "DC-1", quotation_id: "q" }]);
  assert.deepEqual(loadDispatchOptions(st, "u1"), [{ id: "dc_1", label: "DC-1", quotation_id: "q" }]);
  assert.deepEqual(loadDispatchOptions(st, "u2"), []);
});

test("source wiring: the form posts through the existing create endpoint, falls back to the outbox only on a network failure, and the page shows the outbox", () => {
  const modal = read("src/components/TimesheetFormModal.jsx");
  assert.match(modal, /dispatch\.createWorksheet\(form\.dispatch_card_id, body\)/);
  assert.match(modal, /isNetworkError\(err\) && !err\.sessionExpired/);
  assert.match(modal, /enqueueTimesheet\(storage\(\), user\.id/);
  assert.match(modal, /\/images|Dispatch &amp; date/);
  const page = read("src/pages/WorksheetsPage.jsx");
  assert.match(page, /<TimesheetOutboxPanel/); assert.match(page, /<TimesheetFormModal/);
  assert.match(page, /collections\.list\("field_worksheets"\)/);
  const panel = read("src/components/TimesheetOutboxPanel.jsx");
  assert.match(panel, /addEventListener\("online"/);
  for (const f of ["src/components/TimesheetFormModal.jsx", "src/components/TimesheetOutboxPanel.jsx", "src/lib/timesheetFormLogic.js", "src/offlineTimesheetOutbox.js"]) assert.doesNotMatch(read(f), /hourly_rate\s*[:=]|name="rate"|Total Amount|unit_price/, f);
});
