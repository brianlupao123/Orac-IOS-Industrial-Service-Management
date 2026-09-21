import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("operational data UI uses only preview and review endpoints", () => {
  const client = read("src/api/client.js");
  assert.match(client, /\/imports\/leads\/preview/);
  assert.match(client, /\/imports\/leads\/commit/);
  assert.match(client, /\/exports\/pastel-review\/quotes\.csv/);
  assert.match(client, /\/analytics\/operational/);
  assert.doesNotMatch(client, /pastel.*post/i);
});

test("operational data page declares visible evidence states", () => {
  const page = read("src/pages/OperationalDataPage.jsx");
  assert.match(page, /data-evidence="operational-data-ready"/);
  assert.match(page, /data-evidence="operational-analytics-result"/);
  assert.match(page, /data-evidence="lead-preview-result"/);
  assert.match(page, /data-evidence="lead-import-complete"/);
});
