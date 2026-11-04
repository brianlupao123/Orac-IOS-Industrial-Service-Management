// Pure helpers for the Timesheet form (the ONE daily source record).
// No React, no fetch. The server re-validates and re-classifies everything:
// nothing here is trusted, it only shapes input and gives early feedback.
// There is deliberately no rate, amount or cost field anywhere in this module.

import { canPickTechnician, EMPTY_TECHNICIAN_IDENTITY } from "./technicianPickerLogic.js";

export const WEEKDAY_OT15_REVIEW_THRESHOLD_HOURS = 3;

export const EMPTY_TIMESHEET_FORM = () => ({
  dispatch_card_id: "",
  work_date: new Date().toISOString().slice(0, 10),
  worker_type: "technician",
  worker_name: "",
  worker_category: "",
  ...EMPTY_TECHNICIAN_IDENTITY(),
  activity: "",
  outcomes: "",
  start_time: "",
  end_time: "",
  normal: "",
  ot_15: "",
  ot_20: "",
  materials: [],
  employee_name: "",
  employee_attest: false,
  signed_copy_image: "",
  client_request_id: ""
});

export function newRequestId() {
  try { if (globalThis.crypto?.randomUUID) return `ts-${globalThis.crypto.randomUUID()}`; } catch { /* fall through */ }
  return `ts-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

const num = (v) => (v === "" || v === null || v === undefined ? 0 : Number(v));
const isBlank = (v) => v === "" || v === null || v === undefined;

export function totalHours(form) {
  const t = [form.normal, form.ot_15, form.ot_20].map(num);
  return t.every(Number.isFinite) ? Math.round((t[0] + t[1] + t[2]) * 100) / 100 : NaN;
}

export function dayTypeOf(isoDate) {
  const d = new Date(`${isoDate}T00:00:00Z`).getUTCDay();
  return d === 6 ? "saturday" : d === 0 ? "sunday" : "weekday";
}

// Early, non-blocking hints. The server decides; these never stop a save.
export function reviewHints(form) {
  const hints = [];
  if (/^\d{4}-\d{2}-\d{2}$/.test(form.work_date || "") && dayTypeOf(form.work_date) === "weekday" && num(form.ot_15) > WEEKDAY_OT15_REVIEW_THRESHOLD_HOURS) {
    hints.push(`More than ${WEEKDAY_OT15_REVIEW_THRESHOLD_HOURS} hours at 1.5 on a weekday will be flagged for the reviewer. You can still submit.`);
  }
  return hints;
}

export function validateTimesheetForm(form, { submit = false, role = "Technician", requireTechnician = false } = {}) {
  const errors = [];
  if (!form.dispatch_card_id) errors.push("Choose the job (dispatch card).");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.work_date || "")) errors.push("Work date is required.");
  if (!String(form.activity || "").trim()) errors.push("Describe the work done.");
  const buckets = [form.normal, form.ot_15, form.ot_20];
  if (buckets.some((v) => !isBlank(v) && (!Number.isFinite(Number(v)) || Number(v) < 0 || Number(v) > 24))) errors.push("Normal, 1.5 and 2.0 must each be a number of hours from 0 to 24.");
  const total = totalHours(form);
  if (!(total > 0)) errors.push("Enter the hours worked in Normal, 1.5 and/or 2.0.");
  else if (total > 24) errors.push("A Timesheet cannot record more than 24 hours.");
  if ((form.start_time && !form.end_time) || (!form.start_time && form.end_time)) errors.push("Enter both start and end time, or neither.");
  if (form.start_time && form.end_time && form.end_time <= form.start_time) errors.push("End time must be after start time.");
  if (requireTechnician && form.worker_type !== "contractor" && !form.technician_id) errors.push("Choose the technician.");
  if (form.worker_type === "contractor" && ["Admin", "Operations", "Supervisor"].includes(role) && !String(form.worker_name || "").trim()) errors.push("Enter the contractor's name.");
  for (const [i, m] of (form.materials || []).entries()) {
    if (!String(m.description || "").trim()) errors.push(`Material ${i + 1}: description is required.`);
    if (!(Number(m.quantity) > 0)) errors.push(`Material ${i + 1}: quantity must be greater than zero.`);
  }
  if (submit) {
    if (!String(form.employee_name || "").trim()) errors.push("Worker sign-off: enter the worker's name.");
    if (!form.employee_attest && !form.signed_copy_image) errors.push("Worker sign-off: confirm the declaration, or attach the signed paper copy.");
  }
  return errors;
}

// The ONLY place a create body is assembled. No rate / amount / cost key exists.
export function buildTimesheetPayload(form, { submit = false, capturedOfflineAt = null, role = "Technician" } = {}) {
  const body = {
    work_date: form.work_date,
    activity: String(form.activity).trim(),
    hours_breakdown: { normal: num(form.normal), ot_15: num(form.ot_15), ot_20: num(form.ot_20) },
    client_request_id: form.client_request_id || newRequestId(),
    submit: Boolean(submit)
  };
  if (String(form.outcomes || "").trim()) body.outcomes = String(form.outcomes).trim();
  if (form.start_time && form.end_time) { body.start_time = form.start_time; body.end_time = form.end_time; }
  if (String(form.worker_category || "").trim()) body.worker_category = String(form.worker_category).trim();
  if (form.worker_type === "contractor" && ["Admin", "Operations", "Supervisor"].includes(role)) {
    body.worker_type = "contractor"; body.worker_name = String(form.worker_name).trim();
  } else if (form.technician_id && canPickTechnician(role)) {
    // Identity of the picked Technician. A snapshot of what was on file when captured; the server
    // re-checks the technician_id and is the source of truth.
    body.technician_id = form.technician_id;
    body.worker_name = String(form.worker_name || "").trim();
    if (String(form.technician_trade || "").trim()) { body.technician_trade = String(form.technician_trade).trim(); if (!body.worker_category) body.worker_category = body.technician_trade; }
    if (String(form.national_id || "").trim()) body.national_id = String(form.national_id).trim();
  }
  const materials = (form.materials || []).filter((m) => String(m.description || "").trim()).map((m) => ({
    description: String(m.description).trim(), quantity: Number(m.quantity), ...(String(m.unit || "").trim() ? { unit: String(m.unit).trim() } : {})
  }));
  if (materials.length) body.materials_used = materials;
  if (String(form.employee_name || "").trim() || form.employee_attest || form.signed_copy_image) {
    body.signatures = { employee: {
      name: String(form.employee_name || "").trim(), date: form.work_date,
      method: form.signed_copy_image && !form.employee_attest ? "paper_scan" : "on_device",
      ...(form.employee_attest ? { attest: true } : {})
    } };
  }
  if (form.signed_copy_image) body.signed_copy_image = form.signed_copy_image;
  if (capturedOfflineAt) body.captured_offline_at = capturedOfflineAt;
  return body;
}

export function formFromTimesheet(ws) {
  const b = ws.hours_breakdown || {};
  return {
    ...EMPTY_TIMESHEET_FORM(),
    dispatch_card_id: ws.dispatch_card_id || "", work_date: ws.work_date || EMPTY_TIMESHEET_FORM().work_date,
    worker_type: ws.worker_type || "technician", worker_name: ws.worker_name || ws.technician_name || "", worker_category: ws.worker_category || "",
    technician_id: ws.technician_id || "", technician_trade: ws.technician_trade || "", national_id: ws.national_id || "",
    activity: ws.activity || "", outcomes: ws.outcomes || "", start_time: ws.start_time || "", end_time: ws.end_time || "",
    normal: b.normal ? String(b.normal) : "", ot_15: b.ot_15 ? String(b.ot_15) : "", ot_20: b.ot_20 ? String(b.ot_20) : "",
    materials: (ws.materials_used || []).map((m) => ({ description: m.description || "", quantity: String(m.quantity ?? ""), unit: m.unit || "" })),
    employee_name: ws.signatures?.employee?.name || ""
  };
}

export const isTimesheetV2 = (ws) => ws?.timesheet_version === 2 && Boolean(ws?.hours_breakdown);

export function hoursSummary(ws) {
  if (!isTimesheetV2(ws)) return `${ws?.hours ?? "?"} h (no Normal/1.5/2.0 breakdown)`;
  const b = ws.hours_breakdown;
  const parts = [`${b.normal} N`]; if (b.ot_15) parts.push(`${b.ot_15} @1.5`); if (b.ot_20) parts.push(`${b.ot_20} @2.0`);
  return `${ws.hours} h (${parts.join(" + ")})`;
}

// Where a Timesheet is in its sign-off chain, in words a worker understands.
export function signoffProgress(ws) {
  const worker = Boolean(ws?.signatures?.employee?.name) && Boolean(ws?.signed_copy_image || ws?.signatures?.employee?.attested_at);
  return [
    { party: "Worker", done: worker },
    { party: "Customer representative", done: Boolean(ws?.client_acknowledgement?.acknowledged_at) },
    { party: "Foreman / Supervisor", done: Boolean(ws?.approved_by && ws?.approved_at) }
  ];
}
