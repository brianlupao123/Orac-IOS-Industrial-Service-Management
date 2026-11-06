# Coding agent prompts (paste one at a time, in order)

Before pasting a phase prompt, paste the PREAMBLE once at the start of the session, and again if the agent loses context. Do not move to the next phase until the previous one is merged and `npm run maintain` is green.

Files the agent needs in the repository (the kit puts them there): `docs/ux/SDLC_MASTER_PLAN.md`, `docs/ux/ORAC_UI_PROTOTYPE.html`, `ux/*.json`, `scripts/ux-*.mjs`. Also keep the earlier `DESIGN_SYSTEM_SPEC.md` and `PAGE_CONTENT_UNIFORMITY_PLAN.md` in `docs/ux/` for the component code.

---

## PREAMBLE (paste first)

```
You are implementing a presentation-only UI/UX programme on the ORAC-IOS frontend (React 18, Vite, Tailwind 3.4).
The design is the HTML prototype at docs/ux/ORAC_UI_PROTOTYPE.html. The plan is docs/ux/SDLC_MASTER_PLAN.md.
Read both before doing anything. Work on ONE phase at a time, on its own git branch named ux/<phase>.

HARD RULES
1. Presentation only. No change to behaviour, permissions, routes, API calls, data shapes, money or tax logic, or text meaning.
2. Do NOT edit the guarded files listed in ux/rules.json under "guarded" unless ux/owner-approvals.json lists the file. If a phase seems to need one, stop and tell me.
3. Do not weaken, delete or skip any existing test. Several tests pin class strings (see docs/ux/TEST_COUPLING.md). You may edit such a test only when the phase you are running deliberately replaces that class, and only by changing the expected class string to the new one. Keep the assertion's strictness: no wildcards such as `.*`, no removed assertions, no switch from match to doesNotMatch. Make the test change in the same commit as the source change. List every edited test in your report as: file, line, old string, new string, reason.
4. Never lower a rule or raise a baseline to make a check pass. Fix the code instead.
5. Do not install new dependencies. Do not run npm audit fix. Do not push, merge or deploy. Commit to the branch only.
6. Never print secrets. Do not read .env files.
7. Do not claim anything works until you have run it. Paste real command output in your report.
8. If the prototype and the plan disagree, the prototype wins for appearance; ask me about anything else.

BEFORE YOU FINISH EVERY PHASE run, in this order, and paste the last lines of each:
   npm test
   npm run build
   node scripts/ux-check.mjs
   node scripts/ux-ratchet.mjs --report
   node scripts/ux-trace.mjs --embed docs/ux/ORAC_UI_PROTOTYPE.html
THEN report: what changed (files), which requirement IDs moved, ratchet totals before and after, tests you had to change and why, anything you could not do.
```

---

## P0 Tooling and baseline

```
PHASE P0. Install the UX gate kit. Change NO file under src/.
1. Create branch ux/p0-tooling.
2. Confirm these exist (copy from the kit if missing): ux/*.json, scripts/ux-*.mjs, scripts/orac-export.mjs, tests/uxTokens.test.js, tests/uxRatchet.test.js, docs/ux/*.
3. Merge the scripts in package.json.snippet.json into package.json "scripts". Add one line after run("npm", ["test"]) in scripts/verify-maintenance.mjs:  run("node", ["scripts/ux-check.mjs"]);
4. In ux/rules.json check the "guarded" list against the real file names (src/pages, src/api). Fix any path that does not exist. Report each change.
5. Correct ux/routes.json from src/App.jsx (read only): roles, route paths, and the login form labels. Do not edit App.jsx.
6. Run node scripts/ux-ratchet.mjs --init on the current tree and commit ux/baseline.json.
7. Run node scripts/ux-tokens.mjs. It WILL report differences (expected). Do not fix them in this phase. Set nothing to enforced.
8. Run npm test. tests/uxTokens.test.js parity test must be skipped (enforce.parity false); the contrast test and uxRatchet test must pass.
Acceptance: git diff --stat shows no file under src/ changed; ux:check fails ONLY on the token parity differences (print them); everything else passes.
```

## P1 Tokens, contrast and quick fixes

