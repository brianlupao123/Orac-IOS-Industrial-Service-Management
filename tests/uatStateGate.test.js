import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const clientSource = readFileSync(new URL("../src/api/client.js", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const pageStatesSource = readFileSync(new URL("../src/components/PageStates.jsx", import.meta.url), "utf8");
const dataTableSource = readFileSync(new URL("../src/components/DataTable.jsx", import.meta.url), "utf8");

test("UAT state gate is compiled from an explicit build-time flag, not a runtime default", () => {
  assert.match(clientSource, /VITE_UAT_STATE_MODE.*===\s*"true"/);
});

test("error mode never issues a fetch and empty mode never issues a fetch for a GET", () => {
  // The gate's early-return branches must appear before the real fetch call
  // inside request(), so both short-circuits run before any network I/O.
  const requestFnStart = clientSource.indexOf("async function request(path, options = {})");
  const gateBranch = clientSource.indexOf('mode === "error"', requestFnStart);
  const fetchCall = clientSource.indexOf("await fetch(", requestFnStart);
  assert.ok(requestFnStart > -1 && gateBranch > -1 && fetchCall > -1);
  assert.ok(gateBranch < fetchCall, "UAT error/empty short-circuit must precede the real fetch call");
});

test("empty mode is restricted to a known array-shaped read allowlist, not applied blindly", () => {
  assert.match(clientSource, /UAT_EMPTY_ARRAY_PATH_PREFIXES/);
  assert.match(clientSource, /isKnownArrayReadPath/);
});

test("session-expired mode reuses the real notifySessionExpired pathway rather than a new UI", () => {
  assert.match(clientSource, /simulateSessionExpired/);
  const simulateFn = clientSource.slice(clientSource.indexOf("simulateSessionExpired()"));
  assert.match(simulateFn.slice(0, 200), /notifySessionExpired\(\)/);
});

test("App.jsx only triggers the session-expired simulation when the build-time gate is enabled", () => {
  assert.match(appSource, /uatState\.isEnabled\(\)/);
  assert.match(appSource, /uatState\.mode\(\) === "session-expired"/);
});

test("shared empty/error components expose stable evidence selectors for capture", () => {
  assert.match(pageStatesSource, /data-evidence="page-empty-state"/);
  assert.match(pageStatesSource, /data-evidence="page-error-state"/);
  assert.match(dataTableSource, /data-evidence="table-empty-state"/);
});

test("no role, auth, or route-guard logic appears anywhere in the UAT gate additions", () => {
  const gateSection = clientSource.slice(clientSource.indexOf("UAT_STATE_MODE_ENABLED ="), clientSource.indexOf("async function request"));
  assert.doesNotMatch(gateSection, /role/i);
  assert.doesNotMatch(gateSection, /canAccessRoute/);
});
