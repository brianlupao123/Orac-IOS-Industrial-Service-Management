import test from "node:test";
import assert from "node:assert/strict";
import { computeNormalHours, validateDailyTimesheetEntries, voidStartIndex } from "../src/lib/dailyTimesheetLogic.js";

test("frontend daily timesheet logic matches the backend contract (no lunch deduction)", () => {
  assert.equal(computeNormalHours("08:00", "17:00"), 9);
});

test("frontend daily timesheet logic rejects overlapping rows the same way the backend does", () => {
  const errors = validateDailyTimesheetEntries([
    { date: "2026-04-27", start_time: "08:00", end_time: "17:00" },
    { date: "2026-04-27", start_time: "12:00", end_time: "13:00" }
  ]);
  assert.ok(errors.some((e) => /overlaps/.test(e)));
});

test("frontend voidStartIndex agrees with the backend on where unused rows start", () => {
  const entries = [{ date: "2026-04-27", start_time: "08:00", end_time: "17:00" }, {}, {}];
  assert.equal(voidStartIndex(entries), 1);
});
