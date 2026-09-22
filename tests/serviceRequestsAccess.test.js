import test from "node:test";
import assert from "node:assert/strict";
import { NAV_ITEMS, ROLES, ROUTE_ACCESS, canAccessRoute, visibleNavigation } from "../src/accessPolicy.js";

const TRIAGE_ROLES = [ROLES.SALES, ROLES.OPERATIONS];

test("/service-requests is restricted to Sales and Operations by the central route policy", () => {
  assert.deepEqual([...ROUTE_ACCESS["/service-requests"]].sort(), [...TRIAGE_ROLES].sort());
  for (const role of Object.values(ROLES)) {
    assert.equal(canAccessRoute(role, "/service-requests"), TRIAGE_ROLES.includes(role), `${role} access to /service-requests`);
  }
});

test("navigation shows Service Requests only to the roles the policy allows", () => {
  const item = NAV_ITEMS.find((entry) => entry.path === "/service-requests");
  assert.ok(item, "navigation entry must exist");
  assert.equal(item.label, "Service Requests");
  for (const role of Object.values(ROLES)) {
    const visible = visibleNavigation(role).some((entry) => entry.path === "/service-requests");
    assert.equal(visible, TRIAGE_ROLES.includes(role), `${role} navigation visibility`);
  }
});

test("Sales and Operations are not granted the client portal; Client Viewer keeps it", () => {
  assert.deepEqual(ROUTE_ACCESS["/portal"], [ROLES.CLIENT_VIEWER]);
  assert.equal(canAccessRoute(ROLES.SALES, "/portal"), false);
  assert.equal(canAccessRoute(ROLES.OPERATIONS, "/portal"), false);
  assert.equal(canAccessRoute(ROLES.CLIENT_VIEWER, "/portal"), true);
  assert.equal(canAccessRoute(ROLES.CLIENT_VIEWER, "/service-requests"), false);
});

test("Admin, Management, Finance, Supervisor and Technician are denied the triage route", () => {
  for (const role of [ROLES.ADMIN, ROLES.MANAGEMENT, ROLES.FINANCE, ROLES.SUPERVISOR, ROLES.TECHNICIAN]) {
    assert.equal(canAccessRoute(role, "/service-requests"), false, role);
  }
});

test("the new route did not widen or narrow unrelated pre-existing routes", () => {
  const expected = {
    "/portal": ["Client Viewer"],
    "/worksheets": ["Admin", "Management", "Operations", "Supervisor", "Technician"],
    "/inventory": ["Admin", "Management", "Operations"],
    "/admin": ["Admin", "Management", "Operations"],
    "/kiosk": ["Admin", "Management", "Operations", "Supervisor"]
  };
  for (const [path, roles] of Object.entries(expected)) assert.deepEqual([...ROUTE_ACCESS[path]].sort(), [...roles].sort(), path);
  assert.equal(canAccessRoute(ROLES.SALES, "/inventory"), false);
  assert.equal(canAccessRoute(ROLES.CLIENT_VIEWER, "/reports"), false);
});
