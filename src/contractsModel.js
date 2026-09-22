import { ROLES } from "./accessPolicy.js";

// Pure rules for the Contracts & Maintenance page. No React, no network, no
// browser globals, so every rule here is unit-tested under `node --test`.
//
// These mirror the backend so people get instant feedback. They are a
// convenience only: the server re-validates everything and is the authority.

export const CONTRACT_STATUSES = Object.freeze(["Draft", "Active", "Expired", "Cancelled"]);
export const CONTRACT_CREATE_STATUSES = Object.freeze(["Draft", "Active"]);
export const SCHEDULE_FREQUENCIES = Object.freeze(["Weekly", "Monthly", "Quarterly", "Biannual", "Annual"]);

const CONTRACT_TRANSITIONS = Object.freeze({
  Draft: Object.freeze(["Active", "Cancelled"]),
  Active: Object.freeze(["Expired", "Cancelled"]),
  Expired: Object.freeze([]),
  Cancelled: Object.freeze([])
});

export const CONTRACT_MANAGER_ROLES = Object.freeze([ROLES.ADMIN, ROLES.MANAGEMENT]);
export const SCHEDULE_MANAGER_ROLES = Object.freeze([ROLES.ADMIN, ROLES.MANAGEMENT, ROLES.OPERATIONS]);

export const canManageContracts = (role) => CONTRACT_MANAGER_ROLES.includes(role);
export const canManageSchedules = (role) => SCHEDULE_MANAGER_ROLES.includes(role);

export const isContractOpen = (contract) => contract?.status === "Draft" || contract?.status === "Active";

// The status a contract may be set to next, including staying as it is.
export const statusOptionsFor = (status) => [status, ...(CONTRACT_TRANSITIONS[status] || [])];

export function isRealIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

// Local calendar date as YYYY-MM-DD (due dates are plain dates, not instants).
export function todayIso(now = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function isOverdue(schedule, contract, today = todayIso()) {
  return isContractOpen(contract) && typeof schedule?.next_due_date === "string" && schedule.next_due_date < today;
}

// The API returns a bare array (the request helper already unwraps
// `{ success, data }`). Anything else is a real fault and must be shown, not
// turned into an empty list.
export function asList(value, label) {
  if (!Array.isArray(value)) throw new Error(`The server returned an unexpected response for ${label}.`);
  return value;
}

export function formatMoney(value) {
  if (value === null || value === undefined || value === "") return "Not set";
  const amount = Number(value);
  return Number.isFinite(amount) ? `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "Not set";
}

const text = (value) => (typeof value === "string" ? value.trim() : "");

function parseValue(raw) {
  const trimmed = text(raw === null || raw === undefined ? "" : String(raw));
  if (trimmed === "") return { value: null };
  const number = Number(trimmed);
  if (!Number.isFinite(number)) return { error: "Enter the contract value as a number, for example 12500.50." };
  if (number < 0) return { error: "Contract value cannot be negative." };
  if (number > 1_000_000_000_000) return { error: "Contract value is too large." };
  return { value: number };
}

// values: { client_id, title, start_date, end_date, total_value, status }
// mode "create" -> payload has every field; mode "edit" -> payload has only
// the fields that changed against `original`.
export function validateContractForm(values, { mode = "create", original = null } = {}) {
  const errors = {};
  const title = text(values.title);
  const startDate = text(values.start_date);
  const endDate = text(values.end_date);
  const status = values.status || (mode === "create" ? "Draft" : original?.status);
  const value = parseValue(values.total_value);

  if (mode === "create" && !text(values.client_id)) errors.client_id = "Choose the client this contract is for.";
  if (!title) errors.title = "Enter a contract title.";
  else if (title.length > 160) errors.title = "Contract title cannot exceed 160 characters.";

  if (!startDate) errors.start_date = "Enter a start date.";
  else if (!isRealIsoDate(startDate)) errors.start_date = "Enter a real date in the format YYYY-MM-DD.";
  if (!endDate) errors.end_date = "Enter an end date.";
  else if (!isRealIsoDate(endDate)) errors.end_date = "Enter a real date in the format YYYY-MM-DD.";
  if (!errors.start_date && !errors.end_date && endDate < startDate) {
    errors.end_date = "The end date cannot be before the start date.";
  }

  if (value.error) errors.total_value = value.error;

  const allowedStatuses = mode === "create" ? CONTRACT_CREATE_STATUSES : statusOptionsFor(original?.status);
  if (!allowedStatuses.includes(status)) errors.status = "Choose a status that is allowed from the current one.";

  if (Object.keys(errors).length > 0) return { errors, payload: null };

  if (mode === "create") {
    return {
      errors,
      payload: { client_id: text(values.client_id), title, start_date: startDate, end_date: endDate, total_value: value.value, status }
    };
  }

  const payload = {};
  if (title !== original.title) payload.title = title;
  if (startDate !== original.start_date) payload.start_date = startDate;
  if (endDate !== original.end_date) payload.end_date = endDate;
  if (value.value !== (original.total_value ?? null)) payload.total_value = value.value;
  if (status !== original.status) payload.status = status;
  if (Object.keys(payload).length === 0) return { errors: { form: "You have not changed anything yet." }, payload: null };
  return { errors, payload };
}

// values: { contract_id, equipment_tag_id, frequency, next_due_date, notes }
// `contract` is the contract the schedule belongs to (needed for the date window).
export function validateScheduleForm(values, { mode = "create", contract = null, original = null } = {}) {
  const errors = {};
  const dueDate = text(values.next_due_date);
  const notes = text(values.notes);
  const tagId = text(values.equipment_tag_id) || null;

  if (mode === "create" && !contract) errors.contract_id = "Choose the contract this schedule belongs to.";
  if (!SCHEDULE_FREQUENCIES.includes(values.frequency)) errors.frequency = "Choose how often the work is due.";

  if (!dueDate) errors.next_due_date = "Enter the next due date.";
  else if (!isRealIsoDate(dueDate)) errors.next_due_date = "Enter a real date in the format YYYY-MM-DD.";
  else if (contract && (dueDate < contract.start_date || dueDate > contract.end_date)) {
    errors.next_due_date = `The due date must fall within the contract period (${contract.start_date} to ${contract.end_date}).`;
  }

  if (notes.length > 500) errors.notes = "Notes cannot exceed 500 characters.";

  if (Object.keys(errors).length > 0) return { errors, payload: null };

  if (mode === "create") {
    return {
      errors,
      payload: { contract_id: contract.id, equipment_tag_id: tagId, frequency: values.frequency, next_due_date: dueDate, notes }
    };
  }

  const payload = {};
  if (tagId !== (original.equipment_tag_id ?? null)) payload.equipment_tag_id = tagId;
  if (values.frequency !== original.frequency) payload.frequency = values.frequency;
  if (dueDate !== original.next_due_date) payload.next_due_date = dueDate;
  if (notes !== (original.notes ?? "")) payload.notes = notes;
  if (Object.keys(payload).length === 0) return { errors: { form: "You have not changed anything yet." }, payload: null };
  return { errors, payload };
}
