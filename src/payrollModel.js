// Technician payroll tab: small pure helpers (no React, no network).
//
// Hours are certified Worksheet hours only. The server is the authority for the
// numbers, the roles and what may be exported; this file only shapes display
// state so the page cannot offer an action the server will refuse.

export const PAYROLL_VIEW_ROLES = ["Admin", "Management", "Finance"];
// Mirrors the backend `exportPastel` permission. Management is read-only.
export const PAYROLL_EXPORT_ROLES = ["Admin", "Finance"];

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
export const isPayrollMonth = (v) => MONTH.test(String(v || ""));

// Payroll normally runs for the month that just finished.
export function defaultPayrollMonth(now = new Date()) {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth(); // 0-based; previous month
  const d = new Date(Date.UTC(y, m - 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export const canViewPayroll = (role) => PAYROLL_VIEW_ROLES.includes(role);
export const canExportPayroll = (role) => PAYROLL_EXPORT_ROLES.includes(role);

// -> { enabled, reason } for the "Export to Sage Pastel Payroll (CSV)" button.
export function pastelExportState(report, role, month) {
  if (!canExportPayroll(role)) return { enabled: false, reason: "Only Finance and Admin can export to Pastel." };
  if (!isPayrollMonth(month)) return { enabled: false, reason: "Choose a month." };
  const employees = report?.employees || [];
  if (employees.length === 0) return { enabled: false, reason: "No approved Worksheet hours for this month." };
  const blocked = employees.filter((e) => !e.export_ready);
  if (blocked.length) {
    return { enabled: false, reason: `${blocked.length} employee${blocked.length === 1 ? "" : "s"} cannot be exported until fixed.` };
  }
  return { enabled: true, reason: "" };
}

// Hours display: keep up to 2 decimals, drop a trailing .00.
export const formatHours = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return String(Math.round(n * 100) / 100);
};
