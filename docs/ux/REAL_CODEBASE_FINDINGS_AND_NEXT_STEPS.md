# ORAC portal: findings from the real code export (5 Nov 2026)

Source: `orac-ui-export.zip` (275 files, built from commit b1a064d with uncommitted changes), the agent's report, and the research pack. All counts come from the script's regex scan of source text (`UX_INVENTORY.md`), not from rendered pages. The export's own test output shows 548 passed and 0 failed. I did not run the tests, the build or the browser myself.

## 1. What your coding agent has already done (verified in the export's own audit files and code)

- A 72 px three-zone header with labelled, evenly spread navigation, and a labelled bottom tab bar with a "More" drawer (`MOCKUP_CONFORMANCE_AUDIT.md`, `PortalLayout.jsx`).
- Semantic `--orac-*` tokens (50 variables), Tailwind colours mapped to them, 16 px base text, 46 px nav items.
- "Attention work before neutral totals", `StatusSummary` / `IconStatCard statusFirst` (name first, count second), 96 px compact empty states.
- A read-only browser audit at 1440, 1024 and 390 px with no horizontal overflow (evidence folder in the export).
- The agent's own list of what is still open: skeleton loading, the density switch, and "full raw-utility migration".

So Phase 3 (header) and part of Phase 1 are largely done. Do not redo them. The remaining work is Phase 2b and Phase 5 of the guide.

## 2. Where the real code still disagrees with the design (numbers from the scan)

| # | Finding | Evidence |
|---|---|---|
| 1 | No shared Button. | `<Button>` used 0 times, 232 raw button nodes in at least 18 distinct looks (the scan lists only the top 18) (for example `px-4 py-2 rounded-md`, `px-5 py-2 rounded-lg`, `rounded` with `px-3 py-1`). 52 have no size or style classes at all. |
| 2 | Inputs are hand-styled. | 169 input nodes; 50 share one look, the rest vary in padding, radius and height (`px-2 py-1 rounded`, `min-h-11`, none at all). Only 66 uses of a shared field. |
| 3 | Cards are hand-styled. | 279 card-like boxes in at least 18 shapes, with radius `rounded`, `rounded-md`, `rounded-lg`, `rounded-xl` mixed. No Card or Panel component. |
| 4 | Headings differ page to page. | `h1` has 6 looks, `h2` has 7 (from `text-sm` to `text-3xl`), `label` has 7, `td` has 6. Order inversions: none found by the scan. |
| 5 | Text is mostly small. | `text-sm` 764, `text-xs` 274, `text-base` 46. |
| 6 | Text under the 12 px floor. | 14 uses of `text-[10px]` / `text-[11px]`. Your own `UI_UX_REFINEMENT_SCOPE.md` says "no text smaller than 12 px". |
| 7 | Low-contrast grey text. | `text-gray-400` appears 46 times. On white it is 2.54:1; the minimum is 4.5:1. `index.css` only remaps it for dark mode. Some uses may sit on other backgrounds or be decorative, so check each one. |
| 8 | Colour is not centrally controlled. | 2,184 raw Tailwind colour classes against 875 token references, 123 CSS rules that patch raw classes, 37 inline styles, 11 local status/tone maps. |
| 9 | `STYLE_GUIDE.md` contradicts the 16 px decision. | It says labels 13 px, body 15 px, table text 14 px. The audit files say 16 px. Pick one and correct the other. My recommendation is 16 px for labels, body and table cells. |
| 10 | One shared page container is not yet enforced. | The style guide says pages must not add their own `max-w-*`. `max-w-7xl` and `max-w-[1440px]` each appear 6 times; `LandingPage` has 9 `max-w` uses. Some of these may be public pages that are outside the portal shell, so check before changing them. |
| 11 | Plain "Loading..." text on several pages. | Listed as open in the agent's own audit. |

## 3. Logo (your image)

- The real header draws an inline SVG gear (`PortalLayout.jsx` line 226). Login, Landing and Request Access use `public/images/orac-systems-logo.png` at three sizes (`h-11`, `h-12` and `h-20`, each `rounded-full bg-white`). So the brand mark differs between the header and the login page.
- The gear in the image has 6 teeth around a navy and black disc with a white band. My first mockup used a different 8-ray icon. The mockup now uses your real image.
- Recommendation: one `BrandMark` component that renders the PNG, with fixed sizes 40 px (header), 48 px (login), 80 px (request access), 16 mm (documents). Every place that shows the logo uses it.
- The agent's audit says the backend PDFs have no approved logo asset. If you approve this image as that asset, the PDFs can use it. That is an owner decision, so I did not assume it.
- Colours: brand navy `#00488C` and gear blue `#2FA2E3` match the image by eye (I did not measure pixels). `#2FA2E3` on white is 2.84:1, so keep it for fills and the gear, never for text.

## 4. What changed in the mockup (v3.3)

1. **Real logo** in the header and on the quotation and invoice documents.
2. **USD, not "R".** The portal is USD-only, as the agent's conformance audit states. My assumption of "R" was wrong, and I have changed every amount and the document currency line.
3. **Work lifecycle card** for Sales, Operations, Finance and Management. It shows seven stages (Quotes, Purchase orders, Dispatches, Timesheets, Worksheet registers, Invoices, Settled) with the stage name bold and the count quieter. Stages that belong to your role are outlined. Management oversees all stages, so none is highlighted. This comes from the research pack's lifecycle, which I have not verified against the code.
4. A 2 px overflow on the client view at mobile width is fixed.

Checked in Playwright at desktop, tablet and mobile for six roles: no console errors, no horizontal overflow.

## 5. The research pack: what I used and what I did not

- **Used:** the eight roles and the lifecycle (quote, PO, dispatch, timesheets, register, invoice, payment) as the design for the lifecycle card.
- **Not verified:** the pack was written by an AI agent. I did not check its routes, permissions or database claims against code. I did not use its "gap analysis" items, which concern permissions and are outside a presentation-only brief.
- **Privacy:** section 6.2 lists 33 named people with national ID numbers. I did not copy any of it. Remove that section before sharing the pack with any external tool or person.

## 6. Next steps, in order

1. **Fix the quick wins** (about one day, low risk): the 14 text sizes under 12 px, the 46 `text-gray-400` uses (use the muted text token, `text-orac-text-muted`, wherever it is real text; check its contrast on each background), and the contradicting numbers in `STYLE_GUIDE.md`.
2. **Phase 2b primitives:** Button, field, Panel, section heading, Notice, BrandMark, as in `PAGE_CONTENT_UNIFORMITY_PLAN.md`. The scan found few asserted strings that mention class names, but it does not capture assertions written as regular expressions, so the risk is not known. Run the 548 tests after each primitive.
3. **Phase 5 migration** page by page, starting with the pages with the most variants (`AdminEntitiesTab`, `ContractorLogPage`, `WorksheetsPage`, `InternalRequestsPage`).
4. **Add the lifecycle card** to the dashboards only if the owner agrees. It is new UI built on existing counts, so check each count has a source in the dashboard summary API and do not add a new query.
5. **Ratchet test:** fail the build if new raw colour classes, `text-[Npx]`, or hand-built buttons appear.
