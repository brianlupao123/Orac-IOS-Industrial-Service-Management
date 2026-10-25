import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readDeepLinkId, findRecordElement, recordHref } from "../src/lib/deepLink.js";

const require_ = createRequire(import.meta.url);
const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

async function renderEntry(name, source) {
  const { buildSync } = require_("esbuild");
  const baseDir = fileURLToPath(new URL("..", import.meta.url));
  const dir = fs.mkdtempSync(path.join(baseDir, ".orac-ssr-p7-"));
  const entry = path.join(dir, `${name}.jsx`);
  fs.writeFileSync(entry, source);
  const out = path.join(dir, `${name}.mjs`);
  try {
    buildSync({
      entryPoints: [entry], outfile: out, bundle: true, format: "esm", platform: "node", jsx: "automatic",
      external: ["react", "react-dom", "react/jsx-runtime", "react-router-dom", "react-dom/server"],
      absWorkingDir: baseDir, logLevel: "silent", define: { "import.meta.env": JSON.stringify({ PROD: false }) },
    });
    return await import(pathToFileURL(out).href);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("deep link ids: only short plain ids are accepted, everything else is ignored", () => {
  assert.equal(readDeepLinkId("?quote=q-123", "quote"), "q-123");
  assert.equal(readDeepLinkId("?quote=abc_DEF-9", "quote"), "abc_DEF-9");
  for (const bad of ["", "?quote=", "?quote=a b", "?quote=<script>", "?quote=../x", "?quote=" + "a".repeat(65), "?other=1", "?quote=a%27b"]) {
    assert.equal(readDeepLinkId(bad, "quote"), "", `should ignore ${bad}`);
  }
  assert.equal(readDeepLinkId(undefined, "quote"), "");
});

test("deep link lookup compares attribute values and never builds a selector from the id", () => {
  const els = [{ getAttribute: () => "a" }, { getAttribute: () => "b\"]" }];
  const root = { querySelectorAll: () => els };
  assert.equal(findRecordElement(root, "a"), els[0]);
  assert.equal(findRecordElement(root, "zzz"), null);
  assert.equal(findRecordElement(root, ""), null);
  assert.equal(findRecordElement(null, "a"), null);
  assert.equal(recordHref("/quotations", "quote", "q 1&x=2"), "/quotations?quote=q%201%26x%3D2");
  assert.equal(recordHref("/job-cards", "id", "job/1"), "/job-cards/job%2F1");
});

test("deepLink.js is read-only: no network, storage, writes or API client", () => {
  const src = read("src/lib/deepLink.js");
  assert.doesNotMatch(src, /fetch\(|XMLHttpRequest|localStorage|sessionStorage|api\/client|method:|\.innerHTML|eval\(/);
});

test("RecordLink follows the route guard: shown only to roles that may open the destination", async () => {
  const mod = await renderEntry("rl", `
    import React from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import { MemoryRouter } from "react-router-dom";
    import RecordLink from ${JSON.stringify(path.resolve("src/components/RecordLink.jsx"))};
    const r = (role, props) => renderToStaticMarkup(<MemoryRouter><RecordLink user={{ role }} {...props} /></MemoryRouter>);
    export const admin = r("Admin", { path: "/quotations", param: "quote", id: "q-1", what: "quote", name: "Q-1001" });
    export const finance = r("Finance", { path: "/quotations", param: "quote", id: "q-1", what: "quote", name: "Q-1001" });
    export const financePo = r("Finance", { path: "/finance", param: "po", id: "po-9", what: "purchase order", name: "PO-77" });
    export const jobCard = r("Management", { path: "/job-cards", param: "id", id: "job-1", what: "job card", name: "JOB-1" });
    export const invoiceReadiness = r("Finance", { path: "/invoice-readiness", param: "id", id: "job-1", what: "invoice readiness", name: "JOB-1" });
    export const tech = r("Technician", { path: "/finance", param: "po", id: "po-9", what: "purchase order", name: "PO-77" });
    export const noId = r("Admin", { path: "/quotations", param: "quote", id: "", what: "quote", name: "x" });
  `);
  assert.match(mod.admin, /href="\/quotations\?quote=q-1"/);
  assert.match(mod.admin, /aria-label="Open quote Q-1001"/);
  assert.match(mod.admin, /min-h-\[44px\] min-w-\[44px\]/);
  assert.equal(mod.finance, "");   // Finance cannot open /quotations
  assert.match(mod.financePo, /href="\/finance\?po=po-9"/);
  assert.match(mod.jobCard, /href="\/job-cards\/job-1"/);
  assert.match(mod.invoiceReadiness, /href="\/invoice-readiness\/job-1"/);
  assert.equal(mod.tech, "");      // Technician cannot open /finance
  assert.equal(mod.noId, "");
});


test("Reports: record links join the existing Action cell; evidence buttons, columns and wording stay", () => {
  const r = read("src/pages/ReportsPage.jsx");
  assert.match(r, /const canQuote = canAccessRoute\(user\.role, "\/quotations"\);/);
  assert.match(r, /const canFinance = canAccessRoute\(user\.role, "\/finance"\);/);
  assert.match(r, /const canTimesheets = canAccessRoute\(user\.role, "\/worksheets"\);/);
  assert.match(r, /const canJobCards = canAccessRoute\(user\.role, "\/job-cards"\);/);
  assert.match(r, /const canInvoiceReadiness = canAccessRoute\(user\.role, "\/invoice-readiness"\);/);
  assert.equal((r.match(/<RecordLink /g) || []).length, 10);
  // every evidence action that existed before is still there
  assert.equal((r.match(/evidenceAction\("quotes", row\.id\)/g) || []).length, 2);
  assert.equal((r.match(/evidenceAction\("purchase_orders", row\.id\)/g) || []).length, 3);
  assert.equal((r.match(/evidenceAction\("field_worksheets", row\.id\)/g) || []).length, 2);
  assert.equal((r.match(/evidenceAction\("dispatch_cards", row\.id/g) || []).length, 2);
  assert.match(r, /user\.role === "Supervisor" \? <span[^>]*>Not available to this role/);
  assert.doesNotMatch(r, /columns=\{\[[^\]]*"Action"/);   // the Action column still comes from DataTable renderActions
  assert.doesNotMatch(r, /[^\x00-\x7F]/);
});
