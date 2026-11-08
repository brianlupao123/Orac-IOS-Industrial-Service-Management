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
7. SINGLE WRITER. While the UX programme runs, only this thread writes to branches named ux/*. Work in a dedicated git worktree (for example ../orac-ux) so other chats using the main folder cannot dirty it. Never use git stash, reset --hard, clean, checkout of other people's files, or force push. Never merge or rebase unless I say so.
8. START OF EVERY PHASE: run `git status --short` (must be empty), `git rev-parse HEAD`, and `git log --oneline ux/p0-tooling..main` (tells me whether main moved). Paste all three at the top of your report. If the tree is dirty with changes you did not make, STOP and tell me; do not clean it.
9. END OF EVERY PHASE: paste `git status --short` and `git diff --stat <phase start>..HEAD`. Files outside the phase's stated scope mean stop and report.
10. PRESENTATION ONLY ON ux/* BRANCHES. These branches may change class names, markup wrappers, tokens, docs/ux and the UX tooling. Business logic (src/lib, models, API, validation, and tests of logic) never goes on a ux/* branch. If you find such a commit there, stop and report.
11. NEVER DELETE A SIZE OR COLOUR CLASS WITHOUT A REPLACEMENT. Every changed class is listed in the report as old -> new.
12. At the end of every phase run `npm run ux:diffguard`. It must report 0 findings. An exception needs an entry in ux/diffguard.allow.json with a reason, and I must approve it.
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

## P1a Quick fixes (no owner decision needed)

```
PHASE P1a. Branch ux/p1a-quickfixes, created from main after ux/p0-tooling has been merged. Do not run ux-tokens --write in this phase. Do not change colours of surfaces or the page background.
1. Fix the text-[10px] and text-[11px] uses (TYP-FLOOR): 12 px badges and captions become text-xs, anything else text-sm. Skip guarded files and list them.
2. Replace text-gray-200/300/400 and text-slate-200/300/400 used as TEXT with text-orac-text-muted (COL-LOWCONTRAST). Where the class is on a decorative icon or a placeholder, keep the role but use text-orac-border-strong and say so. Skip guarded files and list them.
3. Add alt text to any <img> without it (alt="" for decoration).
4. Correct STYLE_GUIDE.md to: labels, body and table text 16 px (UXD-1); compact density 14 px; counts 28 px regular weight secondary colour (UXD-2). Keep every other sentence.
5. Run npm test, npm run build and node scripts/ux-check.mjs. Then run node scripts/ux-ratchet.mjs --update (counts may only go down) and commit ux/baseline.json.
Report: the ratchet table before and after; every file changed with the count of lines; every test edited (file, line, old, new, why); every guarded file skipped; any text-gray-400 you left and why.
Acceptance: ux:check passes; 614 tests pass and 1 skipped (the parity test); TYP-FLOOR, COL-LOWCONTRAST and A11Y-IMGALT are 0 outside guarded files.
```

## P1a-2 Correction after the P1a review

```
PHASE P1a-2. Stay on branch ux/p1a-quickfixes. Two of my rules were wrong, so some P1a edits must be undone. This is my error, not yours.
1. Overwrite these repo files with the attached copies and commit them first as "chore(ux): ratchet transfers; low-contrast rule ignores dark: variants": scripts/ux-ratchet.mjs, ux/rules.json, docs/ux/AGENT_PROMPTS.md, docs/ux/SDLC_MASTER_PLAN.md. Do not edit them by hand.
2. REVERT every P1a change where the text you removed was a dark: variant, for example dark:text-slate-200, dark:text-slate-300, dark:text-gray-400, dark:hover:text-slate-300. In dark mode those light greys are correct, and the muted token is dimmer. Method: `git diff main..ux/p1a-quickfixes -U0`, find every removed line containing dark:(...:)*text-(gray|slate|zinc|neutral|stone)-(200|300|400), and restore only that dark: class. If a line also had a light-theme change you made, keep that part. Expect about 50 sites. Print the count and the file list.
3. REVERT every change where the colour sat on a block that is dark in BOTH themes (bg-slate-9xx, bg-gray-9xx, bg-black, dark navy, dark gradients). The known case is src/pages/LandingPage.jsx footer (bg-slate-950 text-slate-300): restore text-slate-300. Search all your other edits for the same situation and list each one you restored and the background class that made you restore it.
4. Keep the decorative-icon and placeholder changes (text-orac-border-strong) and the text-gray-400 on white surfaces changed to text-orac-text-muted.
5. Run: node scripts/ux-ratchet.mjs (it must now pass: converting text-[Npx] to text-xs is an allowed transfer), then node scripts/ux-ratchet.mjs --update, npm test, npm run build, node scripts/ux-check.mjs, npm run maintain.
6. Confirm the exact file names of the ux tests under tests/ (you wrote uxTokensParity.test.js; the kit has uxTokens.test.js). Say if you renamed anything.
Report: ratchet table (before P1a, after P1a-2); the reverted lines grouped by file; the dark-background list from step 3; test counts; commit hashes.
Acceptance: ratchet passes and baseline updated; 614 pass, 1 skipped, 0 fail; maintain passes; no dark: class changed from its original value.
```

## P1b Tokens and page background (needs the owner's yes on UXD-3)

```
PHASE P1b. Branch ux/p1b-tokens, created after P1a is merged. Requires my confirmation of UXD-3 (grey page, white cards). If I have not confirmed it, stop and ask.
1. Run node scripts/ux-tokens.mjs --write. Review git diff of src/index.css and docs/ux/ORAC_UI_PROTOTYPE.html. Only token values and a marked UX-TOKENS block may change. The dark block is html[data-theme="dark"].
2. Make the shell use the new page token: the app background (body and the PortalLayout wrapper) uses var(--orac-page); cards, header and panels keep --orac-surface; inputs keep --orac-canvas. Add Tailwind colour keys page, surface-subtle, row-hover, row-alt in tailwind.config.js mapped to the variables. Do not rename existing keys.
3. --orac-table-font-size becomes 16px. DataTable is its only user and its header is pinned by tests/typographyReadability.test.js (text-sm). Update that assertion only if the header class changes, as the preamble rule 3 says.
4. Dark mode must look unchanged except for the new tokens. Run the visual audit if it can run (npm run test:visual-audit needs the local UAT server) and compare screenshots; if it cannot run, say so.
5. Set "enforce": {"parity": true} in ux/tokens.json. The parity test must now run and pass.
6. Run node scripts/ux-ratchet.mjs --update and commit ux/baseline.json.
Acceptance: ux:check passes with parity enforced; 615 tests pass, 0 skipped; build passes; screenshots at 1440, 1024 and 390 px attached for Dashboard, one table page and one form page, light and dark.
```

## P2 Type system (folded into P3)

The type scale is now step 0 of P3, because the type classes live inside the shared components. Do not run P2 on its own. Do not mass-convert text-sm anywhere.

## P3 Type scale and shared components

```
PHASE P3. Branch ux/p3-components from main. This phase adds NEW files and one config change. It must not change any existing page or component, so nothing on screen changes.
STEP 0. TYPE SCALE (was P2).
 a. In tailwind.config.js extend theme.fontSize with these semantic entries (size, line height, weight together):
   ux-title [1.5rem, {lineHeight:'1.3', fontWeight:'700'}]
   ux-section [1.125rem, {lineHeight:'1.4', fontWeight:'600'}]
   ux-sub [1rem, {lineHeight:'1.5', fontWeight:'600'}]
   ux-label [1rem, {lineHeight:'1.5', fontWeight:'600'}]
   ux-body [1rem, {lineHeight:'1.5', fontWeight:'400'}]
   ux-secondary [0.875rem, {lineHeight:'1.45', fontWeight:'400'}]
   ux-caption [0.75rem, {lineHeight:'1.4', fontWeight:'500'}]
   ux-stat [1.75rem, {lineHeight:'1.2', fontWeight:'400'}]
   Keep the existing sizes. Do not set letter-spacing (index.css forces it to 0). The ladder must descend: title 24 > section 18 > sub 16 = label 16 > secondary 14 > caption 12.
 b. Add tests/uxTypeScale.test.js asserting each of the 8 keys exists in tailwind.config.js with the exact size above. Commit as "feat(ux): semantic type scale".
STEP 1. COMPONENTS under src/components/ui/, NEW files only.
Use docs/ux/PAGE_CONTENT_UNIFORMITY_PLAN.md and the prototype's Design system screen as the spec. Every component is a plain function component with forwarded props (ref where it makes sense), uses only orac-* token classes and text-ux-* classes, and sets the data-ux attribute shown. Work in both themes: tokens only, no raw colours, no dark: overrides.
 Button.jsx  data-ux="button" data-variant data-size. Variants primary, secondary, danger, ghost, link. Sizes md (min-h-[44px], px-5) and sm (min-h-[40px], px-4, data-size="sm"). Text text-ux-label. Border 2px. Primary: filled orac-accent-strong, white text, shadow-sm. Secondary: orac-accent border and text on orac-surface. States: hover, active (translate 1px), focus-visible ring, disabled (opacity 50, no pointer), loading (spinner, keeps width, aria-busy). Default type="button".
   The "link" variant is for actions inside table rows (Edit, Disable, History). Text only, text-orac-accent, underline on hover, px-2. Its height must be at least 44px on screens under 900px wide and at least 32px from 900px up: min-h-[44px] min-[900px]:min-h-[32px], inline-flex items-center. The probe found 800 targets of 20px high, mostly these.
 Field.jsx   data-ux="label" on the label (text-ux-label), helper text (text-ux-secondary), error text with role="alert" and an icon, htmlFor/id wiring, required marker.
 Input.jsx, Select.jsx, Textarea.jsx  data-ux="input". min-h-[44px] under 900px and min-h-[40px] from 900px up, text-ux-body, rounded-lg, border-orac-border-strong, bg-orac-canvas, visible focus ring, aria-invalid styling.
 Panel.jsx   data-ux="panel". rounded-xl, border-orac-border-default, bg-orac-surface, shadow, p-6; optional header slot.
 PageTitle.jsx (h1, data-ux="page-title", text-ux-title), SectionTitle.jsx (h2, data-ux="section-title", text-ux-section), SubTitle.jsx (h3, data-ux="sub-title", text-ux-sub). Never render an h3 larger than an h2.
 Notice.jsx  variants error, warning, info, success from the status tokens; role="alert" for error, role="status" otherwise; icon plus text (never colour alone).
 Badge.jsx   data-ux="badge", text-ux-caption, rounded-full; tones from status tokens only. Add a CountBadge variant for the notification count: bg-orac-danger-text with white text must give at least 4.5:1 in both themes, or use bg-red-700 as P1d did; say which you chose and show the contrast.
 BrandMark.jsx data-ux="brandmark"; renders /images/orac-systems-logo.png in a white circle, object-contain; props size in {40,48,80}; alt "Orac Systems"; width and height attributes set.
STEP 2. TESTS AND RULES.
 Add tests/uxPrimitives.test.js (source-string tests in the repository's existing style) asserting for each component: the data-ux attribute, the minimum heights, no raw colour classes (no bg-gray-*, text-slate-*, hex), that Button defaults type="button", and that the link variant has both min-h values.
 In ux/rules.json add Select.jsx and Textarea.jsx to the CMP-INPUT exceptFiles and BrandMark.jsx to the BRAND-LOGO exceptFiles (Button.jsx, Field.jsx and Input.jsx are already listed). Commit as a rules change with a note: "primitives are the one allowed place for raw elements".
STEP 3. A DEMO FOR ME. Add src/components/ui/_demo.md (not code) listing every component, its props and one usage example. Do not wire any component into a page.
Acceptance: all new and old tests pass; npm run build passes; ratchet totals unchanged (components add zero violations); npm run ux:diffguard reports 0 findings; ux-check passes.
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
