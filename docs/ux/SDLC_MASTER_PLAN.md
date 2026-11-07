# ORAC portal UI: SDLC master plan

Purpose: make the HTML prototype (`docs/ux/ORAC_UI_PROTOTYPE.html`) and the real portal one design, and keep them that way. The prototype is the design, the portal is the build, and scripts prove they match.

## 1. Why the gaps exist (measured on the 5 Nov 2026 export, not opinion)

| Root cause | Evidence | Permanent control |
|---|---|---|
| No shared Button, field, card or heading components | 0 uses of a shared Button against 232 hand-built buttons in 18+ looks; `h2` has 7 looks | Shared primitives (Phase 3) and a ratchet that forbids new hand-built ones |
| Tokens exist but nothing enforces them | 2,184 raw colour classes against 875 token references; `STYLE_GUIDE.md` says 13/15 px while audits say 16 px | One token file, checked in both the CSS and the prototype (`ux/tokens.json`) |
| No rule stops regressions | 14 uses of text under 12 px in a project whose own scope forbids it; 46 uses of `text-gray-400` at 2.54:1 | The ratchet fails the build when any count goes up |
| Prototype and portal were never compared by measurement | Header and tokens drifted; currency and logo differed | A browser probe runs the same measurable rules (`ux/components.spec.json`) on both |
| Decisions and evidence lived in chat | Requirements, owner choices and results were scattered | A requirements register and a generated traceability matrix, also shown inside the prototype (Screen > SDLC traceability) |
| Protected files made some pages untouchable | 11 guarded files hold 395 of 2,184 raw colours | A guard script and an owner-approval file make each exception explicit |

## 2. The six controls

1. `ux/tokens.json` is the single source of colour, type, spacing and geometry. `node scripts/ux-tokens.mjs --write` updates `src/index.css` and the prototype. `--check` fails if they differ, and checks 84 contrast pairs.
2. Shared primitives in `src/components/ui/` carry `data-ux` hooks so tests and the probe can find them.
3. `scripts/ux-ratchet.mjs` counts 15 kinds of violation per file against `ux/baseline.json`. Counts can go down, never up.
4. `scripts/ux-probe.mjs` measures the rendered prototype or portal: font sizes, target sizes, contrast, heading order, focus visibility, overflow, component dimensions.
5. `scripts/ux-trace.mjs` builds `docs/ux/TRACEABILITY.md` (requirement, design, build, verification, evidence) and embeds it in the prototype.
6. `scripts/ux-guard.mjs` blocks changes to guarded files unless `ux/owner-approvals.json` records the owner's decision.

`npm run ux:check` runs controls 1, 3 and 6 and is added to `npm run maintain`. Tests `tests/uxTokens.test.js` and `tests/uxRatchet.test.js` put the same checks inside `npm test`.

## 3. SDLC mapping

| SDLC stage | Artifact | Gate to leave the stage |
|---|---|---|
| Requirements | `ux/requirements.json` (38 requirements, each with source) and the decisions below | Every requirement has a source, a design anchor and at least one check |
| Design | The prototype, `ux/tokens.json`, `ux/components.spec.json` | Prototype passes its own probe (it does today: 114 pages, both themes, 0 findings) |
| Implementation | Phases P0 to P8, one branch and one pull request each, using `AGENT_PROMPTS.md` | `npm run maintain` passes, ratchet does not increase, evidence attached |
| Verification | Ratchet, tokens, probe on the portal, `npm test`, manual UAT and accessibility checks recorded in `ux/manual-evidence.json` | Traceability shows every requirement DONE or an owner-accepted exception |
| Release | P9: evidence pack, change log, tightened baseline | Owner sign-off recorded in `ux/manual-evidence.json` |
| Maintenance | The gates stay in `npm run maintain` and CI; baseline only goes down | Quarterly: run the probe on all roles, review `TRACEABILITY.md` |

## 4. Decisions (owner confirms; defaults are used if silent)

| ID | Decision | Default |
|---|---|---|
| UXD-1 | Body and table text size | 16 px comfortable, 14 px compact only. Correct `STYLE_GUIDE.md` |
| UXD-2 | Tile hierarchy | Label bold primary, count 28 px regular secondary |
| UXD-3 | Page and card layering | Grey page, white cards (adds `--orac-page`, `--orac-surface-subtle`, row tokens). Changes light `--orac-surface` from `#f8fafc` to `#ffffff`. Needs owner confirmation before merging P1 |
| UXD-4 | Currency | USD (`$`) through the existing `formatMoney` in `src/lib/format.js` (do not create a second formatter). Confirmed by the agent: no ZAR, KES, ZWL or "R" anywhere in `src/`. This replaces decision D5 in the earlier implementation guide, which assumed "R" from screenshots; the portal's own audit says USD-only |
| UXD-5 | Guarded business pages | Stay frozen and stay in the baseline. At the end, the owner may approve a final wave per file in `ux/owner-approvals.json`. They hold most of the remaining inconsistency, so the project is not uniform until this is decided |
| UXD-6 | Logo on PDFs | DEFERRED (backend). `backend/src/pdfGenerator.js` draws text only, and the three print pages are guarded. Putting the logo on customer PDFs is a backend change, outside this programme. Record it as an owner request. The prototype's document sheets show the logo as the target look |
| UXD-7 | Work lifecycle card on dashboards | DEFERRED. Only 4 of the 7 stage counts exist in `/summary` (`quotes`, `dispatches`, `worksheets`, `invoices`). Purchase orders, worksheet registers and settled would need new backend queries. Do not build in P1 to P9. Owner choice: keep it deferred (default) or build a 4-stage card |
| UXD-8 | Density switch | No UI switch. Compact density is a `data-density` attribute only |
| UXD-9 | Print pages | Exempt from the colour and inline-style rules (they are guarded and use print-specific values) |

