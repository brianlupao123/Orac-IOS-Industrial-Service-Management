import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("V5 commercial UI is dark by default", async () => {
  delete process.env.VITE_ORAC_V5_COMMERCIAL_WORKFLOW;
  const flags = await import(`../src/v5CommercialFlags.js?${Date.now()}`);
  assert.equal(flags.v5CommercialEnabled(), false);
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
