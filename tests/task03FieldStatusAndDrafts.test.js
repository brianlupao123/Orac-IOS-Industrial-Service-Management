import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  worksheetStatusLabel, worksheetNextAction, canReviewWorksheet, canAcknowledgeWorksheet, canReviseWorksheet, canEditWorksheet,
  kioskReviewLabel, kioskNextAction, kioskCountsText, materialStockLabel, foldKioskHours, kioskBreakdown, hasKioskHours
} from "../src/fieldStatusModel.js";
import {
  saveDraft, loadDraft, clearDraft, clearAllDrafts, purgeExpiredDrafts, sanitizeDraft, draftKey, DRAFT_PREFIX, DRAFT_TTL_MS, newBatchKey, isNetworkFailure
} from "../src/offlineDraftModel.js";

const root = new URL("..", import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, root), "utf8");

function memoryStorage() {
  const map = new Map();
  return {
    get length() { return map.size; },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    _map: map
  };
}

// ---- status model -------------------------------------------------------
test("worksheet statuses read in plain language and keep client and internal steps separate", () => {
  assert.equal(worksheetStatusLabel("Submitted"), "Awaiting client acknowledgement");
  assert.equal(worksheetStatusLabel("Client_Acknowledged"), "Client acknowledged, awaiting Supervisor review");
  assert.equal(worksheetStatusLabel("Supervisor_Approved"), "Supervisor approved");
  assert.equal(worksheetStatusLabel("Returned_For_Correction"), "Returned for correction");
});

test("Supervisor review is offered only after client acknowledgement; a client can acknowledge only Submitted work and cannot review", () => {
  for (const status of ["Draft", "Submitted", "Returned_For_Correction", "Supervisor_Approved"]) {
    assert.equal(canReviewWorksheet("Supervisor", { status }), false, status);
  }
  assert.equal(canReviewWorksheet("Supervisor", { status: "Client_Acknowledged" }), true);
  assert.equal(canReviewWorksheet("Client Viewer", { status: "Client_Acknowledged" }), false);
  assert.equal(canReviewWorksheet("Technician", { status: "Client_Acknowledged" }), false);
  assert.equal(canAcknowledgeWorksheet("Client Viewer", { status: "Submitted" }), true);
  assert.equal(canAcknowledgeWorksheet("Client Viewer", { status: "Client_Acknowledged" }), false);
  assert.equal(canAcknowledgeWorksheet("Supervisor", { status: "Submitted" }), false);
});

test("edit and revise are offered only where the server allows them", () => {
  assert.equal(canEditWorksheet("Technician", { status: "Draft" }), true);
  assert.equal(canEditWorksheet("Technician", { status: "Client_Acknowledged" }), false);
  assert.equal(canReviseWorksheet("Technician", { status: "Client_Acknowledged" }), true);
  assert.equal(canReviseWorksheet("Technician", { status: "Supervisor_Approved", superseded_by: "ws-2" }), false);
  assert.equal(canReviseWorksheet("Client Viewer", { status: "Supervisor_Approved" }), false);
});

test("next-action text differs by role, and tells a client that approval is ORAC's own step", () => {
  assert.match(worksheetNextAction("Client Viewer", { status: "Submitted" }), /acknowledge/i);
  assert.match(worksheetNextAction("Client Viewer", { status: "Client_Acknowledged" }), /internal Supervisor review/i);
  assert.match(worksheetNextAction("Supervisor", { status: "Client_Acknowledged" }), /approve it, or return it with a reason/i);
  assert.match(worksheetNextAction("Technician", { status: "Returned_For_Correction" }), /return reason/i);
});

test("kiosk entries: unknown status fails closed to pending; text says pending hours do not count", () => {
  assert.equal(kioskReviewLabel(undefined), "Pending Supervisor review");
  assert.equal(kioskReviewLabel("approved"), "Approved by Supervisor");
  assert.equal(kioskReviewLabel("rejected"), "Rejected by Supervisor");
  assert.match(kioskCountsText("pending_review"), /do not count as approved hours/);
  assert.match(kioskCountsText("rejected"), /do not count/);
  assert.equal(kioskCountsText("approved"), "These hours count as approved.");
});