```
PHASE P1. Branch ux/p1-tokens. Requires owner confirmation of UXD-3 (grey page, white cards). If I have not confirmed it, stop and ask.
1. Run node scripts/ux-tokens.mjs --write. Review git diff of src/index.css and docs/ux/ORAC_UI_PROTOTYPE.html. Only token values and a marked UX-TOKENS block may change.
2. Make the shell use the new page token: the app background (body and the PortalLayout wrapper) uses var(--orac-page); cards, header and panels keep --orac-surface; inputs keep --orac-canvas. Add Tailwind colour keys page, surface-subtle, row-hover, row-alt in tailwind.config.js mapped to the variables. Do not rename existing keys.
3. Dark mode must look unchanged except for the new tokens. Run the visual audit if it can run (npm run test:visual-audit needs the local UAT server) and compare screenshots; if it cannot run, say so.
4. Fix the 14 text-[10px]/text-[11px] uses: 12 px badges and captions become text-xs, anything else text-sm. Skip guarded files and list them.
5. Replace text-gray-200/300/400 and text-slate-200/300/400 used as TEXT with text-orac-text-muted. Where the class is on a decorative icon or placeholder, keep the colour but use text-orac-border-strong and say so. Skip guarded files and list them.
6. Add alt text to any <img> without it.
7. Correct STYLE_GUIDE.md to: labels, body and table text 16 px (UXD-1); compact density 14 px; counts 28 px regular secondary colour (UXD-2). Keep every other sentence.
8. Set "enforce": {"parity": true} in ux/tokens.json.
9. Run node scripts/ux-ratchet.mjs --update (counts only go down) and commit ux/baseline.json.
Acceptance: ux:check passes; TYP-FLOOR, COL-LOWCONTRAST, A11Y-IMGALT are 0 outside guarded files; 548 tests pass (report any you changed).
```

## P2 Type system

```
PHASE P2. Branch ux/p2-type.
1. In tailwind.config.js extend theme.fontSize with these semantic entries (size, line height, weight together):
   ux-title [1.5rem, {lineHeight:'1.3', fontWeight:'700'}]
   ux-section [1.125rem, {lineHeight:'1.4', fontWeight:'600'}]
   ux-sub [1rem, {lineHeight:'1.5', fontWeight:'600'}]
   ux-label [1rem, {lineHeight:'1.5', fontWeight:'600'}]
   ux-body [1rem, {lineHeight:'1.5', fontWeight:'400'}]
   ux-secondary [0.875rem, {lineHeight:'1.45', fontWeight:'400'}]
   ux-caption [0.75rem, {lineHeight:'1.4', fontWeight:'500'}]
   ux-stat [1.75rem, {lineHeight:'1.2', fontWeight:'400'}]
   Keep the existing sizes. Do not set letter-spacing (index.css forces it to 0).
2. Add a test tests/uxTypeScale.test.js that asserts each of the 8 keys exists in tailwind.config.js with the exact size above.
3. Do not change any page or component in this phase.
Acceptance: tests pass; no src/ change except tailwind.config.js and the new test.
```

## P3 Shared components

