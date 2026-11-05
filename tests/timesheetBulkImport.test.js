import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { technicianOptions } from "../src/lib/paperEntryLogic.js";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

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
