import test from "node:test";
import assert from "node:assert/strict";
import { NAV_GROUPS, ROLES, visibleNavigation, visibleNavigationGroups } from "../src/accessPolicy.js";
import { readFileSync } from "node:fs";

test("grouped navigation preserves the route-level visibility policy", () => {
  for (const role of Object.values(ROLES)) {
    const groupedPaths = visibleNavigationGroups(role).flatMap((group) => group.items.map((item) => item.path)).sort();
    const flatPaths = visibleNavigation(role).map((item) => item.path).sort();
    assert.deepEqual(groupedPaths, flatPaths, role);
  }
});

test("commercial and field work keep related operational pages together", () => {
  const commercial = NAV_GROUPS.find((group) => group.id === "commercial");
  const fieldWork = NAV_GROUPS.find((group) => group.id === "field-work");
  assert.deepEqual(commercial.paths, ["/portal", "/service-requests", "/quotations", "/finance", "/internal-requests"]);
  assert.deepEqual(fieldWork.paths, ["/worksheets", "/monthly-worksheets"]);
});

test("sidebar groups are collapsible, expose state to assistive tech and keep one-item areas as direct links", () => {
  const src = readFileSync(new URL("../src/components/layout/SidebarPanel.jsx", import.meta.url), "utf8");
  assert.match(src, /aria-expanded=\{open\}/);
  assert.match(src, /aria-controls=\{listId\}/);
  assert.match(src, /group\.items\.length === 1/);
  assert.match(src, /aria-current=\{childActive \? "page" : undefined\}/);
});

test("sidebar adds Contracts, Kiosk mode and Timesheet sub-filters without widening any route", async () => {
  const { sidebarGroups, TIMESHEET_STATUS_FILTERS } = await import("../src/navModel.js");
  const { canAccessRoute } = await import("../src/accessPolicy.js");
  for (const role of Object.values(ROLES)) {
    const items = sidebarGroups(role).flatMap((g) => g.items);
    for (const item of items) assert.ok(canAccessRoute(role, item.path), `${role} listed ${item.path} without route access`);
    assert.equal(items.some((i) => i.path === "/contracts"), canAccessRoute(role, "/contracts"), `${role} contracts`);
    assert.equal(items.some((i) => i.path === "/kiosk"), canAccessRoute(role, "/kiosk"), `${role} kiosk`);
    const ts = items.find((i) => i.path === "/worksheets");
    if (ts) assert.deepEqual(ts.children.map((c) => c.label), TIMESHEET_STATUS_FILTERS.map((f) => f.label));
  }
  assert.deepEqual(TIMESHEET_STATUS_FILTERS.map((f) => f.label), ["All Timesheets", "Draft", "Awaiting client", "Awaiting Supervisor", "Approved", "Returned"]);
});

test("the Timesheets page reads its status filter from the URL so sidebar sub-items stay in step", () => {
  const src = readFileSync(new URL("../src/pages/WorksheetsPage.jsx", import.meta.url), "utf8");
  assert.match(src, /searchParams\.get\("status"\)/);
  assert.match(src, /next\.set\("status", key\)/);
});

test("compact screens keep labelled primary navigation and a route-safe More menu", () => {
  const src = readFileSync(new URL("../src/layouts/PortalLayout.jsx", import.meta.url), "utf8");
  assert.match(src, /aria-label="Mobile primary" className="orac-mobile-tabs min-\[900px\]:hidden"/);
  assert.match(src, /navGroups\.slice\(0, 4\)/);
  assert.match(src, /<span>More<\/span>/);
});
