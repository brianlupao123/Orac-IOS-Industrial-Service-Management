import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("..", import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), "utf8");

test("timesheets keep the stable technical collection while using the company-facing name", () => {
  const page = read("src/pages/WorksheetsPage.jsx");
  assert.match(page, /Timesheets/);
  assert.match(page, /collections\.list\("field_worksheets"\)/);
  assert.match(page, /Filter timesheets by trade/);
});

test("kiosk uses the scoped roster and audited batch endpoint rather than a generic user listing", () => {
  const page = read("src/pages/KioskModePage.jsx");
  assert.match(page, /kiosk\.roster\(selectedJob\)/);
  assert.match(page, /kiosk\.submit\(selectedJob/);
  assert.doesNotMatch(page, /collections\.list\("users"\)/);
  assert.doesNotMatch(page, /\/api\/dispatch_cards\/\$\{selectedJob\}\/timesheets/);
});