```
PHASE P3. Branch ux/p3-components. Create NEW files only under src/components/ui/. Do not change any existing component or page.
Use docs/ux/PAGE_CONTENT_UNIFORMITY_PLAN.md and the prototype's Design system screen as the spec. Every component must be a plain function component with forwarded props, use only orac-* token classes and text-ux-* classes, and set the data-ux attribute shown.
 Button.jsx  data-ux="button" data-variant data-size. Variants primary, secondary, danger, ghost. Sizes md (min-h-[44px], px-5) and sm (min-h-[40px], px-4, data-size="sm"). Text text-ux-label bold. Border 2px. Primary: filled orac-accent-strong, white text, shadow-sm. Secondary: orac-accent border and text on orac-surface. States: hover, active (translate 1px), focus-visible ring, disabled (opacity 50, no pointer), loading (spinner, keeps width, aria-busy). Default type="button".
 Field.jsx   data-ux="label" on the label (text-ux-label), helper text (text-ux-secondary), error text with role="alert" and an icon, htmlFor/id wiring, required marker.
 Input.jsx, Select.jsx, Textarea.jsx  data-ux="input". min-h-[44px], text-ux-body, rounded-lg, border-orac-border-strong, bg-orac-canvas, visible focus ring, aria-invalid styling.
 Panel.jsx   data-ux="panel". rounded-xl, border-orac-border-default, bg-orac-surface, shadow, p-6; optional header slot.
 PageTitle.jsx (h1, data-ux="page-title", text-ux-title), SectionTitle.jsx (h2, data-ux="section-title", text-ux-section), SubTitle.jsx (h3, text-ux-sub).
 Notice.jsx  variants error, warning, info, success from the status tokens; role="alert" for error, role="status" otherwise; icon plus text (never colour alone).
 Badge.jsx   data-ux="badge", text-ux-caption, rounded-full; tones from status tokens only.
 BrandMark.jsx data-ux="brandmark"; renders /images/orac-systems-logo.png in a white circle, object-contain; props size in {40,48,80}; alt "Orac Systems"; width and height attributes set.
Add tests/uxPrimitives.test.js (source-string tests in the repository's existing style) asserting for each component: the data-ux attribute, the minimum heights, no raw colour classes (no bg-gray-*, text-slate-*, hex), and that Button defaults type="button".
Acceptance: all new tests and old tests pass; ratchet totals unchanged (components must add zero violations; they are the allowed place for <button>, <input>: confirm exceptFiles in ux/rules.json lists Button.jsx, Field.jsx, Input.jsx and add Select.jsx and Textarea.jsx to CMP-INPUT, plus BrandMark.jsx to BRAND-LOGO, committed as a rules change with a note).
```

## P4 Migrate shared components

```
PHASE P4. Branch ux/p4-shared. Migrate these existing shared components onto the P3 primitives, keeping props, behaviour and exported names identical:
 IconStatCard, StatCard, AttentionBand, StatusSummary (tile hierarchy per UXD-2: label text-ux-label in orac-text-primary, count text-ux-stat in orac-text-secondary; add data-ux="stat-tile", "stat-label", "stat-count"),
 StatusBadge (one STATUS_MAP using token classes only; remove the local statusTone maps in ServiceRequestTriagePage and InternalRequestCard, EntrySourceBadge, KioskReviewPanel, PoVarianceBanner, AssignedMaterialsPanel by using StatusBadge or Badge),
 DataTable (16 px cells, --orac-cell-y and --orac-cell-x padding, th text-ux-label, data-ux="table"; keep every string the existing dataTableRendering tests assert),
 PageStates, PageHeaderBanner (title via PageTitle), Modal, NotificationBell, UserProfileDropdown (BrandMark is not used here), AIAssistantPanel (buttons and inputs through Button and Input).
Do ONE component per commit, run its tests, then continue. Where an existing test asserts old class strings, update the assertion to the new equivalent and keep the intent. List every changed test.
Acceptance: TONE-LOCAL is 0; no hand-built <button> or <input> remains in the migrated files; ratchet totals lower than at P1 and --update committed; the visual audit screenshots for dashboard and Finance look equal or better.
```

## P5 Page migration waves (repeat per wave)

```
PHASE P5, WAVE <n>. Branch ux/p5-wave-<n>. Run node scripts/ux-ratchet.mjs --report and take the 5 NON-GUARDED pages with the most CMP-BUTTON + CMP-INPUT + COL-RAW violations that are not yet migrated. Say which five before you start.
For each page, one commit:
 - Replace every <button> with <Button> (primary for the single main action per view, secondary for others, danger only for destructive, ghost for row links), every label+input pair with <Field><Input/></Field>, cards with <Panel>, headings with PageTitle/SectionTitle/SubTitle.
 - Replace raw colour classes with orac-* tokens (text-gray-900 -> text-orac-text-primary, text-gray-500/600 -> text-orac-text-secondary or muted, bg-white -> bg-orac-surface, border-gray-200 -> border-orac-border-default, status colours -> StatusBadge or Notice). Replace text-sm/text-xs with text-ux-* classes by role (body, label, secondary, caption).
 - Remove page-level max-w, mx-auto and outer p-6 (LAY-01). Replace "Loading..." with PageLoadingSkeleton.
 - Do not change copy, logic, handlers, ids used by tests or evidence attributes (data-evidence).
 - Run the page's tests after each page.
Then run node scripts/ux-ratchet.mjs --update and commit the baseline. Attach before and after screenshots at 1440, 1024 and 390 px light and dark if a local server is available; otherwise say they were not taken.
Acceptance: the five pages have 0 in CMP-BUTTON, CMP-INPUT, COL-RAW, COL-HEX, LAY-PAGEWIDTH, STATE-LOADINGTEXT; no guarded file touched; tests pass.
```

