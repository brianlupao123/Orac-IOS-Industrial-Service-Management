// Internal Work Requests - pure UI helpers (no React, no network).
//
// Nothing in this file is a security control. The server decides who may raise
// a request, which types and recipients exist, which related records may be
// used, who may act and which lifecycle steps are allowed. This file only
// shapes what the page shows and sends, and it reads every rule it needs
// (types, recipients, priorities, limits, allowed actions) from server data.
//
// The single exception is PRESENTATION_RELATED_TYPE_NARROWING below: an owner
// decision that narrows what is SHOWN. It can only remove choices the server
// already offered and can never add one.

export const INTERNAL_REQUEST_STATUSES = Object.freeze(["Submitted", "Acknowledged", "In Progress", "Completed", "Rejected", "Cancelled"]);

const STATUS_TONES = Object.freeze({
  Submitted: "bg-sky-100 text-sky-800",
  Acknowledged: "bg-amber-100 text-amber-800",
  "In Progress": "bg-indigo-100 text-indigo-800",
  Completed: "bg-emerald-100 text-emerald-800",
  Rejected: "bg-red-100 text-red-800",
  Cancelled: "bg-gray-200 text-gray-700"
});

const PRIORITY_TONES = Object.freeze({
  Low: "bg-gray-100 text-gray-700",
  Normal: "bg-slate-100 text-slate-700",
  High: "bg-amber-100 text-amber-800",
  Urgent: "bg-red-100 text-red-800"
});

// Button wording only. Which of these a person may use is decided by the server
// and delivered as allowed_actions; an action name not listed here is not shown.
export const APPROVE_REGISTRATION_ACTION = "approve_registration";

const ACTION_LABELS = Object.freeze({
  acknowledge: "Acknowledge",
  [APPROVE_REGISTRATION_ACTION]: "Approve & Add to Technician Registry",
  start: "Start work",
  complete: "Complete",
  reject: "Reject",
  cancel: "Cancel request"
});

const ACTION_TONES = Object.freeze({
  acknowledge: "primary",
  [APPROVE_REGISTRATION_ACTION]: "primary",
  start: "primary",
  complete: "primary",
  reject: "danger",
  cancel: "danger"
});

export const COORDINATION_ONLY_NOTICE =
  "Internal requests are coordination only. Raising, acknowledging or completing one does not move stock, amend a purchase order, approve an invoice, change a quote, dispatch or timesheet, or widen anyone's access.";

// Owner decision (OWNER_RECOMMENDED_ROLE_PAIRINGS.md): when Sales raises a stock
// fulfilment request, show only "quote" as the related-record type. This is a
// presentation rule that only ever removes choices the server offered; the
// server still resolves the record against the requester's own read rights.
export const PRESENTATION_RELATED_TYPE_NARROWING = Object.freeze({
  Sales: Object.freeze({ STOCK_FULFILMENT: Object.freeze(["quote"]) })
});

// Own-property lookups only: a value such as "constructor" must never match.
const own = (table, key) => (typeof key === "string" && Object.hasOwn(table, key) ? table[key] : undefined);

export const statusTone = (status) => own(STATUS_TONES, status) || "bg-gray-100 text-gray-700";
export const priorityTone = (priority) => own(PRIORITY_TONES, priority) || "bg-gray-100 text-gray-700";
export const actionLabel = (action) => own(ACTION_LABELS, action) || "";

export function actionButtonsFor(allowedActions) {
  if (!Array.isArray(allowedActions)) return [];
  const seen = new Set();
  const buttons = [];
  for (const action of allowedActions) {
    if (seen.has(action) || !actionLabel(action)) continue;
    seen.add(action);
    buttons.push({ action, label: actionLabel(action), tone: own(ACTION_TONES, action) });
  }
  return buttons;
}

export function isForbidden(error) {
  return Boolean(error) && error.status === 403;
}

// A 404 or 409 on an action means the request changed under the person (claimed
// by someone else, no longer visible). The page reloads so the screen tells the truth.
export function isStaleState(error) {
  return Boolean(error) && (error.status === 404 || error.status === 409);
}

export function asRequestList(value, label) {
  if (!Array.isArray(value)) throw new Error(`The service returned an unexpected response for ${label}. Please try again.`);
  return value;
}

const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const isPositiveInteger = (value) => Number.isInteger(value) && value > 0;

