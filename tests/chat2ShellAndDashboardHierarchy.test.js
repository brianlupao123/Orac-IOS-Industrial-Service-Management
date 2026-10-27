import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("portal navigation stays policy-derived (no hard-coded role links)", () => {
  const file = read("src/layouts/PortalLayout.jsx");
  assert.match(file, /import \{ visibleNavigationGroups \} from "\.\.\/accessPolicy\.js"/);
  assert.match(file, /visibleNavigationGroups\(user\.role\)/);
  // Guard against role names being hard-coded into the layout itself.
  for (const role of ["Admin", "Management", "Sales", "Finance", "Operations", "Supervisor", "Technician", "Client Viewer"]) {
    assert.doesNotMatch(file, new RegExp(`"${role}"`));
  }
});

test("nav and footer no longer use the unconverted navy utility that fails dark-mode contrast", () => {
  const file = read("src/layouts/PortalLayout.jsx");
  // These utilities have no dark-mode override in index.css, so using them for
  // text on a dark surface previously produced ~1.8:1 contrast (fails WCAG AA).
  assert.doesNotMatch(file, /hover:text-orac-navy/);
  assert.doesNotMatch(file, /className="font-semibold text-orac-navy/);
  assert.match(file, /hover:text-orac-text-primary/);
  assert.match(file, /className="font-semibold text-orac-blue/);
});

test("desktop navigation uses evenly distributed labelled destinations", () => {
  const file = read("src/layouts/PortalLayout.jsx");
  assert.match(file, /orac-primary-nav hidden lg:flex[^\"]*justify-evenly/);
  assert.match(file, /WorkspaceNavMenu key=\{group\.id\} group=\{group\} pathname=\{location\.pathname\}/);
});

test("only one top-level sign-out affordance competes for space at narrow widths", () => {
  const file = read("src/layouts/PortalLayout.jsx");
  assert.match(file, /orac-header-signout hidden items-center rounded-md border border-gray-200[^"]*xl:inline-flex/);
  assert.match(file, /<UserProfileDropdown user=\{user\} onSignOut=\{onLogout\} \/>/);
});

test("dashboard no longer renders the duplicate role-metrics progress-bar section", () => {
  const file = read("src/pages/DashboardPage.jsx");
  assert.doesNotMatch(file, /RoleMetricChart/);
  assert.doesNotMatch(file, /evidence-chart-role-summary/);
});

test("dashboard renders priorities before the general overview KPIs", () => {
  const file = read("src/pages/DashboardPage.jsx");
  const prioritiesIndex = file.indexOf("evidence-section-role-priorities");
  const overviewIndex = file.indexOf("evidence-kpi-clients");
  assert.ok(prioritiesIndex > -1 && overviewIndex > -1);
  assert.ok(prioritiesIndex < overviewIndex, "priorities section must precede the overview KPI grid");
});

test("the floating AI assistant renders after the dashboard content in document order", () => {
  const file = read("src/pages/DashboardPage.jsx");
  const worksheetsIndex = file.indexOf("evidence-section-worksheets");
  const assistantIndex = file.lastIndexOf("<AIAssistantPanel user={user} />");
  assert.ok(worksheetsIndex > -1 && assistantIndex > -1);
  assert.ok(assistantIndex > worksheetsIndex, "assistant should be last for natural tab order (it is fixed-position, so this has no visual effect)");
});
