import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const dashboardSource = readFileSync(new URL("../src/pages/DashboardPage.jsx", import.meta.url), "utf8");
const assistantSource = readFileSync(new URL("../src/components/AIAssistantPanel.jsx", import.meta.url), "utf8");

const REQUIRED_TARGETS = [
  "evidence-kpi-clients",
  "evidence-kpi-quotes",
  "evidence-kpi-dispatches",
  "evidence-kpi-invoices",
  "evidence-kpi-blocked-amendments",
  "evidence-kpi-worksheets",
  "evidence-kpi-worksheets-review",
  "evidence-kpi-returned-for-correction",
  "evidence-section-role-priorities",
  "evidence-section-worksheets"
];

test("all role dashboard evidence targets are stable and visible", () => {
  for (const target of REQUIRED_TARGETS) {
    assert.match(dashboardSource, new RegExp(target));
  }
  assert.match(dashboardSource, /evidence-pipeline-/);
});

test("assistant drawer renders evidence references as buttons", () => {
  assert.match(assistantSource, /response\.evidenceRefs\?\.length/);
  assert.match(assistantSource, /focusEvidence\(ref\)/);
  assert.match(assistantSource, /scrollIntoView/);
  assert.match(assistantSource, /ring-orac-blue\/50/);
});

test("assistant has role-specific copy for all ORAC roles", () => {
  for (const role of ["Admin", "Management", "Sales", "Finance", "Operations", "Supervisor", "Technician"]) {
    assert.match(assistantSource, new RegExp(`${role}\\s*:`));
  }
  assert.match(assistantSource, /["']Client Viewer["']\s*:/);
  assert.match(dashboardSource, /ROLE_CHART_METRICS/);
});
