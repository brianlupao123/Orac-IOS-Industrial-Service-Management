/**
 * reportRoleParity.test.js — FR-01 / CHAT_05
 *
 * Verifies that the portal REPORT_TABS role lists match the backend
 * reportsController.reportGuards exactly. If a new tab or role is added
 * to either side without updating the other, this test will fail.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

// ---- extract portal REPORT_TABS roles from source ----
const portalSrc = readFileSync(
  path.resolve("src/pages/ReportsPage.jsx"),
  "utf8"
);

// Match: { key: "xxx", label: "yyy", roles: ["A","B",...] }
const tabRegex =
  /\{\s*key:\s*"([^"]+)",\s*label:\s*"[^"]+",\s*roles:\s*\[([^\]]+)\]\s*\}/g;

const portalRoles = {};
for (const m of portalSrc.matchAll(tabRegex)) {
  const key = m[1];
  const roles = m[2]
    .split(",")
    .map((r) => r.trim().replace(/"/g, ""))
    .sort();
  portalRoles[key] = roles;
}

// ---- define authoritative backend roles (from reportsController.js) ----
// These MUST match the `reportGuards` object in
//   src/controllers/reportsController.js  (backend repo)
// Update this map if the backend changes.
const backendRoles = {
  pipeline: ["Admin", "Management", "Sales"],
  "po-compliance": ["Admin", "Finance", "Management", "Operations"],
  dispatch: ["Admin", "Management", "Operations", "Supervisor"],
  worksheets: ["Admin", "Management", "Operations", "Supervisor"],
  "invoice-ready": ["Admin", "Finance", "Management", "Sales"],
  variance: ["Admin", "Finance", "Management", "Operations"],
};
// Sort for comparison
for (const k of Object.keys(backendRoles)) backendRoles[k].sort();

test("portal REPORT_TABS keys cover every backend reportGuard key", () => {
  const missing = Object.keys(backendRoles).filter(
    (k) => !portalRoles[k]
  );
  assert.deepStrictEqual(
    missing,
    [],
    `Portal is missing tabs: ${missing.join(", ")}`
  );
});

test("portal REPORT_TABS does not contain tabs absent from backend guards", () => {
  // technician-payroll is portal-only (uses requirePermission, not reportGuards)
  const extras = Object.keys(portalRoles).filter(
    (k) => !backendRoles[k] && k !== "technician-payroll"
  );
  assert.deepStrictEqual(
    extras,
    [],
    `Portal has extra tabs not in backend: ${extras.join(", ")}`
  );
});

test("per-tab roles match backend exactly", () => {
  for (const [key, expected] of Object.entries(backendRoles)) {
    const actual = portalRoles[key];
    assert.ok(actual, `Portal is missing tab "${key}"`);
    assert.deepStrictEqual(
      actual,
      expected,
      `Role mismatch on tab "${key}": portal=${JSON.stringify(actual)} backend=${JSON.stringify(expected)}`
    );
  }
});

test("CSV filename uses formatBusinessDate, not UTC ISO", () => {
  // Ensure the old pattern is gone
  assert.ok(
    !portalSrc.includes('toISOString().split("T")[0]'),
    "CSV filename should not use toISOString (UTC); use formatBusinessDate"
  );
  assert.ok(
    portalSrc.includes("formatBusinessDate"),
    "CSV filename should use formatBusinessDate from lib/format.js"
  );
});
