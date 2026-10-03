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
  assert.deepEqual(fieldWork.paths, ["/worksheets", "/daily-timesheets", "/contractor-logs"]);
});

test("primary navigation provides accessible menus and preserves direct one-item work areas", () => {
  const src = readFileSync(new URL("../src/layouts/PortalLayout.jsx", import.meta.url), "utf8");
  assert.match(src, /aria-haspopup="menu"/);
  assert.match(src, /aria-expanded=\{isOpen\}/);
  assert.match(src, /role="menu"/);
  assert.match(src, /role="menuitem"/);
  assert.match(src, /group\.items\.length === 1/);
});
