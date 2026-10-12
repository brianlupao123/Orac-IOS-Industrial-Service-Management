// Pure logic for the V5 signature-evidence UI. Dependency-free (node:test only).
// Rules this file enforces (the server stays the final gate for every one of them):
//  - Hidden unless VITE_ORAC_V5_COMMERCIAL_WORKFLOW=enabled.
//  - The client-site Supervisor is a NAMED EVIDENCE CONTACT: no login, role, OTP/PIN or portal action.
//  - Hours only: Normal, 1.5 and 2.0 are shown explicitly. No rate, amount, cost or invoice figure.
//  - Evidence is hash-bound; stale evidence is shown with its status, never hidden or deleted.
//  - Only the backend-assigned ORAC Supervisor confirms. Sales/Admin never see a confirm action.
import { v5CommercialEnabled } from "./v5CommercialFlags.js";

export const V5_RECORD_ROLES = Object.freeze(["Sales", "Admin"]);          // manage contacts + record paper evidence
export const V5_CONFIRM_ROLES = Object.freeze(["Supervisor"]);             // in-system confirmation
export const V5_VIEW_ROLES = Object.freeze(["Admin", "Management", "Sales", "Supervisor", "Finance"]);
export const V5_READINESS_ROLES = Object.freeze(["Admin", "Management", "Sales", "Finance"]);

const SHA256 = /^[a-fA-F0-9]{64}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const v5SignatureVisible = (role) => v5CommercialEnabled() && V5_VIEW_ROLES.includes(role);
export const canRecordV5Evidence = (role) => v5CommercialEnabled() && V5_RECORD_ROLES.includes(role);
export const canConfirmV5 = (role) => v5CommercialEnabled() && V5_CONFIRM_ROLES.includes(role);
export const v5ReadinessVisible = (role) => v5CommercialEnabled() && V5_READINESS_ROLES.includes(role);
// Only Timesheets in the Normal / 1.5 / 2.0 shape can carry V5 evidence.
export const v5SheetEligibleForPanel = (ws) => ws?.timesheet_version === 2 && Boolean(ws?.hours_breakdown) && !ws?.superseded_by;

export const EVIDENCE_STATUS_LABEL = Object.freeze({
  current: "Current",
  stale_hours_changed: "Out of date: hours changed after this evidence",
  superseded: "Replaced by newer evidence",
  incomplete: "Incomplete record",
  integrity_failed: "Integrity check failed"
});
export const evidenceStatusLabel = (s) => EVIDENCE_STATUS_LABEL[s] || "Unknown status";
export const evidenceStatusTone = (s) => (s === "current" ? "good" : s === "integrity_failed" || s === "incomplete" ? "bad" : "warn");

export const REASON_LABEL = Object.freeze({
  NOT_V5_QUOTATION: "Not on a V5 quotation revision",
  NOT_V5_TIMESHEET: "Not in the Normal / 1.5 / 2.0 Timesheet shape",
  NO_QUOTE_LINE: "No quotation line linked",
  SUPERSEDED: "Replaced by a corrected Timesheet",
  DUPLICATE_CONFLICT: "Unresolved duplicate conflict",
  NOT_SUBMITTED: "Not yet submitted",
  HOURS_MISMATCH: "Hours do not match the Normal / 1.5 / 2.0 breakdown",
  NO_PAPER_EVIDENCE: "No signed-paper evidence recorded",
  PAPER_EVIDENCE_NOT_CURRENT: "Paper evidence is out of date for the current hours",
  NO_CURRENT_SUPERVISOR_CONFIRMATION: "Waiting for the assigned ORAC Supervisor to confirm"
});
export const reasonLabel = (code) => REASON_LABEL[code] || String(code || "").replace(/_/g, " ").toLowerCase();

// Error handling: the server's code decides, never the message text.
export function v5ErrorAdvice(err) {
  const code = err?.code;
  if (code === "STALE_HASH") return { reload: true, message: "The hours or evidence changed since you opened this Timesheet. The current evidence has been reloaded. Review it and confirm again." };
  if (code === "FEATURE_DISABLED" || err?.status === 409 && /not enabled/i.test(err?.message || "")) return { reload: false, message: "This workflow is not enabled on the server yet." };
  if (code === "SEPARATION_OF_DUTIES" || code === "SALES_OWNER_SEPARATION") return { reload: false, message: err.message };
  if (err?.status === 403) return { reload: false, message: err.message || "You are not allowed to do this." };
  return { reload: false, message: err?.message || "Something went wrong. Please try again." };
}

