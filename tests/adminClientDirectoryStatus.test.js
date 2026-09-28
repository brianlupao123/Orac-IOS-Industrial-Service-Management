import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const page = read("src/pages/AdminPage.jsx");

test("Client Directory shows a Status column, so an inactive client is visible at a glance", () => {
  assert.match(page, /columns=\{\["Client Name", "Type", "Contact Person", "Email", "Status", "Actions"\]\}/);
  assert.match(page, /<StatusBadge status=\{isActive \? "Active" : "Inactive"\} \/>/);
});

test("Client Directory reads is_active defensively so a client with no is_active field counts as active", () => {
  assert.match(page, /const isActive = c\.is_active !== false;/);
  // The old truthy reads drove a backwards Disable/Enable button for legacy clients.
  assert.doesNotMatch(page, /c\.is_active\?"Deactivate "/);
  assert.doesNotMatch(page, /c\.is_active\?"Disable":"Enable"/);
  assert.match(page, /isActive\?"Disable":"Enable"/);
});

test("Client Directory states its place at the top of the client-owned hierarchy and points to Entity Management", () => {
  assert.match(page, /Top of the client-owned hierarchy: Client → Mine Site → Plant → Plant Section → Equipment Tag/);
  assert.match(page, /Manage mine sites, plants, plant sections and equipment tags under Entity Management/);
});

test("Company Identity is labelled as ORAC-owned internal configuration, outside the client hierarchy", () => {
  assert.match(page, /ORAC-owned internal configuration/);
  assert.match(page, /ORAC's own record, not a client's/);
});
