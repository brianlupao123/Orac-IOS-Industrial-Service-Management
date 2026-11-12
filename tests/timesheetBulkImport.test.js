import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  parseAndValidateDate,
  parseHours,
  parseDelimitedText,
  matchTechnician,
  technicianDisplayName,
  reconstructFailedText,
  validateImportBatch,
  computeRowFingerprint,
  BULK_DRAFT_KEY
} from "../src/lib/timesheetBulkImportLogic.js";
import { technicianOptions } from "../src/lib/paperEntryLogic.js";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

// ─── Date Validation ────────────────────────────────────────────────────────

test("parseAndValidateDate: accepts valid ISO date (YYYY-MM-DD)", () => {
  const r = parseAndValidateDate("2026-11-05");
  assert.equal(r.valid, true);
  assert.equal(r.date, "2026-11-05");
});

test("parseAndValidateDate: accepts DD/MM/YYYY format", () => {
  const r = parseAndValidateDate("05/11/2026");
  assert.equal(r.valid, true);
  assert.equal(r.date, "2026-11-05");
});

test("parseAndValidateDate: accepts DD.MM.YYYY format", () => {
  const r = parseAndValidateDate("05.11.2026");
  assert.equal(r.valid, true);
  assert.equal(r.date, "2026-11-05");
});

test("parseAndValidateDate: rejects Feb 30 (invalid calendar date)", () => {
  assert.equal(parseAndValidateDate("2026-02-30").valid, false);
});

test("parseAndValidateDate: rejects Feb 29 in non-leap year", () => {
  assert.equal(parseAndValidateDate("2026-02-29").valid, false);
});

test("parseAndValidateDate: accepts Feb 29 in leap year", () => {
  const r = parseAndValidateDate("2024-02-29");
  assert.equal(r.valid, true);
  assert.equal(r.date, "2024-02-29");
});

test("parseAndValidateDate: rejects month 13", () => {
  assert.equal(parseAndValidateDate("2026-13-01").valid, false);
});

test("parseAndValidateDate: rejects day 0", () => {
  assert.equal(parseAndValidateDate("2026-01-00").valid, false);
});

test("parseAndValidateDate: rejects garbage", () => {
  assert.equal(parseAndValidateDate("yesterday").valid, false);
  assert.equal(parseAndValidateDate("").valid, false);
  assert.equal(parseAndValidateDate(null).valid, false);
  assert.equal(parseAndValidateDate(undefined).valid, false);
});

test("parseAndValidateDate: strips T suffix from ISO datetime", () => {
  const r = parseAndValidateDate("2026-11-05T10:30:00");
  assert.equal(r.valid, true);
  assert.equal(r.date, "2026-11-05");
});

// ─── Hours Validation ───────────────────────────────────────────────────────

test("parseHours: accepts empty or missing as 0", () => {
  assert.deepEqual(parseHours("", ","), { ok: true, hours: 0 });
  assert.deepEqual(parseHours(undefined, ","), { ok: true, hours: 0 });
  assert.deepEqual(parseHours(null, ","), { ok: true, hours: 0 });
});

test("parseHours: parses regular decimal", () => {
  assert.deepEqual(parseHours("8.5", ","), { ok: true, hours: 8.5 });
});

test("parseHours: converts European comma decimal in semicolon-delimited files", () => {
  assert.deepEqual(parseHours("8,5", ";"), { ok: true, hours: 8.5 });
});

test("parseHours: converts European comma decimal in tab-delimited files", () => {
  assert.deepEqual(parseHours("8,5", "\t"), { ok: true, hours: 8.5 });
});

test("parseHours: does NOT convert comma in comma-delimited files", () => {
  // In CSV, "8,5" would already be split into separate cells
  const r = parseHours("8,5", ",");
  assert.equal(r.ok, false); // "8,5" is NaN in comma-delimited context
});

test("parseHours: strips 'hr' and 'hrs' suffix", () => {
  assert.deepEqual(parseHours("8hr", ","), { ok: true, hours: 8 });
  assert.deepEqual(parseHours("8.5hrs", ","), { ok: true, hours: 8.5 });
});

test("parseHours: rejects negative hours", () => {
  const r = parseHours("-2", ",");
  assert.equal(r.ok, false);
  assert.match(r.error, /negative/i);
});

test("parseHours: rejects hours > 24", () => {
  const r = parseHours("25", ",");
  assert.equal(r.ok, false);
  assert.match(r.error, /exceed 24/i);
});

