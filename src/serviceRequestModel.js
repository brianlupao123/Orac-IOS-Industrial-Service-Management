// Client Service Requests - pure UI helpers (no React, no network).
// These only shape what the UI shows and sends. Access control, tenancy and the
// lifecycle are enforced by the server; nothing here is a security control.

export const SERVICE_REQUEST_URGENCY_OPTIONS = Object.freeze([
  { value: "standard", label: "Standard" },
  { value: "planned_shutdown", label: "Planned shutdown" },
  { value: "urgent_downtime", label: "Urgent downtime" }
]);

export const SERVICE_REQUEST_STATUSES = Object.freeze(["Submitted", "Acknowledged", "Accepted", "Declined", "Converted_To_Lead"]);

export const SERVICE_REQUEST_LIMITS = Object.freeze({ title: 160, serviceNeed: 2000, note: 1000 });

const INTERNAL_STATUS_LABELS = Object.freeze({
  Submitted: "Submitted",
  Acknowledged: "Acknowledged",
  Accepted: "Accepted",
  Declined: "Declined",
  Converted_To_Lead: "Converted to lead"
});

// The client sees a plain-language status; internal lead handling is not exposed.
const CLIENT_STATUS_LABELS = Object.freeze({
  Submitted: "Submitted",
  Acknowledged: "Acknowledged",
  Accepted: "Accepted",
  Declined: "Declined",
  Converted_To_Lead: "Being prepared by Sales"
});

const STATUS_TONES = Object.freeze({
  Submitted: "bg-sky-100 text-sky-800",
  Acknowledged: "bg-amber-100 text-amber-800",
  Accepted: "bg-emerald-100 text-emerald-800",
  Declined: "bg-red-100 text-red-800",
  Converted_To_Lead: "bg-slate-200 text-slate-800"
});

export const urgencyLabel = (value) => SERVICE_REQUEST_URGENCY_OPTIONS.find((option) => option.value === value)?.label || String(value || "—");
export const statusLabel = (status) => INTERNAL_STATUS_LABELS[status] || String(status || "—");
export const clientStatusLabel = (status) => CLIENT_STATUS_LABELS[status] || String(status || "—");
export const statusTone = (status) => STATUS_TONES[status] || "bg-gray-100 text-gray-700";

export function isRealCalendarDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export const EMPTY_SERVICE_REQUEST_FORM = Object.freeze({ title: "", service_need: "", urgency: "standard", requested_date: "" });

// Returns a message for the first problem, or "" when the form can be sent.
export function validateServiceRequestForm(form) {
  const title = String(form?.title ?? "").trim();
  const need = String(form?.service_need ?? "").trim();
  if (!title) return "Enter a short title for the request.";
  if (title.length > SERVICE_REQUEST_LIMITS.title) return `The title cannot be longer than ${SERVICE_REQUEST_LIMITS.title} characters.`;
  if (!need) return "Describe the service you need.";
  if (need.length > SERVICE_REQUEST_LIMITS.serviceNeed) return `The description cannot be longer than ${SERVICE_REQUEST_LIMITS.serviceNeed} characters.`;
  if (form?.urgency && !SERVICE_REQUEST_URGENCY_OPTIONS.some((option) => option.value === form.urgency)) return "Choose one of the listed urgency levels.";
  if (form?.requested_date && !isRealCalendarDate(form.requested_date)) return "Enter the requested date as a valid date.";
  return "";
}

// Builds the request body from a fixed whitelist. Anything else on `form`
// (client, creator, status, triager, lead fields...) is never copied.
export function buildServiceRequestPayload(form = {}) {
  const payload = {
    title: String(form.title ?? "").trim(),
    service_need: String(form.service_need ?? "").trim(),
    urgency: SERVICE_REQUEST_URGENCY_OPTIONS.some((option) => option.value === form.urgency) ? form.urgency : "standard"
  };
  for (const key of ["mine_site_id", "equipment_tag_id", "requested_date"]) {
    const value = typeof form[key] === "string" ? form[key].trim() : "";
    if (value) payload[key] = value;
  }
  return payload;
}

// Buttons offered for a request in each status. This mirrors the server's
// transition table for convenience only; the server rejects anything else.
export function triageActionsFor(status) {
  if (status === "Submitted") return [{ decision: "acknowledge", label: "Acknowledge" }, { decision: "decline", label: "Decline" }];
  if (status === "Acknowledged") return [{ decision: "accept", label: "Accept" }, { decision: "decline", label: "Decline" }];
  return [];
}

export const canConvertToLead = (status) => status === "Accepted";