test("kiosk next action: blocked reason points Admin/Operations at assigning a Supervisor and never offers an Admin approval", () => {
  const blocked = { review_status: "pending_review", review_blocked_reason: "No active Supervisor is assigned" };
  assert.match(kioskNextAction("Operations", blocked), /Assign one/);
  assert.match(kioskNextAction("Admin", blocked), /Assign one/);
  assert.match(kioskNextAction("Supervisor", blocked), /Waiting for a Supervisor to be assigned/);
  assert.doesNotMatch(kioskNextAction("Admin", { review_status: "pending_review", can_review: false }), /Approve/);
});

test("material stock labels are plain and handle unknown values", () => {
  assert.equal(materialStockLabel({ quantity_on_hand: 10, is_low_stock: false }), "In stock");
  assert.equal(materialStockLabel({ quantity_on_hand: 2, is_low_stock: true }), "Low stock");
  assert.equal(materialStockLabel({ quantity_on_hand: 0, is_low_stock: true }), "Out of stock");
  assert.equal(materialStockLabel({}), "Stock level unknown");
});

test("kiosk hours: existing folding is unchanged and the reported breakdown is carried as evidence", () => {
  assert.equal(foldKioskHours({ normal: 6, ot15: 1, ot20: 1 }), 6 + 1.5 + 2);
  assert.deepEqual(kioskBreakdown({ normal: 6, ot15: 1, ot20: 1 }), { normal: 6, ot_1_5: 1, ot_2_0: 1 });
  assert.equal(hasKioskHours({ normal: 0, ot15: 0, ot20: 0 }), false);
  assert.equal(hasKioskHours({ normal: 0, ot15: 0.5, ot20: 0 }), true);
});

// ---- offline drafts -----------------------------------------------------
test("drafts are isolated per user: another user on the same device never sees them", () => {
  const s = memoryStorage();
  saveDraft(s, "u1", "kiosk", "d1:2026-09-21", { crewHours: { t1: { normal: 8 } } });
  assert.ok(loadDraft(s, "u1", "kiosk", "d1:2026-09-21"));
  assert.equal(loadDraft(s, "u2", "kiosk", "d1:2026-09-21"), null);
  // even if a key were copied across users, the stored owner must match
  s.setItem(draftKey("u2", "kiosk", "d1:2026-09-21"), s.getItem(draftKey("u1", "kiosk", "d1:2026-09-21")));
  assert.equal(loadDraft(s, "u2", "kiosk", "d1:2026-09-21"), null);
});

test("drafts expire and expired or malformed ones are removed", () => {
  const s = memoryStorage(); const t0 = 1_000_000;
  saveDraft(s, "u1", "kiosk", "a", { x: 1 }, t0);
  assert.ok(loadDraft(s, "u1", "kiosk", "a", t0 + DRAFT_TTL_MS - 1));
  assert.equal(loadDraft(s, "u1", "kiosk", "a", t0 + DRAFT_TTL_MS + 1), null);
  assert.equal(s.getItem(draftKey("u1", "kiosk", "a")), null);
  s.setItem(`${DRAFT_PREFIX}u1:kiosk:bad`, "{not json");
  s.setItem("orac_token", "keep-me");
  assert.equal(purgeExpiredDrafts(s, t0), 1);
  assert.equal(s.getItem("orac_token"), "keep-me");
});

test("rates, costs, tokens, passwords and signatures are never stored in a draft", () => {
  const dirty = { crewHours: { t1: { normal: 8, hourly_rate: 45 } }, rate: 1, cost: 2, price: 3, token: "x", password: "p", signature: "data:image/png;base64,AAA", authorization: "Bearer x", nested: { hourly_rate: 9, ok: "yes" } };
  const clean = sanitizeDraft(dirty);
  const text = JSON.stringify(clean);
  for (const word of ["hourly_rate", "\"rate\"", "cost", "price", "token", "password", "signature", "authorization", "Bearer"]) assert.ok(!text.includes(word), word);
  assert.equal(clean.crewHours.t1.normal, 8);
  assert.equal(clean.nested.ok, "yes");
  const s = memoryStorage(); saveDraft(s, "u1", "kiosk", "a", dirty);
  const stored = JSON.parse(s.getItem(draftKey("u1", "kiosk", "a")));
  assert.equal(stored.data.crewHours.t1.hourly_rate, undefined);
  assert.ok(!("hourly_rate" in stored.data.crewHours.t1));
  assert.ok(!JSON.stringify(stored.data).includes("hourly_rate"));
  assert.ok(!JSON.stringify(stored.data).includes("45"));
});

