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

test("the Timesheets nav label and route are unchanged", () => {
  assert.deepEqual(NAV_ITEMS.find((item) => item.path === "/worksheets"), { path: "/worksheets", label: "Timesheets" });
});

test("two concepts in the navigation: Timesheets (the daily record) and Worksheets (the monthly register); legacy forms are not in the menu", () => {
  const labels = NAV_ITEMS.map((item) => item.label);
  assert.ok(labels.includes("Timesheets") && labels.includes("Worksheets"));
  assert.deepEqual(NAV_ITEMS.find((item) => item.path === "/monthly-worksheets"), { path: "/monthly-worksheets", label: "Worksheets" });
  for (const gone of ["/daily-timesheets", "/contractor-logs"]) assert.ok(!NAV_ITEMS.some((item) => item.path === gone), `${gone} is no longer a menu entry`);
  assert.ok(!labels.includes("Daily Time Sheets") && !labels.includes("Contractor Logs") && !labels.includes("Field Worksheets"));
});

test("a Technician sees Timesheets but not Worksheets (the register shows colleagues' hours); legacy routes stay reachable for history", () => {
  const nav = visibleNavigation(ROLES.TECHNICIAN).map((item) => item.path);
  assert.ok(nav.includes("/worksheets"));
  assert.ok(!nav.includes("/monthly-worksheets"));
  assert.equal(canAccessRoute(ROLES.TECHNICIAN, "/daily-timesheets"), true, "link compatibility");
});
