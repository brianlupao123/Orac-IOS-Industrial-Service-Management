import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("../", import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), "utf8");

// text-orac-slate/-navy/-ink resolve to real hex colors (#00488C / #0B0F19) that are
// NOT remapped by index.css's html[data-theme="dark"] overrides (only .text-orac-blue
// is). Any of these three classes reappearing on Chat 5's owned admin/client/assistant
// surfaces would silently reintroduce near-invisible text in dark mode.
const CHAT5_OWNED_FILES = [
  "src/pages/AdminPage.jsx",
  "src/pages/AdminAccessRequestsPage.jsx",
  "src/pages/AdminAnalyticsPage.jsx",
  "src/pages/AdminEntitiesTab.jsx",
  "src/pages/ClientPortalPage.jsx",
  "src/pages/AccessDeniedPage.jsx",
  "src/components/AIAssistantPanel.jsx",
  "src/components/PageStates.jsx",
];

for (const file of CHAT5_OWNED_FILES) {
  test(`${file} does not use the dark-mode-invisible orac-slate/orac-navy/orac-ink text tokens`, () => {
    const src = read(file);
    assert.doesNotMatch(src, /text-orac-slate\b/, "text-orac-slate is not remapped in dark mode - use text-orac-blue instead");
    assert.doesNotMatch(src, /text-orac-navy\b/, "text-orac-navy is not remapped in dark mode - use text-orac-blue instead");
    assert.doesNotMatch(src, /text-orac-ink\b/, "text-orac-ink is not remapped in dark mode - use text-orac-blue/hover:underline instead");
  });
}

// Any red/amber/green/emerald/sky/slate *light pastel* tint (bg-*-50/100/200/300,
// text-*-600/700/800/900, border-*-100/200/300) used for status, warning, error or
// badge styling on these owned files must carry a dark: companion, since Tailwind's
// dark: variant is live here (ThemeToggle toggles the "dark" class) but none of these
// palettes are covered by the global CSS override map. Solid dark fills used as button
// backgrounds (e.g. hover:bg-slate-700/800 on a white-text button, or the slate-950
// modal backdrop) are intentionally excluded - those already work in both themes.
const SEMANTIC_TINT_PATTERN = /\b(?:bg|border)-(?:red|amber|green|emerald|sky|slate)-(?:50|100|200|300)\b|\btext-(?:red|amber|green|emerald|sky|slate)-(?:600|700|800|900)\b/g;

for (const file of CHAT5_OWNED_FILES) {
  test(`${file} pairs every semantic tint utility with a dark: variant on the same class string`, () => {
    const src = read(file);
    // Pull out class attribute contents (className="..." or backtick template literals)
    const classBlocks = src.match(/className=\{?`?"?[^">`]*(?:red|amber|green|emerald|sky|slate)-(?:50|100|200|300|700|800|900|950)[^">`]*"?`?\}?/g) || [];
    for (const block of classBlocks) {
      const hasTint = SEMANTIC_TINT_PATTERN.test(block);
      SEMANTIC_TINT_PATTERN.lastIndex = 0;
      if (hasTint) {
        assert.match(block, /dark:/, `expected a dark: companion class near: ${block.slice(0, 120)}`);
      }
    }
  });
}

test("AdminEntitiesTab row actions are reachable without a mouse (not opacity-0)", () => {
  const src = read("src/pages/AdminEntitiesTab.jsx");
  assert.doesNotMatch(src, /opacity-0 group-hover:opacity-100/, "Edit/Disable/Enable must stay dimly visible (opacity-70) and reveal on keyboard focus, not only mouse hover");
  assert.match(src, /group-focus-within:opacity-100/);
});

test("AdminAnalyticsPage error state no longer leaks an internal backend filename to end users", () => {
  const src = read("src/pages/AdminAnalyticsPage.jsx");
  assert.doesNotMatch(src, /reportsController\.js/);
  assert.doesNotMatch(src, /reportGuards/);
});

test("AdminAccessRequestsPage and AdminAnalyticsPage reuse the shared ErrorBanner instead of ad hoc red paragraphs", () => {
  for (const file of ["src/pages/AdminAccessRequestsPage.jsx", "src/pages/AdminAnalyticsPage.jsx", "src/pages/AdminEntitiesTab.jsx"]) {
    const src = read(file);
    assert.match(src, /import \{ ErrorBanner \} from "\.\.\/components\/PageStates\.jsx"/, `${file} should import the shared ErrorBanner`);
    assert.match(src, /<ErrorBanner message=/, `${file} should render ErrorBanner for its error state`);
  }
});

test("AdminAccessRequestsPage history table has an explicit empty state and uses StatusBadge", () => {
  const src = read("src/pages/AdminAccessRequestsPage.jsx");
  assert.match(src, /No decided requests yet\./);
  assert.match(src, /<StatusBadge status=\{r\.status\}/);
});

test("PageStates ErrorBanner and PageEmptyState keep their evidence selectors", () => {
  const src = read("src/components/PageStates.jsx");
  assert.match(src, /data-evidence="page-error-state"/);
  assert.match(src, /data-evidence="page-empty-state"/);
});

test("SessionExpiredBanner keeps its amber warning semantics and gains a dark: companion", () => {
  const src = read("src/components/SessionExpiredBanner.jsx");
  assert.match(src, /bg-amber-50/);
  assert.match(src, /dark:bg-amber-950\/30/);
});
