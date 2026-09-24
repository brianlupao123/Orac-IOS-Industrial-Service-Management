import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { csvCell } from "../src/csvSafe.js";

test("string cells that could run as a spreadsheet formula are neutralised", () => {
  for (const risky of ["=1+1", "+SUM(A1)", "-2+3", "@cmd", "\tcmd", "\rcmd", '=HYPERLINK("http://x","y")']) {
    const cell = csvCell(risky);
    assert.ok(cell.startsWith('"\''), `${JSON.stringify(risky)} must be prefixed with an apostrophe`);
  }
});

test("ordinary text, empty values and numbers are unchanged", () => {
  assert.equal(csvCell("Returned: recheck torque"), '"Returned: recheck torque"');
  assert.equal(csvCell(undefined), '""');
  assert.equal(csvCell(""), '""');
  assert.equal(csvCell(-500), '"-500"');
  assert.equal(csvCell(0), '"0"');
  assert.equal(csvCell(true), '"true"');
});

test("quotes are still doubled and objects still JSON-encoded", () => {
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell({ a: 1 }), '"{""a"":1}"');
  assert.equal(csvCell("=A1" + '"'), '"\'=A1"""');
});

test("only the leading character decides", () => {
  assert.equal(csvCell("a=b"), '"a=b"');
  assert.equal(csvCell(" =1"), '" =1"');
});

test("ReportsPage uses the shared cell encoder and no longer builds cells inline", () => {
  const page = readFileSync(new URL("../src/pages/ReportsPage.jsx", import.meta.url), "utf8");
  assert.match(page, /import \{ csvCell \} from "\.\.\/csvSafe\.js";/);
  assert.match(page, /csvCell\(row\[column\]\)/);
  assert.doesNotMatch(page, /text\.replace\(\/"\/g/);
});

test("new frontend files stay ASCII-only", () => {
  for (const file of ["../src/csvSafe.js", "./reportCsvExport.test.js"]) {
    assert.doesNotMatch(readFileSync(new URL(file, import.meta.url), "utf8"), /[^\x00-\x7F]/, file);
  }
});
