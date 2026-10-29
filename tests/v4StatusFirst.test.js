import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const require_ = createRequire(import.meta.url);
const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

async function renderEntry(name, source) {
  const { buildSync } = require_("esbuild");
  const baseDir = fileURLToPath(new URL("..", import.meta.url));
  const dir = fs.mkdtempSync(path.join(baseDir, ".orac-ssr-v4-"));
  const entry = path.join(dir, `${name}.jsx`);
  fs.writeFileSync(entry, source);
  const out = path.join(dir, `${name}.mjs`);
  try {
    buildSync({
      entryPoints: [entry], outfile: out, bundle: true, format: "esm", platform: "node", jsx: "automatic",
      external: ["react", "react-dom", "react/jsx-runtime", "react-router-dom"],
      absWorkingDir: baseDir, logLevel: "silent",
      define: { "import.meta.env": JSON.stringify({ PROD: false }) },
    });
    return await import(pathToFileURL(out).href);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("StatusSummary leads with the status name and meaning; the count is a secondary pill", async () => {
  const mod = await renderEntry("summary", `
    import React from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import StatusSummary from ${JSON.stringify(path.resolve("src/components/StatusSummary.jsx"))};
    export const html = renderToStaticMarkup(
      <StatusSummary label="Quotes by stage" items={[
        { key: "a", label: "Approved Pending PO", meaning: "Client approved. Waiting for a purchase order.", count: 5, tone: "warning" },
        { key: "s", label: "Sent", meaning: "Sent to the client.", count: 1, tone: "info" },
        { key: "d", label: "Draft", count: 0 },
      ]} />);
    export const empty = renderToStaticMarkup(<StatusSummary items={[]} />);
  `);
  assert.match(mod.html, /aria-label="Quotes by stage"/);
  assert.ok(mod.html.indexOf("Approved Pending PO") < mod.html.indexOf("Client approved") && mod.html.indexOf("Client approved") < mod.html.indexOf(">5<"));
  assert.doesNotMatch(mod.html, /text-3xl|text-4xl/);
  assert.match(mod.html, /5<span class="sr-only"> records<\/span>/);
  assert.match(mod.html, /1<span class="sr-only"> record<\/span>/);
  assert.equal(mod.empty, "");
});

test("IconStatCard statusFirst puts label and meaning first and the count in a pill; the default layout is unchanged", async () => {
  const mod = await renderEntry("card", `
    import React from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import IconStatCard from ${JSON.stringify(path.resolve("src/components/IconStatCard.jsx"))};
    import { ICONS } from ${JSON.stringify(path.resolve("src/components/icons.jsx"))};
    const base = { label: "Blocked Amendments", value: 3, iconPath: ICONS.warning, tone: "red", subtitle: "POs requiring amendment", evidenceTarget: "evidence-kpi-blocked-amendments", onClick: () => {} };
    export const first = renderToStaticMarkup(<IconStatCard {...base} statusFirst />);
    export const plain = renderToStaticMarkup(<IconStatCard {...base} />);
    export const zero = renderToStaticMarkup(<IconStatCard {...base} value={0} statusFirst />);
  `);
  const { first, plain, zero } = mod;
  assert.ok(first.indexOf("Blocked Amendments") < first.indexOf("POs requiring amendment") && first.indexOf("POs requiring amendment") < first.indexOf('data-evidence="status-count"'));
  assert.doesNotMatch(first, /text-2xl|text-3xl/);
  assert.match(first, /id="evidence-kpi-blocked-amendments"/);
  assert.match(first, /<button type="button"/);
  assert.match(first, /3<span class="sr-only"> records<\/span>/);
  // default layout: large numeral under the label, as before
  assert.match(plain, /text-2xl font-bold tabular-nums sm:text-3xl/);
  assert.doesNotMatch(plain, /status-count/);
  // zero is still rendered neutral, never tinted
  assert.doesNotMatch(zero, /border-red-300/);
});

test("Reports: categorical summaries lead with the status; numeric measures use shared USD formatting, and evidence actions remain", () => {
  const page = read("src/pages/ReportsPage.jsx");
  assert.equal((page.match(/<StatusSummary /g) || []).length, 5);
  // StatCard stays only on the Variance tab (a count of POs over budget and a money total).
  assert.equal((page.match(/<StatCard /g) || []).length, 2);
  assert.match(page, /<StatCard label="Total Variance" value=\{formatMoney\(totalVariance\)\}/);
  assert.match(page, /import \{ formatMoney, formatNumber, formatSignedMoney \} from "\.\.\/lib\/format\.js"/);
  assert.match(page, /\{formatMoney\(row\.total_amount\)\}/);
  assert.match(page, /\{formatMoney\(row\.po_amount\)\}/);
  assert.match(page, /\{formatSignedMoney\(variance\)\}/);
  assert.doesNotMatch(page, /R \{(?:Number|formatNumber)\(/);
  // owner wording, sections, legacy exception treatment
  assert.match(page, /label: "Legacy dispatch exceptions"/);
  assert.match(page, /<p role="note" className="text-sm text-red-800">Legacy records only: work started before PO verification\./);
  assert.match(page, /Legacy Exceptions: Dispatch Started Before PO Verification/);
  assert.match(page, /Exception - PO unverified/);
  assert.match(page, /label: "Dispatches ready for pricing review"/);
  for (const id of ["pipeline-summary-title", "po-summary-title", "timesheet-summary-title", "invoice-ready-summary-title"]) assert.match(page, new RegExp(`id="${id}"`));
  assert.match(page, /evidenceAction\("quotes", row\.id\)/);
  assert.match(page, /actionLabel="Evidence"/);
  assert.doesNotMatch(page, /[^\x00-\x7F]/);
});

test("Dashboard: only workflow categories are status-first; totals and scope counts keep the numeral", () => {
  const dash = read("src/pages/DashboardPage.jsx");
  for (const key of ["access_requests", "blocked_amendments", "worksheets_review", "returned_for_correction", "returned_worksheets", "submitted_worksheets"]) {
    assert.match(dash, new RegExp(`key="${key}"\\s+statusFirst\\b`), key);
  }
  assert.equal((dash.match(/statusFirst/g) || []).length, 6);
  for (const key of ["field_worksheets", "assigned_dispatches", "my_active_dispatches", "my_worksheets"]) {
    assert.doesNotMatch(dash, new RegExp(`key="${key}"\\s+statusFirst`), key);
  }
  assert.doesNotMatch(dash, /<IconStatCard\s+label="Total (Quotes|Clients)"[\s\S]{0,200}statusFirst/);
});

test("dashboard totals use the purpose-led card treatment", () => {
  const card = read("src/components/IconStatCard.jsx");
  assert.match(card, /text-lg font-bold leading-snug/);
  assert.match(card, /text-2xl font-semibold tabular-nums sm:text-\[28px\]/);
});

test("shared StatCard keeps the purpose prominent and the number secondary", () => {
  const card = read("src/components/StatCard.jsx");
  assert.match(card, /text-lg font-bold leading-snug/);
  assert.match(card, /text-2xl font-semibold tabular-nums opacity-75 sm:text-\[28px\]/);
});

test("administration summary cards use the purpose-led treatment", () => {
  const page = read("src/pages/AdminPage.jsx");
  for (const label of ["Total Active Users", "Registered Clients", "System Status"]) {
    assert.match(page, new RegExp(`<IconStatCard label="${label}" labelFirst`));
  }
});

test("client PO controls retain the approved USD-only display contract", () => {
  const client = read("src/pages/ClientPortalPage.jsx");
  assert.match(client, /\{q\.quote_number \|\| q\.id\} \(\{formatMoney\(q\.total_amount\)\}\)/);
  assert.match(client, /PO Amount \(USD\)/);
  assert.doesNotMatch(client, /\(R \{q\.total_amount\}\)|PO Amount \(R\)/);
  assert.match(read("src/pages/ContractsPage.jsx"), /Total value \(USD, optional\)/);
});