Earlier decisions D1 to D4, D6 and D7 in `IMPLEMENTATION_GUIDE_FOR_CODING_AGENT.md` still apply. Where the header or tokens were already implemented by the agent, do not redo them.

## 5. Phases

Each phase is one branch, one pull request, and must leave `npm run maintain` green. Never merge a phase that raises the ratchet.

| Phase | Objective | Exit criteria |
|---|---|---|
| P0 Tooling and baseline | Install the kit, create the baseline, wire the gates, change no UI | `ux:check` passes; baseline committed; no `src/` file changed; guard passes |
| P1a Quick fixes (text floor, low-contrast text, alt, STYLE_GUIDE), then P1b Tokens and page background | `--write` tokens (after UXD-3 is confirmed); remove text under 12 px; remove low-contrast greys; fix `STYLE_GUIDE.md`; set `enforce.parity` to true | TYP-FLOOR, COL-LOWCONTRAST, A11Y-IMGALT at 0; tokens agree; 548 tests pass |
| P2 Type system | Add semantic type classes to `tailwind.config.js` and the matching tokens | `text-ux-*` classes exist; nothing uses them yet except the new components |
| P3 Shared components | Build Button, Field/Input/Select/Textarea, Panel, PageTitle, SectionTitle, SubTitle, Notice, Badge, BrandMark in `src/components/ui/`, each with `data-ux` | Source tests for each; no page changed |
| P4 Migrate shared components | Move IconStatCard, StatCard, AttentionBand, DataTable, StatusBadge, PageStates, Modal, NotificationBell and assistant panels onto the primitives | TONE-LOCAL at 0; tile hierarchy rule passes; existing component tests updated deliberately |
| P5 Page migration waves | Pages in the order set by the ratchet report, five at a time, least risky first; one pull request per wave | Each wave lowers CMP-BUTTON, CMP-INPUT, COL-RAW, TYP-SM; no guarded file touched |
| P6 Brand and documents | One BrandMark everywhere; document layout brief for the backend owner | BRAND-LOGO at 0; DOC items handed to the backend owner |
| P7 States | Skeletons for every loading state; empty, error and offline states through PageStates | STATE-LOADINGTEXT at 0 |
| P8 Prototype parity | Add `data-ux` to the prototype where missing; run the probe on the prototype and the portal; fix differences in the right place | Probe reports 0 findings on both |
| P9 Verification and release | Full gates, manual UAT and accessibility checks, evidence pack, ratchet tightened, owner sign-off | Traceability: every requirement DONE or an owner-accepted exception |

## 6. Risks

| Risk | Mitigation |
|---|---|
| Changing `--orac-surface` shifts the look of every page and could break dark-mode tests | P1 is its own pull request; run `darkModeTokenCoverage` and the visual audit; owner confirms UXD-3 first |
| Migrating hundreds of buttons by hand introduces regressions | Waves of five pages; screenshots before and after; no behaviour changes; tests after each wave |
| A coding agent drifts or edits guarded files | Prompts forbid it; `ux-guard` fails the build; each phase is reviewed as a diff |
| The regex ratchet misses styles built from variables or logic | The probe measures the rendered result; manual checks cover the rest |
| The slim export drops icons, so one test fails in the review copy | The full project has the icons; the failing test is environmental |

## 7. What these gates do not prove

- They do not judge wording, workflow logic or permissions. Those stay under the existing tests and the backend.
- The ratchet is a text search. The probe sees only the pages and roles it is given; the portal probe needs sign-in credentials and its route list in `ux/routes.json` has to be corrected from `src/App.jsx`.
- A person must still run a keyboard and screen-reader test on a real device, and check printed documents.
- I ran the prototype probe, the token check, the ratchet and the traceability generator against your exported source. I did not run the portal probe, the new components, or any phase against your real project.

## 8. Working agreements

- One phase per branch; the pull request description lists the requirement IDs it addresses and the `ux:trace` summary line.
- Attach the probe summary and before-and-after screenshots to each page wave.
- Never lower a rule's strictness to pass. Fix the code, or record an owner decision.
- Run `npm run maintain` before every commit.

## Rule corrections log

| ID | Date | Rule | Problem found | Correction |
|---|---|---|---|---|
| RC-1 | 6 Nov 2026 | COL-LOWCONTRAST | The regex matched `dark:text-slate-200` and similar. Light grey is correct on dark surfaces, so 50 of 96 matches were false positives, and P1a replaced them with a dimmer token. Text on permanently dark blocks (Landing footer) was also flagged. | Regex ignores any `dark:` variant. Permanently dark blocks keep their light text. P1a-2 reverts the affected edits. |
| RC-2 | 6 Nov 2026 | TYP-FLOOR, TYP-ARBITRARY, TYP-XS | Converting `text-[11px]` to `text-xs` is the intended fix but raised TYP-XS, so the ratchet refused it. | `transfers` in ux/rules.json lets a file add to TYP-XS up to what it removed from TYP-FLOOR or TYP-ARBITRARY in the same file. Any other rise is still refused. |

