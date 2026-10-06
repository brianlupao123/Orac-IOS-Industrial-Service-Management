// Pure helpers for the Worksheet (monthly register) screens. No React, no fetch.
// The server is authoritative for consolidation, exceptions and permissions; this module only
// shapes data for display and builds request bodies. The register is DERIVED from approved
// Timesheets: there is no function here that accepts hours typed in, a rate, an amount or a cost.

export const STATUS_LABEL = Object.freeze({ Draft: "Draft", Submitted: "Awaiting approval", Returned_For_Correction: "Returned for correction", Approved: "Approved", Cancelled: "Cancelled" });
export const RECONCILIATION_LABEL = Object.freeze({
  Not_Built: "Not generated", Exceptions_Open: "Blocking exceptions open", Awaiting_Acknowledgement: "Warnings need acknowledgement",
  Clear: "Clear to submit", Evidence_Recorded: "Reconciliation evidence recorded (not billed)"
});
export const SEVERITY_ORDER = Object.freeze({ blocking: 0, warning: 1, info: 2 });
export const SEVERITY_LABEL = Object.freeze({ blocking: "Must fix", warning: "Needs acknowledgement", info: "For information" });
export const SOURCE_LABEL = Object.freeze({ timesheet: "Timesheet", daily_timesheet: "Daily Time Sheet (legacy)", contractor_log: "Contractor Log (legacy)" });

export const statusLabel = (s) => STATUS_LABEL[s] || String(s || "Unknown").replace(/_/g, " ");
export const reconciliationLabel = (s) => RECONCILIATION_LABEL[s] || String(s || "").replace(/_/g, " ");
export const sourceLabel = (t) => SOURCE_LABEL[t] || t;

export function formatHours(value) { const n = Number(value); return !Number.isFinite(n) || n === 0 ? "" : String(Math.round(n * 100) / 100); }
export function formatTotal(value) { const n = Number(value); return Number.isFinite(n) ? String(Math.round(n * 100) / 100) : "0"; }
export function formatDateShort(iso) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || "")); return m ? `${m[3]}/${m[2]}` : String(iso || ""); }
export function formatDateFull(iso) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || "")); return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso || ""); }

// Register layout of the supplied Excel sheet: weekdays and Saturdays Normal + 1.5, Sundays Normal + 2.0.
// Public holidays are NOT classified (company policy pending), so there is no holiday column type.
// Hours in a bucket the layout does not show stay visible, so nothing recorded is ever hidden.
export const subColumnsFor = (dayType) => (dayType === "sunday" ? ["normal", "ot_20"] : ["normal", "ot_15"]);
export const SUB_LABEL = Object.freeze({ normal: "N", ot_15: "1.5", ot_20: "2.0" });

export function displayCells(dateCol, cell) {
  const cols = subColumnsFor(dateCol.day_type);
  const cells = cols.map((bucket) => ({ bucket, text: formatHours(cell?.[bucket]) }));
  const hidden = ["normal", "ot_15", "ot_20"].filter((b) => !cols.includes(b) && Number(cell?.[b]) > 0).map((b) => ({ bucket: b, text: formatHours(cell?.[b]) }));
  return { cells, hidden };
}

export function groupRows(rows) {
  const groups = []; const index = new Map();
  for (const row of rows || []) {
    const name = row.group || "";
    if (!index.has(name)) { index.set(name, { group: name, rows: [] }); groups.push(index.get(name)); }
    index.get(name).rows.push(row);
  }
  return groups;
}

export const sortExceptions = (list) => [...(list || [])].sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9) || String(a.key).localeCompare(String(b.key)));

export function exceptionCountsText(counts) {
  if (!counts) return "";
  const parts = [];
  if (counts.blocking) parts.push(`${counts.blocking} must fix`);
  if (counts.warning_unacknowledged) parts.push(`${counts.warning_unacknowledged} to acknowledge`);
  return parts.length ? parts.join(" · ") : "No open exceptions";
}

// ---- source references (the id of every record a cell came from) ----
export function cellSourceText(cell) {
  return (cell?.sources || []).map((s) => `${sourceLabel(s.source_type)} ${s.record_id}`).join(", ");
}

export function sourceRows(lines) {
  const out = [];
  for (const l of lines || []) for (const s of l.sources || []) out.push({ roster_key: l.roster_key, date: l.date, carry_over: Boolean(l.carry_over), source_type: s.source_type, record_id: s.record_id, row_index: s.row_index });
  return out.sort((a, b) => a.roster_key.localeCompare(b.roster_key) || a.date.localeCompare(b.date) || a.record_id.localeCompare(b.record_id));
}

