import test from "node:test";
import assert from "node:assert/strict";
import { NAV_ITEMS, ROLES, ROUTE_ACCESS, canAccessRoute, visibleNavigation } from "../src/accessPolicy.js";

const ROUTE = "/internal-requests";
const ALLOWED = [ROLES.ADMIN, ROLES.MANAGEMENT, ROLES.SALES, ROLES.FINANCE, ROLES.OPERATIONS, ROLES.SUPERVISOR, ROLES.TECHNICIAN];

test("/internal-requests is restricted to the seven approved staff roles by the central route policy", () => {
  assert.deepEqual([...ROUTE_ACCESS[ROUTE]].sort(), [...ALLOWED].sort());
  assert.equal(new Set(ROUTE_ACCESS[ROUTE]).size, ROUTE_ACCESS[ROUTE].length, "no duplicate roles");
  for (const role of Object.values(ROLES)) {
    assert.equal(canAccessRoute(role, ROUTE), ALLOWED.includes(role), `${role} access to ${ROUTE}`);
  }
});

test("Admin can access the team inbox while Client Viewer gets neither a route nor a navigation entry", () => {
  assert.equal(canAccessRoute(ROLES.ADMIN, ROUTE), true, "Admin route");
  assert.equal(visibleNavigation(ROLES.ADMIN).some((item) => item.path === ROUTE), true, "Admin navigation");
  assert.equal(canAccessRoute(ROLES.CLIENT_VIEWER, ROUTE), false, "Client Viewer route");
  assert.equal(visibleNavigation(ROLES.CLIENT_VIEWER).some((item) => item.path === ROUTE), false, "Client Viewer navigation");
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
  // /quotations was added afterwards (Chat C, commercial flow) mirroring the
  // backend's createQuote/sendQuote/cancelQuote permission set exactly:
  // Admin and Sales only. Checked explicitly, same as ROUTE above, rather
  // than folded into `expected`, to keep this snapshot's original routes
  // untouched.
  assert.deepEqual([...ROUTE_ACCESS["/quotations"]].sort(), ["Admin", "Sales"].sort());
  // /finance mirrors the backend's invoice/approveAmendment permission set.
  assert.deepEqual([...ROUTE_ACCESS["/finance"]].sort(), ["Admin", "Finance"].sort());
  assert.equal(canAccessRoute(ROLES.SALES, "/finance"), false, "Sales must not reach Finance PO/invoice actions");
  assert.equal(canAccessRoute(ROLES.CLIENT_VIEWER, "/finance"), false);
  assert.equal(canAccessRoute(ROLES.FINANCE, "/quotations"), false, "Finance must not draft/send quotes");
  assert.deepEqual(Object.keys(ROUTE_ACCESS).sort(), [...Object.keys(expected), "/reports", "/operational-data", "/documents", "/quotations", "/finance", "/daily-timesheets", "/contractor-logs", ROUTE].sort());
  assert.equal(canAccessRoute(ROLES.SALES, "/inventory"), false);
  assert.equal(canAccessRoute(ROLES.CLIENT_VIEWER, "/reports"), false);
  assert.equal(canAccessRoute(ROLES.CLIENT_VIEWER, "/quotations"), false, "Client Viewer must never see internal quote drafting");
  assert.equal(canAccessRoute(ROLES.OPERATIONS, "/quotations"), false, "Operations approves a sent quote but does not draft/send/cancel one");
});

test("the dashboard root stays open to everyone and the new route does not change that", () => {
  for (const role of Object.values(ROLES)) assert.equal(canAccessRoute(role, "/"), true, role);
});
