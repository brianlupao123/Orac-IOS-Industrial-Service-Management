import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
test("document workspace exposes all protected quote-to-invoice PDF endpoints", () => {
  const client = read("src/api/client.js");
  for (const path of ["/documents/quotes/", "/documents/purchase-orders/", "/documents/job-cards/", "/documents/worksheets/", "/documents/invoices/"]) assert.match(client, new RegExp(path.replace(/[/.]/g, "\\$&")));
  assert.match(read("src/pages/DocumentsPage.jsx"), /data-evidence="documents-ready"/);
});

test("client quotation PDF link uses the canonical protected quote-document route", () => {
  const clientPortal = read("src/pages/ClientPortalPage.jsx");
  assert.match(clientPortal, /\/api\/documents\/quotes\/\$\{q\.id\}\.pdf/);
  assert.doesNotMatch(clientPortal, /\/api\/documents\/quote\/\$\{q\.id\}\/pdf/);
});
