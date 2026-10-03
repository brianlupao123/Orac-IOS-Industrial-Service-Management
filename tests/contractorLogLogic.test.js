import test from "node:test";
import assert from "node:assert/strict";
import { computeRowTotals, computeLogTotals, validateContractorLogRows } from "../src/lib/contractorLogLogic.js";

test("frontend contractor log totals match the backend formula", () => {
  assert.deepEqual(computeRowTotals({ worker_name: "Employee A", normal: 8, ot_15: 1, ot_20: 0 }), {
    total_hours: 9, total_ot_hours: 1, total_payable_hours: 9.5
  });
});

test("frontend contractor log grand totals skip unused rows", () => {
  const totals = computeLogTotals([{ worker_name: "Employee A", normal: 8 }, {}]);
  assert.equal(totals.normal, 8);
});

test("frontend contractor log validation requires a name once hours are entered", () => {
  const errors = validateContractorLogRows([{ normal: 8 }]);
  assert.ok(errors.length > 0);
});
