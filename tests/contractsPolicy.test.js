import test from "node:test";
import assert from "node:assert/strict";
import { ROLES, ROUTE_ACCESS, canAccessRoute, visibleNavigation, NAV_ITEMS } from "../src/accessPolicy.js";
import { canManageContracts, canManageSchedules } from "../src/contractsModel.js";

const READERS = [ROLES.ADMIN, ROLES.MANAGEMENT, ROLES.OPERATIONS, ROLES.CLIENT_VIEWER];

test("/contracts route policy matches the backend read policy exactly", () => {
  assert.deepEqual([...ROUTE_ACCESS["/contracts"]].sort(), [...READERS].sort());
  for (const role of Object.values(ROLES)) {
    assert.equal(canAccessRoute(role, "/contracts"), READERS.includes(role), role);
  }
});

test("Supervisor, Sales, Finance and Technician can no longer open /contracts", () => {
  for (const role of [ROLES.SUPERVISOR, ROLES.SALES, ROLES.FINANCE, ROLES.TECHNICIAN]) {
    assert.equal(canAccessRoute(role, "/contracts"), false, role);
  }
});

test("Client Viewer can open /contracts but cannot manage anything", () => {
  assert.equal(canAccessRoute(ROLES.CLIENT_VIEWER, "/contracts"), true);
  assert.equal(canManageContracts(ROLES.CLIENT_VIEWER), false);
  assert.equal(canManageSchedules(ROLES.CLIENT_VIEWER), false);
});

test("management capability helpers match the backend write policy", () => {
  const contractManagers = [ROLES.ADMIN, ROLES.MANAGEMENT];
  const scheduleManagers = [ROLES.ADMIN, ROLES.MANAGEMENT, ROLES.OPERATIONS];
  for (const role of Object.values(ROLES)) {
    assert.equal(canManageContracts(role), contractManagers.includes(role), `contracts ${role}`);
    assert.equal(canManageSchedules(role), scheduleManagers.includes(role), `schedules ${role}`);
  }
  assert.equal(canManageContracts(ROLES.OPERATIONS), false, "Operations must not edit contracts");
});

test("navigation is still derived from route policy for /contracts", () => {
  const listed = NAV_ITEMS.some((item) => item.path === "/contracts");
  for (const role of Object.values(ROLES)) {
    assert.equal(visibleNavigation(role).some((item) => item.path === "/contracts"), listed && canAccessRoute(role, "/contracts"), role);
  }
});

test("other routes keep their existing policy", () => {
  assert.equal(canAccessRoute(ROLES.SUPERVISOR, "/kiosk"), true);
  assert.equal(canAccessRoute(ROLES.OPERATIONS, "/inventory"), true);
  assert.equal(canAccessRoute(ROLES.SALES, "/inventory"), false);
  assert.equal(canAccessRoute(ROLES.CLIENT_VIEWER, "/reports"), false);
});