// ---- overrides (exclude a row / include a carry-over): always typed, always with a reason ----
export const refsFromException = (exc) => (Array.isArray(exc?.details?.rows) ? exc.details.rows.filter((r) => r && r.record_id) : []);
const same = (a, b) => a.source_type === b.source_type && a.record_id === b.record_id && a.row_index === b.row_index;
export function addRowRef(list, ref, reason) {
  return [...(list || []).filter((x) => !same(x, ref)), { source_type: ref.source_type, record_id: ref.record_id, row_index: ref.row_index, reason: String(reason || "").trim() }];
}
export const removeRowRef = (list, ref) => (list || []).filter((x) => !same(x, ref));
export const refsForPayload = (list) => (list || []).map(({ source_type, record_id, row_index, reason }) => ({ source_type, record_id, row_index, reason }));
export const refLabel = (r) => `${sourceLabel(r.source_type)} ${r.record_id}${r.source_type === "timesheet" ? "" : ` row ${r.row_index + 1}`}`;

// Candidate roster: workers who have a Timesheet (or legacy record) in the period. Built from records the
// viewer can already list, so no all-users listing is needed.
export function rosterCandidates({ timesheets = [], dailySheets = [] }, periodStart, periodEnd) {
  const seen = new Map();
  const add = (key, base, approved, approvedFlag) => {
    if (!seen.has(key)) seen.set(key, { key, ...base, records: 0, approved: 0 });
    const c = seen.get(key); c.records += 1; if (approvedFlag) c.approved += 1;
  };
  for (const ws of timesheets) {
    if (ws.timesheet_version !== 2 || ws.superseded_by || !(ws.work_date >= periodStart && ws.work_date <= periodEnd)) continue;
    const name = ws.worker_name || ws.technician_name || "";
    add(ws.technician_id ? `t:${ws.technician_id}` : `n:${name.toLowerCase().replace(/\s+/g, " ").trim()}`, { technician_id: ws.technician_id || null, display_name: name, group: ws.worker_category || ws.technician_trade || "" }, 0, ws.status === "Supervisor_Approved");
  }
  for (const sheet of dailySheets) {
    if (!(sheet.entries || []).some((r) => r && r.kind !== "separator" && r.date >= periodStart && r.date <= periodEnd)) continue;
    add(sheet.technician_id ? `t:${sheet.technician_id}` : `n:${String(sheet.name_on_form || "").toLowerCase().replace(/\s+/g, " ").trim()}`, { technician_id: sheet.technician_id || null, display_name: sheet.name_on_form || "", group: sheet.category || "" }, 0, sheet.status === "Supervisor_Approved");
  }
  return [...seen.values()].sort((a, b) => a.display_name.localeCompare(b.display_name));
}

export function validateCreateForm(form) {
  const errors = [];
  if (!String(form.title || "").trim()) errors.push("Title is required.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.period_start || "")) errors.push("Period start is required.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.period_end || "")) errors.push("Period end is required.");
  if (form.period_start && form.period_end && form.period_end < form.period_start) errors.push("Period end cannot be before period start.");
  if (!form.client_id) errors.push("Client is required.");
  if (!String(form.project_title || "").trim()) errors.push("Project title is required.");
  if (!(form.roster || []).length) errors.push("Add at least one employee to the roster.");
  return errors;
}

// The ONLY place a create body is assembled: no hours, no rate, no holiday list, nothing but scope and roster.
export function buildCreatePayload(form) {
  return {
    title: String(form.title).trim(), period_start: form.period_start, period_end: form.period_end,
    scope: { client_id: form.client_id, project_title: String(form.project_title).trim(), ...(form.department_section ? { department_section: String(form.department_section).trim() } : {}) },
    roster: form.roster.map((r) => (r.technician_id ? { technician_id: r.technician_id, ...(r.group ? { group: r.group } : {}) } : { display_name: r.display_name, ...(r.group ? { group: r.group } : {}) }))
  };
}

export function billingNotice(record) {
  if (record?.reconciliation) {
    return record.reconciliation.billing?.overlap_hold
      ? "Evidence recorded. NOT billed: no controlled rate source exists yet, and existing billable time entries were found for some of these dates."
      : "Evidence recorded. NOT billed: no controlled rate source exists yet.";
  }
  return "This Worksheet is generated from approved Timesheets; nobody types hours into it. Approving it does not bill anything: rates come from a controlled rate source that is not part of this release.";
}
export const HOLIDAY_NOTICE = "Public holidays are not classified yet (company policy pending). Every date is treated as a weekday, Saturday or Sunday.";