test("parseHours: rejects non-numeric text", () => {
  const r = parseHours("abc", ",");
  assert.equal(r.ok, false);
  assert.match(r.error, /Invalid number/i);
});

// ─── RFC-4180 Delimiter Parser ──────────────────────────────────────────────

test("parseDelimitedText: parses comma CSV", () => {
  const text = "2026-11-05,Tapiwa Marufu,Boilermaker,DC-001,8,2,0,Conveyor work";
  const rows = parseDelimitedText(text);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].workerName, "Tapiwa Marufu");
  assert.equal(rows[0].trade, "Boilermaker");
  assert.equal(rows[0].normal, 8);
  assert.equal(rows[0].ot15, 2);
});

test("parseDelimitedText: parses tab-separated (Excel paste)", () => {
  const text = "2026-11-05\tTapiwa Marufu\tBoilermaker\tDC-001\t8\t2\t0\tConveyor work";
  const rows = parseDelimitedText(text);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].workerName, "Tapiwa Marufu");
});

test("parseDelimitedText: parses semicolon-separated", () => {
  const text = "2026-11-05;Tapiwa Marufu;Boilermaker;DC-001;8;2;0;Conveyor work";
  const rows = parseDelimitedText(text);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].workerName, "Tapiwa Marufu");
});

test("parseDelimitedText: handles quoted cells with embedded commas", () => {
  const text = '2026-11-05,"Marufu, Tapiwa",Boilermaker,DC-001,8,2,0,"Conveyor, chute work"';
  const rows = parseDelimitedText(text);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].workerName, "Marufu, Tapiwa");
  assert.match(rows[0].activity, /Conveyor, chute work/);
});

test("parseDelimitedText: handles multi-line quoted cells (RFC-4180)", () => {
  const text = '2026-11-05,"Tapiwa Marufu",Boilermaker,DC-001,8,2,0,"Conveyor realignment\nand chute replacement"';
  const rows = parseDelimitedText(text);
  assert.equal(rows.length, 1, "Multi-line quoted cell must NOT split into multiple rows");
  assert.match(rows[0].activity, /Conveyor realignment\nand chute replacement/);
});

test("parseDelimitedText: handles escaped double quotes inside quoted cells", () => {
  const text = '2026-11-05,Tapiwa Marufu,Boilermaker,DC-001,8,0,0,"Replaced ""worn"" liner"';
  const rows = parseDelimitedText(text);
  assert.equal(rows.length, 1);
  assert.match(rows[0].activity, /Replaced "worn" liner/);
});

test("parseDelimitedText: handles empty first cell", () => {
  const text = ",Tapiwa Marufu,Boilermaker,DC-001,8,0,0,Work";
  const rows = parseDelimitedText(text);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].date, ""); // empty date
  assert.equal(rows[0].workerName, "Tapiwa Marufu");
});

test("parseDelimitedText: multiple data rows", () => {
  const text = [
    "2026-11-05,Tapiwa Marufu,Boilermaker,DC-001,8,2,0,Conveyor",
    "2026-11-05,Farai Ndlovu,Fitter,DC-001,8,1.5,0,Pump overhaul"
  ].join("\n");
  const rows = parseDelimitedText(text);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].workerName, "Tapiwa Marufu");
  assert.equal(rows[1].workerName, "Farai Ndlovu");
});

test("parseDelimitedText: handles BOM prefix", () => {
  const text = "\uFEFF2026-11-05,Tapiwa,Boilermaker,DC-001,8,0,0,Work";
  const rows = parseDelimitedText(text);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].isDateValid, true);
});

test("parseDelimitedText: returns empty array for blank input", () => {
  assert.deepEqual(parseDelimitedText(""), []);
  assert.deepEqual(parseDelimitedText("  "), []);
  assert.deepEqual(parseDelimitedText(null), []);
  assert.deepEqual(parseDelimitedText(undefined), []);
});

// ─── Header Detection ───────────────────────────────────────────────────────

test("parseDelimitedText: detects standard header row", () => {
  const text = [
    "Date,Technician Name,Trade,Dispatch Card,Normal Hours,1.5x OT,2.0x OT,Work Description",
    "2026-11-05,Tapiwa Marufu,Boilermaker,DC-001,8,2,0,Conveyor"
  ].join("\n");
  const rows = parseDelimitedText(text);
  assert.equal(rows.length, 1, "Header row must be stripped");
  assert.equal(rows[0].workerName, "Tapiwa Marufu");
});

