# ORAC Portal: Design Specification

Covers typography, layout, components, responsive behaviour, accessibility, document quality and shared design tokens. Styling only. No backend, permissions or business logic changes.

## How to read this
**Live reference:** `ORAC_UI_MOCKUP.html` (v3) now implements this specification. Use the toolbar's *Screen* menu to open the *Design system reference* (every section below, live in light and dark, with contrast ratios calculated from the tokens) and the *Quotation & invoice documents* layout. The Preview buttons switch Desktop, Tablet and Mobile, and *Density* switches Comfortable and Compact.

- **Current** = read from the packet's source (`index.css`, `tailwind.config.js`, page and print files).
- **Verified** = I calculated it (contrast ratios below).
- **Recommended** = my design judgment. Treat it as a starting point to test with your users.
- **Not reviewed** = I had no sample to look at. These are flagged where they occur.

**Correction to my earlier material.** The mockup and benchmark used a 15 px body size. Your real `index.css` already sets 16 px with a 1.5 line height. Keep 16 px in the real app. Use 15 px only in dense table cells if needed. Likewise the mockup used 14 px corner radius, but the repo's typography test expects `rounded-lg` (8 px) on tables, so the radii below follow that.

---

## 1. Typography

| Property | Current (from code) | Recommended |
|---|---|---|
| Font family | System stack: `ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif` | **Keep it.** Zero download, works offline, renders natively on field Android and Windows laptops. Add `font-variant-numeric: tabular-nums` to money, hours, quantities and IDs so columns line up. |
| Base size | 16 px, line height 1.5 | Keep |
| Letter spacing | `0` forced on everything, and the repo test forbids `tracking-*` and `uppercase` in the shell and DataTable | Keep. Do not use wide-tracked uppercase labels. |
| Weights | Mixed utilities | Use only **400** (body), **500** (labels, nav), **600** (headings, buttons), **700** (stat numbers, totals). |

**Type scale** (rem at 16 px base):

| Token | Size | Line height | Weight | Use |
|---|---|---|---|---|
| `text-caption` | 12 px | 1.4 | 400–500 | Timestamps, helper text. **Floor: nothing smaller than 12 px.** |
| `text-sm` | 14 px | 1.4 | 400–500 | Badges, helper text, compact-density table cells only |
| `text-base` | 16 px | 1.5 | 400 | Body text, inputs, buttons, navigation |
| `text-lg` | 18 px | 1.4 | 600 | Card titles |
| `text-xl` | 20 px | 1.3 | 600 | Section headings |
| `text-2xl` | 24 px | 1.25 | 600–700 | Page title (one per page) |
| `text-stat` | 28 px | 1.2 | 600 | Dashboard tile counts (they support the label, they do not lead it) |

Rules:
- One `h1` per page, then headings in order (`h2` for sections, `h3` for cards). Don't skip levels for looks.
- Line length for paragraphs: 60–75 characters (`max-w-prose`). Tables and forms can be wider.
- Sentence case everywhere ("New quotation", not "NEW QUOTATION").
- Text-only buttons keep 16 px. Don't shrink to 12 px to make things fit.

## 2. Layout

| Aspect | Current / problem | Recommended |
|---|---|---|
| Spacing scale | Mixed values | 4 px base: **4, 8, 12, 16, 24, 32, 48**. Use only these. |
| Content width | Page edges seen at three different positions (x = 24 / 80 / 144 in the screenshots) | **One shell**: max width 1440 px, centered, gutter 28 px desktop, 16 px mobile. Pages never add their own outer margin. |
| Grid | Ad hoc | 12 columns, 24 px gap. Cards span 4, 6, 8 or 12. |
| Alignment | Mixed | Left-align text. Right-align numbers and money. Keep actions at the right end of a row or at the end of a form. |
| Hierarchy | Competing buttons and equal-weight tiles | Per page: one title, one primary action, then content. Highlight only things that need attention (tiles tint when count > 0). |
| Density | Tight in some tables, airy elsewhere | Two modes: **Comfortable** (default: cell padding 16×24, single-line row about 56 px) and **Compact** (12×16, single-line row about 46 px; rows with a second text line measured about 80 px and 69 px in the mockup) for Finance and Operations. |
| Visual balance | Header was left heavy | Header zones: brand, nav, account. Page banners no more than 120 px tall on desktop. |

## 3. Components

### Buttons
| Type | Look | Use |
|---|---|---|
| Primary | Filled `accent-strong`, white text (contrast 11.06:1), soft shadow | The one main action per view |
| Secondary | 2 px `accent` border, `accent` text, surface fill | Other actions |
| Danger | Text and border `danger-*`, filled only in the confirm step | Cancel, disable, delete |
| Ghost / link | Text only, underline on hover | Low priority actions in rows |

