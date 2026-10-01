import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

test("floating assistant supports all eight role copies with compact quick actions", () => {
  const file = fs.readFileSync(path.join(root, "src/components/AIAssistantPanel.jsx"), "utf8");
  for (const role of ["Admin", "Management", "Sales", "Finance", "Operations", "Supervisor", "Technician", "Client Viewer"]) {
    assert.ok(file.includes(`${role}:`) || file.includes(`"${role}":`));
  }
  const quickGroups = file.match(/quick:\s*\[/g) || [];
  assert.equal(quickGroups.length, 8);
  assert.match(file, /ORAC Guide/);
  assert.match(file, /Role-scoped dashboard evidence/);
});

test("assistant drawer renders typed chat and evidence highlighting", () => {
  const file = fs.readFileSync(path.join(root, "src/components/AIAssistantPanel.jsx"), "utf8");
  assert.match(file, /assistant\.chat\(question, lastContext\)/);
  assert.match(file, /Show evidence:/);
  assert.match(file, /scrollIntoView/);
  assert.match(file, /ring-orac-blue\/50/);
  assert.match(file, /whitespace-pre-line/);
});

test("dashboard has stable evidence targets for kpis, workflow, and operational queues", () => {
  const file = fs.readFileSync(path.join(root, "src/pages/DashboardPage.jsx"), "utf8");
  for (const target of [
    "evidence-kpi-clients",
    "evidence-kpi-quotes",
    "evidence-kpi-dispatches",
    "evidence-kpi-invoices",
    "evidence-kpi-blocked-amendments",
    "evidence-kpi-worksheets-review",
    "evidence-kpi-worksheets",
    "evidence-kpi-returned-for-correction",
    "evidence-section-role-priorities",
    "evidence-section-worksheets"
  ]) {
    assert.match(file, new RegExp(target));
  }
  assert.match(file, /evidence-pipeline-/);
});
