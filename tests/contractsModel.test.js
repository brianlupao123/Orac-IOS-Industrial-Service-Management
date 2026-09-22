import test from "node:test";
import assert from "node:assert/strict";
import {
  asList, formatMoney, isContractOpen, isOverdue, isRealIsoDate, statusOptionsFor, todayIso,
  validateContractForm, validateScheduleForm
} from "../src/contractsModel.js";

const contractValues = (overrides = {}) => ({
  client_id: "c1", title: "Annual cyclone maintenance", start_date: "2026-01-01", end_date: "2026-12-31", total_value: "12000", status: "Draft", ...overrides
});
const storedContract = { id: "contract_1", contract_number: "CTR-0001", client_id: "c1", title: "Annual cyclone maintenance", start_date: "2026-01-01", end_date: "2026-12-31", total_value: 12000, status: "Draft" };
const openContract = { id: "contract_1", start_date: "2026-03-01", end_date: "2026-09-30", status: "Active" };
const scheduleValues = (overrides = {}) => ({ contract_id: "contract_1", equipment_tag_id: "", frequency: "Monthly", next_due_date: "2026-06-15", notes: "", ...overrides });

test("real-date check rejects impossible and badly formatted dates", () => {
  assert.equal(isRealIsoDate("2026-02-28"), true);
  assert.equal(isRealIsoDate("2028-02-29"), true);
  for (const bad of ["2026-02-30", "2026-13-01", "2026-6-1", "01/06/2026", "", null, undefined, 20260601]) {
    assert.equal(isRealIsoDate(bad), false, String(bad));
  }
});

test("todayIso uses the local calendar date", () => {
  assert.equal(todayIso(new Date(2026, 8, 5, 23, 59)), "2026-09-05");
  assert.equal(todayIso(new Date(2026, 0, 1, 0, 0)), "2026-01-01");
});

test("create contract: valid input produces the exact API payload without server-owned fields", () => {
  const { errors, payload } = validateContractForm(contractValues({ title: "  Padded title  ", total_value: " 12500.5 " }));
  assert.deepEqual(errors, {});
  assert.deepEqual(payload, { client_id: "c1", title: "Padded title", start_date: "2026-01-01", end_date: "2026-12-31", total_value: 12500.5, status: "Draft" });
  for (const key of ["id", "contract_number", "created_by_user_id", "created_at", "updated_at"]) assert.equal(key in payload, false, key);
});

test("create contract: blank value becomes null and zero is kept", () => {
  assert.equal(validateContractForm(contractValues({ total_value: "" })).payload.total_value, null);
  assert.equal(validateContractForm(contractValues({ total_value: "0" })).payload.total_value, 0);
});

test("create contract: every invalid field gets its own message and no payload", () => {
  const { errors, payload } = validateContractForm({ client_id: "", title: " ", start_date: "2026-02-30", end_date: "", total_value: "abc", status: "Expired" });
  assert.equal(payload, null);
  for (const field of ["client_id", "title", "start_date", "end_date", "total_value", "status"]) assert.ok(errors[field], field);
});

test("create contract: end before start, negative and oversized values are rejected", () => {
  assert.ok(validateContractForm(contractValues({ start_date: "2026-06-01", end_date: "2026-05-31" })).errors.end_date);
  assert.ok(validateContractForm(contractValues({ total_value: "-5" })).errors.total_value);
  assert.ok(validateContractForm(contractValues({ total_value: "1000000000001" })).errors.total_value);
  assert.ok(validateContractForm(contractValues({ title: "x".repeat(161) })).errors.title);
  assert.deepEqual(validateContractForm(contractValues({ start_date: "2026-05-01", end_date: "2026-05-01" })).errors, {});
});

test("edit contract: only changed fields are sent and client_id is never included", () => {
  const same = validateContractForm(contractValues({ client_id: "c1" }), { mode: "edit", original: storedContract });
  assert.equal(same.payload, null);
  assert.ok(same.errors.form);

  const changed = validateContractForm(contractValues({ title: "Renamed", total_value: "", status: "Active" }), { mode: "edit", original: storedContract });
  assert.deepEqual(changed.payload, { title: "Renamed", total_value: null, status: "Active" });
  assert.equal("client_id" in changed.payload, false);
});

test("edit contract: status must follow the lifecycle", () => {
  assert.deepEqual(statusOptionsFor("Draft"), ["Draft", "Active", "Cancelled"]);
  assert.deepEqual(statusOptionsFor("Active"), ["Active", "Expired", "Cancelled"]);
  assert.deepEqual(statusOptionsFor("Expired"), ["Expired"]);
  assert.deepEqual(statusOptionsFor("Cancelled"), ["Cancelled"]);
  const blocked = validateContractForm(contractValues({ status: "Expired" }), { mode: "edit", original: storedContract });
  assert.ok(blocked.errors.status);
});