- Height **44 px** (40 px in compact tables), padding 0 20 px, radius 8 px, **text 16 px, weight 700** (never smaller than 16 px; primary adds a soft shadow).
- States: hover (slightly darker), active (1 px press), focus (2 px ring, 2 px offset, already global), disabled (50% opacity, no pointer), loading (spinner and "Saving…", button stays the same width).
- Place the primary on the right in forms and dialogs, secondary to its left.

### Forms
- Label **above** the field, 16 px weight 600. Never use placeholder as the label.
- Inputs: 44 px high, 16 px text (also prevents iOS zoom), `border-strong` border (4.76:1), radius 8 px.
- Required fields marked with text "(required)", not only a red asterisk.
- Helper text 12–14 px under the field. Errors replace it, in `danger-text` with an icon, linked via `aria-describedby`.
- One column on mobile. Two columns maximum on desktop, grouped under headings ("Client", "Line items").
- Hide rarely used fields behind "More details". Keep long forms in a modal only if they fit; otherwise use a page.
- Line items (quotation form): description, qty, unit price and line total on one row on desktop, stacked on mobile, with an obvious "Remove" and "+ Add line".

### Tables
- Head: `surface` background, 14 px weight 600, bottom border `border-strong`.
- Cells: 14–16 px, vertical padding 12–16 px, row divider `border`.
- Numbers right-aligned with tabular figures. Text left-aligned.
- Status always uses `StatusBadge` with a readable label (not raw `Approved_Pending_PO`).
- Whole row clickable when it opens a record (hover tint, pointer, focus ring).
- Sticky header on long tables. Radius 8 px (matches the repo test).
- Mobile: either scroll horizontally inside the table with the first column pinned, or turn rows into stacked cards. Never let the page itself scroll sideways.

### Cards and tiles
- Background `surface`, 1 px `border`, radius 12 px (check against the repo test before changing the current 8 px), padding 24 px, shadow only on hover.
- Stat tiles: neutral by default. Warning tint plus left rule only when action is needed. Zero counts collapse to a quiet "Nothing waiting".
- **The purpose leads.** The label ("Total quotes") is 18 px weight 700 in primary text. The count is 28 px weight 600 in secondary text. The count turns amber or red only when action is needed. (This reverses the usual KPI habit of a big number; chosen because the label tells people what a card is for. If a screen is read for the numbers alone, such as a finance summary, test the other way round.)

### Navigation
- Top bar 72 px: brand, nav, account chip. Nav items are **text labels only**, 16 px, 46 px tall, spread evenly across the space between brand and account (`justify-content: space-evenly`), with equal gaps at every width. No icon-only state anywhere.
- Selected item: filled `accent-strong` with `aria-current="page"`. Hover: `surface-muted`. One selected style across the app.
- Groups: chevron, menu opens with focus on first item, `Esc` closes.
- Mobile: bottom tab bar (up to five items, 58 px targets). Extra items open in a sheet.
- Breadcrumbs / `ScopeTrail` on deep pages only.

### States
| State | Treatment |
|---|---|
| Loading | Skeleton blocks in the shape of the content (no layout jump) |
| Empty | One short sentence, one action ("No quotations yet. New quotation") |
| Error | `danger` banner with plain explanation and a retry action |
| Success | Toast, auto-dismiss 5 s, also announced to screen readers |
| Offline | Full-width amber bar under the header, "Entries are saved on this device" |
| Session expired | Existing `SessionExpiredBanner`, restyled with the same pattern as offline |
| Disabled | 50% opacity and a reason in helper text where possible |

## 4. Responsive behaviour

Align to Tailwind's defaults so the code stays simple:

| Range | Width | Behaviour |
|---|---|---|
| Mobile | under 768 px | Bottom tab bar, single column, tiles 2-up, tables become stacked cards, 16 px gutter, targets 44 px or more |
| Tablet | 768–1023 px | Labelled bottom tab bar under 900 px, labelled top nav from 900 px, equal panels side by side, 24 px gutter, account chip shows avatar only, tiles 2-up |
| Desktop | 1024 px and up | Labelled top nav spread evenly, 12-column grid, tiles 4-up, side-by-side panels |
| Wide | 1440 px and up | Content stays at max 1440 px, centered |

The mockup (v3.1) uses these ranges, plus three steps for space: the brand subtitle hides under 1400 px, the account chip shrinks to the avatar under 1300 px, and the brand name hides under 1150 px. The header nav was checked for equal gaps and no overlap at 1700, 1500, 1440, 1366, 1280, 1100, 1024 and 950 px for the Operations, Management and Admin menus.

Also:
- Safe-area padding at the bottom of the tab bar on phones with a home indicator.
- The ORAC Guide button must sit above the tab bar and never cover content or primary buttons.
- Test portrait and landscape on phones used in the field.

