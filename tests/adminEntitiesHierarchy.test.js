import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const page = read("src/pages/AdminEntitiesTab.jsx");

test("no raw parent-id text inputs remain for the hierarchy's foreign keys", () => {
  // These are exactly the raw-id text boxes the Chat H brief called out
  // (e.g. typing "c_zimplats" into a bare <input>). They must be gone.
  assert.doesNotMatch(page, /name="client_id"[^>]*<input/);
  for (const field of ["client_id", "mine_site_id", "plant_id", "plant_section_id"]) {
    const inputPattern = new RegExp(`<input[^>]*name="${field}"`);
    assert.doesNotMatch(page, inputPattern, `expected no raw <input name="${field}">`);
  }
});

test("every parent relationship is picked with the shared SearchableSelect component", () => {
  assert.match(page, /import SearchableSelect from "\.\.\/components\/SearchableSelect\.jsx";/);
  // One SearchableSelect wired to the current entity's parent field, reused
  // across mine_sites/plants/plant_sections/equipment_tags via config,
  // rather than four separate hand-rolled pickers.
  assert.match(page, /<SearchableSelect[\s\S]*?options=\{parentSelectOptions\}/);
  assert.match(page, /value=\{parentId\}/);
  assert.match(page, /onChange=\{setParentId\}/);
});

test("the parent picker filters to active parents but preserves the record's own (possibly inactive) current parent", () => {
  assert.match(page, /\.filter\(\(p\) => p\.is_active !== false \|\| p\.id === modal\.item\?\.\[currentConfig\.parentField\]\)/);
});

test("the hierarchy breadcrumb is shown via the shared ScopeTrail component", () => {
  assert.match(page, /import ScopeTrail from "\.\.\/components\/ScopeTrail\.jsx";/);
  assert.match(page, /<ScopeTrail/);
  assert.match(page, /HIERARCHY_CHAIN/);
  assert.match(page, /"Client", "Mine Site", "Plant", "Plant Section", "Equipment Tag"/);
});

test("table columns show readable hierarchy labels, not raw id columns", () => {
  assert.doesNotMatch(page, /"Client ID"/);
  assert.doesNotMatch(page, /"Mine Site ID"/);
  assert.doesNotMatch(page, /"Plant ID"/);
  assert.doesNotMatch(page, /"Plant Section ID"/);
  assert.match(page, /columns: \["Name", "Client", "Location", "Status", "Actions"\]/);
  assert.match(page, /columns: \["Name", "Mine Site", "Status", "Actions"\]/);
  assert.match(page, /columns: \["Name", "Plant", "Status", "Actions"\]/);
  assert.match(page, /columns: \["Tag Code", "Equipment Name", "Plant Section", "Status", "Actions"\]/);
});

