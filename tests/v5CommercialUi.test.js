import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("V5 commercial UI is dark by default", async () => {
  delete process.env.VITE_ORAC_V5_COMMERCIAL_WORKFLOW;
  delete process.env.VITE_ORAC_V5_INVOICE_WRITER;
  const flags = await import(`../src/v5CommercialFlags.js?${Date.now()}`);
  assert.equal(flags.v5CommercialEnabled(), false);
  assert.equal(flags.v5InvoiceWriterEnabled(), false);
});

test("V5 invoice writer UI is separately gated and uses evidence-only endpoints", () => {
  const flags = read("src/v5CommercialFlags.js");
  const api = read("src/api/client.js");
  const panel = read("src/components/V5InvoiceWriterPanel.jsx");
  assert.match(flags, /VITE_ORAC_V5_INVOICE_WRITER/);
  for (const path of ["/v5-invoice-draft-workspace", "/v5-invoice-drafts", "/issue"]) assert.ok(api.includes(path), path);
  assert.match(panel, /v5InvoiceWriterEnabled/);
  assert.match(panel, /another authorized user to issue/i);
  assert.equal(/unit_price|hourly_rate|<input[^>]*(?:invoice_number|tax)/i.test(panel), false);
});

test("quotation UI wires V5 revision and acceptance only through server APIs", () => {
  const page = read("src/pages/QuotationsPage.jsx");
  const api = read("src/api/client.js");
  assert.match(page, /v5CommercialEnabled/);
  assert.match(page, /createRevision/);
  assert.match(page, /recordAmendedPoEvidence/);
  assert.match(api, /\/revisions/);
  assert.match(api, /\/amended-po-evidence/);
  assert.equal(/impersonat|hourly_rate/.test(page), false);
});
