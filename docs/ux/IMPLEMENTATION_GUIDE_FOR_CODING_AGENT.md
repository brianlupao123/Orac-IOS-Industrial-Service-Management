# ORAC-IOS Frontend: Implementation Guide for the Coding Agent

> **Update 5 Nov 2026.** This guide is partly superseded by `docs/ux/SDLC_MASTER_PLAN.md` and `docs/ux/AGENT_PROMPTS.md`. The shell, header and tokens (Phases 1 and 3) are already implemented in the real code; do not redo them. Decision D5 (currency "R") is replaced by UXD-4: the portal is USD-only, so use `$` through one shared formatter. Everything else here still applies.


Apply the approved UI/UX redesign to the real codebase (`orac-ios-frontend`, React 18 + Vite + Tailwind 3.4). This is a **presentation-only** change.

**Attach to the agent's context:** `DESIGN_SYSTEM_SPEC.md` (what to build), `ORAC_UI_MOCKUP.html` v3.1 (open it in a browser to see the target; use the toolbar for role, Desktop/Tablet/Mobile, Light/Dark, Density and the *Design system reference* screen), `PRIORITIZED_IMPROVEMENTS.md` and `ROLE_BY_ROLE_FINDINGS.md` (the original findings).

**How this guide was made.** I read the frontend source in the review packet (components, layout, `index.css`, `tailwind.config.js`, tests, `MAINTAINER_GUARDRAILS.md`). I did **not** run the app or the tests, so every claim about current code below must be re-checked by the agent before editing. Decisions D1 to D7 (section 2) are **resolved with defaults** (confirmed on 2026-10-28 by "proceed"); a human can change any of them.

---

## 0. Prompt to paste at the top of the agent session

> You are implementing a visual redesign in `orac-ios-frontend`. Read `IMPLEMENTATION_GUIDE_FOR_CODING_AGENT.md` fully, then `DESIGN_SYSTEM_SPEC.md`. Work in the phases of the guide, one commit per phase. Presentation only: do not change routes, permissions, API calls, workflows or business rules, and do not edit the guarded files listed in section 1. Before editing a file, read it. After every phase run `npm test` and `npm run maintain`. If a test fails because it encodes the old styling, stop and ask (section 3) instead of weakening it. Decisions D1 to D7 are settled in section 2: follow the stated decision, and stop and ask only if what you find in the code contradicts it. Do not claim anything is verified without showing the command output or screenshot.

---

## 1. Hard rules

**Do not edit** (separate implementation stream, per `docs/EXTERNAL_UX_PROMPT.md`):
- `src/App.jsx`, `src/accessPolicy.js`, `src/api/client.js`, anything in the backend
- The Timesheet and quotation business pages. In this repo that means at least `pages/WorksheetsPage.jsx`, `DailyTimesheetPage.jsx`, `ContractorLogPage.jsx`, `TimesheetWorkflowPage.jsx`, `QuotationsPage.jsx`, the three `*PrintPage.jsx` files, and their direct panels (`TimesheetFormModal`, `TimesheetOutboxPanel`, `PeriodPackPanel`, `SignaturePad`, `ClientAcknowledgementPanel`, `WorksheetEvidence`). If unsure whether a file counts, treat it as guarded and list it in the PR for a human.
- Shared components are **allowed** (`StatCard`, `IconStatCard`, `DataTable`, `StatusBadge`, …) but guarded pages that use them will change appearance. Say so in the PR.

**Also never:**
- Add features (no header search, no new settings screens, no density *toggle UI*, no new offline detection, no new API calls).
- Hard-code role names in the layout, or replace server-side RBAC with hiding (`MAINTAINER_GUARDRAILS.md`).
- Change the product name, the logo file `public/images/orac-systems-logo.png`, or the default (light on first visit) theme behaviour.
- Use `tracking-*`, `uppercase`, text under 12 px, or `opacity-50/60` text in shared components (the tests forbid these).
- Mix **Field Worksheet** and **Timesheet** wording (guardrail).