test("every hierarchy entity carries a purpose explanation shown in the UI", () => {
  assert.match(page, /purpose: ".*mine or plant site/);
  assert.match(page, /purpose: ".*processing plant/);
  assert.match(page, /purpose: ".*functional section within a plant/);
  assert.match(page, /purpose: ".*tagged piece of equipment/);
  assert.match(page, /\{currentConfig\.purpose\}/);
});

test("there is no dead Status dropdown: status changes only via the audited Disable/Enable action", () => {
  // The backend never reads is_active from create/update bodies for these
  // collections, so an Active/Inactive <select> silently did nothing.
  assert.doesNotMatch(page, /<select[^>]*name="is_active"/);
  assert.doesNotMatch(page, /payload\.is_active/);
  assert.match(page, /New records start Active\./);
  assert.match(page, /Change this with Disable \/ Enable in the table; that action is recorded in the audit log\./);
});

test("deactivation effects are explained where the decision is made: in the confirmation dialog and the form", () => {
  assert.match(page, /function statusEffectNote/);
  assert.match(page, /can no longer be chosen as the parent for new/);
  // Confirm dialog carries the effect text for Disable, and a re-enable note.
  assert.match(page, /statusEffectNote\(currentConfig\)/);
  assert.match(page, /It becomes available for new links again\./);
  assert.match(page, /confirm\(`\$\{isActive \? "Deactivate" : "Reactivate"\} this record\?/);
  // ...and the same explanation is repeated in the edit form.
  assert.match(page, /\{statusEffect \? ` \$\{statusEffect\}` : ""\}/);
});

test("the equipment tag deactivation note matches what the server actually enforces", () => {
  // Server-side: new quotes (quoteController via validateEquipmentTagForClient),
  // client service requests (resolveOwnedReferences) and maintenance schedules
  // (equipmentTagProblem) all reject an inactive tag; historical records keep it.
  assert.match(page, /keeps it on historical quotes, dispatches, Timesheets and documents/);
  assert.match(page, /can no longer be linked to new quotes, service requests or maintenance schedules/);
});

test("an unresolved (orphan) parent link is visibly flagged, not silently blank", () => {
  assert.match(page, /parent_orphaned/);
  assert.match(page, /Orphan link/);
});

test("an inactive-but-linked parent is flagged distinctly from a healthy link", () => {
  assert.match(page, /Parent inactive/);
});

test("is_active is read defensively (missing/undefined still counts as active) everywhere it gates UI", () => {
  // Guards against the exact bug this patch fixes: `row.is_active ? X : Y`
  // silently treating an unset field as falsy/"Inactive".
  assert.doesNotMatch(page, /row\.is_active \? "Active" : "Inactive"/);
  assert.match(page, /row\.is_active !== false \? "Active" : "Inactive"/);
});

test("the table remains wrapped by the shared DataTable component (inherits horizontal scroll on narrow/mobile viewports)", () => {
  assert.match(page, /import DataTable from "\.\.\/components\/DataTable\.jsx";/);
  assert.match(page, /<DataTable/);
});

test("saving without a parent selected is blocked client-side with a clear message before any request is sent", () => {
  assert.match(page, /if \(currentConfig\.parentField && !parentId\)/);
  assert.match(page, /Select a \$\{currentConfig\.parentNoun\} before saving\./);
});

test("clients are named as part of the hierarchy even though they are managed on a separate tab", () => {
  assert.match(page, /Clients are managed from the Client Directory tab/);
});

test("scope: Operations is not pointed at a Client Directory tab it cannot see", () => {
  // AdminPage.jsx only shows Client Directory to Admin/Management, so the
  // hint must be role-aware rather than a blanket instruction.
  assert.match(page, /const canManageClients = \["Admin", "Management"\]\.includes\(user\.role\)/);
  assert.match(page, /Clients are managed by Admin or Management\./);
  const adminPage = read("src/pages/AdminPage.jsx");
  assert.match(adminPage, /const canManageClients = user\.role === "Admin" \|\| user\.role === "Management";/);
});

test("every entity is labelled with who owns it: client-owned hierarchy data vs ORAC's own internal configuration", () => {
  assert.match(page, /OWNERSHIP_LABEL/);
  assert.match(page, /ownership: "client"/);
  assert.match(page, /ownership: "orac"/);
  assert.match(page, /"Client-owned asset data"/);
  assert.match(page, /"ORAC-owned internal configuration"/);
});

test("no ORAC internal org-unit schema (branch/department/store) is invented in the entity forms or config", () => {
  // The source has no such schema, so the UI must not offer form fields or
  // parent pickers for one. Absence is recorded as an owner decision in the
  // packet's OWNER_DECISIONS.md, and noted in a code comment here.
  for (const invented of ["branch_id", "department_id", "store_id", "warehouse_id", "depot_id"]) {
    assert.doesNotMatch(page, new RegExp(invented), `unexpected invented field ${invented}`);
  }
  assert.match(page, /branch\/department\/store schema/);
  assert.match(page, /owner decision/i);
});

test("mobile: the layout stacks on narrow screens and the table scrolls horizontally instead of clipping", () => {
  // Side menu and content stack vertically below the md breakpoint.
  assert.match(page, /flex flex-col md:flex-row/);
  assert.match(page, /w-full md:w-64/);
  // The shared DataTable provides the horizontal-scroll wrapper.
  const dataTable = read("src/components/DataTable.jsx");
  assert.match(dataTable, /overflow-x-auto/);
  // The action button never wraps mid-label on a narrow header row.
  assert.match(page, /whitespace-nowrap/);
});

test("scope: catalog items (ORAC-owned pricing) stay restricted to Admin and Management, hidden from Operations", () => {
  assert.match(page, /const canManageCatalog = \["Admin", "Management"\]\.includes\(user\.role\)/);
  assert.match(page, /entity\.key !== "catalog_items" \|\| canManageCatalog/);
});
