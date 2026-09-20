import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { canAccessRoute, ROLES } from "../src/accessPolicy.js";

test("dashboard commercial destinations stay inside each role's allowed routes", () => {
  const destinationFor = (role) => canAccessRoute(role, "/portal") ? "/portal" : canAccessRoute(role, "/reports") ? "/reports" : "/";

  for (const role of Object.values(ROLES)) {
    const destination = destinationFor(role);
    assert.ok(destination === "/" || canAccessRoute(role, destination), `${role} must not receive a dashboard dead end`);
  }
  assert.equal(destinationFor(ROLES.CLIENT_VIEWER), "/portal");
  assert.equal(destinationFor(ROLES.SALES), "/reports");
  assert.equal(destinationFor(ROLES.OPERATIONS), "/reports");
  assert.equal(destinationFor(ROLES.SUPERVISOR), "/reports");
});

test("dashboard uses the centralized route policy for report and administration links", () => {
  const source = readFileSync(new URL("../src/pages/DashboardPage.jsx", import.meta.url), "utf8");

  assert.match(source, /const canReports = canAccessRoute\(user\.role, "\/reports"\)/);
  assert.match(source, /const canAdministration = canAccessRoute\(user\.role, "\/admin"\)/);
  assert.match(source, /const canManageAccessRequests = user\.role === "Admin"/);
  assert.match(source, /const commercialDestination = canClientPortal \? "\/portal" : canReports \? "\/reports" : undefined/);
});
