# ORAC-IOS: Page Content Uniformity Plan

Addendum to `IMPLEMENTATION_GUIDE_FOR_CODING_AGENT.md`. It covers what the first guide did not: **buttons, text sizes, form fields, headings and all page contents**, so every page uses the same building blocks.

## 1. What was missing, with numbers

I counted the styling in the packet's frontend source (`src/pages`, `src/components`, `src/layouts`: 61 files). The first guide fixed the shared shell and a handful of shared components. Most of what users see is written inline, page by page:

| What | Count in source | Why it hurts |
|---|---|---|
| `<button>` elements | **200** | Four pages each define their own `buttonClass` (`rounded-md border px-3 py-1.5 text-sm font-semibold`); about 25 other distinct button class strings exist. Sizes range from `py-1` to `py-3`, some are `text-xs`, and white-on-`orac-cyan` buttons fail contrast (2.84:1). |
| `<input>/<select>/<textarea>` | **185** | About 35 use `px-3 py-2 text-sm` (14 px, roughly 38 px high), others use `py-2.5` and different borders (`gray-300` vs `slate-300`). None is 44 px tall by rule. |
| `text-sm` (14 px) | **610** | Most page content is 14 px. This is why everything feels small. |
| `text-xs` (12 px) or `text-[10|11px]` | **180** (13 of them 10–11 px) | Labels, helper text and buttons at 12 px or smaller. |
| Heading styles | **16+ distinct** `<h1>`–`<h3>` class strings | Sizes from `text-sm` to `text-3xl`, in four different colours. |
| Raw colour utilities (`text-gray-*`, `bg-white`, `border-slate-*`, `text-red-*`, …) | **1,734** | Only 19 uses of the semantic `orac-*` tokens. Dark mode survives only because `index.css` patches the raw classes. |
| Card wrappers | 6+ variants (`rounded-lg` or `rounded-xl`, `border-gray-200` or `border-orac-border`, with or without `p-5`/shadow) | Cards look slightly different on every page. |

So the redesign cannot be finished by restyling the shell. It needs **shared building blocks** and a **page-by-page migration** that is measured, so progress cannot slip back.

## 2. The readable-size rules (apply everywhere)

| Use | Size | Weight | Tailwind |
|---|---|---|---|
| Page title (one per page, in `PageHeaderBanner`) | 24 px | 700 | `text-2xl font-bold` |
| Section or card title | 18 px | 600 | `text-lg font-semibold` |
| Sub-section title | 16 px | 600 | `text-base font-semibold` |
| **Body text, field labels, table cells, card descriptions, buttons, inputs, nav** | **16 px** | 400 (labels 600, buttons 700) | `text-base` |
| Secondary: helper text, column headings, badges, dates, counters | 14 px | 500–600 | `text-sm` |
| Caption only (timestamps, tiny counters) | 12 px | 500 | `text-xs` |
| Nothing | under 12 px | | `text-[9|10|11px]` is banned |

Rules of thumb for the migration (do this by element, not by blind search and replace):
- `text-xs` on a **button, label, paragraph or table cell** becomes `text-base` or `text-sm` (never stays 12 px). Keep `text-xs` only for true captions.
- `text-sm` on a **paragraph, field label, table body cell or button** becomes `text-base`.
- Keep `text-sm` on: table column headings (a test requires `text-left text-sm font-semibold text-gray-600` in `DataTable`), `StatusBadge`, helper text under fields, secondary metadata.
- Muted text must keep 4.5:1 (`text-orac-text-muted` passes on card and muted surfaces; do not go lighter).

## 3. Shared building blocks to create

Create these in `src/components/` (all are presentation only, no business logic). They use the semantic tokens, so light and dark work without the dark-mode bridge. Check each against the tests listed in section 7 of the first guide (no `uppercase`, no `tracking-`, nothing under 12 px).

### 3.1 `Button.jsx`
```jsx
import React from "react";

const BASE =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border-2 font-bold " +
  "transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orac-focus-ring focus-visible:ring-offset-2 " +
  "disabled:cursor-not-allowed disabled:opacity-60";

const VARIANTS = {
  primary:   "border-orac-accent-strong bg-orac-accent-strong text-white shadow-sm hover:brightness-90",
  secondary: "border-orac-accent bg-orac-surface text-orac-accent hover:bg-orac-info-bg",
  danger:    "border-orac-danger-text bg-orac-surface text-orac-danger-text hover:bg-orac-danger-bg",
  ghost:     "border-transparent bg-transparent text-orac-accent hover:bg-orac-surface-muted hover:underline",
};
const SIZES = { md: "min-h-[44px] px-5 text-base", sm: "min-h-[40px] px-4 text-base" };

export default function Button({ variant = "secondary", size = "md", loading = false, className = "", children, disabled, ...props }) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${BASE} ${VARIANTS[variant] || VARIANTS.secondary} ${SIZES[size] || SIZES.md} ${className}`}
    >
      {loading && <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />}
      {children}
    </button>
  );
}
```
Rules: **one `primary` per view**; white text always sits on navy (`orac-accent-strong`), never on gear blue or cyan; do **not** default `type` (many buttons rely on submit behaviour, so each call site keeps its existing `type`). Keep every existing `onClick`, `disabled` and `data-*`/`id` attribute when swapping.

### 3.2 `FormField.jsx` and the input class
```jsx
export const inputClass =
  "w-full min-h-[44px] rounded-lg border border-orac-border-strong bg-orac-canvas px-3.5 py-2 text-base text-orac-text-primary " +
  "placeholder:text-orac-text-muted focus:border-orac-accent focus:outline-none focus:ring-2 focus:ring-orac-focus-ring/30 " +
  "disabled:bg-orac-surface-muted disabled:opacity-70 aria-[invalid=true]:border-orac-danger-text";