## 5. Accessibility

**Contrast (verified).** I calculated WCAG ratios for your current tokens. All pass AA (4.5:1 text, 3:1 for UI borders):

| Pair | Light | Dark |
|---|---|---|
| Primary text on canvas | 19.15 | 17.67 |
| Secondary text on surface | 8.61 | 10.61 |
| Muted text on canvas | 5.44 | 7.23 |
| Muted text on muted surface | 4.84 | 5.83 |
| Accent on canvas | 9.11 | 10.26 |
| White on filled button | 11.06 | 9.11 |
| Input border (`border-strong`) on canvas | 4.76 | 5.13 |
| Success / danger / warning / info text on own bg | 5.21 / 5.91 / 6.84 / 5.57 | 8.05 / 7.94 / 8.27 / 7.93 |

Watch-outs:
- Brand cyan `#2FA2E3` is only **2.84:1** on white. Use it for decoration only, never for text or thin icons.
- The tokens pass, but the screenshots still showed weak amber and grey text. That comes from hard-coded Tailwind classes that bypass the tokens (see section 7). Replace them with `text-orac-warning-text`, `text-orac-text-muted` and so on.
- Muted text is close to the limit on muted surfaces (4.84:1). Don't use it for anything smaller than 14 px there.

**Other requirements**
- Readable sizes: body and inputs 16 px, nothing under 12 px, zoom to 200% without loss.
- Focus: global 2 px ring exists. Keep it on every interactive element, including clickable rows and tiles.
- Targets: 44 px target size for buttons and nav, never below 24 px (WCAG 2.2).
- Labels: every field has a visible label. Icon-only buttons need `aria-label`. Status never by colour alone.
- Keyboard: skip link, logical tab order, `Esc` closes menus and dialogs, focus returns to the trigger.
- Motion: keep the existing reduced-motion rule. Animations 150–200 ms.
- Not tested: screen readers and real devices. Run NVDA/VoiceOver on login, dashboard and a form.

## 6. Document quality (quotations, PDFs, print)

**What exists in the packet**
- Quote, invoice, purchase order, job card and worksheet PDFs are **generated by the backend** (`/documents/quotes/{id}.pdf` etc. in `api/client.js`) and downloaded from the Documents page. **The packet has no sample PDF and no renderer code, so I have not reviewed their real layout.** The checklist below is a brief for whoever owns the renderer, not a review of it.
- Three print pages are in the frontend: Daily Timesheet (A4 portrait), Contractor Log (A4 landscape) and Worksheet Register (A3 landscape). I read their CSS but did not see their printed output.
- `quoteModel.js` formats amounts as plain 2-decimal numbers with no currency symbol, and the Client Portal adds "R". I found no VAT or tax handling in `quoteModel.js` or `financeModel.js`. Confirm what the PDF shows.

**Quotation / invoice structure (recommended)**
1. **Header band**: logo left, document type and number right ("Quotation QT-0042"), issue date, valid-until date, status.
2. **Parties**: two columns, "From" (ORAC legal name, address, registration and VAT numbers if applicable) and "To" (client name, contact, site).
3. **Reference line**: equipment tag, job or PO reference, prepared by.
4. **Line-item table**: columns Item, Description, Qty, Unit, Unit price, Line total. Description left-aligned, numbers right-aligned, repeating header on page breaks, rows never split across pages.
5. **Totals block**: right-aligned under the table: Subtotal, Tax (only if applicable), **Total** in 700 weight and larger. Currency symbol shown once and consistently ("R 12,450.00").
6. **Terms and notes**: payment terms, validity, scope exclusions in 9–10 pt.
7. **Signature / acceptance** (quotes): name, date, signature lines.
8. **Footer**: ORAC contact details, page "Page 1 of 3", document number on every page.

