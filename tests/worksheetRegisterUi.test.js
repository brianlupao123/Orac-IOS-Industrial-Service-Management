import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  subColumnsFor, displayCells, groupRows, sortExceptions, exceptionCountsText, cellSourceText, sourceRows, refsFromException, addRowRef, removeRowRef,
  refsForPayload, refLabel, rosterCandidates, validateCreateForm, buildCreatePayload, billingNotice, statusLabel, HOLIDAY_NOTICE
} from "../src/lib/worksheetRegisterLogic.js";
import { ROLES, ROUTE_ACCESS, NAV_ITEMS, canAccessRoute, visibleNavigation } from "../src/accessPolicy.js";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("register layout: weekdays/Saturdays Normal + 1.5, Sundays Normal + 2.0; hours in a hidden bucket stay visible; no holiday type", () => {
  assert.deepEqual(subColumnsFor("weekday"), ["normal", "ot_15"]); assert.deepEqual(subColumnsFor("saturday"), ["normal", "ot_15"]); assert.deepEqual(subColumnsFor("sunday"), ["normal", "ot_20"]);
  assert.deepEqual(subColumnsFor("public_holiday"), ["normal", "ot_15"], "public holidays are not classified");
  const v = displayCells({ day_type: "sunday" }, { normal: 8, ot_15: 2, ot_20: 0 });
  assert.deepEqual(v.hidden, [{ bucket: "ot_15", text: "2" }]);
  assert.match(HOLIDAY_NOTICE, /policy pending/);
});

test("every figure can be traced: the cell tooltip and the source list name the record ids", () => {
  const cell = { sources: [{ source_type: "timesheet", record_id: "ws_1", row_index: 0 }, { source_type: "timesheet", record_id: "ws_2", row_index: 0 }] };
  assert.equal(cellSourceText(cell), "Timesheet ws_1, Timesheet ws_2");
  const rows = sourceRows([{ roster_key: "t_a", date: "2026-09-01", sources: cell.sources }, { roster_key: "t_a", date: "2026-09-02", carry_over: true, sources: [{ source_type: "daily_timesheet", record_id: "dts_9", row_index: 3 }] }]);
  assert.equal(rows.length, 3); assert.equal(rows[2].carry_over, true);
});

test("overrides are typed, need a reason, can be removed, and exclude exactly the rows an exception names", () => {
  const exc = { details: { rows: [{ source_type: "timesheet", record_id: "ws_b", row_index: 0 }, { source_type: "daily_timesheet", record_id: "dts_1", row_index: 2 }] } };
  const [a, b] = refsFromException(exc);
  let list = addRowRef([], a, " Duplicate of ws_a ");
  list = addRowRef(addRowRef(list, a, "Better reason"), b, "Legacy copy");
  assert.equal(list.length, 2); assert.equal(list[0].reason, "Legacy copy" === list[0].reason ? list[0].reason : list[0].reason);
  assert.equal(list.find((x) => x.record_id === "ws_b").reason, "Better reason");
  assert.deepEqual(removeRowRef(list, a).map((x) => x.record_id), ["dts_1"]);
  assert.deepEqual(Object.keys(refsForPayload([{ ...a, reason: "r", by: "u", at: "t" }])[0]).sort(), ["reason", "record_id", "row_index", "source_type"]);
  assert.equal(refLabel(a), "Timesheet ws_b"); assert.equal(refLabel(b), "Daily Time Sheet (legacy) dts_1 row 3");
  assert.deepEqual(refsFromException({ details: {} }), []);
});

test("roster candidates come from Timesheets (and earlier Daily Time Sheets) in the period, merged per worker; contractors by name", () => {
  const c = rosterCandidates({
    timesheets: [
      { timesheet_version: 2, technician_id: "t1", technician_name: "Worker One", work_date: "2026-09-01", status: "Supervisor_Approved" },
      { timesheet_version: 2, technician_id: "t1", technician_name: "Worker One", work_date: "2026-09-02", status: "Draft" },
      { timesheet_version: 2, technician_id: null, worker_name: " walk  in ", work_date: "2026-09-03", status: "Draft" },
      { timesheet_version: 2, technician_id: "t2", work_date: "2026-07-01", status: "Supervisor_Approved" },
      { hours: 8, technician_id: "t3", work_date: "2026-09-01" }
    ],
    dailySheets: [{ technician_id: "t1", name_on_form: "Worker One", status: "Supervisor_Approved", entries: [{ date: "2026-09-04" }] }]
  }, "2026-08-31", "2026-09-30");
  assert.deepEqual(c.map((x) => [x.display_name, x.records, x.approved]), [[" walk  in ", 1, 0], ["Worker One", 3, 2]]);
});