test("parseDelimitedText: does NOT treat 'motor alignment' row as a header (word boundary)", () => {
  // "motor" contains "ot" substring - old code dropped it as a header
  const text = [
    "2026-11-05,Tapiwa Marufu,Boilermaker,DC-001,8,0,0,Motor alignment and rotor balancing",
    "2026-11-06,Farai Ndlovu,Fitter,DC-001,8,0,0,Pump overhaul"
  ].join("\n");
  const rows = parseDelimitedText(text);
  assert.equal(rows.length, 2, "Data row with 'motor' must NOT be dropped as header");
  assert.equal(rows[0].workerName, "Tapiwa Marufu");
  assert.match(rows[0].activity, /Motor alignment/);
});

test("parseDelimitedText: does NOT treat row starting with a valid date as a header", () => {
  const text = [
    "2026-11-05,Date Jones,Fitter,DC-001,8,0,0,Work",
    "2026-11-06,Tapiwa Marufu,Boilermaker,DC-001,8,0,0,Work"
  ].join("\n");
  const rows = parseDelimitedText(text);
  assert.equal(rows.length, 2, "A row with a valid date in col 0 must never be treated as header");
  assert.equal(rows[0].workerName, "Date Jones");
});

// ─── Technician Matching ────────────────────────────────────────────────────

test("matchTechnician: matches by exact full name", () => {
  const techs = [
    { id: "t1", name: "Tapiwa Marufu", trade: "Boilermaker", is_active: true },
    { id: "t2", name: "Farai Ndlovu", trade: "Fitter", is_active: true }
  ];
  const match = matchTechnician({ workerName: "Tapiwa Marufu" }, techs);
  assert.equal(match.id, "t1");
});

test("matchTechnician: matches by national ID (ignoring dashes)", () => {
  const techs = [
    { id: "t1", name: "Tapiwa Marufu", national_id: "63-9999999-Y-12", is_active: true }
  ];
  const match = matchTechnician({ workerName: "639999999Y12" }, techs);
  assert.equal(match.id, "t1");
});

test("matchTechnician: returns null for inactive technician", () => {
  const techs = [
    { id: "t1", name: "Tapiwa Marufu", is_active: false }
  ];
  const match = matchTechnician({ workerName: "Tapiwa Marufu" }, techs);
  assert.equal(match, null);
});

test("matchTechnician: returns null for no match (no partial matching)", () => {
  const techs = [
    { id: "t1", name: "Tapiwa Marufu", is_active: true }
  ];
  const match = matchTechnician({ workerName: "Tapiwa" }, techs);
  assert.equal(match, null, "Partial name must NOT match");
});

test("matchTechnician: matches by first_name + last_name", () => {
  const techs = [
    { id: "t1", first_name: "Tapiwa", last_name: "Marufu", is_active: true }
  ];
  const match = matchTechnician({ workerName: "Tapiwa Marufu" }, techs);
  assert.equal(match.id, "t1");
});

test("matchTechnician: returns null for empty workerName", () => {
  const match = matchTechnician({ workerName: "" }, [{ id: "t1", name: "Test", is_active: true }]);
  assert.equal(match, null);
});

// ─── Partial Failure Recovery ───────────────────────────────────────────────

test("reconstructFailedText: retains only failed rows", () => {
  const validated = [
    { rowId: 1, rawText: "2026-11-05,Tapiwa,Boilermaker,DC-001,8,0,0,Work", headerRawText: "" },
    { rowId: 2, rawText: "2026-11-05,Farai,Fitter,DC-001,8,0,0,Pump", headerRawText: "" },
    { rowId: 3, rawText: "2026-11-05,Nyasha,Electrician,DC-001,8,0,0,MCC", headerRawText: "" }
  ];
  const result = reconstructFailedText(validated, [2]);
  assert.equal(result, "2026-11-05,Farai,Fitter,DC-001,8,0,0,Pump");
});

test("reconstructFailedText: preserves header row when present", () => {
  const header = "Date,Worker,Trade,Job,Normal,1.5x,2.0x,Activity";
  const validated = [
    { rowId: 1, rawText: "2026-11-05,Tapiwa,Boilermaker,DC-001,8,0,0,Work", headerRawText: header },
    { rowId: 2, rawText: "2026-11-05,Farai,Fitter,DC-001,8,0,0,Pump", headerRawText: header }
  ];
  const result = reconstructFailedText(validated, [2]);
  const lines = result.split("\n");
  assert.equal(lines[0], header);
  assert.equal(lines[1], "2026-11-05,Farai,Fitter,DC-001,8,0,0,Pump");
});

