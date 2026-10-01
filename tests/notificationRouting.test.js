import test from "node:test";
import assert from "node:assert/strict";
import { resolveNotificationTarget, unreadCount, bellLabel } from "../src/notificationRouting.js";
import { ROUTE_ACCESS } from "../src/accessPolicy.js";

const ROLES = ["Admin", "Management", "Sales", "Finance", "Operations", "Supervisor", "Technician", "Client Viewer"];
const dest = (route, extra = {}) => ({ id: "n1", read: false, destination: { route, exact: false, resolved: true, note: "", ...extra } });

test("an exact route the role may open is followed unchanged, with its query", () => {
  const out = resolveNotificationTarget({ role: "Admin" }, dest("/admin?tab=access-requests&focus=areq_1", { exact: true }));
  assert.equal(out.to, "/admin?tab=access-requests&focus=areq_1");
  assert.equal(out.exact, true);
  assert.equal(out.resolved, true);
});

test("a route the role cannot open falls back to the dashboard with an honest message", () => {
  const out = resolveNotificationTarget({ role: "Sales" }, dest("/admin?tab=access-requests&focus=x"));
  assert.equal(out.to, "/");
  assert.equal(out.resolved, false);
  assert.match(out.note, /not available in your workspace/i);
});

test("unsafe or external destinations are never followed", () => {
  const admin = { role: "Admin" };
  for (const route of ["https://evil.test/admin", "//evil.test/admin", "javascript:alert(1)", "\\\\evil", "/\\evil.test", "admin", "", null, undefined, 42, { a: 1 }]) {
    const out = resolveNotificationTarget(admin, dest(route));
    assert.equal(out.to, "/", String(route));
  }
});

test("missing, malformed or legacy notifications go to the dashboard and never throw", () => {
  for (const n of [null, undefined, {}, { destination: null }, { destination: "/admin" }, { destination: {} }]) {
    assert.equal(resolveNotificationTarget({ role: "Admin" }, n).to, "/");
  }
  assert.equal(resolveNotificationTarget(null, dest("/admin")).to, "/");
});

test("stale-target note from the server is passed through to the user", () => {
  const out = resolveNotificationTarget({ role: "Operations" }, dest("/internal-requests", { resolved: false, note: "That record is no longer available to you. Showing Internal requests." }));
  assert.equal(out.to, "/internal-requests");
  assert.equal(out.resolved, false);
  assert.match(out.note, /no longer available/);
});

test("for every role, every route the client would accept is one its route table allows", () => {
  const candidates = ["/", ...Object.keys(ROUTE_ACCESS)];
  for (const role of ROLES) {
    for (const path of candidates) {
      const out = resolveNotificationTarget({ role }, dest(`${path}?focus=abc`));
      const landed = out.to.split("?")[0];
      const allowed = landed === "/" || ROUTE_ACCESS[landed]?.includes(role);
      assert.ok(allowed, `${role} was routed to ${landed}`);
    }
  }
});

test("a Client Viewer is never routed into a staff workspace", () => {
  for (const path of ["/admin", "/finance", "/quotations", "/worksheets", "/inventory", "/service-requests", "/internal-requests"]) {
    assert.equal(resolveNotificationTarget({ role: "Client Viewer" }, dest(path)).to, "/", path);
  }
  assert.equal(resolveNotificationTarget({ role: "Client Viewer" }, dest("/portal")).to, "/portal");
});

test("unread count and accessible bell label", () => {
  assert.equal(unreadCount([{ read: false }, { read: true }, {}, null]), 2);
  assert.equal(unreadCount(undefined), 0);
  assert.equal(bellLabel(0), "Notifications, none unread");
  assert.equal(bellLabel(3), "Notifications, 3 unread");
});
