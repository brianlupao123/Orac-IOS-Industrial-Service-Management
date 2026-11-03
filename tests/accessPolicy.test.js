import test from "node:test";
import assert from "node:assert/strict";
import { NAV_ITEMS, ROLES, ROUTE_ACCESS, canAccessRoute, visibleNavigation } from "../src/accessPolicy.js";

test("every protected route has only defined ORAC roles", () => {
  const knownRoles = new Set(Object.values(ROLES));
  for (const [path, allowedRoles] of Object.entries(ROUTE_ACCESS)) {
    assert.ok(allowedRoles.length > 0, `${path} must not be open by omission`);
    for (const role of allowedRoles) assert.ok(knownRoles.has(role), `${path} contains an unknown role`);
  }
});

test("navigation is derived from the same policy as protected routes", () => {
  for (const role of Object.values(ROLES)) {
    for (const item of NAV_ITEMS) {
      assert.equal(visibleNavigation(role).some((visible) => visible.path === item.path), canAccessRoute(role, item.path));
    }
  }
});

test("eight roles retain their expected role-specific routes", () => {
  assert.ok(canAccessRoute(ROLES.CLIENT_VIEWER, "/portal"));
  assert.ok(canAccessRoute(ROLES.TECHNICIAN, "/worksheets"));
  assert.ok(canAccessRoute(ROLES.FINANCE, "/reports"));
  assert.ok(canAccessRoute(ROLES.OPERATIONS, "/inventory"));
  assert.ok(canAccessRoute(ROLES.TECHNICIAN, "/operational-data"));
  assert.ok(canAccessRoute(ROLES.SALES, "/operational-data"));
  assert.ok(canAccessRoute(ROLES.MANAGEMENT, "/admin"));
  assert.ok(canAccessRoute(ROLES.SALES, "/inventory"));
  assert.ok(!canAccessRoute(ROLES.CLIENT_VIEWER, "/reports"));
});
