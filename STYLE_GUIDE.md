# ORAC portal style guide (one page)

**Tokens.** Colours come from the `orac-*` Tailwind tokens and `--orac-*` CSS variables in `src/index.css` (light and dark). Do not write raw hex colours in components. The logo cyan (#2FA2E3) is 2.8:1 on white: use it for fills and accents only, never for text.

**Type.** Labels 13 px, body and form text 15 px, table text 14 px regular with tabular numerals. System font stack.

**Layout.** One shared page container (max 1440 px) set by `PortalLayout`. Pages must not add their own `max-w-*` / `mx-auto` / `p-6` wrapper.

**Navigation.** Built only from `visibleNavigationGroups`. Targets are at least 44 px. Which small-screen pattern is used (drawer or bottom tabs) is an owner decision; do not change it as part of other work.

**Components.** `PageHeaderBanner` at the top of every page. For workflow categories (Draft, Sent, Pending review, Blocked amendments ...) use `StatusSummary` or `IconStatCard statusFirst`: name and meaning first, count second. Keep the large numeral for real quantities such as totals, money, hours or stock. `DataTable` for lists. `StatusBadge` for every status (never print a raw enum). `PageStates` for empty, error, restricted, offline and signed-out situations.

**Money.** The currency symbol is not changed by presentation work. Screens currently show different symbols in different places; changing any of them is a separate owner decision.

**Forms.** Every input has a visible label tied by `htmlFor`/`id`; set `autoComplete` (`username`, `current-password`, `new-password`, `email`); never block paste.

**Boundaries.** Presentation changes stay out of `App.jsx`, `accessPolicy.js`, API clients, signature controls, offline queue code, feature flags and the workflow pages unless an owner decision says otherwise. Do not weaken accessibility tests. Do not claim something works or looks right until it has been built and seen.
