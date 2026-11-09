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
  const dir = fs.mkdtempSync(path.join(baseDir, ".orac-ssr-dt-"));
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
      external: ["react", "react-dom", "react/jsx-runtime", "react-router-dom"],
      absWorkingDir: baseDir,
      logLevel: "silent",
      define: { "import.meta.env": JSON.stringify({ PROD: false }) },
    });
    return await import(pathToFileURL(out).href);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("DataTable renders status components and never hides custom badge content", async () => {
  const mod = await renderEntry("statusTable", `
    import React from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import DataTable from ${JSON.stringify(path.resolve("src/components/DataTable.jsx"))};
    import StatusBadge from ${JSON.stringify(path.resolve("src/components/StatusBadge.jsx"))};

    export default function render() {
      const columns = ["ID", "Status", "Notes"];
      const rows = [
        { id: "101", status: "Approved_Pending_PO", notes: "First row" },
        { id: "102", status: "In_Progress", notes: "Second row" },
      ];
      return renderToStaticMarkup(
        <DataTable
          title="Status Test"
          columns={columns}
          rows={rows}
          hideEmptyColumns={true}
          renderRow={(r) => (
            <tr key={r.id}>
              <td>{r.id}</td>
              <td><StatusBadge status={r.status} /></td>
              <td>{r.notes}</td>
            </tr>
          )}
        />
      );
    }
  `);

  const html = mod.default();
  assert.ok(html.includes("Awaiting PO"), "StatusBadge label override must render");
  assert.ok(html.includes("In Progress"), "StatusBadge label must render");
  assert.ok(html.includes("<th"), "Headers must render");
  assert.ok(html.includes("Status</th>"), "Status column must not be auto-hidden");
  assert.match(html, /role="region" aria-label="Status Test table" tabindex="0"/, "The scrollable table must have a keyboard-focusable, named region");
});

test("DataTable preserves icon-only action columns even with hideEmptyColumns enabled", async () => {
  const mod = await renderEntry("actionsTable", `
    import React from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import DataTable from ${JSON.stringify(path.resolve("src/components/DataTable.jsx"))};

    export default function render() {
      const columns = ["Item", "Action"];
      const rows = [{ id: "A1", name: "Filter Valve" }];
      return renderToStaticMarkup(
        <DataTable
          columns={columns}
          rows={rows}
          hideEmptyColumns={true}
          renderRow={(r) => (
            <tr key={r.id}>
              <td>{r.name}</td>
              <td>
                <button type="button" aria-label="Edit item">
                  <svg className="w-4 h-4"><path d="M0 0" /></svg>
                </button>
              </td>
            </tr>
          )}
        />
      );
    }
  `);

  const html = mod.default();
  assert.ok(html.includes("Action</th>"), "Action header must not be hidden");
  assert.ok(html.includes("aria-label=\"Edit item\""), "Icon-only button must be preserved");
  assert.ok(html.includes("<svg"), "SVG icon must be preserved");
});

test("DataTable adds an accessible opt-in action column to each data row", async () => {
  const mod = await renderEntry("renderedActionColumn", `
    import React from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import DataTable from ${JSON.stringify(path.resolve("src/components/DataTable.jsx"))};

    export default function render() {
      const rows = [{ id: "Q-1", name: "Quote one" }];
      return renderToStaticMarkup(
        <DataTable
          columns={["Quote"]}
          rows={rows}
          renderActions={(row) => <button type="button">PDF {row.id}</button>}
          renderRow={(row) => <tr key={row.id}><td>{row.name}</td></tr>}
        />
      );
    }
  `);
  const html = mod.default();
  assert.ok(html.includes("Action</th>"), "Action column header is visible");
  assert.ok(html.includes('data-label="Action"'), "Action cell is labelled for responsive layouts");
  assert.ok(html.includes("PDF Q-1"), "row action receives its corresponding record");
});

