# ORAC Portal UI/UX Refinement Scope

Date: 2026-10-27  
Status: implementation in progress; styling and presentation only.

## Sources merged

- Owner feedback and supplied screenshots: navigation must be labelled, evenly distributed, easier to interact with, and not visually squeezed.
- `BENCHMARK_AND_RECOMMENDATIONS.md`: three-zone header, 44 px targets, action-first hierarchy, deliberate empty states, and responsive navigation.
- `DESIGN_SYSTEM_SPEC.md`: type scale, spacing scale, semantic tokens, status treatment, tables, forms, accessibility, and document layout reference.
- Existing ORAC frontend contracts: role-derived navigation, tested route visibility, dark mode, readable typography, V5 isolation, commercial controls, and evidence routes.

## Visual rules being applied

1. **Header and navigation**
   - One 72 px shell with brand, labelled navigation, and account/actions as distinct zones.
   - Desktop navigation begins beside the brand rather than floating in an empty centre area.
   - Navigation targets are at least 44 px; labels remain readable rather than compressed.
   - At narrower tablet widths, use the existing accessible menu instead of squeezing a partial desktop bar.
   - Offline state is a full-width, readable notice—not a competing header pill.

2. **Hierarchy and cards**
   - Action-required work precedes neutral overview totals.
   - Warning, blocked, and returned conditions use status colour and explanatory language.
   - Neutral totals lead with their purpose label; numerals remain clear but do not dominate the card.
   - Zero states are quiet and do not receive warning or danger styling.

3. **Typography, spacing and controls**
   - System font stack, 16 px base text, normal letter spacing, tabular numbers for operational values.
   - Shared 4 px spacing scale: 4, 8, 12, 16, 24, 32 and 48 px.
   - Shared 44 px default control height, 8 px control radius, 12 px card radius, and 1440 px shell.
   - Visible focus rings, labelled fields, sentence-case copy, and no text smaller than 12 px.

4. **Responsive and accessibility behavior**
   - Desktop preserves labels and a stable grid.
   - Tablet avoids squeezed navigation; mobile uses the existing accessible navigation overlay.
   - Tables retain their own horizontal region rather than forcing page-level horizontal scrolling.
   - ORAC Guide and fixed controls must not cover primary page actions.

5. **Document and release work still to complete**
   - Inspect real quotation, invoice, PO, job-card, worksheet, and print output at desktop/tablet/mobile or print widths.
   - Apply consistent header, line-item table, totals, terms, logo, and print rules without changing commercial content or backend behavior.
   - Complete visual browser UAT in light/dark and responsive viewports, followed by independent review.

## Guardrails

- No access-policy, role, route, API, financial, tax, V5, database, deployment, or public-site behavior changes are part of this scope.
- Existing tests are retained and expanded only where a presentation contract needs protection.
- Each shared component is verified before page-by-page migration.
