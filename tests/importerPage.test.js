import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const require_ = createRequire(import.meta.url);
const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

async function render(source) {
  const { buildSync } = require_("esbuild");
  const baseDir = fileURLToPath(new URL("..", import.meta.url));
  const dir = fs.mkdtempSync(path.join(baseDir, ".orac-ssr-import-"));
  const entry = path.join(dir, "entry.jsx");
  fs.writeFileSync(entry, source);
  const out = path.join(dir, "entry.mjs");
  try {
    buildSync({ entryPoints: [entry], outfile: out, bundle: true, format: "esm", platform: "node", jsx: "automatic",
      external: ["react", "react-dom", "react/jsx-runtime", "react-router-dom"], absWorkingDir: baseDir, logLevel: "silent",
      define: { "import.meta.env": JSON.stringify({ PROD: false }) } });
    return await import(pathToFileURL(out).href);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

test("the Data Import page renders its steps, the phrase fields only after a preview, and the past-imports table", async () => {
  const mod = await render(`
    import React from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import ImporterPage from ${JSON.stringify(path.resolve("src/pages/ImporterPage.jsx"))};
    export const html = renderToStaticMarkup(<ImporterPage />);
  `);
  const { html } = mod;
  assert.match(html, /Data Import/);
  assert.match(html, /1\. What are you importing\?/);
  assert.match(html, /name="import-entity" checked="" value="clients"/);
  assert.match(html, /<label for="import-file"/);
  assert.match(html, /accept="\.csv,text\/csv"/);
  assert.match(html, /Download template \(CSV\)/);
  assert.match(html, /Importing a file needs a larger screen/);
  assert.match(html, /Past imports/);
  assert.match(html, /No imports yet\./);
  assert.doesNotMatch(html, /IMPORT_CLIENTS/);        // confirmation fields appear only after a preview
  assert.doesNotMatch(html, /Import \d+ rows/);
});

test("the API client exposes the five import calls and uses only the shared request helper", () => {
  const client = read("src/api/client.js");
  const block = client.slice(client.indexOf("export const imports"));
  for (const name of ["preview(entity, csvContent)", "commit(entity, body)", "list()", "get(id)", "template(entity)"]) assert.ok(block.includes(name), name);
  assert.doesNotMatch(block, /\bfetch\(|localStorage|sessionStorage|DELETE/);
  assert.match(block, /"\/imports"/);
});

test("the page never changes a currency or number display and adds no dependency", () => {
  const page = read("src/pages/ImporterPage.jsx");
  assert.doesNotMatch(page, /toLocale|formatMoney|\$\{Number|R \{/);
  const pkg = JSON.parse(read("package.json"));
  assert.deepEqual(Object.keys(pkg.dependencies).sort(), ["react", "react-dom", "react-router-dom"]);
});
