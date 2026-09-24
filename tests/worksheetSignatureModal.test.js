import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("..", import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), "utf8");

// Modal renders nothing unless it receives isOpen. Every <Modal> on the Timesheets page
// must therefore pass it, or "Submit for Review" opens an invisible sign-off step and a
// Draft or Returned timesheet can never reach Submitted from the UI.
test("Modal renders null unless isOpen is truthy (contract the page depends on)", () => {
  assert.match(read("src/components/Modal.jsx"), /if \(!isOpen\) return null/);
});

test("every Modal on the Timesheets page passes isOpen, including the client sign-off modal", () => {
  const page = read("src/pages/WorksheetsPage.jsx");
  const modals = page.match(/<Modal\b[^>]*>/g) || [];
  assert.ok(modals.length >= 2, "expected the create and sign-off modals");
  for (const tag of modals) assert.match(tag, /\bisOpen\b/, `missing isOpen: ${tag.replace(/\s+/g, " ")}`);
  assert.match(page, /title="Client Representative Sign-Off"[^>]*isOpen|isOpen[^>]*title="Client Representative Sign-Off"/);
});
