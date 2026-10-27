# ORAC portal mock-up conformance audit

Date: 2026-10-27  
Reference reviewed: `C:\Users\BRIAN LUPAO\Downloads\ORAC_UI_MOCKUP (1).html`  
Supporting references: `DESIGN_SYSTEM_SPEC (1).md` and `BENCHMARK_AND_RECOMMENDATIONS (1).md`

## Result

The portal deliberately does **not** copy the mock-up's fictional records,
currency (`R`), role names, or placeholder charts. It now follows the mock-up's
shell and hierarchy more closely while retaining ORAC's USD-only and
role-authorised workflow.

| Reference requirement | Result | Evidence |
| --- | --- | --- |
| 72px three-zone header | Matches | `PortalLayout.jsx` keeps the shared 1440px shell and 72px header. |
| Labelled, evenly distributed desktop navigation | Corrected | Text-only group labels now use `justify-evenly` from 1024px. |
| Avoid crowded navigation at narrower desktop widths | Corrected | Brand text hides from 1024px to 1199px; the logo mark, labels and account controls remain. |
| Labelled mobile destinations plus an overflow path | Corrected | A fixed labelled tab bar exposes primary groups; **More** opens the existing full role-scoped drawer. |
| 16px operational text baseline, 4px spacing rhythm, 1440px page shell | Matches | Shared tokens in `src/index.css`; browser audit confirms 16px base text and no horizontal overflow. |
| Neutral overview cards with colour reserved for attention | Partially matches | Shared cards follow this direction; individual legacy pages still need semantic-class migration. |
| Compact, deliberate empty states | Corrected | Compact empty states now use a 96px minimum instead of 128px, avoiding oversized blank Finance panels. |
| Skeleton loading pattern | Open | Several pages still show plain `Loading...`; this is a future shared-component migration, not hidden by this audit. |
| Single semantic component vocabulary and density switch | Open | Tokens exist, but the reference's optional density selector and full raw-utility migration are not implemented. |

## Verification run

The read-only fictional-data browser audit passed on 2026-10-27:

- Desktop: 1440px, dashboard and Finance
- Tablet: 1024px, dashboard and Finance
- Mobile: 390px, dashboard and Finance
- Every viewport had no horizontal overflow and retained a 16px base font.

Evidence is stored in `evidence/ui-visual-audit/2026-10-27T13-31-19-813Z/`.

## Important non-copy decisions

- ORAC remains USD-only. The mock-up's `R` amounts are sample layout content,
  not a financial policy.
- Role visibility remains derived from `accessPolicy.js`; visual navigation
  changes cannot broaden a user's routes.
- Finance, quotation, invoice, settlement and V5 controls were not changed by
  this shell refinement.
