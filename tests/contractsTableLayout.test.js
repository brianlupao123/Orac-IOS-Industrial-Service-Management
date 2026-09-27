import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("Contracts and schedules render as scannable tables, not stacked cards", () => {
  const page = read("src/pages/ContractsPage.jsx");
  assert.match(page, /<table className="min-w-full divide-y divide-gray-200 text-sm">/);
  // Both the contracts list and the schedules list are tables now.
  const tableCount = (page.match(/<table className="min-w-full divide-y divide-gray-200 text-sm">/g) || []).length;
  assert.equal(tableCount, 2);
  // Each table scrolls horizontally at narrow widths instead of clipping.
  assert.equal((page.match(/<div className="overflow-x-auto">/g) || []).length, 2);
});

test("Table conversion preserves the original edit-gating and read-only messaging verbatim", () => {
  const page = read("src/pages/ContractsPage.jsx");
  assert.match(page, /manageContracts && isContractOpen\(contract\)/);
  assert.match(page, /manageSchedules && isContractOpen\(contract\)/);
  assert.match(page, /This contract is \{contract\.status\}, so the schedule is read-only\./);
  assert.match(page, /aria-label=\{`Edit contract \$\{contract\.contract_number\}`\}/);
  assert.match(page, /aria-label=\{`Edit schedule for \$\{contract\.contract_number\}`\}/);
});

test("Table headers label every scanned column", () => {
  const page = read("src/pages/ContractsPage.jsx");
  for (const header of ["Contract", "Client", "Period", "Total value", "Status", "Equipment", "Frequency", "Next due"]) {
    assert.ok(page.includes(`>${header}<`), `missing column header: ${header}`);
  }
});