**Before each commit:** `npm test` and `npm run maintain` (tests, production build, whitespace check, product-name guard). Fix failures in the code, not by editing tests, unless section 3 says the test encodes the old design.

---

## 2. Decisions (resolved with defaults; change any before the agent starts if you disagree)

No individual answers were given, so each decision below is the default and is **in force**. The agent follows the decision column.

| # | Question | Decision |
|---|---|---|
| D1 | `MAINTAINER_GUARDRAILS.md` says brand navy `#004088`, gear blue `#3890D8`, dark `#080838`, but the code uses `#00488C`, `#2FA2E3`, `#0B0F19` (`tailwind.config.js`, `index.css`). Which is right? | **Keep the code values** (`#00488C`, `#2FA2E3`, `#0B0F19`). Change nothing. Report the mismatch in the PR so a human can fix the guardrails file or the code. |
| D2 | The header "Online" pill is asserted by `typographyReadability.test.js` (`text-xs font-bold text-emerald-700`). The mockup replaced it with an offline bar. A real offline bar needs online/offline detection, which is new behaviour. | **Keep the pill** (restyled, shown only from `xl` up). No offline bar. The mockup's offline bar is a possible later feature that needs real online/offline detection and approval. |
| D3 | The standalone top-level "Sign out" button duplicates the one in the avatar menu, and uses the space the nav needs. `chat2ShellAndDashboardHierarchy.test.js` asserts it exists (`lg:inline-flex`). | **Remove it** and update that test to assert exactly one top-level sign-out affordance (the avatar dropdown). State this test change in the PR. |
| D4 | Move `ThemeToggle` into the avatar menu (as in the mockup)? It needs edits to `UserProfileDropdown`. | **Keep `ThemeToggle` in the header**, as a 44 px icon button (36 px if space is tight). Do not edit its storage logic. |
| D5 | Currency: the mockup uses "R" everywhere. `DashboardPage` already does `R ${…}`; `quoteModel.formatAmount` has no symbol. | **Use "R"** via one shared formatter in a new `src/lib/formatMoney.js`. It is an assumption taken from the screenshots (the portal mixed "$" and "R"); the business should confirm the currency before release. |
| D6 | Tiles currently tinted `blue` and `green` on non-urgent counts (e.g. Admin). The design tints only when action is needed. | **Keep each page's tone choice**, restyle to semantic tokens, and list the non-urgent `blue`/`green` tiles as candidates for a human to retone. Do not retone them yourself. |
| D7 | Tile count vs label hierarchy (label leads, count 28 px quieter) was a stakeholder preference. | **Implement as specified** (label leads, count supports). If a finance or summary screen reads badly this way, report it with a screenshot instead of reversing it. |

---

## 3. Existing tests that protect the files you will change

These are **source-string assertions**. Keep each string, or change the test only where marked and say why in the PR.

**`tests/typographyReadability.test.js`**
- `index.css` keeps `font-family: ui-sans-serif`, `font-size: 16px`, `line-height: 1.5`, `letter-spacing: 0 !important`.
- `PortalLayout.jsx`: no `text-[9px|10px]`, no `tracking-`; contains `text-base font-bold text-orac-slate` and `text-xs font-bold text-emerald-700` (**D2**).
- `DataTable.jsx`: contains `rounded-lg`; no `rounded-xl`, `tracking-`, `uppercase`; contains `text-left text-sm font-semibold text-gray-600`.

**`tests/chat2ShellAndDashboardHierarchy.test.js`**
- Layout imports `visibleNavigationGroups` from `../accessPolicy.js` and calls `visibleNavigationGroups(user.role)`; no role names in quotes.
- No `hover:text-orac-navy`; no `className="font-semibold text-orac-navy`; must contain `hover:text-orac-text-primary` and `className="font-semibold text-orac-blue` (footer link).
- Must contain `bg-gray-50/70` and not `bg-gray-50/60`. The one-row header removes the second nav row that used `/70`. **Update this assertion** to only forbid `/60` (intent: no opacity variant without a dark-mode override). Mark as a deliberate test change.
- Sign-out button regex (**D3**). `<UserProfileDropdown user={user} onSignOut={onLogout} />` must stay exactly.
- Dashboard order: `evidence-section-role-priorities` before `evidence-kpi-clients`; assistant after worksheets. Do not reorder or rename `id`/`data-evidence*` attributes anywhere (UAT evidence tooling depends on them).

