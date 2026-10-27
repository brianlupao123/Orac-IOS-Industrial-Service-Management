import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/pages/ClientPortalPage.jsx", import.meta.url), "utf8");

test("Client Portal permits only issued quotation states", () => {
  for (const status of ["Sent", "Approved_Pending_PO", "PO_Verified", "Field_Dispatch", "Invoiced"]) {
    assert.match(source, new RegExp(`"${status}"`));
  }
  assert.match(source, /CLIENT_VISIBLE_QUOTE_STATUSES\.has\(item\.status\)/);
  assert.doesNotMatch(source, /item\.status !== "Draft"/);
});

test("Client Portal PO controls retain explicit labels and touch-safe actions", () => {
  for (const id of ["client-po-quote", "client-po-reference", "client-po-amount", "client-po-document-reference"]) {
    assert.match(source, new RegExp(`htmlFor="${id}"`));
    assert.match(source, new RegExp(`id="${id}"`));
  }
  assert.match(source, /min-h-11 w-full rounded-lg bg-orac-blue/);
  assert.match(source, /inline-flex min-h-11 items-center rounded border border-orac-blue/);
});
