import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  bannerTone, figuresLine, issueControl, canAttachEvidence, needsEvidence, validateEvidenceForm, buildEvidencePayload, evidenceErrorMessage, MIN_NOTE_LENGTH
} from "../src/lib/poVarianceModel.js";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const within = { status: "within_budget", label: "Within PO Budget — Ready for Invoicing", blocks_invoicing: false, evidence_required: false, evidence: null,
  hours: { available: true, quoted: 100, certified: 80, this_period: 32 }, amount: { available: true, restricted: true, overrun: false } };
const over = { status: "overrun", label: "Scope Overrun Detected: +12 Hours over PO", blocks_invoicing: true, evidence_required: true, evidence: null, hash: "abc123",
  issue_disabled_reason: "Sales must attach an amendment note or revised PO reference before this can be invoiced.",
  scope: { po_reference: "PO-1", purchase_order_id: "po1" }, hours: { available: true, quoted: 100, certified: 112, this_period: 32 }, amount: { available: true, restricted: true, overrun: false } };

test("tone: within budget is green, a blocked overrun is red, a cleared or warn-only overrun is amber, unknown is neutral", () => {
  assert.equal(bannerTone(within), "success");
  assert.equal(bannerTone(over), "danger");
  assert.equal(bannerTone({ ...over, blocks_invoicing: false, evidence: { id: "e" } }), "warning");
  assert.equal(bannerTone({ status: "no_baseline" }), "neutral");
  assert.equal(bannerTone(null), "neutral");
});

test("the 1-click issue control is disabled while the server blocks, and fails safe while loading or on error", () => {
  assert.deepEqual(issueControl(within), { disabled: false, reason: "" });
  const blocked = issueControl(over);
  assert.equal(blocked.disabled, true); assert.match(blocked.reason, /amendment note or revised PO reference/);
  assert.equal(issueControl(null, { loaded: false }).disabled, true, "disabled until the check has loaded");
  assert.equal(issueControl(null, { failed: true }).disabled, true, "disabled if the check could not be read");
  assert.equal(issueControl({ ...over, blocks_invoicing: false, evidence: { id: "e" } }).disabled, false, "unlocked once evidence is attached");
});

test("supporting figures: hours always, money only when the server sent it", () => {
  assert.equal(figuresLine(within), "Certified 80 h of 100 h quoted · 32 h on this Worksheet");
  assert.doesNotMatch(figuresLine({ ...over, amount: { available: true, restricted: true, overrun: true } }), /\$|vs PO \d/);
  assert.match(figuresLine({ ...over, amount: { available: true, overrun: true, actual: 550, quoted: 500 } }), /Approved work 550 vs PO 500/);
  assert.match(figuresLine({ ...over, amount: { available: true, restricted: true, overrun: true } }), /PO value exceeded/);
  assert.equal(figuresLine({ status: "no_baseline", reason: "Scope it to a quote." }), "Scope it to a quote.");
});

test("only Sales and Admin are offered the evidence form, and only for an uncleared overrun", () => {
  assert.equal(canAttachEvidence("Sales"), true); assert.equal(canAttachEvidence("Admin"), true);
  for (const r of ["Finance", "Management", "Operations", "Supervisor", "Technician", "Client Viewer"]) assert.equal(canAttachEvidence(r), false, r);
  assert.equal(needsEvidence(over), true); assert.equal(needsEvidence(within), false);
  assert.equal(needsEvidence({ ...over, evidence: { id: "e" } }), false);
  assert.equal(needsEvidence({ ...over, evidence_required: false }), false, "V5 quotes never ask for a Sales note");
});

test("evidence form mirrors the server rules", () => {
  assert.match(validateEvidenceForm({ kind: "amendment_note", note: "short" }, over), new RegExp(String(MIN_NOTE_LENGTH)));
  assert.equal(validateEvidenceForm({ kind: "amendment_note", note: "Client approved 15 extra hours." }, over), "");
  assert.match(validateEvidenceForm({ kind: "revised_po", revised_po_reference: "x" }, over), /revised PO reference/);
  assert.match(validateEvidenceForm({ kind: "revised_po", revised_po_reference: "po-1" }, over), /must differ/);
  assert.equal(validateEvidenceForm({ kind: "revised_po", revised_po_reference: "PO-1-REV-A" }, over), "");
  assert.match(validateEvidenceForm({ kind: "nope" }, over), /Choose/);
});

test("payload carries the hash the user saw; a stale hash gets a clear message", () => {
  const p = buildEvidencePayload({ kind: "revised_po", revised_po_reference: " PO-1-REV-A ", note: "" }, over);
  assert.deepEqual(p, { kind: "revised_po", note: undefined, revised_po_reference: "PO-1-REV-A", variance_hash: "abc123", purchase_order_id: "po1" });
  assert.equal(buildEvidencePayload({ kind: "amendment_note", note: "n".repeat(12), revised_po_reference: "ignored" }, over).revised_po_reference, undefined);
  assert.match(evidenceErrorMessage({ code: "STALE_VARIANCE" }), /hours changed/);
  assert.match(evidenceErrorMessage({ code: "V5_AMENDMENT_PATH_REQUIRED" }), /V5/);
  assert.equal(evidenceErrorMessage({ message: "boom" }), "boom");
});

test("wiring: client endpoints, banner on the Worksheet page, theme tokens only, server wording is rendered not re-typed", () => {
  const client = read("src/api/client.js");
  assert.match(client, /\/worksheet_registers\/\$\{encodeURIComponent\(registerId\)\}\/po-variance/);
  assert.match(client, /\/dispatch_cards\/\$\{encodeURIComponent\(dispatchId\)\}\/po-variance/);
  assert.match(client, /\/quotes\/\$\{encodeURIComponent\(quoteId\)\}\/po-scope-evidence/);
  assert.match(read("src/pages/WorksheetRegisterPage.jsx"), /<PoVarianceBanner key=\{detail\.id\} user=\{user\} registerId=\{detail\.id\} \/>/);
  const banner = read("src/components/PoVarianceBanner.jsx");
  assert.match(banner, /\{variance\.label\}/, "the server's label is displayed");
  assert.doesNotMatch(banner, /Scope Overrun Detected|Within PO Budget/, "wording lives in one place: the server");
  assert.doesNotMatch(banner, /(?:bg|text|border)-(?:red|amber|green|gray|sky)-\d+/, "theme tokens only, so dark mode works");
  assert.match(banner, /FEATURE_DISABLED/); assert.match(banner, /return null/);
  assert.doesNotMatch(banner, /localStorage|sessionStorage/);
});
