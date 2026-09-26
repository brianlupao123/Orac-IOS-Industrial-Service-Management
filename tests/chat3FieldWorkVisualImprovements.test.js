import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("..", import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), "utf8");

// ---- Kiosk: no full-page takeover on error, no hard reload -------------------

test("Kiosk Mode never hard-reloads the page and keeps entered state on error", () => {
  const page = read("src/pages/KioskModePage.jsx");
  assert.doesNotMatch(page, /window\.location\.reload/, "a reload would discard the technician's entered hours");
  assert.doesNotMatch(page, /if \(loading && !technicians\.length\)/, "the old full-page loading takeover should be gone");
  assert.doesNotMatch(page, /if \(error\)\s*\{\s*return/, "the old full-page error takeover should be gone");
});

test("Kiosk Mode separates job-list errors from roster errors and both offer an inline retry", () => {
  const page = read("src/pages/KioskModePage.jsx");
  assert.match(page, /const \[jobsError, setJobsError\]/);
  assert.match(page, /const \[rosterError, setRosterError\]/);
  assert.match(page, /const \[formError, setFormError\]/);
  const retries = page.match(/onClick=\{load(Jobs|Roster)\}/g) || [];
  assert.equal(retries.length, 2, "expected a retry button wired to loadJobs and one wired to loadRoster");
  assert.match(page, /role="alert"/);
});

test("Kiosk Mode groups the form into a job/date step and a crew-hours step", () => {
  const page = read("src/pages/KioskModePage.jsx");
  assert.match(page, /<fieldset[^>]*>/);
  assert.match(page, /1\. Select job and date/);
  assert.match(page, /2\. Enter crew hours/);
});

test("Kiosk Mode still uses the scoped roster and audited batch endpoint (unchanged contract)", () => {
  const page = read("src/pages/KioskModePage.jsx");
  assert.match(page, /kiosk\.roster\(selectedJob\)/);
  assert.match(page, /kiosk\.submit\(selectedJob/);
  assert.doesNotMatch(page, /collections\.list\("users"\)/);
});

// ---- Timesheets: grouped create-timesheet form, unmistakable from Internal Requests

test("the Timesheets create form is grouped into labelled sections", () => {
  const page = read("src/pages/WorksheetsPage.jsx");
  assert.match(page, /<fieldset className="space-y-4">/);
  assert.match(page, /Dispatch &amp; date/);
  assert.match(page, /Work details/);
});

test("the Timesheets page distinguishes itself from Internal Requests in its own copy", () => {
  const page = read("src/pages/WorksheetsPage.jsx");
  assert.match(page, /separate from an <strong>Internal Request<\/strong>/);
});

test("the Timesheets page keeps the stable technical collection and trade filter (unchanged contract)", () => {
  const page = read("src/pages/WorksheetsPage.jsx");
  assert.match(page, /collections\.list\("field_worksheets"\)/);
  assert.match(page, /Filter timesheets by trade/);
});

test("every Modal on the Timesheets page still passes isOpen after the form regrouping", () => {
  const page = read("src/pages/WorksheetsPage.jsx");
  const modals = page.match(/<Modal\b[^>]*>/g) || [];
  assert.ok(modals.length >= 2, "expected the create and sign-off modals");
  for (const tag of modals) assert.match(tag, /\bisOpen\b/, `missing isOpen: ${tag.replace(/\s+/g, " ")}`);
});

// ---- Service Request triage / Internal Request inbox scanning accents --------

test("the Service Request triage queue carries a presentation-only urgency accent, not a filter", () => {
  const page = read("src/pages/ServiceRequestTriagePage.jsx");
  assert.match(page, /urgencyAccent\(item\.urgency\)/);
  assert.doesNotMatch(page, /\.filter\(/, "triage must not filter records in the browser");
});

test("the Internal Request card carries a presentation-only priority accent, not a filter", () => {
  const card = read("src/components/InternalRequestCard.jsx");
  assert.match(card, /priorityAccent\(view\.priority\)/);
  assert.doesNotMatch(card, /\.filter\(/, "the card must not filter records in the browser");
});
