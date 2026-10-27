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
