# Tests that pin presentation classes

Found by the P0 agent (6 Nov 2026). A phase may edit these assertions only as AGENT_PROMPTS.md rule 3 says. Each row names the phase most likely to touch it.

| Test file | Reads | What it pins | Likely phase |
|---|---|---|---|
| chat2ShellAndDashboardHierarchy | PortalLayout, index.css | hover and font classes, sign-out button classes, guide trigger | P4 |
| chat5AdminAssistantDarkMode | AdminEntitiesTab, ClientPortalPage, AccessDeniedPage, AIAssistantPanel, PageStates, SessionExpiredBanner | no `text-orac-slate/navy/ink`; `bg-amber-50` and `dark:bg-amber-950/30` | P5 |
| chatFOperationsConsole | TabNav, StatCard | tab nav classes; no `text-xs` on label or button | P4 |
| clientQuoteVisibilitySource | ClientPortalPage | two button class strings | P5 |
| contractsTableLayout | ContractsPage | `<table>` classes with `text-sm`; two `overflow-x-auto` wrappers | P5 |
| dataTableRendering | DataTable (rendered) | cell padding `px-5 py-3.5`, `bg-gray-50` | P3/P4 |
| groupedNavigation | PortalLayout | mobile tab bar classes | P4 |
| internalRequestsModel | InternalRequestsPage | `statusTone` returns `bg-gray-100 text-gray-700` | P5 |
| reportsStructuredViews | ReportsPage | variance colour classes | P5 |
| typographyReadability | index.css, PortalLayout, DataTable | 16 px base; `text-base font-bold`; table head `text-sm font-semibold text-gray-600`; `rounded-lg` | P2/P4 |
| v4RecordLinks | deepLink.js | `min-h-[44px] min-w-[44px]` | P4 |
| v4ShellContainer | PortalLayout, DashboardPage | header container, 72 px inline height, main container, link classes | P4 |
| v4StatusFirst | StatusSummary, IconStatCard, StatCard, ReportsPage | count 28 px, label `text-lg font-bold`, note colour | P3/P4 |

Notes
- `typographyReadability` pins table head `text-sm`, and `DataTable` is the only user of `--orac-table-font-size`. UXD-1 (16 px tables) changes both together.
- `v4StatusFirst` already pins `sm:text-[28px]` for counts, which matches UXD-2.
- `ContractsPage` builds its own `<table>` and does not use DataTable, so tables are not uniform today.
