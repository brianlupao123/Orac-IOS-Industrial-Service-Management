// Frontend part of the Timesheet workflow packet. Dependency-free (node:test only).
// Flags are read from process.env here because import.meta.env exists only under Vite.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");
const KEYS = ["WORKFLOW_UI", "CLIENT_RETURN", "AUTHORITY", "BATCH_CONFIRM", "OPS_RESTRICT", "KIOSK_HIDDEN"].map((k) => `VITE_TIMESHEET_${k}`);
async function load(flags, tag) {
  const saved = {}; for (const k of KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
  for (const k of flags) process.env[k] = "enabled";
  try { return await import(`../src/accessPolicy.js?${tag}`); } finally { for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } }
}

test("all flags off: routes and navigation are exactly the pre-packet policy", async () => {
  const p = await load([], "off");
  assert.equal(p.canAccessRoute(p.ROLES.SALES, "/worksheets"), true);
  assert.equal(p.canAccessRoute(p.ROLES.SALES, "/monthly-worksheets"), true);
  assert.equal(p.canAccessRoute(p.ROLES.OPERATIONS, "/monthly-worksheets"), true);
  assert.equal(p.canAccessRoute(p.ROLES.OPERATIONS, "/kiosk"), true);
  assert.equal(p.ROUTE_ACCESS["/timesheet-workflow"], undefined);
  assert.equal(p.NAV_ITEMS.some((i) => i.path === "/timesheet-workflow"), false);
});

test("workflow UI on: Sales/Finance reach Timesheets and Worksheets; the workflow page is Admin/Sales/Finance only", async () => {
  const p = await load(["VITE_TIMESHEET_WORKFLOW_UI"], "ui");
  for (const r of [p.ROLES.SALES, p.ROLES.FINANCE]) { assert.ok(p.canAccessRoute(r, "/worksheets")); assert.ok(p.canAccessRoute(r, "/monthly-worksheets")); assert.ok(p.canAccessRoute(r, "/timesheet-workflow")); }
  for (const r of [p.ROLES.OPERATIONS, p.ROLES.SUPERVISOR, p.ROLES.TECHNICIAN, p.ROLES.CLIENT_VIEWER, p.ROLES.MANAGEMENT]) assert.equal(p.canAccessRoute(r, "/timesheet-workflow"), false, r);
  assert.equal(p.canAccessRoute(p.ROLES.CLIENT_VIEWER, "/worksheets"), false);
});

test("ops restrict and kiosk hide are independent switches", async () => {
  const p = await load(["VITE_TIMESHEET_OPS_RESTRICT", "VITE_TIMESHEET_KIOSK_HIDDEN"], "restrict");
  assert.equal(p.canAccessRoute(p.ROLES.OPERATIONS, "/monthly-worksheets"), false);
  assert.equal(p.canAccessRoute(p.ROLES.SUPERVISOR, "/monthly-worksheets"), false);
  assert.equal(p.canAccessRoute(p.ROLES.ADMIN, "/monthly-worksheets"), true);
  assert.equal(p.canAccessRoute(p.ROLES.OPERATIONS, "/kiosk"), false);
  assert.equal(p.canAccessRoute(p.ROLES.ADMIN, "/kiosk"), true);
  assert.equal(p.canAccessRoute(p.ROLES.OPERATIONS, "/worksheets"), true, "dispatch/field Timesheets stay with Operations");
});

test("Client Viewer is displayed as Client; business labels appear only with the authority flag", async () => {
  const { roleLabel } = await import("../src/timesheetWorkflowFlags.js");
  assert.equal(roleLabel("Client Viewer"), "Client"); assert.equal(roleLabel("Sales"), "Sales");
  delete process.env.VITE_TIMESHEET_AUTHORITY;
  let m = await import("../src/timesheetWorkflowFlags.js?a");
  assert.equal(m.statusLabel("Client_Acknowledged"), "Client Acknowledged");
  process.env.VITE_TIMESHEET_AUTHORITY = "enabled";
  try { m = await import("../src/timesheetWorkflowFlags.js?b"); assert.equal(m.statusLabel("Client_Acknowledged"), "Client Confirmed"); assert.equal(m.statusLabel("Captured_From_Signed_Paper"), "Captured from Signed Paper"); }
  finally { delete process.env.VITE_TIMESHEET_AUTHORITY; }
});

test("API client targets the server routes and sends no identity or rate fields", () => {
  const c = src("api/client.js");
  for (const p of ["/client-return", "/field_worksheets/batch-confirm", "/field_worksheets/paper-capture", "/timesheet-authorities", "/timesheet-policy", "/invoice-variance", "/variance-override", "/timesheet-cutover"]) assert.ok(c.includes(p), p);
  const block = c.slice(c.indexOf("export const timesheetWorkflow"));
  assert.equal(/hourly_rate|rate_card|client_user|impersonat/i.test(block), false);
});

test("client panel: return needs a reason, batch is never pre-ticked, confirmation says it is not rate/invoice approval", () => {
  const s = src("components/ClientAcknowledgementPanel.jsx");
  assert.ok(s.includes("flags.clientReturn")); assert.ok(s.includes("reason.length < 3"));
  assert.ok(s.includes("setSelected({})") && !/useState\(\{[^)]*true/.test(s));
  assert.ok(s.includes("not approval of rates, invoice value or payment"));
});

test("workflow page exposes no rate fields and no client-impersonation control", () => {
  const s = src("pages/TimesheetWorkflowPage.jsx");
  assert.equal(/hourly_rate|rate_card|\bunit_price\b|impersonat|act as client/i.test(s), false);
  assert.ok(s.includes("never recorded as acting"));
  assert.ok(src("App.jsx").includes('path="/timesheet-workflow"'));
});

test("variance panel shows the PO position and the API client can fetch paper sampling", () => {
  assert.match(src("pages/TimesheetWorkflowPage.jsx"), /po_position/);
  assert.match(src("api/client.js"), /\/timesheets\/paper-sampling\?month=/);
});