test("DataTable preserves zero values and does not treat 0 as empty", async () => {
  const mod = await renderEntry("zeroTable", `
    import React from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import DataTable from ${JSON.stringify(path.resolve("src/components/DataTable.jsx"))};

    export default function render() {
      const columns = ["Code", "Balance", "Variance"];
      const rows = [
        { code: "C-1", balance: 0, variance: "0" },
        { code: "C-2", balance: 0.0, variance: 0 },
      ];
      return renderToStaticMarkup(
        <DataTable
          columns={columns}
          rows={rows}
          hideEmptyColumns={true}
          renderRow={(r) => (
            <tr key={r.code}>
              <td>{r.code}</td>
              <td>{r.balance}</td>
              <td>{r.variance}</td>
            </tr>
          )}
        />
      );
    }
  `);

  const html = mod.default();
  assert.ok(html.includes("Balance</th>"), "Numeric column with 0 must not be hidden");
  assert.ok(html.includes("Variance</th>"), "Numeric column with '0' string must not be hidden");
  assert.ok(html.includes(">0</td>"), "0 value must be rendered in body cell");
});

test("DataTable applies numeric alignment consistently when NO columns are hidden", async () => {
  const mod = await renderEntry("numericNoHide", `
    import React from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import DataTable from ${JSON.stringify(path.resolve("src/components/DataTable.jsx"))};

    export default function render() {
      const columns = ["Ref", "Total Amount", "Hours"];
      const rows = [
        { ref: "Q-100", total: "$1,200.00", hours: 4.5 },
      ];
      return renderToStaticMarkup(
        <DataTable
          columns={columns}
          rows={rows}
          hideEmptyColumns={false}
          renderRow={(r) => (
            <tr key={r.ref}>
              <td>{r.ref}</td>
              <td>{r.total}</td>
              <td>{r.hours}</td>
            </tr>
          )}
        />
      );
    }
  `);

  const html = mod.default();
  // Headers
  assert.ok(html.includes('class="px-6 py-3 whitespace-nowrap text-right">Total Amount'), "Total Amount header must be text-right");
  assert.ok(html.includes('class="px-6 py-3 whitespace-nowrap text-right">Hours'), "Hours header must be text-right");
  // Body cells must receive text-right, tabular-nums, and data-label
  assert.ok(html.includes('data-label="Total Amount"'), "Cell must receive data-label");
  assert.ok(html.includes("text-right"), "Body cells in numeric columns must receive text-right");
  assert.ok(html.includes("[font-variant-numeric:tabular-nums]"), "Body cells must receive tabular-nums");
});

test("DataTable preserves colspan rows and their child attributes", async () => {
  const mod = await renderEntry("colspanTable", `
    import React from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import DataTable from ${JSON.stringify(path.resolve("src/components/DataTable.jsx"))};

    export default function render() {
      const columns = ["Col1", "Col2", "Col3"];
      const rows = [
        { id: "1", type: "data", text: "Regular row" },
        { id: "2", type: "summary", text: "Summary across all columns" },
      ];
      return renderToStaticMarkup(
        <DataTable
          columns={columns}
          rows={rows}
          renderRow={(r) => {
            if (r.type === "summary") {
              return (
                <tr key={r.id}>
                  <td colSpan={3} className="font-bold text-center bg-gray-50">{r.text}</td>
                </tr>
              );
            }
            return (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.text}</td>
                <td>Data</td>
              </tr>
            );
          }}
        />
      );
    }
  `);

  const html = mod.default();
  assert.ok(html.includes('colSpan="3"'), "Colspan attribute must be preserved");
  assert.ok(html.includes("Summary across all columns"), "Colspan text must be rendered");
  assert.ok(html.includes("bg-gray-50"), "Colspan cell custom classes must be preserved");
});

test("DataTable opt-in column hiding hides empty columns when hideEmptyColumns is true and keeps column 0", async () => {
  const mod = await renderEntry("emptyHiding", `
    import React from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import DataTable from ${JSON.stringify(path.resolve("src/components/DataTable.jsx"))};

    export default function render() {
      const columns = ["ID", "EmptyCol", "FilledCol"];
      const rows = [
        { id: "1", empty: "", filled: "Yes" },
        { id: "2", empty: "\u2014", filled: "Yes" },
      ];
      return renderToStaticMarkup(
        <DataTable
          columns={columns}
          rows={rows}
          hideEmptyColumns={true}
          renderRow={(r) => (
            <tr key={r.id}>
              <td>{r.id}</td>
              <td>{r.empty}</td>
              <td>{r.filled}</td>
            </tr>
          )}
        />
      );
    }
  `);

  const html = mod.default();
  assert.ok(html.includes("ID</th>"), "Column 0 must never be hidden");
  assert.ok(!html.includes("EmptyCol</th>"), "Truly empty column must be hidden when opt-in is enabled");
  assert.ok(html.includes("FilledCol</th>"), "Filled column must remain visible");
});