test("reconstructFailedText: returns empty string when no failures", () => {
  const validated = [
    { rowId: 1, rawText: "line1", headerRawText: "" }
  ];
  assert.equal(reconstructFailedText(validated, []), "");
});

// ─── "Unclassified" Trade Fallback ──────────────────────────────────────────

test("TimesheetBulkImportModal.jsx uses Unclassified instead of Fitter for missing trade", () => {
  const source = read("src/components/TimesheetBulkImportModal.jsx");
  // Must NOT contain the old "Fitter" fallback for trade
  assert.doesNotMatch(source, /\|\|\s*"Fitter"/, "Must use Unclassified, never Fitter as fallback trade");
  assert.match(source, /"Unclassified"/, "Must use Unclassified as trade fallback");
});

// ─── Drafts-Only Import (Maker-Checker Sign-off Integrity) ───────────────────

test("TimesheetBulkImportModal.jsx strictly creates drafts and never forges employee signatures", () => {
  const source = read("src/components/TimesheetBulkImportModal.jsx");
  assert.doesNotMatch(source, /submitDirectly/, "Must not include submitDirectly state");
  assert.doesNotMatch(source, /payload\.signatures\s*=\s*\{/, "Must not forge employee signatures");
  assert.match(source, /submit:\s*false/, "Must explicitly create worksheets with submit: false");
});

// ─── Bulk Draft Key Cleared on Logout ───────────────────────────────────────

test("client.js logout clears bulk timesheet draft keys", () => {
  const clientSource = read("src/api/client.js");
  assert.match(clientSource, /orac_draft_bulk_timesheets_/, "Logout must clear orac_draft_bulk_timesheets_ keys");
});

// ─── Dispatch Auto-select Safety ────────────────────────────────────────────

test("TimesheetBulkImportModal.jsx auto-selects dispatch only when dispatches.length === 1", () => {
  const source = read("src/components/TimesheetBulkImportModal.jsx");
  assert.match(source, /dispatches\.length\s*===\s*1/, "Must check dispatches.length === 1 for auto-select");
  assert.doesNotMatch(source, /dispatches\.length\s*>\s*0\s*&&\s*!defaultDispatchId/, "Must NOT auto-select dispatches[0] when multiple exist");
});

// ─── Ghost Draft Prevention ─────────────────────────────────────────────────

test("PaperEntryModal.jsx prevents ghost draft with isSubmittedRef", () => {
  const source = read("src/components/PaperEntryModal.jsx");
  assert.match(source, /isSubmittedRef/, "Must use isSubmittedRef to prevent draft re-save after submit");
});

test("TimesheetFormModal.jsx prevents ghost draft with isSubmittedRef", () => {
  const source = read("src/components/TimesheetFormModal.jsx");
  assert.match(source, /isSubmittedRef/, "Must use isSubmittedRef to prevent draft re-save after submit");
});

// ─── Always-Visible Clear Draft Button ──────────────────────────────────────

test("PaperEntryModal.jsx has Clear Draft button outside the restore banner", () => {
  const source = read("src/components/PaperEntryModal.jsx");
  // The footer section should have a Clear Draft button independent of the note banner
  const footerSection = source.slice(source.lastIndexOf("border-t border-gray-100"));
  assert.match(footerSection, /Clear Draft/, "Clear Draft must be visible in the footer area");
});

test("TimesheetFormModal.jsx has Clear Draft button outside the restore banner", () => {
  const source = read("src/components/TimesheetFormModal.jsx");
  const footerSection = source.slice(source.lastIndexOf("border-t border-gray-100"));
  assert.match(footerSection, /Clear Draft/, "Clear Draft must be visible in the footer area");
});

// ─── Existing Wiring Tests ──────────────────────────────────────────────────

test("paperEntryLogic: technicianOptions merges active profiles and marks contractor worker_type correctly", () => {
  const profiles = [
    { id: "tech_01", name: "Tapiwa Marufu", trade: "Boilermaker", national_id: "63-9999999-Y-12", worker_type: "permanent" },
    { id: "tech_02", name: "Farai Ndlovu", trade: "Fitter", national_id: "28-8888888-A-04", worker_type: "contractor" }
  ];
  const users = [
    { id: "tech_03", name: "Nyasha Moyo", role: "Technician", trade: "Electrician", national_id: "08-7777777-B-55" }
  ];
  const worksheets = [
    { technician_id: "tech_04", worker_name: "Simba Dube", technician_trade: "Rigger" }
  ];

  const opts = technicianOptions(users, worksheets, profiles);
  assert.equal(opts.length, 4);
  const tapiwa = opts.find((t) => t.id === "tech_01");
  assert.equal(tapiwa.trade, "Boilermaker");
  assert.equal(tapiwa.worker_type, "permanent");

  const farai = opts.find((t) => t.id === "tech_02");
  assert.equal(farai.trade, "Fitter");
  assert.equal(farai.worker_type, "contractor");
});

test("TimesheetBulkImportModal and PaperEntryModal are correctly wired into WorksheetsPage", () => {
  const pageSource = read("src/pages/WorksheetsPage.jsx");
  assert.match(pageSource, /import TimesheetBulkImportModal/);
  assert.match(pageSource, /<TimesheetBulkImportModal/);
  assert.match(pageSource, /Bulk Import \(CSV \/ Excel\)/);
  assert.match(pageSource, /BULK_IMPORT_ROLES/);
});

test("PaperEntryModal uses SearchableSelect and offlineDraftModel", () => {
  const modalSource = read("src/components/PaperEntryModal.jsx");
  assert.match(modalSource, /import SearchableSelect/);
  assert.match(modalSource, /<SearchableSelect/);
  assert.match(modalSource, /loadDraft\(storage\(\), user\.id, "paper_timesheet"/);
  assert.match(modalSource, /saveDraft\(storage\(\), user\.id, "paper_timesheet"/);
  assert.match(modalSource, /clearDraft\(storage\(\), user\.id, "paper_timesheet"/);
  assert.match(modalSource, /technicianProfiles\.list\(\)/);
});

test("TimesheetFormModal has clear draft button and strictly avoids 'Trade Category'", () => {
  const formSource = read("src/components/TimesheetFormModal.jsx");
  assert.match(formSource, /clearDraft\(storage\(\), user\.id, "timesheet"/);
  assert.doesNotMatch(formSource, /Trade Category/);
});

test("client.js exports salesPortfolio.purchaseOrders", () => {
  const clientSource = read("src/api/client.js");
  assert.match(clientSource, /purchaseOrders\(\)\s*\{\s*return request\(`\/sales-portfolio\/purchase_orders`\);\s*\}/);
});

// ─── Rate-Free Verification ─────────────────────────────────────────────────

test("TimesheetBulkImportModal.jsx is rate-free (no wage or hourly rate)", () => {
  const source = read("src/components/TimesheetBulkImportModal.jsx");
  assert.doesNotMatch(source, /\$\d+\.\d+\s*[–-]\s*\$\d+\.\d+/, "Must not contain rate ranges");
  assert.doesNotMatch(source, /hourly.?rate/i, "Must not mention hourly rate");
  assert.doesNotMatch(source, /wage/i, "Must not mention wage");
});

test("TimesheetFormModal.jsx is rate-free", () => {
  const source = read("src/components/TimesheetFormModal.jsx");
  assert.doesNotMatch(source, /hourly.?rate/i);
  assert.doesNotMatch(source, /wage/i);
});

test("PaperEntryModal.jsx is rate-free", () => {
  const source = read("src/components/PaperEntryModal.jsx");
  assert.doesNotMatch(source, /hourly.?rate/i);
  assert.doesNotMatch(source, /wage/i);
});

// ─── External Auditor Edge Cases & Integrity Verification ───────────────────

test("parseDelimitedText: detects and flags unclosed quotes at EOF", () => {
  const text = '2026-11-05,Tapiwa Marufu,Boilermaker,DC-001,8,0,0,"Unclosed activity description';
  const rows = parseDelimitedText(text);
  assert.equal(rows.length, 1);
  assert.match(rows[0].parseErrors[0], /Unclosed quote in CSV input starting on line 1/);
});

test("matchTechnician: normalizes whitespace in names", () => {
  const techs = [
    { id: "t1", name: "Tapiwa   Marufu", trade: "Boilermaker", is_active: true }
  ];
  const match = matchTechnician({ workerName: "  Tapiwa  Marufu  " }, techs);
  assert.ok(match);
  assert.equal(match.id, "t1");
});

// U-10 checker requirement: identity conflict (name and national ID identify different people)
test("matchTechnician: rejects identity conflict — name and national ID point to different people", () => {
  const techs = [
    { id: "t1", name: "Tapiwa Marufu", national_id: "63-1111111-A-01", is_active: true },
    { id: "t2", name: "Farai Ndlovu", national_id: "63-2222222-B-02", is_active: true }
  ];
  // Row says "Tapiwa Marufu" but supplies Farai's national ID
  const result = matchTechnician({ workerName: "Tapiwa Marufu", nationalId: "63-2222222-B-02" }, techs);
  assert.ok(result.identityError, "Must return identityError when name and ID disagree");
  assert.match(result.identityError, /different people/i);
});

test("matchTechnician: rejects unrecognised national ID with descriptive error", () => {
  const techs = [
    { id: "t1", name: "Tapiwa Marufu", national_id: "63-1111111-A-01", is_active: true }
  ];
  const result = matchTechnician({ workerName: "Tapiwa Marufu", nationalId: "99-XXXXXXX-Z-99" }, techs);
  assert.ok(result.identityError, "Must return identityError for unknown national ID");
  assert.match(result.identityError, /does not match/i);
});

test("matchTechnician: detects ambiguous duplicate names and returns ambiguous flag", () => {
  const techs = [
    { id: "t1", name: "John Moyo", national_id: "63-1111111-A-01", is_active: true },
    { id: "t2", name: "John Moyo", national_id: "63-2222222-B-02", is_active: true }
  ];
  // Without National ID, matching is ambiguous
  const ambiguousMatch = matchTechnician({ workerName: "John Moyo" }, techs);
  assert.ok(ambiguousMatch.ambiguous);
  assert.equal(ambiguousMatch.count, 2);

  // With exact National ID, disambiguates cleanly
  const exactMatch = matchTechnician({ workerName: "63-2222222-B-02" }, techs);
  assert.equal(exactMatch.id, "t2");
  assert.equal(exactMatch.ambiguous, undefined);
});

test("validateImportBatch: flags ambiguous technician as an error requiring National ID", () => {
  const techs = [
    { id: "t1", name: "John Moyo", national_id: "63-1111111-A-01", is_active: true },
    { id: "t2", name: "John Moyo", national_id: "63-2222222-B-02", is_active: true }
  ];
  const dispatches = [{ id: "d1", dispatch_number: "DC-001" }];
  const rows = [
    { rowId: 1, date: "2026-11-05", isDateValid: true, workerName: "John Moyo", normal: 8, ot15: 0, ot20: 0, jobRef: "DC-001", parseErrors: [] }
  ];
  const validated = validateImportBatch(rows, techs, dispatches, "d1");
  assert.equal(validated[0].isValid, false);
  assert.match(validated[0].errors[0], /Multiple active technicians \(2\) named "John Moyo"/);
});

test("validateImportBatch: contractor gate blocks unmatched worker unless allowExternalContractors is true", () => {
  const techs = [{ id: "t1", name: "Tapiwa Marufu", is_active: true }];
  const dispatches = [{ id: "d1", dispatch_number: "DC-001" }];
  const rows = [
    { rowId: 1, date: "2026-11-05", isDateValid: true, workerName: "Unknown Worker", normal: 8, ot15: 0, ot20: 0, jobRef: "DC-001", parseErrors: [] }
  ];

  // Default: blocked with error
  const blocked = validateImportBatch(rows, techs, dispatches, "d1", { allowExternalContractors: false });
  assert.equal(blocked[0].isValid, false);
  assert.match(blocked[0].errors[0], /Technician "Unknown Worker" not found in active registry/);

  // Enabled: allowed with warning
  const allowed = validateImportBatch(rows, techs, dispatches, "d1", { allowExternalContractors: true });
  assert.equal(allowed[0].isValid, true);
  assert.match(allowed[0].warnings[0], /importing as external contractor/);
});

test("validateImportBatch: flags intra-batch duplicate entries (same worker, date, dispatch)", () => {
  const techs = [{ id: "t1", name: "Tapiwa Marufu", is_active: true }];
  const dispatches = [{ id: "d1", dispatch_number: "DC-001" }];
  const rows = [
    { rowId: 1, date: "2026-11-05", isDateValid: true, workerName: "Tapiwa Marufu", normal: 8, ot15: 0, ot20: 0, jobRef: "DC-001", parseErrors: [] },
    { rowId: 2, date: "2026-11-05", isDateValid: true, workerName: "Tapiwa Marufu", normal: 4, ot15: 0, ot20: 0, jobRef: "DC-001", parseErrors: [] }
  ];
  const validated = validateImportBatch(rows, techs, dispatches, "d1");
  assert.equal(validated[0].isValid, true);
  assert.equal(validated[1].isValid, false);
  assert.match(validated[1].errors[0], /Duplicate entry in batch for "Tapiwa Marufu" on 2026-11-05 under this dispatch/);
});

test("validateImportBatch: flags cumulative daily hours exceeding 24h across batch rows", () => {
  const techs = [{ id: "t1", name: "Tapiwa Marufu", is_active: true }];
  const dispatches = [
    { id: "d1", dispatch_number: "DC-001" },
    { id: "d2", dispatch_number: "DC-002" }
  ];
  const rows = [
    { rowId: 1, date: "2026-11-05", isDateValid: true, workerName: "Tapiwa Marufu", normal: 14, ot15: 0, ot20: 0, jobRef: "DC-001", parseErrors: [] },
    { rowId: 2, date: "2026-11-05", isDateValid: true, workerName: "Tapiwa Marufu", normal: 12, ot15: 0, ot20: 0, jobRef: "DC-002", parseErrors: [] }
  ];
  const validated = validateImportBatch(rows, techs, dispatches, "");
  // Total is 26h which exceeds 24h
  assert.equal(validated[0].isValid, false);
  assert.equal(validated[1].isValid, false);
  assert.match(validated[0].errors[0], /Cumulative daily hours \(26h\) for "Tapiwa Marufu" on 2026-11-05 exceed 24h limit/);
  assert.match(validated[1].errors[0], /Cumulative daily hours \(26h\) for "Tapiwa Marufu" on 2026-11-05 exceed 24h limit/);
});

test("parseDelimitedText & matchTechnician: parses National ID column to disambiguate identical technician names", () => {
  const techs = [
    { id: "t_jm1", name: "John Moyo", national_id: "63-111111-A-01", trade: "Fitter", is_active: true },
    { id: "t_jm2", name: "John Moyo", national_id: "63-222222-B-02", trade: "Electrician", is_active: true }
  ];
  const dispatches = [{ id: "d1", dispatch_number: "DC-001" }];

  // 1. Without National ID column: duplicate John Moyo is blocked with ambiguous error
  const csvWithoutNatId = [
    "Date,Technician Name,Trade,Dispatch Card,Hours",
    "2026-11-05,John Moyo,Fitter,DC-001,8.0"
  ].join("\n");
  const parsedWithout = parseDelimitedText(csvWithoutNatId);
  const validatedWithout = validateImportBatch(parsedWithout, techs, dispatches, "d1");
  assert.equal(validatedWithout[0].isValid, false);
  assert.match(validatedWithout[0].errors[0], /Multiple active technicians \(2\) named "John Moyo"\. Provide National ID in CSV/);

  // 2. With National ID column: parses column and resolves to John Moyo #1 directly
  const csvWithNatId = [
    "Date,Technician Name,National ID,Trade,Dispatch Card,Hours",
    "2026-11-05,John Moyo,63-111111-A-01,Fitter,DC-001,8.0"
  ].join("\n");
  const parsedWith = parseDelimitedText(csvWithNatId);
  assert.equal(parsedWith[0].nationalId, "63-111111-A-01");
  const validatedWith = validateImportBatch(parsedWith, techs, dispatches, "d1");
  assert.equal(validatedWith[0].isValid, true);
  assert.equal(validatedWith[0].matchedTech?.id, "t_jm1");
  assert.equal(validatedWith[0].matchedTech?.national_id, "63-111111-A-01");
  assert.equal(validatedWith[0].errors.length, 0);

  // 3. With National ID column pointing to John Moyo #2: resolves to #2
  const csvWithNatId2 = [
    "Date,Technician Name,National ID,Trade,Dispatch Card,Hours",
    "2026-11-05,John Moyo,63-222222-B-02,Electrician,DC-001,8.0"
  ].join("\n");
  const parsedWith2 = parseDelimitedText(csvWithNatId2);
  const validatedWith2 = validateImportBatch(parsedWith2, techs, dispatches, "d1");
  assert.equal(validatedWith2[0].isValid, true);
  assert.equal(validatedWith2[0].matchedTech?.id, "t_jm2");
});

test("idempotency retry safety: content fingerprint preserves exact request IDs for failed rows across reconstruct and retry", () => {
  // Scenario: 3 rows (A, B, C). Rows A (#1) and C (#3) fail, Row B (#2) succeeds.
  // Reconstructed text will contain Row A (#1) and Row C (#2).
  // Row C must NOT inherit Row B's old request ID.
  const initialText = [
    "Date,Technician,Dispatch,Hours",
    "2026-11-05,Tapiwa Marufu,DC-001,8.0",
    "2026-11-05,Farai Ndlovu,DC-001,8.0",
    "2026-11-05,Nyasha Moyo,DC-001,8.0"
  ].join("\n");

  const initialRows = parseDelimitedText(initialText);
  assert.equal(initialRows.length, 3);

  const idMap = {};
  const getReqId = (item) => {
    const fp = computeRowFingerprint(item);
    if (!idMap[fp]) idMap[fp] = `req_${Math.random().toString(36).slice(2, 8)}`;
    return idMap[fp];
  };

  // Initial import attempt for all 3 rows
  const idA_initial = getReqId(initialRows[0]);
  const idB_initial = getReqId(initialRows[1]);
  const idC_initial = getReqId(initialRows[2]);

  assert.notEqual(idA_initial, idB_initial);
  assert.notEqual(idB_initial, idC_initial);
  assert.notEqual(idA_initial, idC_initial);

  // Partial failure: Row 1 (A) and Row 3 (C) fail; Row 2 (B) succeeds.
  const failedIds = [1, 3];
  const remainingText = reconstructFailedText(initialRows, failedIds);

  // Re-parse the retained text (now 2 rows: position 1 is A, position 2 is C!)
  const reParsed = parseDelimitedText(remainingText);
  assert.equal(reParsed.length, 2);
  assert.equal(reParsed[0].workerName, "Tapiwa Marufu"); // position 1
  assert.equal(reParsed[1].workerName, "Nyasha Moyo");    // position 2 (was position 3!)

  // Retry import: compute request IDs for the re-parsed rows
  const idA_retry = getReqId(reParsed[0]);
  const idC_retry = getReqId(reParsed[1]);

  // Row A retained its exact original request ID
  assert.equal(idA_retry, idA_initial);

  // Crucial: Row C retained its own original request ID, and did NOT inherit Row B's old ID!
  assert.equal(idC_retry, idC_initial);
  assert.notEqual(idC_retry, idB_initial);
});

test("technicianDisplayName: resolves name from name property or first_name + last_name", () => {
  assert.equal(technicianDisplayName({ name: "Tapiwa Marufu" }), "Tapiwa Marufu");
  assert.equal(technicianDisplayName({ first_name: "Tendai", last_name: "Chikore" }), "Tendai Chikore");
  assert.equal(technicianDisplayName({ first_name: "Simba" }), "Simba");
  assert.equal(technicianDisplayName(null), "");
});

test("matchTechnician & validation: ID-only row populates workerName for first_name/last_name profiles", () => {
  const techs = [
    { id: "t_split", first_name: "Tendai", last_name: "Chikore", national_id: "63-999-K-88", trade: "Electrician", is_active: true }
  ];
  const dispatches = [{ id: "d1", dispatch_number: "DC-001" }];

  const parsedRows = parseDelimitedText("Date,Technician,National ID,Dispatch,Hours\n2026-11-05,,63-999-K-88,DC-001,8.0");
  const validated = validateImportBatch(parsedRows, techs, dispatches, "d1");
  assert.equal(validated[0].isValid, true);
  assert.equal(validated[0].workerName, "Tendai Chikore");
  assert.equal(validated[0].errors.length, 0);
});

test("matchTechnician: conflict message displays full first + last name for first_name/last_name profiles", () => {
  const techs = [
    { id: "t_split", first_name: "Tendai", last_name: "Chikore", national_id: "63-999-K-88", trade: "Electrician", is_active: true }
  ];
  const row = { workerName: "Farai Gumbo", nationalId: "63-999-K-88" };
  const match = matchTechnician(row, techs);
  assert.ok(match?.conflict);
  assert.match(match.message, /National ID belongs to Tendai Chikore\)\./);
});
