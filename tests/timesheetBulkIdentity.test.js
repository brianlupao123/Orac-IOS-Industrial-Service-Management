import assert from "node:assert/strict";
import test from "node:test";
import { matchTechnician, validateImportBatch } from "../src/lib/timesheetBulkImportLogic.js";

const technicians = [
  { id: "worker-a", name: "Ari Vale", national_id: "ID-100-A", is_active: true },
  { id: "worker-b", name: "Bea Vale", national_id: "ID-200-B", is_active: true }
];
const dispatches = [{ id: "dispatch-1", dispatch_number: "D-1" }];
const row = (overrides = {}) => ({ rowId: 1, date: "2026-11-05", isDateValid: true,
  workerName: "Ari Vale", nationalId: "ID-100-A", normal: 8, ot15: 0, ot20: 0,
  jobRef: "D-1", parseErrors: [], ...overrides });

test("explicit National ID cannot fall back to a matching name", () => {
  const result = validateImportBatch([row({ nationalId: "ID-999-X" })], technicians, dispatches, "dispatch-1", { allowExternalContractors: true })[0];
  assert.equal(result.isValid, false);
  assert.equal(result.matchedTech?.id, undefined);
  assert.match(result.errors.join(" "), /National ID does not match an active technician/);
});

test("a valid National ID paired with another worker's name blocks the row", () => {
  const result = validateImportBatch([row({ workerName: "Bea Vale" })], technicians, dispatches, "dispatch-1")[0];
  assert.equal(result.isValid, false);
  assert.equal(result.matchedTech?.id, undefined);
  assert.match(result.errors.join(" "), /name and National ID identify different people/);
});

test("duplicate active registry IDs are ambiguous instead of choosing the first worker", () => {
  const duplicateId = { id: "worker-c", name: "Cai Vale", national_id: "ID 100 A", is_active: true };
  const result = validateImportBatch([row()], [...technicians, duplicateId], dispatches, "dispatch-1")[0];
  assert.equal(result.isValid, false);
  assert.equal(result.matchedTech?.id, undefined);
  assert.match(result.errors.join(" "), /matches multiple active technicians/);
});

test("case and spacing variants still resolve one active worker", () => {
  const matched = matchTechnician(row({ workerName: "  ARI   VALE  ", nationalId: "id 100 a" }), technicians);
  assert.equal(matched?.id, "worker-a");
  assert.equal(matchTechnician({ workerName: "Absent Person" }, technicians), null);
});
