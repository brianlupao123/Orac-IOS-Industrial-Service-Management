import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
// Public/auth pages are outside the operational console scope.
const PUBLIC = new Set(["LandingPage.jsx", "LoginPage.jsx", "ForgotPassword.jsx", "ResetPassword.jsx", "RequestAccess.jsx"]);
const pages = readdirSync(new URL("../src/pages/", import.meta.url)).filter((f) => f.endsWith(".jsx") && !PUBLIC.has(f));

test("TabNav implements the WAI-ARIA tabs pattern", () => {
  const src = read("src/components/TabNav.jsx");
  for (const re of [/role="tablist"/, /role="tab"/, /aria-selected=\{selected\}/, /aria-controls=/, /tabIndex=\{selected \? 0 : -1\}/, /"ArrowRight"/, /"ArrowLeft"/, /"Home"/, /"End"/, /focus-visible:ring/]) {
    assert.match(src, re);
  }
  assert.match(src, /className="orac-tab-nav flex w-full gap-1 overflow-x-auto/);
});

test("Administration and Inventory tab workspaces use TabNav with a labelled tabpanel", () => {
  for (const file of ["src/pages/AdminPage.jsx", "src/pages/InventoryPage.jsx"]) {
    const src = read(file);
    assert.match(src, /<TabNav\b/, file);
    assert.match(src, /role="tabpanel"/, file);
    assert.match(src, /aria-labelledby=\{`tab-\$\{activeTab\}`\}/, file);
    assert.doesNotMatch(src, /border-b-2/, `${file} must not keep a bespoke underline tab strip`);
  }
});

test("no page uses decorative all-caps or letter-spaced labels", () => {
  for (const file of pages) {
    const src = read(`src/pages/${file}`);
    assert.doesNotMatch(src, /\buppercase\b/, `${file} uses uppercase`);
    assert.doesNotMatch(src, /\btracking-(tight|tighter|wide|wider|widest)\b/, `${file} uses letter spacing`);
  }
  for (const file of ["StatCard", "ScopeTrail", "AttentionBand", "DataTable"]) {
    assert.doesNotMatch(read(`src/components/${file}.jsx`), /\buppercase\b|\btracking-/, file);
  }
});

test("no sub-12px arbitrary text sizes and no faded opacity text in shared components", () => {
  for (const file of ["StatCard", "ScopeTrail", "AttentionBand", "DataTable", "PageHeaderBanner", "Modal", "IconStatCard"]) {
    const src = read(`src/components/${file}.jsx`);
    assert.doesNotMatch(src, /text-\[(9|10|11)px\]/, file);
  }
  assert.doesNotMatch(read("src/components/StatCard.jsx"), /opacity-(50|60)/);
});

test("Administration form labels, buttons and table text are at least 14px", () => {
  for (const file of ["src/pages/AdminPage.jsx", "src/pages/AdminAccessRequestsPage.jsx", "src/pages/InventoryPage.jsx"]) {
    const src = read(file);
    assert.doesNotMatch(src, /<label[^>]*text-xs/, `${file} has a 12px label`);
    assert.doesNotMatch(src, /<button[^>]*text-xs/, `${file} has a 12px button`);
  }
});

test("DataTable exposes scope=col headers, a toolbar slot, a count badge and row scanning aid", () => {
  const src = read("src/components/DataTable.jsx");
  assert.match(src, /<th key=\{i\} scope="col"/);
  assert.match(src, /toolbar/);
  assert.match(src, /count !== undefined/);
  assert.match(src, /nth-child\(even\)/);
});

test("Modal is size-aware, keeps md default, labels its close button and scrolls internally", () => {
  const src = read("src/components/Modal.jsx");
  assert.match(src, /size = "md"/);
  assert.match(src, /aria-label="Close dialog"/);
  assert.match(src, /overflow-y-auto/);
});

test("shell provides a skip link and a main landmark target", () => {
  const src = read("src/layouts/PortalLayout.jsx");
  assert.match(src, /href="#main-content"/);
  assert.match(src, /<main id="main-content"/);
});

test("AttentionBand only shows attention from a caller-supplied flag", () => {
  const src = read("src/components/AttentionBand.jsx");
  assert.match(src, /item\.attention/);
  assert.match(src, /role="list"/);
  // Administration passes no attention flag: no invented business rule.
  assert.doesNotMatch(read("src/pages/AdminPage.jsx"), /attention:/);
});

test("Administration search is client-side only and adds no new API calls", () => {
  const src = read("src/pages/AdminPage.jsx");
  assert.match(src, /useMemo/);
  const calls = (src.match(/admin\.\w+|collections\.\w+/g) || []).sort();
  assert.deepEqual([...new Set(calls)], ["admin.createClient","admin.createUser","admin.deactivateEntity","admin.getCompanyProfile","admin.reactivateEntity","admin.updateClient","admin.updateCompanyProfile","admin.updateUser","collections.list"]);
});

test("Chat G/H boundaries: clear inventory movement rules and entity config are preserved", () => {
  const inv = read("src/pages/InventoryPage.jsx");
  assert.match(inv, /<option value="in">Receipt \(increases stock\)<\/option>/);
  assert.match(inv, /override_negative: form\.override_negative/);
  assert.match(inv, /needsReorder = i\.quantity_on_hand <= i\.reorder_level/);
  assert.match(read("src/pages/AdminEntitiesTab.jsx"), /aria-current=\{activeEntity === ent\.key \? "page" : undefined\}/);
});
