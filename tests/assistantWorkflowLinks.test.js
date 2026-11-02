import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { ROUTE_ACCESS, ROLES, canAccessRoute } from "../src/accessPolicy.js";

const root = process.cwd();
const panel = fs.readFileSync(path.join(root, "src/components/AIAssistantPanel.jsx"), "utf8");
const client = fs.readFileSync(path.join(root, "src/api/client.js"), "utf8");
const ALL_ROLES = Object.values(ROLES);

// The same table is asserted by the backend test "assistant destinations match
// the shared route contract" (tests/aiWorkflowAssistant.test.js). The backend
// assistant may only link to these paths for these roles. Change both together.
const ROUTE_CONTRACT = {
  "/": ALL_ROLES,
  "/portal": ["Client Viewer"],
  "/service-requests": ["Sales", "Operations"],
  "/quotations": ["Admin", "Management", "Sales"],
  "/finance": ["Admin", "Finance"],
  "/internal-requests": ["Admin", "Management", "Sales", "Finance", "Operations", "Supervisor", "Technician"],
  "/worksheets": ["Admin", "Management", "Operations", "Supervisor", "Technician"],
  "/daily-timesheets": ["Admin", "Management", "Operations", "Supervisor", "Technician"],
  "/contractor-logs": ["Admin", "Management", "Operations", "Supervisor"],
  "/monthly-worksheets": ["Admin", "Management", "Operations", "Supervisor"],
  "/legacy-history": ["Admin", "Management", "Operations", "Supervisor"],
  "/kiosk": ["Admin", "Management", "Operations", "Supervisor"],
  "/inventory": ["Admin", "Management", "Operations"],
  "/reports": ["Admin", "Management", "Operations", "Supervisor", "Sales", "Finance"],
  "/job-cards": ["Admin", "Management", "Operations", "Supervisor", "Technician", "Sales"],
  "/invoice-readiness": ["Admin", "Management", "Finance", "Sales"],
  "/operational-data": ["Admin", "Management", "Operations", "Supervisor", "Technician", "Sales", "Finance"],
  "/documents": ALL_ROLES,
  "/contracts": ["Admin", "Management", "Operations", "Client Viewer"],
  "/admin": ["Admin", "Management", "Operations"]
};

test("assistant link contract matches the real frontend route policy for every role", () => {
  for (const [route, allowed] of Object.entries(ROUTE_CONTRACT)) {
    for (const role of ALL_ROLES) {
      assert.equal(canAccessRoute(role, route), allowed.includes(role), `${role} on ${route}`);
    }
  }
  for (const route of Object.keys(ROUTE_ACCESS)) {
    assert.ok(Object.hasOwn(ROUTE_CONTRACT, route), `route ${route} exists in ROUTE_ACCESS but not in the assistant link contract`);
  }
});

test("panel renders a server link only when the frontend route policy also allows the role", () => {
  assert.match(panel, /import \{ canAccessRoute \} from "\.\.\/accessPolicy\.js"/);
  assert.match(panel, /canAccessRoute\(user\.role, link\.path\)/);
  assert.match(panel, /function openLink\(link\) \{\s*if \(!canAccessRoute\(user\.role, link\.path\)\) return;/);
  assert.match(panel, /navigate\(link\.path\)/);
});

test("panel is read-only: no mutation calls, storage, raw HTML, external navigation or network calls", () => {
  assert.doesNotMatch(panel, /dangerouslySetInnerHTML|window\.open|window\.location|localStorage|sessionStorage|\bfetch\s*\(|XMLHttpRequest/);
  assert.doesNotMatch(panel, /method:\s*"(?:PUT|PATCH|DELETE)"/);
  const imports = [...panel.matchAll(/import \{([^}]+)\} from "\.\.\/api\/client\.js"/g)].map((match) => match[1].trim());
  assert.deepEqual(imports, ["assistant"], "the panel may import only the read-only assistant API");
});

test("assistant API client only calls /ai/ endpoints", () => {
  const block = client.slice(client.indexOf("export const assistant = {"));
  const assistantBlock = block.slice(0, block.indexOf("\n};") + 3);
  const paths = [...assistantBlock.matchAll(/request\("([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(paths.sort(), ["/ai/attention", "/ai/briefing", "/ai/chat", "/ai/explain", "/ai/feedback", "/ai/health", "/ai/record-analysis", "/ai/workflow"]);
  assert.match(assistantBlock, /workflow\(articleId\)/);
  assert.match(assistantBlock, /recordAnalysis\(recordType, recordId\)/);
});

test("panel is honest about what it is and offers role-scoped workflow guides", () => {
  assert.match(panel, /not generative AI/);
  assert.match(panel, /ORAC Guide/);
  assert.match(panel, /config\.workflow_topics/);
  assert.match(panel, /assistant\.workflow\(topic\.id\)/);
  assert.match(panel, /Workflow guides for \{user\.role\}/);
  assert.match(panel, /I cannot do the task for you/);
});

test("panel keeps accessibility behaviour: live log, labelled input, focus trap and focus return", () => {
  assert.match(panel, /role="log" aria-live="polite"/);
  assert.match(panel, /role="status"/);
  assert.match(panel, /role="alert"/);
  assert.match(panel, /aria-label="Ask the ORAC guide a question"/);
  assert.match(panel, /role="dialog" aria-modal="true" aria-labelledby="assistant-title"/);
  assert.match(panel, /event\.key !== "Tab"/);
  assert.match(panel, /launcherRef\.current\?\.focus\(\)/);
  assert.match(panel, /inputRef\.current\?\.focus\(\)/);
  assert.match(panel, /event\.key === "Escape"/);
});

test("follow-up context carries only ids and labels, never answer text", () => {
  assert.match(panel, /setLastContext\(\{ metric: first\.metric, targetId: first\.targetId, label: first\.label, articleId \}\)/);
  assert.doesNotMatch(panel, /setLastContext\([^)]*message/);
});
