import test from "node:test";
import assert from "node:assert/strict";
import { NAV_ITEMS, ROLES, canAccessRoute, visibleNavigation } from "../src/accessPolicy.js";

test("Daily Time Sheets route is reachable by operational roles and Technician, not Client Viewer", () => {
  for (const role of [ROLES.ADMIN, ROLES.MANAGEMENT, ROLES.OPERATIONS, ROLES.SUPERVISOR, ROLES.TECHNICIAN]) {
    assert.equal(canAccessRoute(role, "/daily-timesheets"), true, role);
  }
  assert.equal(canAccessRoute(ROLES.CLIENT_VIEWER, "/daily-timesheets"), false);
  assert.equal(canAccessRoute(ROLES.SALES, "/daily-timesheets"), false);
});

test("Contractor Logs route is restricted to Admin/Management/Operations/Supervisor only", () => {
  for (const role of [ROLES.ADMIN, ROLES.MANAGEMENT, ROLES.OPERATIONS, ROLES.SUPERVISOR]) {
    assert.equal(canAccessRoute(role, "/contractor-logs"), true, role);
  }
  for (const role of [ROLES.TECHNICIAN, ROLES.SALES, ROLES.FINANCE, ROLES.CLIENT_VIEWER]) {
    assert.equal(canAccessRoute(role, "/contractor-logs"), false, role);
  }
});

test("the existing Timesheets nav label is untouched by the two new nav items", () => {
  assert.deepEqual(NAV_ITEMS.find((item) => item.path === "/worksheets"), { path: "/worksheets", label: "Timesheets" });
});

test("the two new nav items use distinct labels from the existing Timesheets entry", () => {
  const dailyItem = NAV_ITEMS.find((item) => item.path === "/daily-timesheets");
  const contractorItem = NAV_ITEMS.find((item) => item.path === "/contractor-logs");
  assert.equal(dailyItem.label, "Daily Time Sheets");
  assert.equal(contractorItem.label, "Contractor Logs");
  assert.notEqual(dailyItem.label, "Timesheets");
});

test("a Technician sees Daily Time Sheets in navigation but not Contractor Logs", () => {
  const nav = visibleNavigation(ROLES.TECHNICIAN).map((item) => item.path);
  assert.ok(nav.includes("/daily-timesheets"));
  assert.ok(!nav.includes("/contractor-logs"));
});