test("a failing or missing storage never throws and simply yields no draft", () => {
  const broken = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("full"); }, removeItem() { throw new Error("denied"); }, get length() { throw new Error("x"); }, key() { throw new Error("x"); } };
  assert.equal(saveDraft(broken, "u1", "k", "s", { a: 1 }), false);
  assert.equal(loadDraft(broken, "u1", "k", "s"), null);
  assert.doesNotThrow(() => clearDraft(broken, "u1", "k", "s"));
  assert.equal(clearAllDrafts(broken), 0);
  assert.equal(saveDraft(null, "u1", "k", "s", {}), false);
});

test("clearAllDrafts removes only drafts", () => {
  const s = memoryStorage();
  saveDraft(s, "u1", "kiosk", "a", { x: 1 }); saveDraft(s, "u2", "worksheet", "new", { y: 2 });
  s.setItem("orac_token", "t"); s.setItem("orac-theme", "dark");
  assert.equal(clearAllDrafts(s), 2);
  assert.equal(s.getItem("orac_token"), "t"); assert.equal(s.getItem("orac-theme"), "dark");
});

test("batch keys are unique and satisfy the server's length rule; network failures are told apart from server answers", () => {
  const a = newBatchKey(), b = newBatchKey();
  assert.notEqual(a, b); assert.ok(a.length >= 8 && a.length <= 100);
  assert.equal(isNetworkFailure(Object.assign(new Error("x"), { network: true })), true);
  assert.equal(isNetworkFailure(Object.assign(new Error("dup"), { status: 409 })), false);
});

// ---- logout cleanup (real client.js, stubbed fetch/localStorage) ---------
test("explicit logout removes unsent drafts and the session; session expiry keeps drafts", async () => {
  const source = read("src/api/client.js").replaceAll("import.meta.env", "globalThis.__ORAC_TEST_ENV__");
  const s = memoryStorage();
  s.setItem("orac_token", "t"); s.setItem("orac_user", "{}"); s.setItem("orac-theme", "dark");
  saveDraft(s, "u1", "kiosk", "a", { x: 1 });
  globalThis.__ORAC_TEST_ENV__ = { PROD: false, VITE_API_BASE_URL: "http://api.test" };
  globalThis.localStorage = s;
  const client = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
  client.auth.logout();
  assert.equal(s.getItem("orac_token"), null);
  assert.equal([...s._map.keys()].some((k) => k.startsWith(DRAFT_PREFIX)), false);
  assert.equal(s.getItem("orac-theme"), "dark");

  // 401 (session expiry) clears the session but must leave the draft in place
  saveDraft(s, "u1", "kiosk", "b", { x: 2 }); s.setItem("orac_token", "t");
  globalThis.fetch = async () => ({ ok: false, status: 401, headers: { get: () => "application/json" }, text: async () => JSON.stringify({ success: false, message: "expired" }) });
  await assert.rejects(() => client.collections.list("quotes"), /expired/);
  assert.equal(s.getItem("orac_token"), null);
  assert.ok(loadDraft(s, "u1", "kiosk", "b"));
});

test("a dropped connection is flagged as a network failure by the real client, with no payload replay", async () => {
  const source = read("src/api/client.js").replaceAll("import.meta.env", "globalThis.__ORAC_TEST_ENV__");
  globalThis.__ORAC_TEST_ENV__ = { PROD: false, VITE_API_BASE_URL: "http://api.test" };
  globalThis.localStorage = memoryStorage();
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; throw new TypeError("fetch failed"); };
  const client = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}#net`);
  await assert.rejects(() => client.kiosk.submit("d1", { work_date: "2026-09-21", batch_key: "kb-12345678", entries: [{ technician_id: "t1", hours_logged: 4 }] }), (e) => e.network === true && isNetworkFailure(e));
  assert.equal(calls, 1, "the client must not retry or queue a submission on its own");
});