// ---- hours, always explicit ----------------------------------------------------
const h = (n) => Number((Number(n || 0) / 100).toFixed(2));
export function hoursFromBasis(basis) {
  const t = basis?.hours_hundredths;
  if (!t) return null;
  return { normal: h(t.normal), ot_15: h(t.ot_15), ot_20: h(t.ot_20), total: h(t.total) };
}
export const hoursLine = (hrs) => (hrs ? `Normal ${hrs.normal} h · 1.5 ${hrs.ot_15} h · 2.0 ${hrs.ot_20} h · Total ${hrs.total} h` : "Hours unavailable");
export const shortHash = (hash) => (SHA256.test(String(hash || "")) ? `${hash.slice(0, 8)}…${hash.slice(-6)}` : "none");

// ---- rate-free projections (whitelist, so an unexpected field can never be shown) ----
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o && o[k] !== undefined).map((k) => [k, o[k]]));
export function projectSignatureState(raw) {
  if (!raw || typeof raw !== "object") return null;
  const ev = raw.evidence;
  return {
    timesheet_id: raw.timesheet_id,
    dispatch_card_id: raw.dispatch_card_id,
    current_hash: raw.current_hash,
    hours: hoursFromBasis(raw.hash_basis),
    verified: raw.verified === true,
    reasons: Array.isArray(raw.reasons) ? raw.reasons : [],
    evidence: ev ? {
      ...pick(ev, ["id", "hours_hash", "evidence_reference", "source_channel", "custodian_user_id", "received_date", "scan_hash", "replacement_reason", "replaces_evidence_id", "recorded_by", "recorded_at"]),
      worker_name_on_paper: ev.paper?.worker_name_on_paper,
      client_supervisor_name_on_paper: ev.paper?.client_supervisor_name_on_paper,
      contact: ev.client_supervisor_contact ? pick(ev.client_supervisor_contact, ["contact_id", "name", "title", "phone", "email", "source_reference"]) : null
    } : null,
    evidence_history: (raw.evidence_history || []).map((x) => pick(x, ["id", "status", "hours_hash", "recorded_at"])),
    confirmation: raw.confirmation ? pick(raw.confirmation, ["id", "evidence_id", "hours_hash", "supervisor_id", "confirmed_at"]) : null,
    confirmation_history: (raw.confirmation_history || []).map((x) => pick(x, ["id", "evidence_id", "hours_hash", "current", "confirmed_at"]))
  };
}
export const projectContact = (c) => pick(c, ["id", "name", "title", "phone", "email", "source_reference", "status", "dispatch_card_id", "created_at", "withdrawn_at"]);
export function projectReadiness(raw) {
  if (!raw || typeof raw !== "object") return null;
  return {
    dispatch_card_id: raw.dispatch_card_id,
    quotation_number: raw.quotation_number,
    lines: (raw.lines || []).map((l) => ({ quote_line_id: l.quote_line_id, description: l.description, pricing_basis: l.pricing_basis, canonical_hours: Number(l.canonical_hours || 0), source_count: (l.source_timesheet_ids || []).length })),
    unmapped_hours: Number(raw.unmapped?.hours || 0),
    unverified_hours: Number(raw.verification?.unverified_hours || 0),
    unverified: (raw.verification?.unverified_timesheets || []).map((t) => ({ id: t.id, hours: Number(t.hours || 0), reasons: t.reasons || [] })),
    total_hours: Number(raw.canonical_hours_total || 0),
    ready: raw.ready_for_pricing_review === true,
    blockers: Array.isArray(raw.blockers) ? raw.blockers : []
  };
}

