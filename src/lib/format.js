const DASH = "\u2014"; // Em-dash: '—'

// Business timezone for CSV filenames and date displays.
// Configurable via VITE_ORAC_BUSINESS_TZ (browser) or ORAC_BUSINESS_TZ (node tests).
// Default: Africa/Harare (CAT, UTC+2) — confirmed pilot fallback pending accountant TZ decision.
const _env = (name) => (typeof import.meta !== "undefined" && import.meta.env && import.meta.env[name] !== undefined
  ? import.meta.env[name]
  : (typeof process !== "undefined" ? process.env?.[name] : undefined));

export const BUSINESS_TZ = _env("VITE_ORAC_BUSINESS_TZ") || _env("ORAC_BUSINESS_TZ") || "Africa/Harare";

/**
 * Format a Date as YYYY-MM-DD in the business timezone.
 * Uses Intl.DateTimeFormat with "sv-SE" locale for ISO-style output.
 */
export function formatBusinessDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("sv-SE", { timeZone: BUSINESS_TZ }).format(date);
}

const MONTH_NAMES_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_NAMES_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

/**
 * Validates and parses numeric input.
 * Rejects: null, undefined, empty string, whitespace-only string,
 * non-numeric strings, booleans, NaN, Infinity, -Infinity.
 * Preserves: valid 0, -0, negative numbers, floats, finite numeric strings.
 */
function parseNumeric(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    const num = Number(trimmed);
    if (!Number.isFinite(num)) return null;
    return num;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return value;
  }
  return null;
}

/**
 * Checks if a year, month (1-12), and day (1-31) represent a real calendar date.
 * Prevents rollover (e.g. Feb 31 -> Mar 3 or Apr 31 -> May 1).
 */
function isValidCalendarDate(y, m, d) {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const date = new Date(y, m - 1, d);
  return (
    date.getFullYear() === y &&
    date.getMonth() === m - 1 &&
    date.getDate() === d
  );
}

/**
 * Parses and validates a date input.
 * Rejects invalid calendar dates (e.g. 2026-02-31, 2026-04-31).
 * Preserves date-only values without local timezone shift.
 */
function parseDateValue(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    // Strict Date-only: YYYY-MM-DD
    const dateOnlyMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnlyMatch) {
      const y = Number(dateOnlyMatch[1]);
      const m = Number(dateOnlyMatch[2]);
      const d = Number(dateOnlyMatch[3]);
      if (!isValidCalendarDate(y, m, d)) return null;
      return new Date(y, m - 1, d);
    }

    // Date with time: YYYY-MM-DDTHH:mm... or YYYY-MM-DD HH:mm...
    const dateTimeMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
    if (dateTimeMatch) {
      const y = Number(dateTimeMatch[1]);
      const m = Number(dateTimeMatch[2]);
      const d = Number(dateTimeMatch[3]);
      if (!isValidCalendarDate(y, m, d)) return null;
    }

    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

/**
 * Format money in USD with commas and two decimal places.
 * Example: 12500 -> "$12,500.00", 0 -> "$0.00", -50 -> "-$50.00"
 */
export function formatMoney(value) {
  const num = parseNumeric(value);
  if (num === null) return DASH;
  // Handle -0 gracefully as 0
  const normalized = Object.is(num, -0) ? 0 : num;
  const isNegative = normalized < 0;
  const abs = Math.abs(normalized);
  const parts = abs.toFixed(2).split(".");
  const withCommas = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${isNegative ? "-" : ""}$${withCommas}.${parts[1]}`;
}

/**
 * Format signed money with explicit +/- prefix.
 * Example: 500 -> "+$500.00", -500 -> "-$500.00", 0 -> "$0.00"
 */
export function formatSignedMoney(value) {
  const num = parseNumeric(value);
  if (num === null) return DASH;
  const normalized = Object.is(num, -0) ? 0 : num;
  if (normalized > 0) {
    const parts = normalized.toFixed(2).split(".");
    const withCommas = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return `+$${withCommas}.${parts[1]}`;
  }
  if (normalized < 0) {
    const abs = Math.abs(normalized);
    const parts = abs.toFixed(2).split(".");
    const withCommas = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return `-$${withCommas}.${parts[1]}`;
  }
  return "$0.00";
}

/**
 * Format numeric count with thousands separators.
 * Example: 12500 -> "12,500", 0 -> "0", -5 -> "-5"
 */
export function formatNumber(value) {
  const num = parseNumeric(value);
  if (num === null) return DASH;
  const normalized = Object.is(num, -0) ? 0 : num;
  const isNegative = normalized < 0;
  const abs = Math.abs(normalized);
  const str = String(abs);
  const [intPart, decPart] = str.split(".");
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const formatted = decPart !== undefined ? `${withCommas}.${decPart}` : withCommas;
  return `${isNegative ? "-" : ""}${formatted}`;
}

/**
 * Format date as D MMM YYYY.
 * Example: "12 Oct 2026"
 */
export function formatDate(value) {
  const date = parseDateValue(value);
  if (date === null) return DASH;
  const d = date.getDate();
  const m = MONTH_NAMES_SHORT[date.getMonth()];
  const y = date.getFullYear();
  return `${d} ${m} ${y}`;
}

/**
 * Format date and time as D MMM YYYY, HH:mm.
 * Example: "12 Oct 2026, 14:30"
 */
export function formatDateTime(value) {
  const date = parseDateValue(value);
  if (date === null) return DASH;
  const d = date.getDate();
  const m = MONTH_NAMES_SHORT[date.getMonth()];
  const y = date.getFullYear();
  const hh = pad2(date.getHours());
  const mm = pad2(date.getMinutes());
  return `${d} ${m} ${y}, ${hh}:${mm}`;
}

/**
 * Format time as HH:mm.
 * Example: "14:30"
 */
export function formatTime(value) {
  const date = parseDateValue(value);
  if (date === null) return DASH;
  const hh = pad2(date.getHours());
  const mm = pad2(date.getMinutes());
  return `${hh}:${mm}`;
}

/**
 * Format long date as D MMMM YYYY.
 * Example: "12 October 2026"
 */
export function formatLongDate(value) {
  const date = parseDateValue(value);
  if (date === null) return DASH;
  const d = date.getDate();
  const m = MONTH_NAMES_LONG[date.getMonth()];
  const y = date.getFullYear();
  return `${d} ${m} ${y}`;
}