// ---- rates: blocked, isolated, never shown ------------------------------
test("the kiosk rate placeholder lives only in client.js, is labelled unapproved, and is not shown or stored by any page", () => {
  const client = read("src/api/client.js");
  assert.match(client, /UNAPPROVED_INTERIM_KIOSK_RATE/);
  assert.match(client, /BLOCKED ON THE CONTROLLED-RATES WORK/);
  for (const file of ["src/pages/KioskModePage.jsx", "src/pages/WorksheetsPage.jsx", "src/components/KioskReviewPanel.jsx", "src/components/PeriodPackPanel.jsx", "src/components/ClientAcknowledgementPanel.jsx", "src/fieldStatusModel.js", "src/offlineDraftModel.js"]) {
    const text = read(file);
    assert.doesNotMatch(text, /hourly_rate\s*[:=]|\b45\b|UNAPPROVED_INTERIM/, `${file} must not set, show or mention a rate value`);
  }
});

// ---- source contracts ----------------------------------------------------
test("client acknowledgement is authenticated and typed: no drawn signature and no identity fields sent from the browser", () => {
  const panel = read("src/components/ClientAcknowledgementPanel.jsx");
  assert.doesNotMatch(panel, /SignaturePad|toDataURL|canvas/i);
  assert.match(panel, /worksheets\.clientAcknowledge/);
  const api = read("src/api/client.js");
  const ack = /clientAcknowledge\([^)]*\)\s*\{[\s\S]*?\n  \},/.exec(api)[0];
  assert.match(ack, /signer_name, signer_role, acknowledgement: true/);
  assert.doesNotMatch(ack, /client_id|user_id|acknowledged_by|acknowledged_at|evidence_reference/);
  assert.match(read("src/pages/ClientPortalPage.jsx"), /<ClientAcknowledgementPanel \/>/);
});

