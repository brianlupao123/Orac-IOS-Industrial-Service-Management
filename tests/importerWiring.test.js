import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { canAccessRoute, visibleNavigationGroups } from "../src/accessPolicy.js";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("route policy: only Admin and Management see and reach /imports (the server enforces the same on every call)", () => {
  for (const role of ["Admin", "Management"]) assert.equal(canAccessRoute(role, "/imports"), true, role);
  for (const role of ["Sales", "Finance", "Operations", "Technician", "Supervisor", "Client Viewer"]) assert.equal(canAccessRoute(role, "/imports"), false, role);
  const labels = (role) => visibleNavigationGroups(role).flatMap((g) => g.items.map((i) => i.path));
  assert.ok(labels("Admin").includes("/imports") && labels("Management").includes("/imports"));
  assert.ok(!labels("Sales").includes("/imports") && !labels("Finance").includes("/imports"));
});

test("wiring: the route sits behind GuardedRoute", () => {
  assert.match(read("src/App.jsx"), /<Route path="\/imports" element=\{<GuardedRoute user=\{user\} path="\/imports"><ImporterPage user=\{user\} \/><\/GuardedRoute>\} \/>/);
});