export default function FormField({ id, label, required, hint, error, children }) {
  const hintId = hint ? `${id}-hint` : undefined, errId = error ? `${id}-err` : undefined;
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-base font-semibold text-orac-text-primary">
        {label}{required && <span className="ml-1 font-medium text-orac-text-muted">(required)</span>}
      </label>
      {children /* the page renders <input id={id} className={inputClass} aria-describedby={`${hintId||""} ${errId||""}`.trim()||undefined} aria-invalid={error?"true":undefined} /> */}
      {hint && <p id={hintId} className="text-sm text-orac-text-muted">{hint}</p>}
      {error && <p id={errId} role="alert" className="text-sm font-semibold text-orac-danger-text">{error}</p>}
    </div>
  );
}
```
`ContractsPage` already has its own `Field` and `fieldProps`; migrate it to this file only after reading `tests/contractsPageSurface.test.js`, and keep its error and `hint` behaviour identical. Selects use the same `inputClass`; checkboxes `h-5 w-5 accent-[#00488C]`, with the statement in `text-base`.

### 3.3 `Panel.jsx` (the one card)
`rounded-xl border border-orac-border-default bg-orac-surface p-5 shadow-sm sm:p-6`, with optional `title` rendered as `<h2 className="text-lg font-semibold text-orac-text-primary">`. Replace the six card variants above. Tables keep `rounded-lg` (test).

### 3.4 `SectionHeading.jsx`
Three levels only (section 2). Provide `<SectionHeading level={2}>` / `level={3}` that render `text-lg font-semibold text-orac-text-primary` and `text-base font-semibold text-orac-text-primary`. Page titles stay in `PageHeaderBanner` (`h1`). Do not reorder heading levels.

### 3.5 `Notice.jsx`
Replaces ad hoc `<p className="text-sm text-red-700">` messages: variants `info | success | warning | error` using the `orac-*-bg/-text/-border` tokens, `text-base`, an icon from `icons.jsx`, and `role="alert"` (error) or `role="status"` (others). `ErrorBanner` in `PageStates.jsx` can wrap it.

## 4. Mapping the existing button styles

Swap by intent, not by exact string. Typical mappings from the 25 variants found:

| Existing look | New |
|---|---|
| `bg-orac-blue` / `bg-orac-navy` / `bg-slate-900` + white text | `variant="primary"` |
| `bg-orac-cyan` + white text (fails contrast) | `variant="primary"` |
| `border-orac-blue text-orac-blue`, `border-gray-300 text-gray-700`, `border-slate-300 text-slate-700` | `variant="secondary"` |
| `border-red-* text-red-*` | `variant="danger"` |
| `text-orac-blue hover:underline` link-like buttons, "Edit", "History" | `variant="ghost"` |
| `text-xs` or `py-1` row-action buttons | `size="sm"` (still 16 px text) |
| the four `buttonClass` constants | delete after their page is migrated |

Links that navigate stay `<a>`/`<NavLink>`: give them the same classes through a `buttonLinkClass` helper exported from `Button.jsx`, not a `<button>` wrapped in a link.

## 5. A safety net: the ratchet test

Without a test, new code will drift back. Add a baseline and a test that only allows the counts to go down.

`scripts/uniformity-baseline.mjs` (run once, commit the JSON): for every `.jsx` file under `src/pages`, `src/components`, `src/layouts` record `{ raw, tiny, button, input }`:
- `raw`: matches of `\b(text|bg|border|ring|divide)-(gray|slate|red|emerald|amber|sky|green|orange|indigo|blue)-\d+|\bbg-white\b`
- `tiny`: matches of `\btext-xs\b|text-\[(9|10|11)px\]`
- `button`: matches of `<button\b` (raw buttons that have not moved to `Button`)
- `input`: matches of `<(input|select|textarea)\b` without `inputClass`

`tests/uniformityRatchet.test.js`: load `tests/fixtures/uniformity-baseline.json`; fail if any file's counts are **higher** than baseline, or if a **new** file has any `tiny` or `raw` hits. As a page is migrated, regenerate its baseline entry to the lower number in the same PR. When a migrated page reaches zero `raw` and `tiny`, pin it at 0 forever.

## 6. Migration order (non-guarded files first, biggest first)

Counts are `raw / tiny / buttons / inputs` from the packet. **G** = guarded (leave; list in the PR).

| Order | File | raw | tiny | btn | inp | Notes |
|---|---|---|---|---|---|---|
| 1 | `pages/InventoryPage.jsx` | 104 | 11 | 10 | 21 | Has tests (`inventory*`): keep their strings |
| 2 | `pages/AdminPage.jsx` | 94 | 8 | 11 | 13 | Tests forbid `attention:` and `text-xs` labels/buttons |
| 3 | `pages/AdminEntitiesTab.jsx` | 82 | 7 | 6 | 10 | `aria-current` test string must stay |
| 4 | `pages/ContractsPage.jsx` | 57 | 6 | 9 | 13 | Has its own `Field`; 4 contracts tests |
| 5 | `pages/AdminAccessRequestsPage.jsx` | 55 | 3 | 6 | 2 | Uses `StatusBadge` (tested) |
| 6 | `pages/DashboardPage.jsx` | 36 | 0 | – | – | Keep all `evidence-*` ids and section order |
| 7 | `pages/FinanceCommercialPage.jsx` | 32 | 3 | 7 | 4 | `buttonClass` here |
| 8 | `pages/OperationalDataPage.jsx` | 31 | 1 | 5 | 3 | |
| 9 | `pages/ServiceRequestTriagePage.jsx` | 30 | 1 | 5 | 2 | `buttonClass` here |
| 10 | `pages/ReportsPage.jsx` | 30 | 1 | 2 | 0 | |
| 11 | `components/NotificationBell.jsx` | 26 | 5 | 5 | 0 | Has a source test |
| 12 | `components/InternalRequestCard.jsx`, `InternalRequestForm.jsx`, `pages/InternalRequestsPage.jsx` | – | – | – | – | `buttonClass` in card |
| 13 | `pages/ClientPortalPage.jsx`, `DocumentsPage.jsx`, `LegacyHistoryPage.jsx` | – | – | – | – | Small |
| later | `pages/LandingPage.jsx` (85), `AIAssistantPanel.jsx` (70), login and access pages | | | | | Public or floating surfaces; style separately and last |
| **G** | `WorksheetRegisterPage` (132), `WorksheetsPage` (86), `ContractorLogPage` (66), `DailyTimesheetPage` (63), `QuotationsPage` (40), `KioskModePage` (51), `KioskReviewPanel`, `TimesheetFormModal`, print pages | | | | | Do not edit now. Give the owner of that stream this plan and the same primitives |

## 7. Per-page recipe

For each page in order:
1. Read the page and its tests (`grep -ln "<PageName>" tests/*.test.js`).
2. Wrap content in the shell's page flow: outer element `space-y-6` only (no `max-w-*`, `mx-auto`, `p-6`).
3. Replace buttons with `Button` (section 4), inputs with `FormField` + `inputClass`, card wrappers with `Panel`, headings with `SectionHeading`, message paragraphs with `Notice`. Keep every handler, `id`, `data-evidence*`, `aria-*`, copy and condition exactly.
4. Apply the readable-size rules (section 2) element by element.
5. Replace raw colour classes with `orac-*` tokens: `text-gray-900|800` to `text-orac-text-primary`; `text-gray-700|600` to `text-orac-text-secondary`; `text-gray-500|400` to `text-orac-text-muted`; `bg-white` to `bg-orac-surface`; `bg-gray-50|100` to `bg-orac-surface-muted`; `border-gray-100|200|300` to `border-orac-border-default` (inputs and essential boundaries `border-orac-border-strong`); status reds, greens, ambers to the `orac-danger|success|warning|info-*` token families. Do not leave `dark:` variants behind where the token already handles dark.
6. Run `npm test`. Regenerate this file's baseline entry. Screenshot at 1440 and 390 px, light and dark.
7. Acceptance for a migrated page: zero raw colour classes, zero `text-xs` except true captions, no raw `<button>` without `Button`, every field 44 px high, a single `h1`, headings follow section 2, no horizontal scroll at 390 px.

## 8. Definition of done for uniformity
- All non-guarded files in section 6 (orders 1 to 13) migrated and pinned.
- The ratchet test is in `npm test` and green.
- A reviewer opening any two pages side by side sees the same button, field, card, heading and spacing styles.
- Guarded pages are listed with their current counts so the other stream can apply the same primitives.

## 9. Limits
- Counts come from regular expressions over the packet's source, not from rendered pages, and the packet may not match your latest code. Regenerate them with `scripts/uniformity-baseline.mjs` before starting.
- I have not run the proposed components against your build or tests.
- 16 px as the default reading size is a recommendation to improve readability. If a table-heavy screen becomes too long, use the Compact density hook (`data-density="compact"`, 14 px cells) rather than shrinking text page by page.
