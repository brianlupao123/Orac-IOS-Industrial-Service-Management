import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const FLAG = "VITE_ORAC_V5_COMMERCIAL_WORKFLOW";
const SAVED_FLAG = process.env[FLAG];
test.after(() => { if (SAVED_FLAG === undefined) delete process.env[FLAG]; else process.env[FLAG] = SAVED_FLAG; });
// The flag is read at call time, so it must stay set while the test body runs.
async function model(enabled, tag) {
  if (enabled) process.env[FLAG] = "enabled"; else delete process.env[FLAG];
  return import(`../src/v5SignatureModel.js?${tag}`);
}
const HASH = "a".repeat(64);

test("everything is hidden when the V5 flag is off", async () => {
  const m = await model(false, "off");
  for (const role of ["Admin", "Management", "Sales", "Supervisor", "Finance"]) {
    assert.equal(m.v5SignatureVisible(role), false, role);
    assert.equal(m.v5ReadinessVisible(role), false, role);
    assert.equal(m.canRecordV5Evidence(role), false, role);
    assert.equal(m.canConfirmV5(role), false, role);
  }
});

test("flag on: roles match the backend permissions exactly", async () => {
  const m = await model(true, "on");
  for (const r of ["Admin", "Management", "Sales", "Supervisor", "Finance"]) assert.equal(m.v5SignatureVisible(r), true, r);
  for (const r of ["Operations", "Technician", "Client Viewer"]) assert.equal(m.v5SignatureVisible(r), false, r);
  assert.deepEqual(["Admin", "Sales"].filter(m.canRecordV5Evidence), ["Admin", "Sales"]);
  for (const r of ["Management", "Finance", "Supervisor", "Operations"]) assert.equal(m.canRecordV5Evidence(r), false, r);
  assert.equal(m.canConfirmV5("Supervisor"), true);
  for (const r of ["Sales", "Admin", "Finance", "Management"]) assert.equal(m.canConfirmV5(r), false, `${r} cannot confirm`);
  for (const r of ["Admin", "Management", "Sales", "Finance"]) assert.equal(m.v5ReadinessVisible(r), true, r);
  assert.equal(m.v5ReadinessVisible("Supervisor"), false);
});

test("confirm action needs a Supervisor, current evidence and no existing confirmation", async () => {
  const m = await model(true, "confirm");
  const state = { evidence: { id: "e1" }, confirmation: null, current_hash: HASH };
  assert.equal(m.canShowConfirm("Supervisor", state), true);
  assert.equal(m.canShowConfirm("Sales", state), false);
  assert.equal(m.canShowConfirm("Supervisor", { ...state, evidence: null }), false);
  assert.equal(m.canShowConfirm("Supervisor", { ...state, confirmation: { id: "c1" } }), false);
  assert.deepEqual(m.confirmPayload(state), { evidence_id: "e1", hours_hash: HASH, attest: true });
});

test("hours are always explicit as Normal, 1.5 and 2.0", async () => {
  const m = await model(true, "hours");
  const hrs = m.hoursFromBasis({ hours_hundredths: { normal: 800, ot_15: 150, ot_20: 0, total: 950 } });
  assert.deepEqual(hrs, { normal: 8, ot_15: 1.5, ot_20: 0, total: 9.5 });
  assert.equal(m.hoursLine(hrs), "Normal 8 h · 1.5 1.5 h · 2.0 0 h · Total 9.5 h");
  assert.equal(m.hoursLine(null), "Hours unavailable");
});

test("state projection is a whitelist: rates and unknown fields never reach the screen", async () => {
  const m = await model(true, "project");
  const raw = {
    timesheet_id: "t1", dispatch_card_id: "d1", current_hash: HASH, verified: false, reasons: ["NO_PAPER_EVIDENCE"],
    hash_basis: { hours_hundredths: { normal: 800, ot_15: 0, ot_20: 0, total: 800 }, hourly_rate: 55 },
    hourly_rate: 55, invoice_total: 999,
    evidence: { id: "e1", hours_hash: HASH, scan_hash: HASH, evidence_reference: "REF1", amount: 5, paper: { worker_name_on_paper: "A B", client_supervisor_name_on_paper: "C D", payroll: 1 }, client_supervisor_contact: { contact_id: "c1", name: "C D", rate: 4 } },
    evidence_history: [{ id: "e1", status: "current", hours_hash: HASH, recorded_at: "2026-10-01T00:00:00Z", cost: 3 }],
    confirmation: null, confirmation_history: []
  };
  const out = JSON.stringify(m.projectSignatureState(raw));
  for (const word of ["hourly_rate", "invoice_total", "amount", "payroll", "cost", "\"rate\""]) assert.equal(out.includes(word), false, word);
  assert.match(out, /REF1/);
  const ready = JSON.stringify(m.projectReadiness({ dispatch_card_id: "d1", quotation_number: "Q1", lines: [{ quote_line_id: "l1", description: "Fitter", pricing_basis: "hourly", canonical_hours: 8, source_timesheet_ids: ["t1"], unit_rate: 9 }], unmapped: { hours: 0 }, verification: { unverified_hours: 2, unverified_timesheets: [{ id: "t2", hours: 2, reasons: ["NOT_SUBMITTED"] }] }, canonical_hours_total: 8, ready_for_pricing_review: true, blockers: [], invoice_total: 9 }));
  assert.equal(/unit_rate|invoice_total/.test(ready), false);
});

