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

test("manifest states use the full PASSED/FAILED/SKIPPED/BLOCKED vocabulary", () => {
  assert.match(source, /"PASSED"/);
  assert.match(source, /"FAILED"/);
  assert.match(source, /"SKIPPED"/);
  assert.match(source, /"BLOCKED"/);
  assert.doesNotMatch(source, /status:\s*"PASS"/);
  assert.doesNotMatch(source, /status:\s*"FAIL"/);
});

test("--evidence-class must be supplied and must exactly match UAT_EVIDENCE_CLASS before browser launch", () => {
  assert.match(source, /--evidence-class/);
  assert.match(source, /cliEvidenceClass !== env\.UAT_EVIDENCE_CLASS/);
  const classCheckIndex = source.indexOf("cliEvidenceClass !== env.UAT_EVIDENCE_CLASS");
  const browserLaunchIndex = source.indexOf("chromium.launch");
  assert.ok(classCheckIndex > -1 && browserLaunchIndex > -1 && classCheckIndex < browserLaunchIndex, "evidence-class check must run before browser launch");
});

test("session-expired, state-empty and state-error captures use the app's own UAT state gate, never a fabricated bypass", () => {
  assert.match(source, /uatState=\$\{mode\}/);
  assert.match(source, /"empty"/);
  assert.match(source, /"error"/);
  assert.match(source, /uatState=session-expired/);
  assert.match(source, /table-empty-state/);
  assert.match(source, /page-error-state/);
  assert.match(source, /session-expired-state/);
  assert.doesNotMatch(source, /bypass/i);
});
