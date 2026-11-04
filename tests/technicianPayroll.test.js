import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  defaultPayrollMonth, isPayrollMonth, canViewPayroll, canExportPayroll, pastelExportState, formatHours
} from "../src/payrollModel.js";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("default month is the month that just finished, including across a year boundary", () => {
  assert.equal(defaultPayrollMonth(new Date("2026-11-03T10:00:00Z")), "2026-10");
  assert.equal(defaultPayrollMonth(new Date("2027-01-15T10:00:00Z")), "2026-12");
});

test("month validation matches the server (YYYY-MM only)", () => {
  assert.equal(isPayrollMonth("2026-10"), true);
  for (const bad of ["2026-13", "2026-1", "2026-10-01", "", null]) assert.equal(isPayrollMonth(bad), false);
});

test("Finance, Admin and Management may view; only Finance and Admin may export", () => {
  for (const role of ["Finance", "Admin", "Management"]) assert.equal(canViewPayroll(role), true);
  for (const role of ["Operations", "Supervisor", "Sales", "Technician", "Client Viewer"]) assert.equal(canViewPayroll(role), false);
  assert.equal(canExportPayroll("Finance"), true);
  assert.equal(canExportPayroll("Admin"), true);
  assert.equal(canExportPayroll("Management"), false);
});

test("Pastel export button state explains why it is disabled", () => {
  const ok = { employees: [{ export_ready: true }, { export_ready: true }] };
  assert.deepEqual(pastelExportState(ok, "Finance", "2026-10"), { enabled: true, reason: "" });
  assert.equal(pastelExportState(ok, "Management", "2026-10").enabled, false);
  assert.equal(pastelExportState({ employees: [] }, "Finance", "2026-10").enabled, false);
  assert.equal(pastelExportState(null, "Finance", "2026-10").enabled, false);
  assert.equal(pastelExportState(ok, "Finance", "").enabled, false);
  const blocked = pastelExportState({ employees: [{ export_ready: true }, { export_ready: false }] }, "Finance", "2026-10");
  assert.equal(blocked.enabled, false);
  assert.match(blocked.reason, /1 employee cannot be exported/);
});

test("hours display keeps two decimals without float noise", () => {
  assert.equal(formatHours(16.25), "16.25");
  assert.equal(formatHours(8), "8");
  assert.equal(formatHours(0.1 + 0.2), "0.3");
  assert.equal(formatHours(undefined), "-");
});

test("Reports page offers the Technician Payroll tab to Finance, Admin and Management only", () => {
  const page = read("src/pages/ReportsPage.jsx");
  assert.match(page, /key: "technician-payroll", label: "Technician Payroll", roles: \["Admin", "Management", "Finance"\]/);
  assert.match(page, /<TechnicianPayrollPanel user=\{user\} \/>/);
  // The payroll tab does not use the generic JSON-to-CSV button.
  assert.match(page, /active !== PAYROLL_TAB && <button/);
});

test("Payroll panel shows the required columns and the Pastel export button", () => {
  const panel = read("src/components/TechnicianPayrollPanel.jsx");
  for (const col of ["Full name", "National ID", "Trade", "Normal hours", "Overtime 1.5 hours", "Overtime 2.0 hours", "Total hours", "Days worked"]) {
    assert.ok(panel.includes(`"${col}"`), `missing column ${col}`);
  }
  assert.match(panel, /Export to Sage Pastel Payroll \(CSV\)/);
  assert.match(panel, /reports\.downloadPastelPayroll\(month\)/);
  assert.match(panel, /Hours only: no rates or amounts/);
});

test("API client calls the payroll report and the Pastel export endpoints", () => {
  const client = read("src/api/client.js");
  assert.match(client, /\/reports\/technician-payroll\?month=/);
  assert.match(client, /downloadCsv\(`\/exports\/pastel-payroll\.csv\?month=/);
});

test("Admin user form captures national ID and employee code, blank as null", () => {
  const admin = read("src/pages/AdminPage.jsx");
  assert.match(admin, /name="national_id"/);
  assert.match(admin, /name="employee_code"/);
  assert.match(admin, /\["national_id", "employee_code"\]/);
});