test("evidence status and reason codes read as plain words, including stale evidence", async () => {
  const m = await model(true, "labels");
  assert.match(m.evidenceStatusLabel("stale_hours_changed"), /hours changed/i);
  assert.equal(m.evidenceStatusTone("current"), "good");
  assert.equal(m.evidenceStatusTone("stale_hours_changed"), "warn");
  assert.equal(m.evidenceStatusTone("integrity_failed"), "bad");
  assert.match(m.reasonLabel("NO_CURRENT_SUPERVISOR_CONFIRMATION"), /assigned ORAC Supervisor/);
  assert.equal(m.reasonLabel("SOMETHING_NEW"), "something new");
});

test("server error codes drive the advice, not message text", async () => {
  const m = await model(true, "errors");
  assert.equal(m.v5ErrorAdvice({ code: "STALE_HASH", message: "x" }).reload, true);
  assert.equal(m.v5ErrorAdvice({ code: "SEPARATION_OF_DUTIES", message: "Not you." }).message, "Not you.");
  assert.equal(m.v5ErrorAdvice({ status: 403, message: "Forbidden" }).message, "Forbidden");
});

test("contact form mirrors the server schema and sends no account fields", async () => {
  const m = await model(true, "contact");
  const e = m.validateContactForm({ ...m.emptyContactForm(), name: "A", source_reference: "x", email: "bad" });
  assert.ok(e.name && e.source_reference && e.email);
  const ok = { ...m.emptyContactForm(), name: "Pat Moyo", title: "Site Supervisor", source_reference: "PO 123 email", dispatch_scoped: true };
  assert.deepEqual(m.validateContactForm(ok), {});
  const payload = m.contactPayload(ok);
  assert.deepEqual(Object.keys(payload).sort(), ["dispatch_scoped", "name", "source_reference", "title"]);
  for (const key of Object.keys(payload)) assert.equal(/password|otp|pin|role|login|account/i.test(key), false, key);
});

test("paper form blocks every incomplete case the server would refuse", async () => {
  const m = await model(true, "paper");
  const empty = m.validatePaperForm(m.emptyPaperForm(""), { workDate: "2026-10-01", today: "2026-10-13" });
  for (const k of ["client_supervisor_contact_id", "worker_name_on_paper", "client_supervisor_name_on_paper", "worker_signed_on_paper", "client_supervisor_signed_on_paper", "paper_attestation", "evidence_reference", "source_channel", "custodian_user_id", "received_date", "scan_hash"]) assert.ok(empty[k], k);
  const good = { ...m.emptyPaperForm("u1"), client_supervisor_contact_id: "c1", worker_name_on_paper: "A B", client_supervisor_name_on_paper: "C D", worker_signed_on_paper: true, client_supervisor_signed_on_paper: true, paper_attestation: true, evidence_reference: "REF-1", source_channel: "email", received_date: "2026-10-02", scan_hash: HASH.toUpperCase() };
  assert.deepEqual(m.validatePaperForm(good, { workDate: "2026-10-01", today: "2026-10-13" }), {});
  assert.ok(m.validatePaperForm({ ...good, received_date: "2026-10-30" }, { workDate: "2026-10-01", today: "2026-10-13" }).received_date, "future date");
  assert.ok(m.validatePaperForm({ ...good, received_date: "2026-09-30" }, { workDate: "2026-10-01", today: "2026-10-13" }).received_date, "before work date");
  assert.ok(m.validatePaperForm({ ...good, scan_hash: "abc" }, {}).scan_hash);
  assert.ok(m.validatePaperForm(good, { needsReplacementReason: true }).replacement_reason);
  const payload = m.paperPayload(good);
  assert.equal(payload.scan_hash, HASH, "hash is lower-cased like the server stores it");
  assert.equal(payload.worker_signed_on_paper, true);
  assert.equal("replacement_reason" in payload, false);
  assert.equal("replacement_reason" in m.paperPayload({ ...good, replacement_reason: "Corrected scan" }, { needsReplacementReason: true }), true);
});