test("the existing courtesy signature modal is kept but no longer implies it is the client's acknowledgement", () => {
  const page = read("src/pages/WorksheetsPage.jsx");
  assert.match(page, /title="Client Representative Sign-Off"/);
  assert.match(page, /not stored as the client's acknowledgement/);
  assert.match(page, /worksheets\.submit\(signatureTarget, \{ signature: signatureDataUrl \}\)/);
});

test("kiosk entry is Admin/Operations only in the UI, and review buttons are shown only when the server says can_review", () => {
  const kioskPage = read("src/pages/KioskModePage.jsx");
  assert.match(kioskPage, /KIOSK_ENTRY_ROLES = \["Admin", "Operations"\]/);
  const panel = read("src/components/KioskReviewPanel.jsx");
  assert.match(panel, /row\.can_review && \(/);
  assert.doesNotMatch(panel, /user\.role === "Admin"[^\n]*(approve|review)\(/i);
});

test("the kiosk page reuses one submission reference for a retry and starts a new one after a server answer", () => {
  const page = read("src/pages/KioskModePage.jsx");
  assert.match(page, /batch_key: batchKeyRef\.current/);
  assert.match(page, /if \(isNetworkFailure\(err\)\)/);
  assert.match(page, /batchKeyRef\.current = null;\s*\n\s*setFormError\(err\.message\)/);
  assert.doesNotMatch(page, /setInterval|setTimeout\([^)]*handleSubmit|navigator\.serviceWorker|sync\.register/);
});

// ---- component rendering (real JSX through esbuild + react-dom/server) ---
const require_ = createRequire(import.meta.url);
async function renderEntry(name, source) {
  const { buildSync } = require_("esbuild");
  // Keep the temporary module below the repo so Node can resolve its installed dependencies.
  const dir = fs.mkdtempSync(path.join(fileURLToPath(new URL("..", import.meta.url)), ".orac-ssr-"));
  const entry = path.join(dir, `${name}.jsx`);
  fs.writeFileSync(entry, source);
  const out = path.join(dir, `${name}.mjs`);
  try {
    buildSync({ entryPoints: [entry], outfile: out, bundle: true, format: "esm", platform: "node", jsx: "automatic", external: ["react", "react-dom", "react/jsx-runtime", "react-router-dom"], absWorkingDir: fileURLToPath(new URL("..", import.meta.url)), logLevel: "silent", define: { "import.meta.env": JSON.stringify({ PROD: false, VITE_API_BASE_URL: "http://api.test" }) } });
    return await import(pathToFileURL(out).href);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("review rows render status, the not-counted notice, the blocked reason and no rate", async () => {
  const mod = await renderEntry("rows", `
    import React from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import { KioskReviewRow } from ${JSON.stringify(path.resolve("src/components/KioskReviewPanel.jsx"))};
    export default function render(row, role) { return renderToStaticMarkup(<ul><KioskReviewRow row={row} role={role} /></ul>); }
  `);
  const row = { id: "k1", technician_name: "Tapiwa Moyo", dispatch_number: "DC-1", work_date: "2026-09-21", hours_logged: 8.5, hours_breakdown: { normal: 6, ot_1_5: 1, ot_2_0: 0.5 }, review_status: "pending_review", review_blocked_reason: "No active Supervisor is assigned to this dispatch", can_review: false, recorded_by_name: "Ops" };
  const html = mod.default(row, "Operations");
  for (const needle of ["Pending Supervisor review", "do not count as approved hours", "No active Supervisor is assigned", "Assign one", "reported normal 6"]) assert.ok(html.includes(needle), needle);
  assert.ok(!/hourly_rate|\bR ?45\b/.test(html));
  assert.ok(!/Approve hours/.test(html), "no approve control is rendered by the row itself");
  const rejected = mod.default({ ...row, review_status: "rejected", review_blocked_reason: null, review_comment: "Wrong day" }, "Supervisor");
  assert.ok(rejected.includes("Rejected by Supervisor") && rejected.includes("Rejected: Wrong day"));
});

test("worksheet evidence shows the return reason, the client acknowledgement and the internal approval as separate facts", async () => {
  const mod = await renderEntry("evidence", `
    import React from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import WorksheetEvidence from ${JSON.stringify(path.resolve("src/components/WorksheetEvidence.jsx"))};
    export default function render(ws, role) { return renderToStaticMarkup(<WorksheetEvidence worksheet={ws} role={role} />); }
  `);
  const returned = mod.default({ status: "Returned_For_Correction", supervisor_comment: "Hours do not match the shift log" }, "Technician");
  assert.ok(returned.includes("Hours do not match the shift log") && returned.includes("Returned for correction"));
  const ack = mod.default({ status: "Client_Acknowledged", client_acknowledgement: { signer_name: "Farai Ncube", signer_role: "Site Manager", acknowledged_at: "2026-09-05T16:00:00.000Z", evidence_reference: "evd-9" } }, "Supervisor");
  assert.ok(ack.includes("Client acknowledgement") && ack.includes("Farai Ncube, Site Manager") && ack.includes("evd-9"));
  assert.ok(!ack.includes("Supervisor approval (internal)"));
  const approved = mod.default({ status: "Supervisor_Approved", approved_at: "2026-09-07T08:00:00.000Z", client_acknowledgement: { signer_name: "A", signer_role: "B" } }, "Client Viewer");
  assert.ok(approved.includes("Supervisor approval (internal)") && approved.includes("Approved by ORAC"));
});

test("assigned-job materials render plain stock words, not raw quantities as the status", async () => {
  const mod = await renderEntry("materials", `
    import React from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import { MaterialRows } from ${JSON.stringify(path.resolve("src/components/AssignedMaterialsPanel.jsx"))};
    export default function render(items) { return renderToStaticMarkup(<MaterialRows items={items} />); }
  `);
  const html = mod.default([
    { catalog_item_id: "c1", item_name: "Ceramic tile", item_code: "CT-1", unit_of_measure: "m2", quantity_on_hand: 40, is_low_stock: false, used_on_this_dispatch: 3 },
    { catalog_item_id: "c2", item_name: "Epoxy", item_code: "EP-2", unit_of_measure: "kg", quantity_on_hand: 1, is_low_stock: true, used_on_this_dispatch: 2 },
    { catalog_item_id: "c3", item_name: "Bolts", item_code: "BL-3", unit_of_measure: "ea", quantity_on_hand: 0, is_low_stock: true, used_on_this_dispatch: 5 }
  ]);
  for (const word of ["In stock", "Low stock", "Out of stock", "Used on this job: 3 m2"]) assert.ok(html.includes(word), word);
  assert.ok(mod.default([]).includes("No materials have been recorded"));
});