**Print layout rules**
- Page: A4 portrait for quotes/invoices, margins 15–20 mm (the timesheet page sets margin 0 with its own sheet width, so check printers' non-printable area).
- Type: body 10–11 pt, table 9–10 pt, totals 12–14 pt, minimum 8 pt. Use a standard font that embeds reliably.
- Colour: black text on white. Brand navy for the header rule and table head only. Must stay legible in black-and-white printing.
- Hide on-screen toolbars with `@media print` (already done on the print pages).
- Avoid breaking inside rows, totals and signature blocks (`break-inside: avoid`).
- Branding: same logo, navy `#00488C` and wording as the portal so documents and app feel like one product.

**Consistency gap to fix**: the print pages carry their own hard-coded colours and sizes (for example `#444`, `#1a3a8a`, pt units). That is fine for paper, but move those into a shared print token set so all documents match.

## 7. Consistency: shared design tokens

**Why pages look like separate products.** `index.css` has a strong semantic token set. But page JSX still uses fixed Tailwind classes (`bg-white`, `text-gray-500`, `border-gray-200`, `rounded-lg`, `text-orac-slate`), and a long "dark-mode retrofit bridge" in `index.css` patches them. Each page therefore decides colours and sizes itself.

**Add these tokens** (values are my recommendation; colour tokens already exist):

```css
:root {
  /* type */
  --orac-font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --orac-text-caption: 0.75rem;  --orac-text-sm: 0.875rem;
  --orac-text-base: 1rem;        --orac-text-lg: 1.125rem;
  --orac-text-xl: 1.25rem;       --orac-text-2xl: 1.5rem;
  --orac-text-stat: 1.75rem;

  /* spacing (4px base) */
  --orac-space-1: 4px;  --orac-space-2: 8px;   --orac-space-3: 12px;
  --orac-space-4: 16px; --orac-space-6: 24px;  --orac-space-8: 32px; --orac-space-12: 48px;

  /* shape and size */
  --orac-radius-control: 8px;  --orac-radius-card: 12px;
  --orac-control-h: 44px;      --orac-control-h-compact: 40px;
  --orac-page-max: 1440px;     --orac-gutter: 28px;  /* 16px under 768px */

  /* elevation and motion */
  --orac-shadow-card: 0 1px 2px rgb(11 15 25 / 0.06);
  --orac-shadow-hover: 0 6px 16px rgb(11 15 25 / 0.10);
  --orac-motion: 160ms ease-out;
}
```

Also map them in `tailwind.config.js` (`fontSize`, `spacing`, `borderRadius`, `boxShadow`) so developers write `text-orac-lg` instead of raw sizes.

**Rules for the team**
1. New or edited JSX uses `orac-*` semantic classes only: no raw `gray`, `slate`, `red`, `emerald` or `amber` utilities.
2. Pages never set their own outer width or margin. They render inside the shell.
3. Use shared components for repeated patterns (`StatusBadge`, `StatCard`, `DataTable`, `PageHeaderBanner`, `PageStates`). Add a `Button` and `FormField` component so buttons and fields stop being re-styled per page.
4. One currency formatter, one date formatter, one status-label map.
5. Remove each retrofit-bridge rule once the last page using that class is migrated.
6. Keep `typographyReadability.test.js` and add checks for new rules (no text under 12 px, no raw gray classes in new files).
7. Add a one-page "component gallery" screen (buttons, fields, tables, badges, states in both themes) so reviewers can compare before merging.

**Migration order** (biggest visible gain first): tokens and shell, DataTable and StatusBadge, tiles and banner, buttons and form fields, then page-by-page cleanup of raw classes. Guarded files (`App.jsx`, `accessPolicy.js`, API client, Timesheet and quotation pages) wait for your go-ahead.

## 8. Where each look is controlled (control points)

Read from the packet's source. Change a look in one of these files and it changes everywhere that file is used.

| Look | Controlled by | Used by | Note |
|---|---|---|---|
| Tile label vs count hierarchy (size, weight, colour) | `components/IconStatCard.jsx` (label `text-sm font-semibold`, count `text-3xl sm:text-4xl font-semibold`) | Dashboard, Admin, Client Portal | Also decides "zero is always neutral" and the tone colours (`TONES` map) |
| Same, on the timesheet counters | `components/StatCard.jsx` | Worksheets (timesheets) page | Uses emoji icons and its own `TONES` map, so it drifts from `IconStatCard` |
| Inventory priority strip | `components/AttentionBand.jsx` | Inventory | Label `text-sm`, count `text-2xl` |
| Which tone a tile gets | `pages/DashboardPage.jsx` (and the other pages) pass `tone=` | Per page | Pages choose the colour, the component draws it |
| Header, nav item look, spacing, distribution | `layouts/PortalLayout.jsx` (`<nav className="flex flex-wrap ... gap-1">` is why items sit at the left) | Every page | The 5 items come from `accessPolicy.js`, which is guarded and not touched |
| Tab strips | `components/TabNav.jsx` | Role pages | |
| Tables | `components/DataTable.jsx` | All lists | |
| Status pills | `components/StatusBadge.jsx` | All lists | |
| Colours, base font size, focus ring | `index.css` tokens and `tailwind.config.js` | Everything | The dark-mode "bridge" patches raw classes |

**Why the look drifts.** Each component hard-codes its own Tailwind sizes and colours, and `StatCard`, `IconStatCard` and `AttentionBand` are three versions of the same idea. The fix is one shared stat component that reads the type tokens, then pointing all three at it.

## 9. Limits of this document
- Based on screenshots, source files and benchmark sources; no real-device, screen-reader or print testing.
- Quotation and other backend PDFs were not available, so section 6 is a specification, not an audit.
- Sizes are recommendations. Confirm with a short test with a field user, a finance user and a client.
