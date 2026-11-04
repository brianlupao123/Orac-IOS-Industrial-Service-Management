import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildConsolidatePayload, buildCreatePayload, previewSignature, previewWorkerRows, previewDayRows, previewHeadline, STALE_PREVIEW_CODE } from "../src/lib/worksheetRegisterLogic.js";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8").replace(/\r/g, "");
const form = { title: "Fictional Oct", period_start: "2026-10-01", period_end: "2026-10-31", client_id: "c1", project_title: "P", department_section: "", roster: [{ technician_id: "u1", display_name: "A", group: "Fitters" }] };

test("consolidate payload is the create payload plus the preview hash, and never carries hours or rates", () => {
  const hash = "a".repeat(64);
  const p = buildConsolidatePayload(form, hash);
  assert.deepEqual(p, { ...buildCreatePayload(form), preview_hash: hash });
  for (const k of ["hourly_rate", "rate", "amount", "normal", "ot_15", "ot_20", "lines", "totals"]) assert.equal(k in p, false, k);
});

test("editing the form after a preview changes its signature, so a stale preview cannot be consolidated", () => {
  assert.notEqual(previewSignature(form), previewSignature({ ...form, period_end: "2026-10-30" }));
  assert.equal(previewSignature(form), previewSignature({ ...form }));
});

test("preview rows show the server's totals unchanged and dates in order", () => {
  const preview = { summary: { worker_days: 1, dates_covered: 1, workers_with_hours: 1, workers_total: 2, source_records: 1 },
    grid: { rows: [{ roster_key: "t_u1", display_name: "A", group: "Fitters", totals: { normal: 8, ot_15: 2, ot_20: 0, total_hours: 10 } }],
      totals: { by_date: { "2026-10-02": { normal: 1, ot_15: 0, ot_20: 0, total_hours: 1 }, "2026-10-01": { normal: 8, ot_15: 2, ot_20: 0, total_hours: 10 } } } } };
  assert.deepEqual(previewWorkerRows(preview), [{ key: "t_u1", name: "A", group: "Fitters", normal: 8, ot_15: 2, ot_20: 0, total_hours: 10 }]);
  assert.deepEqual(previewDayRows(preview).map((d) => d.date), ["2026-10-01", "2026-10-02"]);
  assert.match(previewHeadline(preview), /1 certified worker-day across 1 date, 1 of 2 employees with hours, from 1 approved record\./);
  assert.equal(STALE_PREVIEW_CODE, "STALE_PREVIEW");
});

test("page wiring: button label, preview before consolidate, hash passed, no hours input", () => {
  const page = read("src/pages/WorksheetRegisterPage.jsx");
  assert.match(page, /Generate Monthly Worksheet from Daily Timesheets/);
  assert.match(page, /worksheetRegisters\.preview\(buildCreatePayload\(form\)\)/);
  assert.match(page, /worksheetRegisters\.create\(buildConsolidatePayload\(form, preview\.preview_hash\)\)/);
  assert.match(page, />Consolidate</);
  assert.doesNotMatch(page, /handleCreate/);
  assert.match(read("src/api/client.js"), /preview\(payload\) \{ return request\("\/worksheet_registers\/preview"/);
});
