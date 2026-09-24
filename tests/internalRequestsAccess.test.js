import test from "node:test";
import assert from "node:assert/strict";
import { NAV_ITEMS, ROLES, ROUTE_ACCESS, canAccessRoute, visibleNavigation } from "../src/accessPolicy.js";

const ROUTE = "/internal-requests";
const ALLOWED = [ROLES.MANAGEMENT, ROLES.SALES, ROLES.FINANCE, ROLES.OPERATIONS, ROLES.SUPERVISOR, ROLES.TECHNICIAN];

test("/internal-requests is restricted to the six approved staff roles by the central route policy", () => {
  assert.deepEqual([...ROUTE_ACCESS[ROUTE]].sort(), [...ALLOWED].sort());
  assert.equal(new Set(ROUTE_ACCESS[ROUTE]).size, ROUTE_ACCESS[ROUTE].length, "no duplicate roles");
  for (const role of Object.values(ROLES)) {
    assert.equal(canAccessRoute(role, ROUTE), ALLOWED.includes(role), `${role} access to ${ROUTE}`);
  }
});

test("Admin and Client Viewer get neither a route nor a navigation entry", () => {
  for (const role of [ROLES.ADMIN, ROLES.CLIENT_VIEWER]) {
    assert.equal(canAccessRoute(role, ROUTE), false, `${role} route`);
    assert.equal(visibleNavigation(role).some((item) => item.path === ROUTE), false, `${role} navigation`);
  }
});

test("navigation lists Internal Requests once, derived from the same policy as the route", () => {
  const entries = NAV_ITEMS.filter((item) => item.path === ROUTE);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].label, "Internal Requests");
  for (const role of Object.values(ROLES)) {
    assert.equal(visibleNavigation(role).some((item) => item.path === ROUTE), canAccessRoute(role, ROUTE), `${role} navigation visibility`);
  }
});

test("adding the route did not widen or narrow any pre-existing route", () => {
  const expected = {
    "/portal": ["Client Viewer"],
    "/service-requests": ["Operations", "Sales"],
    "/worksheets": ["Admin", "Management", "Operations", "Supervisor", "Technician"],
    "/inventory": ["Admin", "Management", "Operations"],
    "/admin": ["Admin", "Management", "Operations"],
    "/kiosk": ["Admin", "Management", "Operations", "Supervisor"],
    "/contracts": ["Admin", "Management", "Operations", "Client Viewer"]
  };
  for (const [path, roles] of Object.entries(expected)) assert.deepEqual([...ROUTE_ACCESS[path]].sort(), [...roles].sort(), path);
  assert.deepEqual(Object.keys(ROUTE_ACCESS).sort(), [...Object.keys(expected), "/reports", "/operational-data", "/documents", ROUTE].sort());
  assert.equal(canAccessRoute(ROLES.SALES, "/inventory"), false);
  assert.equal(canAccessRoute(ROLES.CLIENT_VIEWER, "/reports"), false);
});

test("the dashboard root stays open to everyone and the new route does not change that", () => {
  for (const role of Object.values(ROLES)) assert.equal(canAccessRoute(role, "/"), true, role);
});