test("contract open/closed helper", () => {
  assert.equal(isContractOpen({ status: "Draft" }), true);
  assert.equal(isContractOpen({ status: "Active" }), true);
  assert.equal(isContractOpen({ status: "Expired" }), false);
  assert.equal(isContractOpen({ status: "Cancelled" }), false);
  assert.equal(isContractOpen(undefined), false);
});

test("create schedule: valid input maps to the API payload", () => {
  const { errors, payload } = validateScheduleForm(scheduleValues({ equipment_tag_id: "tag_1", notes: " Grease " }), { contract: openContract });
  assert.deepEqual(errors, {});
  assert.deepEqual(payload, { contract_id: "contract_1", equipment_tag_id: "tag_1", frequency: "Monthly", next_due_date: "2026-06-15", notes: "Grease" });
  assert.equal(validateScheduleForm(scheduleValues(), { contract: openContract }).payload.equipment_tag_id, null);
});

test("create schedule: contract, frequency and date are required and validated", () => {
  const missing = validateScheduleForm(scheduleValues({ frequency: "", next_due_date: "" }), { contract: null });
  assert.equal(missing.payload, null);
  for (const field of ["contract_id", "frequency", "next_due_date"]) assert.ok(missing.errors[field], field);
  assert.ok(validateScheduleForm(scheduleValues({ frequency: "Daily" }), { contract: openContract }).errors.frequency);
  assert.ok(validateScheduleForm(scheduleValues({ next_due_date: "2026-02-30" }), { contract: openContract }).errors.next_due_date);
  assert.ok(validateScheduleForm(scheduleValues({ notes: "x".repeat(501) }), { contract: openContract }).errors.notes);
});

test("create schedule: due date must fall inside the contract window (inclusive)", () => {
  assert.ok(validateScheduleForm(scheduleValues({ next_due_date: "2026-02-28" }), { contract: openContract }).errors.next_due_date);
  assert.ok(validateScheduleForm(scheduleValues({ next_due_date: "2026-10-01" }), { contract: openContract }).errors.next_due_date);
  assert.deepEqual(validateScheduleForm(scheduleValues({ next_due_date: "2026-03-01" }), { contract: openContract }).errors, {});
  assert.deepEqual(validateScheduleForm(scheduleValues({ next_due_date: "2026-09-30" }), { contract: openContract }).errors, {});
});

test("edit schedule: only changed fields are sent, tag can be cleared, contract_id never sent", () => {
  const original = { id: "m1", contract_id: "contract_1", equipment_tag_id: "tag_1", frequency: "Monthly", next_due_date: "2026-06-15", notes: "" };
  const none = validateScheduleForm(scheduleValues({ equipment_tag_id: "tag_1" }), { mode: "edit", contract: openContract, original });
  assert.equal(none.payload, null);
  assert.ok(none.errors.form);

  const cleared = validateScheduleForm(scheduleValues({ equipment_tag_id: "", frequency: "Weekly" }), { mode: "edit", contract: openContract, original });
  assert.deepEqual(cleared.payload, { equipment_tag_id: null, frequency: "Weekly" });
  assert.equal("contract_id" in cleared.payload, false);
});

test("overdue applies only to open contracts with a past due date", () => {
  const schedule = { next_due_date: "2026-06-01" };
  assert.equal(isOverdue(schedule, { status: "Active" }, "2026-06-02"), true);
  assert.equal(isOverdue(schedule, { status: "Active" }, "2026-06-01"), false);
  assert.equal(isOverdue(schedule, { status: "Cancelled" }, "2026-06-02"), false);
  assert.equal(isOverdue(schedule, undefined, "2026-06-02"), false);
});

test("asList accepts arrays and surfaces anything else instead of hiding it", () => {
  assert.deepEqual(asList([], "contracts"), []);
  assert.deepEqual(asList([{ id: 1 }], "contracts"), [{ id: 1 }]);
  for (const bad of [undefined, null, {}, { data: [] }, "x"]) {
    assert.throws(() => asList(bad, "contracts"), /unexpected response for contracts/);
  }
});

test("money formatting", () => {
  assert.equal(formatMoney(12000), "$12,000.00");
  assert.equal(formatMoney(0), "$0.00");
  assert.equal(formatMoney(null), "Not set");
  assert.equal(formatMoney(undefined), "Not set");
});
