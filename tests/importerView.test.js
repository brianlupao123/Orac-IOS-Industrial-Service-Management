import assert from "node:assert/strict";
import test from "node:test";
import {
  ENTITY_OPTIONS, MAX_FILE_BYTES, commitBlocker, commitBody, describeJob, fileProblem,
  hasProblems, problemRowsCsv, summaryItems, visibleRows
} from "../src/importer/importerView.js";

// Synthetic data only.
const row = (n, status, errors = [], warnings = []) => ({ row: n, status, values: { name: `Co ${n}` }, errors, warnings });
const preview = (over = {}) => ({
  entity: "clients", file_sha256: "abc", file_errors: [], row_count: 3, ok_count: 2, error_count: 1, warning_count: 1,
  confirmation_phrase: "IMPORT_CLIENTS", already_imported: false, can_commit: false,
  rows: [row(1, "ok"), row(2, "error", [{ field: "email", code: "FIELD_INVALID", message: "Invalid email" }]), row(3, "ok", [], [{ field: "name", code: "WARN_SPACES", message: "spaces" }])], ...over
});

test("the entity options match the server's phrases", () => {
  assert.deepEqual(ENTITY_OPTIONS.map((e) => [e.key, e.phrase]), [["clients", "IMPORT_CLIENTS"], ["catalog_items", "IMPORT_CATALOG_ITEMS"]]);
});

test("file problems are explained before anything is sent", () => {
  assert.match(fileProblem(null), /Choose a CSV file/);
  assert.match(fileProblem({ name: "data.xlsx", size: 10 }), /Only \.csv/);
  assert.match(fileProblem({ name: "data.csv", size: MAX_FILE_BYTES + 1 }), /512 KB/);
  assert.match(fileProblem({ name: "data.csv", size: 0 }), /empty/);
  assert.equal(fileProblem({ name: "Data.CSV", size: MAX_FILE_BYTES }), "");
});

test("the summary leads with the status name and meaning; the count is separate", () => {
  const items = summaryItems(preview());
  assert.deepEqual(items.map((i) => [i.label, i.count, i.tone]), [["Ready", 2, "success"], ["Needs fixing", 1, "danger"], ["Warnings", 1, "warning"]]);
  assert.ok(items.every((i) => i.meaning.length > 10));
  const clean = summaryItems(preview({ ok_count: 3, error_count: 0, warning_count: 0 }));
  assert.deepEqual(clean.map((i) => i.tone), ["success", "neutral", "neutral"]);
});

test("a Possible duplicates card appears only when the server found repeats", () => {
  assert.equal(summaryItems(preview()).some((i) => i.key === "duplicates"), false);
  const items = summaryItems(preview({ duplicate_count: 2 }));
  const card = items.find((i) => i.key === "duplicates");
  assert.deepEqual([card.label, card.count, card.tone], ["Possible duplicates", 2, "warning"]);
  assert.match(card.meaning, /still imported/);
  assert.equal(items.length, 4);
});

test("visibleRows filters to rows with errors or warnings", () => {
  assert.deepEqual(visibleRows(preview(), true).map((r) => r.row), [2, 3]);
  assert.deepEqual(visibleRows(preview(), false).map((r) => r.row), [1, 2, 3]);
  assert.deepEqual(visibleRows(null, true), []);
  assert.equal(hasProblems(preview()), true);
  assert.equal(hasProblems(preview({ error_count: 0 })), false);
});

test("the problem list is CSV, quoted when needed, and formula-like text is neutralised", () => {
  const p = preview({ file_errors: [{ code: "HEADER_UNKNOWN", message: "Unknown column: =cmd" }],
    rows: [row(1, "error", [{ field: "name", code: "FIELD_INVALID", message: 'Bad "value", please fix' }])] });
  const csv = problemRowsCsv(p);
  assert.ok(csv.startsWith("row,column,code,message\r\n"));
  assert.ok(csv.includes('1,name,FIELD_INVALID,"Bad ""value"", please fix"'));
  assert.ok(csv.includes(",,HEADER_UNKNOWN,Unknown column: =cmd"));
  const formula = problemRowsCsv(preview({ file_errors: [{ code: "X", message: "=1+1" }], rows: [] }));
  assert.ok(formula.includes(",,X,'=1+1"));
});

test("the Import button stays blocked until everything matches, and says why", () => {
  const ok = preview({ error_count: 0, warning_count: 0, can_commit: true });
  assert.match(commitBlocker({ preview: null, phrase: "", count: "" }), /Preview the file first/);
  assert.match(commitBlocker({ preview: preview(), phrase: "IMPORT_CLIENTS", count: "3" }), /Fix the problems/);
  assert.match(commitBlocker({ preview: { ...ok, already_imported: true }, phrase: "IMPORT_CLIENTS", count: "3" }), /already been imported/);
  assert.match(commitBlocker({ preview: ok, phrase: "import_clients", count: "3" }), /Type IMPORT_CLIENTS exactly/);
  assert.match(commitBlocker({ preview: ok, phrase: "IMPORT_CLIENTS", count: "2" }), /number of rows/);
  assert.equal(commitBlocker({ preview: ok, phrase: "IMPORT_CLIENTS", count: " 3 " }), "");
});

test("the commit body carries the text, the hash and the typed values", () => {
  const body = commitBody({ csvText: "a,b\n1,2\n", preview: preview(), phrase: "IMPORT_CLIENTS", count: "3" });
  assert.deepEqual(body, { csv_content: "a,b\n1,2\n", confirmation: "IMPORT_CLIENTS", expected_row_count: 3, file_sha256: "abc" });
});

test("job rows read plainly", () => {
  const d = describeJob({ id: "imp_1", entity: "catalog_items", created_at: "2030-01-02T03:04:05.000Z", created_count: 5, warnings_count: 0, ids_available: false });
  assert.deepEqual(d, { id: "imp_1", when: "2030-01-02 03:04 UTC", entity: "Catalog items", created: 5, warnings: 0, duplicates: 0, ids: "Cleared after 90 days" });
  assert.equal(describeJob({ id: "imp_2", entity: "clients", created_count: 2, warnings_count: 1, duplicate_warnings_count: 1, ids_available: true }).duplicates, 1);
});
