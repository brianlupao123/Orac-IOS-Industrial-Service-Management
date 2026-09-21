import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../scripts/capture-uat-evidence.mjs", import.meta.url), "utf8");
test("UAT capture requires a clean ignored workspace and produces a truthful manifest", () => {
  assert.match(source, /status", "--porcelain/);
  assert.match(source, /check-ignore/);
  assert.match(source, /evidenceClass/);
  assert.match(source, /status: "BLOCKED"/);
  assert.match(source, /redact\(error.message\)/);
});