// Checks the shape of GET /internal-work-requests/options and returns a plain copy.
export function normaliseOptions(data) {
  const unexpected = () => new Error("The service returned unexpected options for internal requests. Please try again.");
  if (!isObject(data) || !Array.isArray(data.types) || !Array.isArray(data.priorities) || !isObject(data.limits)) throw unexpected();
  const { subject, description, note, relatedId } = data.limits;
  if (![subject, description, note, relatedId].every(isPositiveInteger)) throw unexpected();
  const types = data.types.map((entry) => {
    if (!isObject(entry) || typeof entry.request_type !== "string" || typeof entry.label !== "string" || !Array.isArray(entry.recipients)) throw unexpected();
    const related = Array.isArray(entry.related_entity_types) ? entry.related_entity_types : [];
    const normalised = {
      request_type: entry.request_type,
      label: entry.label,
      related_required: entry.related_required === true,
      recipients: entry.recipients.filter((role) => typeof role === "string"),
      related_entity_types: related
        .filter((item) => isObject(item) && typeof item.type === "string")
        .map((item) => ({ type: item.type, label: typeof item.label === "string" ? item.label : item.type }))
    };
    // Present only on the type that takes structured technician details. Its
    // presence is what switches the form to that layout; the browser never
    // looks at the type's code.
    if (entry.technician_registration !== undefined) {
      const registration = entry.technician_registration;
      if (!isObject(registration) || !Array.isArray(registration.trades) || !Array.isArray(registration.worker_types) || !isObject(registration.limits)) throw unexpected();
      const { name, nationalId, phone } = registration.limits;
      if (![name, nationalId, phone].every(isPositiveInteger)) throw unexpected();
      normalised.technician_registration = {
        trades: registration.trades.filter((value) => typeof value === "string"),
        worker_types: registration.worker_types.filter((value) => typeof value === "string"),
        limits: { name, nationalId, phone }
      };
    }
    return normalised;
  });
  return {
    types,
    priorities: data.priorities.filter((priority) => typeof priority === "string"),
    limits: { subject, description, note, relatedId }
  };
}

export const findOption = (options, requestType) => options?.types?.find((entry) => entry.request_type === requestType) || null;

// Related-record types to SHOW for one option: exactly what the server offered,
// minus the owner's presentation narrowing. Never adds a type.
export function relatedTypeChoices(option, requesterRole) {
  if (!option) return [];
  const offered = Array.isArray(option.related_entity_types) ? option.related_entity_types : [];
  const forRole = own(PRESENTATION_RELATED_TYPE_NARROWING, requesterRole);
  const narrowed = forRole ? own(forRole, option.request_type) : undefined;
  return narrowed ? offered.filter((item) => narrowed.includes(item.type)) : offered;
}

export const EMPTY_INTERNAL_REQUEST_FORM = Object.freeze({
  request_type: "",
  recipient_role: "",
  priority: "",
  subject: "",
  description: "",
  related_entity_type: "",
  related_entity_id: ""
});

// The recipient is fixed when the server offers exactly one; otherwise the
// person must choose. Nothing here knows which roles exist.
export const recipientFor = (form, option) => {
  if (!option) return "";
  if (option.recipients.length === 1) return option.recipients[0];
  return option.recipients.includes(form?.recipient_role) ? form.recipient_role : "";
};

export const EMPTY_TECHNICIAN_DETAILS = Object.freeze({
  first_name: "", last_name: "", national_id: "", trade: "", worker_type: "", phone_number: ""
});
const TECHNICIAN_DETAIL_KEYS = Object.freeze(Object.keys(EMPTY_TECHNICIAN_DETAILS));
const cleanText = (value) => String(value ?? "").trim().replace(/\s+/g, " ");
const capitalise = (value) => (typeof value === "string" && value ? value.charAt(0).toUpperCase() + value.slice(1) : "");

// Quick checks so an obvious slip is caught before sending. The server checks
// everything again (names, ID and phone formats, the trade and worker-type lists).
function validateTechnicianDetails(form, option) {
  const registration = option.technician_registration;
  if (!recipientFor(form, option)) return "Choose who this request is for.";
  const details = form?.technician || {};
  const { name, nationalId, phone } = registration.limits;
  const first = cleanText(details.first_name);
  const last = cleanText(details.last_name);
  if (!first) return "Enter the first name.";
  if (first.length > name) return `The first name cannot be longer than ${name} characters.`;
  if (!last) return "Enter the last name.";
  if (last.length > name) return `The last name cannot be longer than ${name} characters.`;
  const id = cleanText(details.national_id);
  if (!id) return "Enter the national ID.";
  if (id.length > nationalId) return `The national ID cannot be longer than ${nationalId} characters.`;
  if (!registration.trades.includes(details.trade)) return "Choose the trade from the list.";
  if (!registration.worker_types.includes(details.worker_type)) return "Choose whether this is a permanent worker or a contractor.";
  const number = cleanText(details.phone_number);
  if (!number) return "Enter a phone number.";
  if (number.length > phone) return `The phone number cannot be longer than ${phone} characters.`;
  return "";
}