**`tests/groupedNavigation.test.js`**
- Layout keeps `aria-haspopup="menu"`, `aria-expanded={isOpen}`, `role="menu"`, `role="menuitem"` and `group.items.length === 1`.

**`tests/chatFOperationsConsole.test.js`**
- `StatCard`, `ScopeTrail`, `AttentionBand`, `DataTable`: no `uppercase` or `tracking-`.
- Shared components: no `text-[9|10|11px]`; `StatCard` has no `opacity-50/60`.
- `DataTable`: `<th key={i} scope="col"`, a `toolbar` slot, `count !== undefined`, `nth-child(even)`.
- `AttentionBand`: `item.attention`, `role="list"`; `AdminPage` must not contain `attention:`.
- Layout has `href="#main-content"` and `<main id="main-content"`. `TabNav` keeps the WAI-ARIA tabs pattern.

**`tests/uatStateGate.test.js`**: `DataTable` keeps `data-evidence="table-empty-state"`.

**Others to run and read if they fail:** `darkModeTokenCoverage.test.js`, `chat5AdminAssistantDarkMode.test.js`, `adminEntitiesHierarchy.test.js` (DataTable horizontal scroll wrapper stays), `reportsStructuredViews.test.js`.

---

## 4. Phases

Each phase is independently shippable and reversible. Do them in order.

### Phase 0: Baseline (no code changes)
1. `npm ci`, `npm test`, `npm run maintain`. Record the results. If anything fails before you start, stop and report.
2. Capture "before" screenshots (light and dark) at **1440, 1024, 768, 390 px** for each role's dashboard, Inventory, Admin and Client Portal, using the repo's existing Playwright/screenshot tooling in `scripts/` (look there first; do not invent credentials, use the documented fixture/UAT accounts only). Save under a new `docs/redesign-before/` folder outside `src`.

