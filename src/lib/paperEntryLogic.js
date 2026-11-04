// Pure helpers for the Sales Desk "Paper Entry" of a signed paper Timesheet.
// No React, no fetch. The server re-validates everything; this only shapes input,
// gives early feedback, and decides which origin badge a row shows.
// There is deliberately no rate, amount or cost field anywhere in this module.
import { EMPTY_TIMESHEET_FORM, validateTimesheetForm, buildTimesheetPayload } from "./timesheetFormLogic.js";

export const ENTRY_SOURCE = Object.freeze({ SITE_DIGITAL: "site_digital", PAPER: "paper" });

// Wire field names used for paper evidence. Kept in ONE place so the backend contract
// (Phase 1/2) can be matched by editing only this block.
export const PAPER_FIELDS = Object.freeze({
  source: "entry_source",
  reference: "paper_reference",
  signatory: "client_signatory_name",
  technician: "technician_id",
  scan: "signed_copy_image" // existing field already accepted by the Timesheet create endpoint
});

// Largest data-URL we will send (about 1 MB of image after base64).
export const MAX_SCAN_DATA_URL_CHARS = 1_300_000;

// Where a Timesheet came from. Anything not recorded as paper is a direct on-site entry.
export function entrySourceOf(ws) {
  if (!ws) return ENTRY_SOURCE.SITE_DIGITAL;
  const src = String(ws[PAPER_FIELDS.source] || ws.entry_mode || "").toLowerCase();
  if (src === ENTRY_SOURCE.PAPER || src === "paper_verified") return ENTRY_SOURCE.PAPER;
  if (ws[PAPER_FIELDS.reference] || ws.paper_ref || ws.status === "Captured_From_Signed_Paper") return ENTRY_SOURCE.PAPER;
  return ENTRY_SOURCE.SITE_DIGITAL;
}

export const ENTRY_SOURCE_BADGE = Object.freeze({
  [ENTRY_SOURCE.SITE_DIGITAL]: { icon: "🟢", label: "Site Digital Entry", tone: "green", hint: "Entered directly by the Supervisor on site." },
  [ENTRY_SOURCE.PAPER]: { icon: "🔵", label: "Paper Verified Entry", tone: "blue", hint: "Entered from a signed paper booklet." }
});

export function paperReferenceOf(ws) {
  return String(ws?.[PAPER_FIELDS.reference] || ws?.paper_ref || "").trim();
}

export const EMPTY_PAPER_FORM = () => ({
  ...EMPTY_TIMESHEET_FORM(),
  technician_id: "",
  paper_reference: "",
  client_signatory: ""
});

// Technician choices from a users list and/or already-recorded Timesheets. De-duplicated by id.
export function technicianOptions(users = [], worksheets = []) {
  const map = new Map();
  for (const u of users || []) {
    if (!u || u.role !== "Technician" || u.active === false || u.is_active === false || u.status === "Inactive") continue;
    map.set(u.id, { id: u.id, name: u.name || u.full_name || u.email || u.id, trade: u.trade || u.technician_trade || "", national_id: u.national_id || "" });
  }
  for (const w of worksheets || []) {
    if (!w?.technician_id || map.has(w.technician_id)) continue;
    map.set(w.technician_id, { id: w.technician_id, name: w.technician_name || w.worker_name || w.technician_id, trade: w.technician_trade || "", national_id: w.technician_national_id || "" });
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// The technician is the worker; the paper carries their signature, so the on-screen
// declaration is never used for a paper entry.
function effective(form, tech) {
  return { ...form, worker_type: "technician", employee_name: tech?.name || "", employee_attest: false };
}

export function validatePaperEntry(form, tech, { submit = false, role = "Sales" } = {}) {
  const errors = [];
  if (!form.technician_id || !tech) errors.push("Choose the technician who worked these hours.");
  if (!String(form.paper_reference || "").trim()) errors.push("Enter the Physical Booklet / Sheet Ref # (for example Booklet #42 - Sheet 15).");
  if (submit) {
    if (!String(form.client_signatory || "").trim()) errors.push("Enter the client representative who signed the paper.");
    if (!form.signed_copy_image) errors.push("Attach the scanned copy or a photo of the signed sheet.");
  }
  const base = validateTimesheetForm(effective(form, tech), { submit, role })
    .filter((e) => !e.startsWith("Worker sign-off")); // paper wording is handled above
  return [...errors, ...base];
}

export function buildPaperPayload(form, tech, { submit = false, role = "Sales" } = {}) {
  const body = buildTimesheetPayload(effective(form, tech), { submit, role });
  body[PAPER_FIELDS.source] = ENTRY_SOURCE.PAPER;
  body[PAPER_FIELDS.technician] = tech.id;
  body[PAPER_FIELDS.reference] = String(form.paper_reference).trim();
  if (String(form.client_signatory || "").trim()) body[PAPER_FIELDS.signatory] = String(form.client_signatory).trim();
  if (!body.worker_category && tech.trade) body.worker_category = tech.trade;
  return body;
}
