import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeTechnicianProfiles, technicianLabel, technicianOptions, identityFromTechnician, canPickTechnician
} from "../src/lib/technicianPickerLogic.js";
import { EMPTY_TIMESHEET_FORM, validateTimesheetForm, buildTimesheetPayload, formFromTimesheet } from "../src/lib/timesheetFormLogic.js";
import { enqueueTimesheet, listOutbox, cacheTechnicianOptions, loadTechnicianOptions, clearOutboxOnLogout } from "../src/offlineTimesheetOutbox.js";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
function memoryStorage() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), removeItem: (k) => m.delete(k), setItem: (k, v) => m.set(k, String(v)) }; }

const PROFILES = [
  { id: "u2", first_name: "Tinashe", last_name: "Moyo", technician_trade: "Boilermaker", national_id: "63-1234567-X-42", is_active: true },
  { id: "u1", name: "Anesu Chikore", trade: "Fitter", id_number: "08-7654321-Q-11" },
  { id: "u3", first_name: "Gone", last_name: "Away", technician_trade: "Fitter", is_active: false },
  { id: "u4", name: "Office Person", role: "Sales" },
  { id: "u2", first_name: "Tinashe", last_name: "Moyo" }
];

test("profiles are normalised: active Technicians only, de-duplicated, sorted by name", () => {
  const list = normalizeTechnicianProfiles(PROFILES);
  assert.deepEqual(list.map((t) => t.id), ["u1", "u2"]);
  assert.deepEqual(list[1], { id: "u2", name: "Tinashe Moyo", trade: "Boilermaker", national_id: "63-1234567-X-42" });
  assert.deepEqual(normalizeTechnicianProfiles(null), []);
});

test("dropdown entry reads [Trade] Firstname Lastname (ID: National_ID)", () => {
  const [, tinashe] = normalizeTechnicianProfiles(PROFILES);
  assert.equal(technicianLabel(tinashe), "[Boilermaker] Tinashe Moyo (ID: 63-1234567-X-42)");
  assert.equal(technicianLabel({ name: "A B", trade: "", national_id: "" }), "[Unclassified] A B (ID: not on file)");
  assert.equal(technicianOptions([tinashe])[0].value, "u2");
});

test("picking a technician fills name, trade and national ID; clearing empties them", () => {
  const techs = normalizeTechnicianProfiles(PROFILES);
  assert.deepEqual(identityFromTechnician(techs, "u2"), { technician_id: "u2", worker_name: "Tinashe Moyo", technician_trade: "Boilermaker", national_id: "63-1234567-X-42" });
  assert.deepEqual(identityFromTechnician(techs, ""), { technician_id: "", worker_name: "", technician_trade: "", national_id: "" });
});

test("picker roles include Supervisor and Sales but not the Technician capturing their own sheet", () => {
  assert.ok(canPickTechnician("Supervisor") && canPickTechnician("Sales"));
  assert.ok(!canPickTechnician("Technician"));
});

const good = (over = {}) => ({ ...EMPTY_TIMESHEET_FORM(), dispatch_card_id: "dc_1", work_date: "2026-11-03", activity: "Replaced a bearing", normal: "8", client_request_id: "ts-fixed-1", ...over });

test("a technician must be chosen when the picker is shown, but not when editing or for a contractor", () => {
  assert.match(validateTimesheetForm(good(), { role: "Supervisor", requireTechnician: true }).join("|"), /Choose the technician/);
  assert.equal(validateTimesheetForm(good({ technician_id: "u2" }), { role: "Supervisor", requireTechnician: true }).length, 0);
  assert.equal(validateTimesheetForm(good(), { role: "Supervisor", requireTechnician: false }).length, 0);
  assert.equal(validateTimesheetForm(good({ worker_type: "contractor", worker_name: "C" }), { role: "Supervisor", requireTechnician: true }).length, 0);
});

test("the payload carries the picked identity plus date, job, activity and the hours breakdown", () => {
  const body = buildTimesheetPayload(good({ technician_id: "u2", worker_name: "Tinashe Moyo", technician_trade: "Boilermaker", national_id: "63-1234567-X-42", ot_15: "1" }), { role: "Supervisor" });
  assert.equal(body.technician_id, "u2");
  assert.equal(body.worker_name, "Tinashe Moyo");
  assert.equal(body.technician_trade, "Boilermaker");
  assert.equal(body.worker_category, "Boilermaker");
  assert.equal(body.national_id, "63-1234567-X-42");
  assert.deepEqual(body.hours_breakdown, { normal: 8, ot_15: 1, ot_20: 0 });
  assert.equal(body.work_date, "2026-11-03");
  assert.equal(body.activity, "Replaced a bearing");
});

test("a Technician capturing their own sheet, or a contractor, sends no picked identity", () => {
  assert.equal(buildTimesheetPayload(good({ technician_id: "u2", worker_name: "X" }), { role: "Technician" }).technician_id, undefined);
  const c = buildTimesheetPayload(good({ worker_type: "contractor", worker_name: "Con Tractor", technician_id: "u2" }), { role: "Supervisor" });
  assert.equal(c.worker_type, "contractor"); assert.equal(c.technician_id, undefined);
});

test("an offline Timesheet keeps the identity and still queues through the existing outbox", () => {
  const st = memoryStorage();
  const body = buildTimesheetPayload(good({ technician_id: "u2", worker_name: "Tinashe Moyo", technician_trade: "Boilermaker", national_id: "63-1234567-X-42" }), { role: "Supervisor" });
  assert.equal(enqueueTimesheet(st, "u1", { dispatchId: "dc_1", body }).ok, true);
  const [item] = listOutbox(st, "u1");
  assert.equal(item.body.national_id, "63-1234567-X-42"); assert.equal(item.body.technician_id, "u2");
});

test("the technician list is cached per user for offline use and removed on logout", () => {
  const st = memoryStorage();
  const techs = normalizeTechnicianProfiles(PROFILES);
  cacheTechnicianOptions(st, "u1", techs);
  assert.deepEqual(loadTechnicianOptions(st, "u1"), techs);
  assert.deepEqual(loadTechnicianOptions(st, "other"), []);
  clearOutboxOnLogout(st, "u1");
  assert.deepEqual(loadTechnicianOptions(st, "u1"), []);
});

test("editing shows the stored identity read-only", () => {
  const f = formFromTimesheet({ technician_id: "u2", worker_name: "Tinashe Moyo", technician_trade: "Boilermaker", national_id: "63-1234567-X-42", hours_breakdown: { normal: 8 } });
  assert.deepEqual([f.technician_id, f.worker_name, f.technician_trade, f.national_id], ["u2", "Tinashe Moyo", "Boilermaker", "63-1234567-X-42"]);
});

test("source wiring: the form uses the searchable picker, read-only identity fields and the cached list", () => {
  const modal = read("src/components/TimesheetFormModal.jsx");
  assert.match(modal, /<SearchableSelect/);
  assert.match(modal, /technicianProfiles\.list\(\)/);
  assert.match(modal, /loadTechnicianOptions\(storage\(\), user\.id\)/);
  for (const id of ["ts-worker-fullname", "ts-worker-trade", "ts-worker-nid"]) assert.match(modal, new RegExp(`id="${id}" readOnly`));
  assert.match(modal, /dispatch\.createWorksheet\(form\.dispatch_card_id, body\)/);
  assert.match(read("src/api/client.js"), /request\("\/technician-profiles"\)/);
});
