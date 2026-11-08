import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const root = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("shared styles establish a stable operational reading baseline", () => {
  const css = read("src/index.css");
  assert.match(css, /font-family: ui-sans-serif/);
  assert.match(css, /font-size: 16px/);
  assert.match(css, /line-height: 1\.5/);
  assert.match(css, /letter-spacing: 0 !important/);
});

test("portal identity and status text avoid tiny tracked labels", () => {
  const shell = read("src/layouts/PortalLayout.jsx");
  assert.doesNotMatch(shell, /text-\[(?:9|10)px\]|tracking-/);
  assert.match(shell, /text-base font-bold text-orac-slate/);
  assert.match(shell, /text-xs font-bold text-emerald-700/);
});

test("shared data tables use readable untracked labels and compact corners", () => {
  const table = read("src/components/DataTable.jsx");
  assert.match(table, /rounded-lg/);
  assert.doesNotMatch(table, /rounded-xl|tracking-|uppercase/);
  assert.match(table, /text-left text-ux-label font-semibold text-gray-600/);
});