## P5-FINAL Guarded pages (only after the owner approves each file)

```
PHASE P5-FINAL. Only for files the owner has listed in ux/owner-approvals.json. For each approved file, apply the same migration as P5 with extra care: these pages hold the Timesheet, quotation and worksheet business logic. Change class names and wrapper elements only. After each file, run the whole test suite and diff the rendered output text (strip classes) before and after; it must be identical. If anything differs, revert that file and tell me.
```

## P6 Brand and documents

```
PHASE P6. Branch ux/p6-brand.
1. Replace every use of orac-systems-logo in LandingPage, LoginPage and RequestAccess, and the inline gear SVG in PortalLayout, with <BrandMark size={...}>: header 40, login 48, request access 80, landing 40. Keep layout and text next to the mark unchanged. BRAND-LOGO must reach 0.
2. Do not edit the backend. Write docs/ux/DOCUMENT_BRIEF.md for the backend owner from the prototype's "Quotation & invoice documents" screen: page size, margins, header band with the logo, parties block, reference strip, line-item table with repeating header, totals block, terms, signature block, footer, font sizes in points, colours, print rules. State that the logo asset needs owner approval (UXD-6).
Acceptance: BRAND-LOGO is 0; header still 72 px; document brief committed.
```

## P7 States

```
PHASE P7. Branch ux/p7-states. Replace every plain "Loading..." text with PageLoadingSkeleton (page level) or Skeleton (inside panels and tables, rows matching the final layout). Make sure empty, error, restricted, offline and signed-out situations render through PageStates with Notice-style wording unchanged. Add reduced-motion support: skeleton shimmer and transitions off under prefers-reduced-motion.
Acceptance: STATE-LOADINGTEXT is 0 outside guarded files; tests pass.
```

## P8 Prototype parity

```
PHASE P8. Branch ux/p8-parity.
1. Run node scripts/ux-probe.mjs --target prototype and make sure it reports 0 findings.
2. Start the local UAT server as scripts/ui_visual_audit.mjs does. Set ORAC_PROBE_PASSWORD and ORAC_PROBE_EMAIL_<ROLE> for the fictional UAT accounts (never real accounts). Run node scripts/ux-probe.mjs --target app --url <local url>.
3. For every finding on the app: fix it in the portal if it breaks a rule in ux/components.spec.json; if the rule itself is wrong, stop and ask me (do not edit the spec to pass).
4. For any component the probe cannot find in the app, check data-ux is present.
Acceptance: both probes report 0 FAIL; evidence folders listed in the report.
```

## P9 Verification and release

```
PHASE P9. Branch ux/p9-release.
1. Run the full gate: npm test, npm run build, npm run maintain, node scripts/ux-probe.mjs for prototype and app, node scripts/ux-trace.mjs --embed docs/ux/ORAC_UI_PROTOTYPE.html.
2. Run node scripts/ux-ratchet.mjs --report. For every rule whose total is not 0, list the files; each must be a guarded file with an owner decision, or you must fix it.
3. Create docs/ux/UAT_CHECKLIST.md from the manual requirements in ux/requirements.json (CMP-06, NAV-01, NAV-02, NAV-03, A11Y-05, STA-02, DOC-01, DOC-02, PRC-01) with steps and the expected result. Do NOT mark anything verified. A person records results in ux/manual-evidence.json.
4. Create docs/ux/CHANGELOG.md: one line per phase with the requirement IDs delivered.
5. Update docs/ux/TRACEABILITY.md by running ux:trace and commit it with the embedded prototype.
Acceptance: traceability shows every automated requirement DONE; manual items PENDING until a person verifies them; report any requirement still OPEN and why.
```