// ---- forms: mirror the server schemas so mistakes are caught before a round trip ----
export const emptyContactForm = () => ({ name: "", title: "", phone: "", email: "", source_reference: "", dispatch_scoped: true });
export function validateContactForm(f) {
  const errors = {};
  if (String(f.name || "").trim().length < 2) errors.name = "Enter the client Supervisor's name.";
  if (String(f.source_reference || "").trim().length < 3) errors.source_reference = "State how the client named this person (PO, email, minutes).";
  if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) errors.email = "Enter a valid email address.";
  return errors;
}
export function contactPayload(f) {
  const out = { name: f.name.trim(), source_reference: f.source_reference.trim(), dispatch_scoped: Boolean(f.dispatch_scoped) };
  for (const k of ["title", "phone", "email"]) if (String(f[k] || "").trim()) out[k] = f[k].trim();
  return out;
}

export const emptyPaperForm = (userId = "") => ({
  client_supervisor_contact_id: "", worker_name_on_paper: "", client_supervisor_name_on_paper: "",
  worker_signed_on_paper: false, client_supervisor_signed_on_paper: false, paper_attestation: false,
  evidence_reference: "", source_channel: "", custodian_user_id: userId, received_date: "", scan_hash: "", replacement_reason: ""
});
export function validatePaperForm(f, { workDate, today, needsReplacementReason } = {}) {
  const e = {};
  if (!f.client_supervisor_contact_id) e.client_supervisor_contact_id = "Select the named client Supervisor contact.";
  if (String(f.worker_name_on_paper || "").trim().length < 2) e.worker_name_on_paper = "Enter the worker's name as written on the paper.";
  if (String(f.client_supervisor_name_on_paper || "").trim().length < 2) e.client_supervisor_name_on_paper = "Enter the client Supervisor's name as written on the paper.";
  if (!f.worker_signed_on_paper) e.worker_signed_on_paper = "The worker's paper signature must be present.";
  if (!f.client_supervisor_signed_on_paper) e.client_supervisor_signed_on_paper = "The client Supervisor's paper signature must be present.";
  if (!f.paper_attestation) e.paper_attestation = "Explicit paper attestation is required.";
  if (String(f.evidence_reference || "").trim().length < 3) e.evidence_reference = "Enter the paper evidence reference.";
  if (String(f.source_channel || "").trim().length < 2) e.source_channel = "Enter the source channel.";
  if (!String(f.custodian_user_id || "").trim()) e.custodian_user_id = "Enter the custodian's user id.";
  if (!ISO_DATE.test(f.received_date || "")) e.received_date = "Received date must be YYYY-MM-DD.";
  else if (today && f.received_date > today) e.received_date = "Received date cannot be in the future.";
  else if (workDate && f.received_date < workDate) e.received_date = "Received date cannot be before the work date.";
  if (!SHA256.test(f.scan_hash || "")) e.scan_hash = "Scan hash must be a 64-character SHA-256 hex digest.";
  if (needsReplacementReason && String(f.replacement_reason || "").trim().length < 5) e.replacement_reason = "State why this replaces the existing evidence (at least 5 characters).";
  return e;
}
export function paperPayload(f, { needsReplacementReason } = {}) {
  const out = {
    client_supervisor_contact_id: f.client_supervisor_contact_id,
    worker_name_on_paper: f.worker_name_on_paper.trim(),
    client_supervisor_name_on_paper: f.client_supervisor_name_on_paper.trim(),
    worker_signed_on_paper: true, client_supervisor_signed_on_paper: true, paper_attestation: true,
    evidence_reference: f.evidence_reference.trim(), source_channel: f.source_channel.trim(),
    custodian_user_id: f.custodian_user_id.trim(), received_date: f.received_date, scan_hash: f.scan_hash.trim().toLowerCase()
  };
  if (needsReplacementReason || String(f.replacement_reason || "").trim()) out.replacement_reason = f.replacement_reason.trim();
  return out;
}
// Evidence for the current hours already exists: a replacement needs a stated reason.
export const needsReplacement = (state) => Boolean(state?.evidence && state.evidence.hours_hash === state.current_hash);
export const confirmPayload = (state) => ({ evidence_id: state.evidence.id, hours_hash: state.current_hash, attest: true });
export const canShowConfirm = (role, state) => canConfirmV5(role) && Boolean(state?.evidence) && !state?.confirmation;

// Hash a scan file in the browser. The file is not uploaded anywhere.
export async function sha256OfFile(file) {
  const buf = await file.arrayBuffer();
  const digest = await globalThis.crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