// Returns a message for the first problem, or "" when the form can be sent.
export function validateInternalRequestForm(form, option, limits, requesterRole) {
  if (!option) return "Choose a request type.";
  if (option.technician_registration) return validateTechnicianDetails(form, option);
  const subject = String(form?.subject ?? "").trim();
  const description = String(form?.description ?? "").trim();
  if (!recipientFor(form, option)) return "Choose who this request is for.";
  if (!subject) return "Enter a short subject.";
  if (subject.length > limits.subject) return `The subject cannot be longer than ${limits.subject} characters.`;
  if (!description) return "Describe what you need.";
  if (description.length > limits.description) return `The description cannot be longer than ${limits.description} characters.`;

  const choices = relatedTypeChoices(option, requesterRole);
  const type = String(form?.related_entity_type ?? "");
  const id = String(form?.related_entity_id ?? "").trim();
  if (type && !choices.some((item) => item.type === type)) return "Choose one of the listed related record types.";
  if (type && !id) return "Enter the ID of the related record, or clear the record type.";
  if (id && !type) return "Choose the type of the related record.";
  if (id.length > limits.relatedId) return `The related record ID cannot be longer than ${limits.relatedId} characters.`;
  if (option.related_required && choices.length === 0) return "A related record is needed for this request type, but none is available to you.";
  if (option.related_required && !type) return "Choose the related record this request is about.";
  return "";
}

// Builds the body from a fixed whitelist. Anything else on `form` (sender, role,
// client, status, assignee, history, timestamps) is never copied. Optional keys
// are left out when empty because the server schema is strict.
export function buildInternalRequestPayload(form = {}, option) {
  const recipient = recipientFor(form, option);
  if (option.technician_registration) {
    // Details only: the server writes the subject and description, and a
    // technician request takes no related record.
    const details = form.technician && typeof form.technician === "object" ? form.technician : {};
    const body = { request_type: option.request_type, payload: {} };
    for (const key of TECHNICIAN_DETAIL_KEYS) body.payload[key] = key === "trade" || key === "worker_type" ? String(details[key] ?? "") : cleanText(details[key]);
    if (recipient) body.recipient_role = recipient;
    if (typeof form.priority === "string" && form.priority) body.priority = form.priority;
    return body;
  }
  const payload = {
    request_type: option.request_type,
    subject: String(form.subject ?? "").trim(),
    description: String(form.description ?? "").trim()
  };
  if (recipient) payload.recipient_role = recipient;
  if (typeof form.priority === "string" && form.priority) payload.priority = form.priority;
  const type = typeof form.related_entity_type === "string" ? form.related_entity_type : "";
  const id = typeof form.related_entity_id === "string" ? form.related_entity_id.trim() : "";
  if (type && id) {
    payload.related_entity_type = type;
    payload.related_entity_id = id;
  }
  return payload;
}

// Text for the related-record line. A viewer who may not read the record sees
// its kind only, exactly as the server returned it.
export function describeRelated(related) {
  if (!related || typeof related !== "object") return "";
  const kind = related.type_label || related.type || "Record";
  if (related.viewable && related.label) return `${kind}: ${related.label}`;
  return `${kind} (details not available to you)`;
}

// Rows for the technician details a request carries, as the server returned
// them. Empty when the request has none.
export function describeRegistration(details) {
  if (!isObject(details)) return [];
  const rows = [
    ["Name", [details.first_name, details.last_name].filter(Boolean).join(" ")],
    ["National ID", details.national_id],
    ["Trade", details.trade],
    ["Worker type", capitalise(details.worker_type)],
    ["Phone", details.phone_number]
  ];
  return rows.filter(([, value]) => typeof value === "string" && value).map(([label, value]) => ({ label, value }));
}

export const REGISTRATION_APPROVAL_NOTICE =
  "Approving adds this person to the technician registry as an account with no sign-in. Nothing else in ORAC changes. Reject the request, with a reason, if any detail is wrong.";

// Result line after an approval, from the server's response.
export function describeApproval(result) {
  const technician = isObject(result) && isObject(result.technician) ? result.technician : null;
  if (!technician || !technician.name) return "The request was approved and the technician was added to the registry.";
  return `${technician.name} was added to the technician registry${technician.trade ? ` as ${technician.trade}` : ""}.`;
}

export function formatWhen(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
}

export function describeHistoryEntry(entry) {
  if (!entry || typeof entry !== "object") return "";
  const who = entry.actor_name || "Someone";
  const role = entry.actor_role ? ` (${entry.actor_role})` : "";
  const move = entry.from_status && entry.to_status ? `${entry.from_status} to ${entry.to_status}` : entry.to_status || "";
  const verb = String(entry.action || "updated").replace(/_/g, " ");
  return `${who}${role}: ${verb}${move ? `, ${move}` : ""}`;
}