### Phase 1: Tokens (invisible by itself)
**`tailwind.config.js`** (extend, never replace; Tailwind's default 4 px spacing, `rounded-lg` 8 px, `rounded-xl` 12 px, `h-11` 44 px already match the spec):
```js
theme: { extend: {
  fontSize: { stat: ["1.75rem", { lineHeight: "1.2" }] },   // 28px tile counts -> class `text-stat`
  maxWidth: { page: "1440px" },                              // -> class `max-w-page`
  colors: { orac: { /* existing tokens stay */ } }
}}
```
**`src/index.css`**: add after the colour tokens (keep every existing token and the dark-mode bridge):
```css
:root {
  --orac-cell-y: 16px;  --orac-cell-x: 24px;     /* table cell padding, comfortable */
  --orac-motion: 160ms ease-out;
}
html[data-density="compact"] { --orac-cell-y: 12px; --orac-cell-x: 16px; }
```
Do not add a UI to set `data-density` (D: out of scope). The attribute is only a hook for a later approved setting.

**Acceptance:** build passes, no visual change.

### Phase 2: Shared components (largest visible gain, lowest risk)

**2a. Tile hierarchy: `IconStatCard.jsx`, `StatCard.jsx`, `AttentionBand.jsx`** (D7)
Target: the **label leads** (18 px bold, primary text); the **count supports** (28 px, weight 600, secondary text) and turns amber or red only when the tone says action is needed. Zero stays neutral (keep the existing zero rule in `IconStatCard`).

`IconStatCard.jsx`, replace the tone map and the text lines:
```jsx
const TONES = {
  neutral: { box: "border-orac-border-default bg-orac-surface",                      count: "text-orac-text-secondary" },
  blue:    { box: "border-orac-info-border bg-orac-info-bg",                          count: "text-orac-info-text" },
  green:   { box: "border-orac-success-border bg-orac-success-bg",                    count: "text-orac-success-text" },
  amber:   { box: "border-orac-warning-border bg-orac-warning-bg border-l-4",         count: "text-orac-warning-text" },
  red:     { box: "border-orac-danger-border bg-orac-danger-bg border-l-4",           count: "text-orac-danger-text" },
};
const tone = TONES[resolvedTone] || TONES.neutral;
// container:  `w-full rounded-xl border p-5 text-left shadow-sm transition-all duration-200 ${tone.box} ...`  (was rounded-lg)
<p className="text-lg font-bold text-orac-text-primary">{label}</p>
<p className={`mt-1.5 text-stat font-semibold tabular-nums ${tone.count}`}>{value}</p>
{subtitle && <p className="mt-2 text-sm leading-5 text-orac-text-secondary">{subtitle}</p>}
```
Keep: the `onClick` button behaviour, `evidenceTarget` / `data-evidence-target`, the zero-is-neutral rule and its comment. Icon chip: `h-11 w-11 rounded-lg border border-orac-border-default bg-orac-canvas text-orac-accent`. "View details →" line: first `grep -rn "View details" tests src`. If no test depends on it, drop it (the tile is the button; `aria-label` not needed because the label is the text). If a test depends on it, keep it and report.

`StatCard.jsx`: same hierarchy (`text-lg font-bold text-orac-text-primary` label, `text-stat font-semibold` count), same semantic tone map (its tones are `slate|blue|amber|green|red`). Keep its `icon` prop as a node (the guarded `WorksheetsPage` passes emoji; do not edit that page, list it as a follow-up).
Do not add `opacity-50/60`.

`AttentionBand.jsx`: label `text-base font-bold text-orac-text-primary` (was `text-sm font-semibold text-gray-600`); count `text-xl font-semibold tabular-nums text-orac-text-secondary` (was `text-2xl … text-gray-900`). Attention rows: `border-l-4 border-orac-warning-border bg-orac-warning-bg`, count `text-orac-warning-text`, replacing the raw `amber-*`/`dark:` classes. Keep `item.attention` and `role="list"`.

**Optional dedupe (separate commit, ask first):** `StatCard`, `IconStatCard` and `AttentionBand` are three copies of one idea. Make `IconStatCard` the single implementation and have `StatCard` render it. Only do this if tests stay green.

**2b. `DataTable.jsx`**
Keep every asserted string (section 3). Changes:
- Outer: `rounded-lg border border-orac-border-default bg-orac-surface shadow-sm` (was `border-gray-100 bg-white`).
- Title row: `bg-orac-surface-muted` replaces `bg-gray-50/30`; title `text-lg font-semibold text-orac-text-primary`.
- `<thead>`: `bg-orac-surface-muted`; keep `text-left text-sm font-semibold text-gray-600` on the `<tr>` exactly as the test needs.
- Density hook for cells (pages own their `<td>` classes, so drive padding from the table):
  `<table className="w-full text-sm [&_th]:px-[var(--orac-cell-x)] [&_th]:py-3 [&_td]:px-[var(--orac-cell-x)] [&_td]:py-[var(--orac-cell-y)]">`
- Row hover: add `[&>tr:hover]:bg-orac-surface-muted` to the existing `<tbody>` class list (keep `nth-child(even)` and the border classes).
- Empty state: keep `data-evidence="table-empty-state"`; text `text-sm font-medium text-orac-text-secondary`.
- Mobile: keep the `overflow-x-auto` wrapper (a test relies on it).

**2c. `StatusBadge.jsx`**
- Keep `statusLabel(status)` (it produces readable text) and the `STATUS_MAP` keys.
- Replace raw colour classes with semantic tokens so light and dark both work without the bridge, e.g. warning: `bg-orac-warning-bg text-orac-warning-text border border-orac-warning-border`; success, danger, info likewise; neutral: `bg-orac-surface-muted text-orac-text-secondary border border-orac-border-default`.
- Size: `px-3 py-1 text-sm font-semibold`, add a 6 px dot: `before:mr-2 before:inline-block before:h-1.5 before:w-1.5 before:rounded-full before:bg-current` with `inline-flex items-center`.
- Do not change which statuses map to which tone unless a human asks (the review suggested "Active" as info; leave it).

**2d. `PageHeaderBanner.jsx`**
- Container: `rounded-xl border border-orac-border-default border-l-4 border-l-orac-accent bg-orac-surface px-5 py-5 shadow-sm sm:px-7 sm:py-6`.
- Title: `text-2xl font-bold text-orac-accent` (remove `sm:text-3xl`; page title is 24 px). Eyebrow `text-sm font-semibold text-orac-text-secondary`.
- Icon chip `h-14 w-14 rounded-2xl border border-orac-info-border bg-orac-canvas text-orac-accent`.
- Keep the props API (`eyebrow, title, subtitle, iconPath, aside, meta, className`).

**2e. `PageStates.jsx`**: add exports `Skeleton` and `PageSkeleton` (shimmer blocks: `animate-pulse rounded bg-orac-surface-muted`) mirroring the mockup's "Simulate loading". Do not wire them into data fetching; only replace existing "Loading…" text where a component already has a loading flag, and only in non-guarded pages.

**Acceptance (phase 2):** `npm test` green; tiles show label first and count second in light and dark; dark-mode screenshots show no unreadable tinted tiles; no new `text-[…px]` under 12 px.

### Phase 2b: Page-content uniformity primitives

Before touching pages, build the Button, FormField/inputClass, Panel, SectionHeading and Notice primitives and the ratchet test exactly as described in `PAGE_CONTENT_UNIFORMITY_PLAN.md`. Phase 5 migrates pages onto them.

### Phase 3: Shell (`layouts/PortalLayout.jsx`) and the one-row header

Target (see mockup): one 72 px bar, **brand | labelled navigation spread evenly | account**. No icon-only state. Below 900 px the top nav is replaced by a labelled bottom tab bar (Phase 4).

1. **Structure:** merge the two rows into one:
```jsx
<header className="sticky top-0 z-20 border-b border-orac-border-default bg-orac-surface shadow-sm">
  <div className="mx-auto flex h-[66px] min-[900px]:h-[72px] w-full max-w-page items-center gap-2 px-4 sm:px-6 lg:px-7">
    {/* brand: keep the SVG, `text-base font-bold text-orac-slate` for the name (test), hide subtitle lines below xl */}
    <nav aria-label="Primary" className="hidden min-w-0 flex-1 items-center justify-evenly px-3 min-[900px]:flex">
      {navGroups.map((g) => <WorkspaceNavMenu key={g.id} group={g} pathname={location.pathname} />)}
    </nav>
    <div className="ml-auto flex shrink-0 items-center gap-2">{/* Online pill (D2), ThemeToggle (D4), NotificationBell, UserProfileDropdown */}</div>
  </div>
</header>
```
   `justify-evenly` is what spreads the items equally across the free space; do not use `gap-1` and left alignment as today (the cause of the bunched look).
2. **Nav item** (both the single-item `NavLink` and the group button), keep all ARIA and the `group.items.length === 1` branch:
   `inline-flex h-[46px] items-center gap-2 whitespace-nowrap rounded-xl px-3 min-[1100px]:px-4 text-base font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orac-focus-ring`
   - Selected: `bg-orac-accent-strong text-white` (white text on navy, per guardrail). Unselected: `text-orac-text-secondary hover:bg-orac-surface-muted hover:text-orac-text-primary` (keep `hover:text-orac-text-primary`, the test needs it).
   - Replace the literal `v` character with an inline SVG chevron (`aria-hidden`), rotating when `isOpen`.
   - **Text labels only, no icons** in the top nav.
3. **Dropdown menu panel:** `rounded-xl border border-orac-border-default bg-orac-surface p-2 shadow-lg`, items `min-h-[44px]`, move focus to the first `menuitem` when it opens, keep Escape handling.
4. **Responsive hide rules** (viewport breakpoints in the real app; the mockup used container widths): brand name and subtitle hide below `min-[1150px]` (logo stays); account name chip only from `min-[1300px]` (see Phase 3 step 6); Online pill only from `xl`.
5. **Sign-out and tests:** apply **D3**.
6. **`UserProfileDropdown.jsx`** (not guarded): keep the avatar button and menu. Add, visible from `min-[1300px]`, a name + role line beside the avatar (`user.name || user.email`, `user.role`), 16 px / 14 px. Keep `title`, keep the menu contents. Make the avatar `h-11 w-11` and the menu items `min-h-[44px]`.
7. **Content frame:** wrap children once so every page shares one edge:
   `<main id="main-content" className="flex-1"><div className="mx-auto w-full max-w-page px-4 py-6 pb-28 sm:px-6 lg:px-7">{children}</div></main>`
   (`pb-28` leaves room for the floating assistant and the mobile tab bar.)
8. **Assistant launcher:** in `AiAssistant.jsx` and `AIAssistantPanel.jsx` change the launcher from `bottom-6` to `bottom-24 min-[900px]:bottom-6` so it never sits on the tab bar. Keep everything else.

**Acceptance (phase 3):** at 1440, 1280, 1100, 1024 and 950 px, for the Operations, Management and Admin roles, nav items are labelled, gaps between items are equal, nothing overlaps the bell or avatar, and the header has no horizontal overflow. Check with a Playwright script that measures item gaps (see the checks in section 6). All tests in section 3 green or deliberately updated.

### Phase 4: Mobile and tablet navigation
New component `src/components/MobileTabBar.jsx`, rendered by `PortalLayout` below 900 px only (`min-[900px]:hidden`), fed by the **same** `navGroups` (no new routes, no new policy):
- Fixed bottom bar, `grid-flow-col auto-cols-fr`, each tab `min-h-[58px]`, icon (from `components/icons.jsx`) **plus a text label** (use short labels: map `Internal Requests` to `Requests`, `Field Work` to `Field work`, `Client Portal` to `Portal` locally; do not rename routes).
- A group with several items opens a **sheet** above the bar listing its items as `role="menu"`/`menuitem` links; a single-item group is a direct `NavLink`.
- Selected tab: `bg-orac-info-bg text-orac-accent` with `aria-current="page"`. Safe-area padding: `pb-[max(10px,env(safe-area-inset-bottom))]`.
- Show at most five tabs. In the review every role had 2 to 5 navigation groups, but count them from `visibleNavigationGroups` for each role; if a role has more than five, put the rest under a final "More" sheet.
- Labels 12 px minimum (the guide uses `text-xs`); do not use text under 12 px.

**Acceptance:** at 390 and 768 px every role shows a labelled tab bar; the guide button sits above it; nothing is cut off; keyboard: Tab reaches each tab and `Esc` closes the sheet.

### Phase 5: Pages (only non-guarded pages)

Follow the migration order and per-page recipe in `PAGE_CONTENT_UNIFORMITY_PLAN.md`; use the Phase 2b primitives instead of raw classes.

Go page by page. For each: read it, make the smallest change, run the tests, screenshot.

1. **One content width.** The shell now owns width. Remove page-level outer wrappers that fight it. Found in the packet:
   - `p-6 max-w-6xl mx-auto` in `ContractorLogPage`, `DailyTimesheetPage` (**guarded: list only**)
   - `p-6 max-w-7xl mx-auto` in `LegacyHistoryPage`, `WorksheetRegisterPage` (register is timesheet-related: **guarded**; do `LegacyHistoryPage` only)
   - `mx-auto max-w-7xl space-y-6` in `OperationalDataPage`
   Replace with `space-y-6`. Login, landing, forgot/reset/request-access pages are outside the shell: leave them.
2. **Status text.** One component for status. Replace the local look-alikes with `StatusBadge`: `statusTone`/`statusLabel` pill in `ServiceRequestTriagePage`, `InternalRequestCard` (prints raw `view.status`), the inline `r.status` text in `InventoryPage` (reconciled / needs attention: keep wording, use the badge look), `{contract.status}` text in `ContractsPage`. Do not change wording that tests assert; run the suite. `KioskModePage` prints `{j.status}` in an `<option>`: a `<select>` option cannot hold a badge, so pass it through `statusLabel()` only if the Kiosk page is not guarded (it is timesheet-adjacent: list it).
3. **Currency.** Create or reuse one formatter (put it in a new `src/lib/formatMoney.js`, do not edit the guarded model files): `R 1,234.50`, 2 decimals, `tabular-nums`. Replace `R ${Number(x).toLocaleString()}` in `DashboardPage` and any `$` usage found by: `grep -rnE "\\$\\s?\\{|toFixed\\(2\\)|toLocaleString" src/pages src/components`. Do not touch `quoteModel.js`/`financeModel.js` (guarded/business); report where they differ. **D5.**
4. **Emoji icons.** (needs a UTF-8 locale) `grep -rnP "[\x{2190}-\x{27BF}\x{1F300}-\x{1FAFF}]" src --include=*.jsx`. Replace UI emoji with the line icons in `components/icons.jsx` (add paths there if missing). `WorksheetsPage` uses emoji via `StatCard icon="✏️"`: guarded, list it.
5. **Tile tones (D6).** Do not change any page's `tone=` choice. List the tiles that use `blue` or `green` for non-urgent counts (for example in `AdminPage`) in the PR as candidates for a human to set to `neutral`. Keep the existing zero-is-neutral rule.
6. **Mobile overflow.** Inventory and Client Portal overflowed sideways at 390 px. Wrap wide tables in `DataTable` (it scrolls) or add `overflow-x-auto` on the immediate parent. Verify no horizontal page scroll (check in section 6).
7. **Admin:** make "Disable" visibly destructive (`text-orac-danger-text`) and separated from "Edit" (`gap-4`). Do not change handlers or confirm flows.
8. **Inventory:** explain only the row that needs reordering (existing text); keep the movement form logic. Making the form collapsible is optional and only if the form's state and tests are unaffected.
9. **Forms (shared look).** Inputs `min-h-[44px] text-base rounded-lg border border-orac-border-strong bg-orac-canvas px-3.5`, labels above at `text-sm font-semibold`, errors with an icon and `aria-describedby`. Many pages build fields inline; do this only where a page already uses a shared field helper (`Field` in `ContractsPage`), otherwise leave the markup and note it.
10. **Clickable rows.** Optional. Only where the page already has a row link: make the primary link a stretched link (`after:absolute after:inset-0` with `relative` on the `<tr>`), keep the existing `<a>` so keyboard and screen-reader behaviour is unchanged.

### Phase 6: Documents (quotations, invoices, PDFs)
- Quote, invoice, PO, job card and worksheet **PDFs are generated by the backend** (`/documents/...pdf` in `api/client.js`). The frontend cannot restyle them. Give section 6 of `DESIGN_SYSTEM_SPEC.md` and the "Quotation & invoice documents" screen of the mockup to the backend owner (`C:\deploy-backend`).
- Frontend print pages (`DailyTimesheetPrintPage`, `ContractorLogPrintPage`, `WorksheetRegisterPrintPage`) are guarded. List them; do not edit.
- `DocumentsPage` is a download list built on `DataTable` and inherits Phase 2. Only change its outer wrapper (`border-y border-slate-200 bg-white px-5 py-5`) to tokens: `border-y border-orac-border-default bg-orac-surface px-5 py-5`.
- Confirm with the business what the PDF must show for tax (no VAT handling was found in `quoteModel.js` or `financeModel.js`).

### Phase 7: Tests and guards for the new design
Add one test file `tests/designSystemTokens.test.js` in the existing style (read source, assert strings):
- `index.css` has `--orac-cell-y`, `--orac-cell-x` and `html[data-density="compact"]`.
- `tailwind.config.js` defines `stat` font size and `page` max width.
- `PortalLayout.jsx` contains `justify-evenly`, `min-[900px]`, `max-w-page`; contains no `text-[9px]`/`text-[10px]`/`tracking-`.
- `MobileTabBar.jsx` exists, renders `aria-current`, and has no `uppercase`/`tracking-`.
- `IconStatCard.jsx` and `AttentionBand.jsx` use `text-lg font-bold` for the label and do not use `text-4xl`.
- `StatusBadge.jsx` contains no raw `bg-(amber|emerald|red|sky|gray)-` classes.
- No new file under `src/components` or `src/layouts` has `text-[9|10|11px]`.

### Phase 8: Verification and hand-off
1. `npm test`, `npm run maintain`, `npm run build`. Paste the output into the PR.
2. Screenshots after, same set as Phase 0, light and dark, 1440 / 1024 / 768 / 390, all roles. Put before/after side by side.
3. Automated checks (Playwright, script lives in `scripts/`, not in `src`): at each width, assert no horizontal page scroll (`document.documentElement.scrollWidth <= clientWidth`), header children do not overlap, nav item gaps are equal within 1 px, every interactive element is at least 24 px (target 44 px), no console errors.
4. Contrast: compute ratios for each token pair in both themes (the mockup's *Design system reference > Colour and contrast* does this live; reuse its formula). All text pairs 4.5:1, borders and focus ring 3:1. Brand cyan `#2FA2E3` must not be used for text (2.84:1 on white).
5. Manual: keyboard only (Tab order, skip link, menus, `Esc`), 200% zoom, one screen-reader pass (NVDA or VoiceOver) on login, dashboard and a form. State plainly in the PR what you did **not** test.
6. PR description: what changed per phase, every test you changed and why (expected: the `bg-gray-50/70` and sign-out assertions, and anything under D2/D3), the guarded pages that changed appearance, the decisions taken (D1 to D7) and what remains.

---

## 5. Quick map: mockup to code

| Mockup (`ORAC_UI_MOCKUP.html`) | Real code |
|---|---|
| `.hdr`, `.hdr__in`, `.topnav`, `.nav-item` | `layouts/PortalLayout.jsx` (`WorkspaceNavMenu`) |
| `.user`, `.avatar`, `.menu--user` | `components/UserProfileDropdown.jsx` |
| `.tabbar`, `.tab-item`, `.menu--sheet` | new `components/MobileTabBar.jsx` |
| `.tile`, `.tile__top`, `.tile__val`, `.tile--warning` | `IconStatCard.jsx`, `StatCard.jsx` |
| `.sumrow` (Inventory/Admin summary) | `AttentionBand.jsx` and `IconStatCard` in those pages |
| `.card`, `table.dt`, `.dt--link` | `DataTable.jsx` plus each page's `renderRow` |
| `.pill` | `StatusBadge.jsx` |
| `.banner` | `PageHeaderBanner.jsx` |
| `.empty`, `.alert`, `.sk` | `PageStates.jsx` |
| `--t-*`, `--sp-*`, `--r-*`, `--ctl-h` | Tailwind defaults plus the small Phase 1 additions |
| Density Comfortable / Compact | `html[data-density]` hook only (no UI) |
| "Quotation & invoice documents" screen | Backend PDF templates (hand-off, Phase 6) |

---

## 6. Useful commands

```bash
# baseline and gates
npm ci && npm test && npm run maintain

# find styling the new rules forbid or the design replaces
grep -rnE "text-\[(9|10|11)px\]|tracking-|\buppercase\b" src
grep -rnE "max-w-(6|7)xl|mx-auto" src/pages
grep -rnE "bg-(white|gray|slate)-|text-(gray|slate)-|border-(gray|slate)-" src/components src/layouts | wc -l
grep -rn "View details" src tests
grep -rnE "statusTone|\.status\}" src | grep -v StatusBadge
grep -rnE "\\$\\s?\\{|toLocaleString|toFixed\\(2\\)" src/pages src/components
```

## 7. Definition of done
- All phases above merged or explicitly deferred with a reason.
- `npm test` and `npm run maintain` green.
- No guarded file edited; guarded pages that changed appearance are listed.
- Screenshots before/after for each role at 4 widths in both themes attached.
- D1 to D7 answered or defaulted in writing.
- A list of follow-ups for the guarded areas (Timesheet and quotation pages, print pages, emoji in `WorksheetsPage`, backend PDF templates).
