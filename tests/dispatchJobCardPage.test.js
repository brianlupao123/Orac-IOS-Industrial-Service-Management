import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("Dispatch Job Card is a read-only evidence summary backed by the scoped server endpoint", () => {
  const page = read("src/pages/DispatchJobCardPage.jsx");
  const client = read("src/api/client.js");
  assert.match(client, /jobCard\(dispatchId\) \{\s*return request\(`\/dispatch_cards\/\$\{encodeURIComponent\(dispatchId\)\}\/job-card`\);/);
  assert.match(page, /dispatch\.jobCard\(id\)/);
  assert.match(page, /Read-only evidence summary/);
  assert.match(page, /No invoice is created from this page\./);
  assert.doesNotMatch(page, /method:\s*"POST"/);
  assert.doesNotMatch(page, /hourly_rate|total_amount|stock_cost|supplier/);
});

test("Dispatch Job Card keeps role-scoped evidence and legacy PO exceptions visible without authorising work", () => {
  const page = read("src/pages/DispatchJobCardPage.jsx");
  const policy = read("src/accessPolicy.js");
  assert.match(policy, /"\/job-cards": \[\.\.\.operationalRoles, ROLES\.TECHNICIAN\]/);
  assert.match(page, /evidence_summary: evidence/);
  assert.match(page, /evidence\.audit\?\.available/);
  assert.match(page, /job-card-started-before-po/);
  assert.match(page, /does not authorise new work without a verified PO/);
  assert.match(page, /job-card-invoice-readiness/);
  assert.match(page, /capabilities\.can_create_timesheet/);
});

test("Dispatch analysis is separately flag-gated and sends only the displayed dispatch id", () => {
  const page = read("src/pages/DispatchJobCardPage.jsx");
  assert.match(page, /recordAnalysisVisible\(\)/);
  assert.match(page, /assistant\.recordAnalysis\("dispatch", id\)/);
  assert.match(page, /Dispatch evidence analysis/);
  assert.doesNotMatch(page, /method:\s*"POST"/);
});

test("Reports link authorised dispatch rows to the Job Card as well as their controlled PDF", () => {
  const page = read("src/pages/ReportsPage.jsx");
  assert.match(page, /const canJobCards = canAccessRoute\(user\.role, "\/job-cards"\)/);
  assert.match(page, /RecordLink user=\{user\} path="\/job-cards" param="id"/);
  assert.match(page, /evidenceAction\("dispatch_cards", row\.id\)/);
});

test("Invoice readiness is a commercial read model, not an invoice writer or V5 estimate", () => {
  const page = read("src/pages/InvoiceReadinessPage.jsx");
  const client = read("src/api/client.js");
  const policy = read("src/accessPolicy.js");
  assert.match(client, /invoiceReadiness\(dispatchId\) \{\s*return request\(`\/dispatch_cards\/\$\{encodeURIComponent\(dispatchId\)\}\/invoice-readiness`\);/);
  assert.match(page, /dispatch\.invoiceReadiness\(id\)/);
  assert.match(policy, /"\/invoice-readiness": \[ROLES\.ADMIN, ROLES\.MANAGEMENT, ROLES\.FINANCE\]/);
  assert.match(page, /This page never creates an invoice\./);
  assert.match(page, /v5-invoice-calculation-blocked/);
  assert.doesNotMatch(page, /method:\s*"POST"/);
});