test("replacement is required only when evidence for the current hours already exists", async () => {
  const m = await model(true, "replace");
  assert.equal(m.needsReplacement({ evidence: { hours_hash: HASH }, current_hash: HASH }), true);
  assert.equal(m.needsReplacement({ evidence: null, current_hash: HASH }), false);
});

test("scan hashing matches a known SHA-256 vector", async () => {
  const m = await model(true, "sha");
  const file = new Blob(["abc"]);
  assert.equal(await m.sha256OfFile(file), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("only V5 Timesheets that are not superseded show the panel", async () => {
  const m = await model(true, "eligible");
  assert.equal(m.v5SheetEligibleForPanel({ timesheet_version: 2, hours_breakdown: { normal: 1 } }), true);
  assert.equal(m.v5SheetEligibleForPanel({ timesheet_version: 1 }), false);
  assert.equal(m.v5SheetEligibleForPanel({ timesheet_version: 2, hours_breakdown: {}, superseded_by: "x" }), false);
});

test("API client uses only the existing backend endpoints and keeps the server code", () => {
  const api = read("src/api/client.js");
  for (const path of ["/v5-signature-state", "/v5-paper-signature", "/v5-supervisor-confirmation", "/v5-client-supervisor-contacts", "/withdraw", "/v5-billing-readiness"]) assert.ok(api.includes(path), path);
  assert.match(api, /error\.code = body\.code/);
});

test("components are flag-gated, rate-free and never create a client login or action", () => {
  const panel = read("src/components/V5SignaturePanel.jsx");
  const ready = read("src/components/V5BillingReadinessPanel.jsx");
  const model = read("src/v5SignatureModel.js");
  assert.match(panel, /v5SignatureVisible/);
  assert.match(ready, /v5ReadinessVisible/);
  assert.match(model, /v5CommercialEnabled/);
  for (const [name, src] of [["panel", panel], ["readiness", ready]]) {
    assert.equal(/hourly_rate|unit_rate|invoice_total|payroll|impersonat|localStorage|dangerouslySetInnerHTML/i.test(src), false, name);
    assert.equal(/Create invoice|Approve invoice|Edit invoice|Send invoice/i.test(src), false, `${name}: no invoice action`);
    assert.equal(/<input[^>]*type="password"|\bOTP\b[^.]*input|client portal action/i.test(src), false, `${name}: no credential entry`);
  }
  assert.match(panel, /no login, role, code or portal access/);
  assert.match(panel, /cannot provide the ORAC Supervisor confirmation/);
  assert.match(panel, /kept, never deleted/);
});

test("pages mount the panels only behind the model's flag-aware checks", () => {
  const ws = read("src/pages/WorksheetsPage.jsx");
  assert.match(ws, /v5SignatureVisible\(user\.role\) && v5SheetEligibleForPanel\(ws\)/);
  assert.match(ws, /v5ReadinessVisible\(user\.role\) && <V5ReadinessByDispatch/);
  assert.match(read("src/pages/FinanceCommercialPage.jsx"), /V5BillingReadinessPanel/);
  assert.match(read("src/App.jsx"), /<FinanceCommercialPage user=\{user\} \/>/);
});

test("route access: V5 flag off leaves /worksheets exactly as before; on adds only Sales and Finance", async () => {
  const saved = process.env[FLAG];
  const load = async (on, tag) => { if (on) process.env[FLAG] = "enabled"; else delete process.env[FLAG]; return import(`../src/accessPolicy.js?${tag}`); };
  try {
    const off = await load(false, "v5-off");
    assert.equal(off.canAccessRoute(off.ROLES.SALES, "/worksheets"), false);
    assert.equal(off.canAccessRoute(off.ROLES.FINANCE, "/worksheets"), false);
    const on = await load(true, "v5-on");
    for (const r of [on.ROLES.SALES, on.ROLES.FINANCE, on.ROLES.MANAGEMENT, on.ROLES.ADMIN, on.ROLES.SUPERVISOR]) assert.ok(on.canAccessRoute(r, "/worksheets"), r);
    assert.equal(on.canAccessRoute(on.ROLES.CLIENT_VIEWER, "/worksheets"), false);
    assert.equal(on.canAccessRoute(on.ROLES.SALES, "/monthly-worksheets"), false, "other routes do not widen");
    assert.equal(on.canAccessRoute(on.ROLES.SALES, "/finance"), false);
  } finally { if (saved === undefined) delete process.env[FLAG]; else process.env[FLAG] = saved; }
});
