import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../src/pages/WorksheetsPage.jsx", import.meta.url), "utf8");

test("Timesheet cards show their stable record and guarded dispatch context without exposing quotation data", () => {
  assert.match(page, /canAccessRoute\(user\.role, "\/job-cards"\)/);
  assert.match(page, /data-evidence="timesheet-record-context"/);
  assert.match(page, /Timesheet \{ws\.id/);
  assert.match(page, /Dispatch \{dispatchLabel\(ws\.dispatch_card_id\)\}/);
  assert.match(page, /to=\{`\/job-cards\/\$\{encodeURIComponent\(ws\.dispatch_card_id\)\}`\}/);
  assert.doesNotMatch(page, /quote_number|total_amount|hourly_rate/);
});

test("Timesheet analysis is separately flag-gated and sends only the displayed field worksheet id", () => {
  assert.match(page, /recordAnalysisVisible\(\)/);
  assert.match(page, /assistant\.recordAnalysis\("field_worksheet", id\)/);
  assert.match(page, /Timesheet evidence analysis/);
  assert.match(page, /RecordAnalysisModal/);
  assert.doesNotMatch(page, /method:\s*"POST"/);
});
