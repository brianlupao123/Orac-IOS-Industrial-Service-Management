import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const require_ = createRequire(import.meta.url);

async function renderEntry(name, source) {
  const { buildSync } = require_("esbuild");
  const baseDir = fileURLToPath(new URL("..", import.meta.url));
  const dir = fs.mkdtempSync(path.join(baseDir, ".orac-ssr-shared-"));
  const entry = path.join(dir, `${name}.jsx`);
  fs.writeFileSync(entry, source);
  const out = path.join(dir, `${name}.mjs`);
  try {
    buildSync({
      entryPoints: [entry],
      outfile: out,
      bundle: true,
      format: "esm",
      platform: "node",
      jsx: "automatic",
      external: ["react", "react-dom", "react-dom/server", "react/jsx-runtime"],
      absWorkingDir: baseDir,
      logLevel: "silent",
      define: { "import.meta.env": JSON.stringify({ PROD: false }) },
    });
    return await import(pathToFileURL(out).href);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("DataTable renders data-ux=table with 16px body, 14px compact, and responsive cues", async () => {
  const mod = await renderEntry("dataTableSharedTest", `
    import React from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import DataTable from ${JSON.stringify(path.resolve("src/components/DataTable.jsx"))};

    const columns = ["ID", "Name"];
    const rows = [{ id: "1", name: "Alpha" }];
    const renderRow = (r) => (
      <tr key={r.id}>
        <td>{r.id}</td>
        <td>{r.name}</td>
      </tr>
    );

    export const normal = renderToStaticMarkup(<DataTable columns={columns} rows={rows} renderRow={renderRow} />);
    export const compact = renderToStaticMarkup(<DataTable columns={columns} rows={rows} renderRow={renderRow} compact />);
  `);

  assert.ok(mod.normal.includes('data-ux="table"'), "DataTable has data-ux=table");
  assert.ok(mod.normal.includes("var(--orac-table-font-size, 16px)"), "DataTable default body has 16px font-size");
  assert.ok(mod.normal.includes("text-ux-secondary font-semibold text-orac-text-secondary"), "DataTable header has 14px/600 secondary text");
  assert.ok(mod.normal.includes("max-sm:whitespace-nowrap"), "First column does not wrap on mobile");

  assert.ok(mod.compact.includes("var(--orac-table-font-size-compact, 14px)"), "DataTable compact body has 14px font-size");
});

test("StatusBadge renders data-ux=badge with unified status mappings", async () => {
  const mod = await renderEntry("statusBadgeSharedTest", `
    import React from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import StatusBadge from ${JSON.stringify(path.resolve("src/components/StatusBadge.jsx"))};

    export const draft = renderToStaticMarkup(<StatusBadge status="Draft" />);
    export const sent = renderToStaticMarkup(<StatusBadge status="Sent" />);
    export const awaitingPo = renderToStaticMarkup(<StatusBadge status="Approved_Pending_PO" />);
    export const completed = renderToStaticMarkup(<StatusBadge status="Completed" />);
    export const rejected = renderToStaticMarkup(<StatusBadge status="Rejected" />);
  `);

  assert.ok(mod.draft.includes('data-ux="badge"'), "Draft has data-ux=badge");
  assert.ok(mod.draft.includes(">Draft</span>"), "Draft text is rendered");

  assert.ok(mod.sent.includes('data-ux="badge"'), "Sent has data-ux=badge");
  assert.ok(mod.sent.includes("border-orac-info-border"), "Sent has info border");
  assert.ok(mod.sent.includes("h-1.5 w-1.5 rounded-full bg-current"), "Sent has 6px dot");
  assert.ok(mod.sent.includes(">Sent</span>"), "Sent text is rendered");

  assert.ok(mod.awaitingPo.includes('data-ux="badge"'), "Awaiting PO has data-ux=badge");
  assert.ok(mod.awaitingPo.includes(">Awaiting PO</span>"), "Awaiting PO label override applied");

  assert.ok(mod.completed.includes('data-ux="badge"'), "Completed has data-ux=badge");
  assert.ok(mod.completed.includes(">Completed</span>"), "Completed text is rendered");

  assert.ok(mod.rejected.includes('data-ux="badge"'), "Rejected has data-ux=badge");
  assert.ok(mod.rejected.includes(">Rejected</span>"), "Rejected text is rendered");
});

test("TabNav renders 44px min-height tabs with active and inactive styling", async () => {
  const mod = await renderEntry("tabNavSharedTest", `
    import React from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import TabNav from ${JSON.stringify(path.resolve("src/components/TabNav.jsx"))};

    const tabs = [
      { id: "all", label: "All Items", count: 12 },
      { id: "pending", label: "Pending" }
    ];

    export const html = renderToStaticMarkup(<TabNav tabs={tabs} activeId="all" onChange={() => {}} />);
  `);

  assert.ok(mod.html.includes('role="tablist"'), "TabNav has role=tablist");
  assert.ok(mod.html.includes("min-h-[44px]"), "Tabs enforce min-h-[44px] touch target");
  assert.ok(mod.html.includes('aria-selected="true"'), "Active tab has aria-selected=true");
  assert.ok(mod.html.includes('aria-selected="false"'), "Inactive tab has aria-selected=false");
  assert.ok(mod.html.includes("text-ux-body"), "Tabs use text-ux-body");
  assert.ok(mod.html.includes("border-b-[3px] border-orac-accent"), "Active tab has 3px accent underline");
});

test("StatCard renders tile hierarchy matching prototype", async () => {
  const mod = await renderEntry("statCardSharedTest", `
    import React from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import StatCard from ${JSON.stringify(path.resolve("src/components/StatCard.jsx"))};

    export const activeCard = renderToStaticMarkup(<StatCard label="Pending Approval" value={5} />);
    export const zeroCard = renderToStaticMarkup(<StatCard label="Overdue" value={0} />);
  `);

  assert.ok(mod.activeCard.includes('data-ux="stat-tile"'), "StatCard has data-ux=stat-tile");
  assert.ok(mod.activeCard.includes('data-ux="stat-label"'), "StatCard has data-ux=stat-label");
  assert.ok(mod.activeCard.includes('data-ux="stat-count"'), "StatCard has data-ux=stat-count");
  assert.ok(mod.activeCard.includes("text-lg font-bold"), "Label is text-lg font-bold");
  assert.ok(mod.activeCard.includes("sm:text-[28px]"), "Count is 28px");

  assert.ok(mod.zeroCard.includes("text-orac-text-muted"), "Zero count has muted text");
});

test("PageStates components render Notice primitive, type scale, and evidence selectors", async () => {
  const mod = await renderEntry("pageStatesSharedTest", `
    import React from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import {
      ErrorBanner,
      PageEmptyState,
      PageLoadingSkeleton,
      RestrictedState,
      OfflineState,
      SessionExpiredState
    } from ${JSON.stringify(path.resolve("src/components/PageStates.jsx"))};

    export const error = renderToStaticMarkup(<ErrorBanner message="Network timeout" />);
    export const empty = renderToStaticMarkup(<PageEmptyState title="No items found" subtitle="Try adjusting your filter" />);
    export const skeleton = renderToStaticMarkup(<PageLoadingSkeleton rows={2} />);
    export const restricted = renderToStaticMarkup(<RestrictedState />);
    export const offline = renderToStaticMarkup(<OfflineState />);
    export const expired = renderToStaticMarkup(<SessionExpiredState onSignIn={() => {}} />);
  `);

  assert.ok(mod.error.includes('data-evidence="page-error-state"'), "ErrorBanner has page-error-state");
  assert.ok(mod.error.includes('data-ux="notice"'), "ErrorBanner uses Notice primitive");
  assert.ok(mod.error.includes('data-variant="error"'), "ErrorBanner has error variant");

  assert.ok(mod.empty.includes('data-evidence="page-empty-state"'), "PageEmptyState has page-empty-state");
  assert.ok(mod.empty.includes("text-ux-section"), "PageEmptyState uses text-ux-section");

  assert.ok(mod.skeleton.includes('data-evidence="page-loading-skeleton"'), "Skeleton has evidence selector");
  assert.ok(mod.skeleton.includes('role="status"'), "Skeleton has role=status");

  assert.ok(mod.restricted.includes('data-evidence="page-restricted-state"'), "Restricted has evidence selector");
  assert.ok(mod.offline.includes('data-evidence="page-offline-state"'), "Offline has evidence selector");
  assert.ok(mod.expired.includes('data-evidence="page-session-expired-state"'), "SessionExpired has evidence selector");
  assert.ok(mod.expired.includes('data-ux="button"'), "SessionExpired uses Button primitive");
});

test("PageHeaderBanner renders PageTitle and Button primitives", async () => {
  const mod = await renderEntry("pageHeaderBannerSharedTest", `
    import React from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import PageHeaderBanner from ${JSON.stringify(path.resolve("src/components/PageHeaderBanner.jsx"))};

    export const banner = renderToStaticMarkup(
      <PageHeaderBanner
        title="Inventory Control"
        subtitle="Manage materials and requisitions"
        action={{ label: "New Request", onClick: () => {} }}
      />
    );
  `);

  assert.ok(mod.banner.includes('data-ux="page-title"'), "Banner uses PageTitle primitive");
  assert.ok(mod.banner.includes("text-ux-title"), "PageTitle has text-ux-title");
  assert.ok(mod.banner.includes('data-ux="button"'), "Banner action uses Button primitive");
  assert.ok(mod.banner.includes("New Request"), "Button text rendered");
});

test("AttentionBand renders metric list with warning tokens on attention", async () => {
  const mod = await renderEntry("attentionBandSharedTest", `
    import React from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import AttentionBand from ${JSON.stringify(path.resolve("src/components/AttentionBand.jsx"))};

    const items = [
      { label: "Pending Approvals", value: "3", attention: true },
      { label: "Active Jobs", value: "14", attention: false }
    ];

    export const band = renderToStaticMarkup(<AttentionBand items={items} />);
  `);

  assert.ok(mod.band.includes('role="list"'), "AttentionBand has role=list");
  assert.ok(mod.band.includes("text-ux-label"), "Item label has text-ux-label");
  assert.ok(mod.band.includes("text-ux-stat"), "Item value has text-ux-stat");
  assert.ok(mod.band.includes("border-orac-warning-border"), "Attention item has warning border");
  assert.ok(mod.band.includes("bg-orac-warning-bg"), "Attention item has warning bg");
  assert.ok(mod.band.includes("needs attention"), "Attention text is rendered");
});