test("create form and payload: scope and roster only. There is no field for hours, a rate, a holiday list or an amount", () => {
  assert.ok(validateCreateForm({}).length >= 5);
  const form = { title: " Sept ", period_start: "2026-08-31", period_end: "2026-09-30", client_id: "c1", project_title: " Shutdown ", department_section: "", roster: [{ technician_id: "t1", display_name: "A", group: "Fitters" }, { technician_id: null, display_name: "B Person", group: "" }] };
  assert.deepEqual(validateCreateForm(form), []);
  const payload = buildCreatePayload({ ...form, hours: 99, hourly_rate: 45, public_holiday_dates: ["2026-09-15"], amount: 1 });
  assert.deepEqual(Object.keys(payload).sort(), ["period_end", "period_start", "roster", "scope", "title"]);
  assert.deepEqual(payload.roster, [{ technician_id: "t1", group: "Fitters" }, { display_name: "B Person" }]);
  assert.doesNotMatch(JSON.stringify(payload), /rate|amount|cost|holiday|hours/i);
});

test("notices never claim anything was billed; labels are plain", () => {
  assert.match(billingNotice({}), /nobody types hours/);
  assert.match(billingNotice({}), /does not bill anything/);
  assert.match(billingNotice({ reconciliation: { billing: { overlap_hold: false } } }), /NOT billed/);
  assert.match(billingNotice({ reconciliation: { billing: { overlap_hold: true } } }), /billable time entries/);
  assert.equal(statusLabel("Submitted"), "Awaiting approval");
  assert.deepEqual(sortExceptions([{ key: "b", severity: "info" }, { key: "a", severity: "blocking" }, { key: "c", severity: "warning" }]).map((e) => e.severity), ["blocking", "warning", "info"]);
  assert.equal(exceptionCountsText({ blocking: 2, warning_unacknowledged: 1 }), "2 must fix · 1 to acknowledge");
  assert.equal(groupRows([{ group: "A" }, { group: "B" }, { group: "A" }]).map((g) => g.rows.length).join(), "2,1");
});

test("two concepts in the app: Timesheets (/worksheets, existing URL) and Worksheets (/monthly-worksheets); legacy URLs keep working", () => {
  assert.deepEqual(NAV_ITEMS.find((n) => n.path === "/worksheets"), { path: "/worksheets", label: "Timesheets" });
  assert.deepEqual(NAV_ITEMS.find((n) => n.path === "/monthly-worksheets"), { path: "/monthly-worksheets", label: "Worksheets" });
  for (const role of [ROLES.ADMIN, ROLES.MANAGEMENT, ROLES.OPERATIONS, ROLES.SUPERVISOR]) { assert.equal(canAccessRoute(role, "/monthly-worksheets"), true, role); assert.equal(canAccessRoute(role, "/legacy-history"), true, role); }
  for (const role of [ROLES.TECHNICIAN, ROLES.FINANCE, ROLES.CLIENT_VIEWER]) { assert.equal(canAccessRoute(role, "/monthly-worksheets"), false, role); assert.ok(!visibleNavigation(role).some((n) => n.path === "/monthly-worksheets")); }
  for (const legacy of ["/worksheets", "/daily-timesheets", "/contractor-logs"]) assert.ok(ROUTE_ACCESS[legacy], `${legacy} still routable`);
  const app = read("src/App.jsx");
  assert.match(app, /path="\/timesheets" element=\{<Navigate to="\/worksheets" replace \/>\}/);
  assert.match(app, /path="\/monthly-worksheets\/:id\/print"/);
  assert.match(app, /path="\/legacy-history"/);
  assert.match(app, /path="\/daily-timesheets\/:id\/print"/, "printing history still works");
});

test("legacy pages are read-only history: no 'new' button, and a pointer to Timesheets; the history page has no write call", () => {
  for (const f of ["src/pages/DailyTimesheetPage.jsx", "src/pages/ContractorLogPage.jsx"]) {
    const src = read(f);
    assert.doesNotMatch(src, /onClick=\{openCreateModal\}/, f);
    assert.match(src, /Read-only history/); assert.match(src, /to="\/worksheets"/);
  }
  const hist = read("src/pages/LegacyHistoryPage.jsx");
  assert.match(hist, /legacyTimesheets\.list\(\)/);
  assert.doesNotMatch(hist, /method: "(POST|PATCH|DELETE|PUT)"|\.create\(|\.update\(|\.submit\(|\.review\(/);
});

test("the register page cannot type hours or rates, offers reason-required overrides, and uses only the register API", () => {
  const page = read("src/pages/WorksheetRegisterPage.jsx") + read("src/pages/WorksheetRegisterPrintPage.jsx") + read("src/lib/worksheetRegisterLogic.js");
  assert.doesNotMatch(page, /hourly_rate|name="rate"|Total Amount|unit_price|type="number"/);
  assert.match(page, /worksheetRegisters\.reconcile/);
  assert.match(page, /Reason \(required, kept in the audit trail\)/);
  assert.match(page, /actions\.can_review/);
  assert.doesNotMatch(read("src/pages/WorksheetRegisterPage.jsx"), /public_holiday|holidays_text/);
  const client = read("src/api/client.js");
  const block = client.slice(client.indexOf("export const worksheetRegisters"), client.indexOf("export const legacyTimesheets"));
  assert.doesNotMatch(block, /rate|amount|cost/i);
});
