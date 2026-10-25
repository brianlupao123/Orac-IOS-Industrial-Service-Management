import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("the shell owns the page width: header bar, main and footer share one 1440 px container (D: gutters kept)", () => {
  const layout = read("src/layouts/PortalLayout.jsx");
  assert.match(layout, /<div className="mx-auto flex w-full max-w-\[1440px\] items-center justify-between gap-2 px-[^"]*" style=\{\{ height: "72px" \}\}>/);
  assert.match(layout, /<main id="main-content" className="mx-auto w-full max-w-\[1440px\] flex-1 [^"]*pb-28 sm:pb-24">/);
  assert.match(layout, /max-w-\[1440px\] flex-col gap-2/);
  assert.doesNotMatch(layout, /max-w-7xl/);
});

test("non-protected pages no longer add their own outer width or padding wrapper", () => {
  for (const file of ["ContractorLogPage", "ContractsPage", "DocumentsPage", "KioskModePage", "LegacyHistoryPage", "OperationalDataPage"]) {
    const src = read(`src/pages/${file}.jsx`);
    assert.doesNotMatch(src, /className="(?:p-6 )?(?:mx-auto )?max-w-(?:6xl|7xl)(?: mx-auto)?(?: space-y-\d)?"/, `${file} still has an outer width wrapper`);
    assert.doesNotMatch(src, /className="p-6 max-w-/, `${file} still has an outer p-6 wrapper`);
  }
  // protected wrappers are intentionally untouched
  assert.ok(read("src/pages/DailyTimesheetPage.jsx").length > 0);
});

test("footer links and the Dashboard report link have a 44 px minimum height", () => {
  const layout = read("src/layouts/PortalLayout.jsx");
  assert.match(layout, /<a className="font-semibold[^"]*inline-flex min-h-\[44px\] items-center" href="https:\/\/oracsystems\.co\.zw"/);
  assert.match(layout, /<button type="button" onClick=\{onLogout\} className="font-semibold[^"]*inline-flex min-h-\[44px\] items-center">Sign out<\/button>/);
  assert.match(read("src/pages/DashboardPage.jsx"), /className="inline-flex min-h-\[44px\] items-center text-xs font-semibold text-orac-blue hover:underline shrink-0"\s+>\s+View report/);
});

test("the brand subtitle uses the theme accent token, not the logo cyan that is 2.84:1 on white", () => {
  const layout = read("src/layouts/PortalLayout.jsx");
  assert.match(layout, /text-xs font-semibold text-orac-accent">Operational Portal/);
  assert.doesNotMatch(layout, /text-orac-cyan/);
});
