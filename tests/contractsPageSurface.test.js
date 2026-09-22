import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const page = read("src/pages/ContractsPage.jsx");
const client = read("src/api/client.js");
const model = read("src/contractsModel.js");

// The contracts API block inside client.js, so checks cannot be satisfied by
// unrelated code elsewhere in the file.
const apiBlock = client.slice(client.indexOf("export const contracts"));

// Every opening <button ...> tag, read with brace depth so `=>` inside an
// onClick does not end the tag early.
function buttonTags(source) {
  const tags = [];
  for (let index = source.indexOf("<button"); index !== -1; index = source.indexOf("<button", index + 1)) {
    let depth = 0; let quote = null; let end = index;
    for (; end < source.length; end += 1) {
      const char = source[end];
      if (quote) { if (char === quote) quote = null; continue; }
      if (char === '"' || char === "'") { quote = char; continue; }
      if (char === "{") depth += 1;
      else if (char === "}") depth -= 1;
      else if (char === ">" && depth === 0 && source[end - 1] !== "=") break;
    }
    tags.push(source.slice(index, end + 1));
  }
  return tags;
}

test("client.js exposes explicit contract and schedule endpoints with the right verbs", () => {
  assert.match(apiBlock, /request\("\/contracts"\)/);
  assert.match(apiBlock, /request\("\/contracts", \{ method: "POST"/);
  assert.match(apiBlock, /`\/contracts\/\$\{encodeURIComponent\(id\)\}`, \{ method: "PATCH"/);
  assert.match(apiBlock, /request\("\/maintenance-schedules"\)/);
  assert.match(apiBlock, /request\("\/maintenance-schedules", \{ method: "POST"/);
  assert.match(apiBlock, /`\/maintenance-schedules\/\$\{encodeURIComponent\(id\)\}`, \{ method: "PATCH"/);
});

test("contract API uses the shared request helper: no raw fetch, storage, or delete", () => {
  assert.doesNotMatch(apiBlock, /\bfetch\(/);
  assert.doesNotMatch(apiBlock, /localStorage|sessionStorage/);
  assert.doesNotMatch(apiBlock, /DELETE/);
  assert.doesNotMatch(apiBlock, /\bcontract_number\b|created_by_user_id/, "server-owned fields must never be sent");
});

test("page reads through the dedicated API, not the generic collection route", () => {
  assert.match(page, /import \{[^}]*\bcontracts\b[^}]*\bmaintenanceSchedules\b[^}]*\} from "\.\.\/api\/client\.js"/);
  assert.match(page, /contracts\.list\(\)/);
  assert.match(page, /maintenanceSchedules\.list\(\)/);
  assert.match(page, /contracts\.create\(/);
  assert.match(page, /contracts\.update\(/);
  assert.match(page, /maintenanceSchedules\.create\(/);
  assert.match(page, /maintenanceSchedules\.update\(/);
  assert.doesNotMatch(page, /collections\.list\(\s*["'](?:contracts|maintenance_schedules)["']/);
});

test("page has no swallowed failures, raw fetch, browser storage, alert or reload", () => {
  assert.doesNotMatch(page, /\.catch\(\s*\(\s*\w*\s*\)\s*=>/, "no promise .catch fallbacks");
  assert.doesNotMatch(page, /\|\|\s*\{\s*data/, "no { data } fallbacks");
  assert.doesNotMatch(page, /\bdata\.data\b|\.data\s*\|\|\s*\[\]/, "arrays are used directly");
  assert.doesNotMatch(page, /\bfetch\(/);
  assert.doesNotMatch(page, /localStorage|sessionStorage/);
  assert.doesNotMatch(page, /\balert\(/);
  assert.doesNotMatch(page, /location\.reload/);
  assert.match(page, /asList\(/, "responses are checked, not assumed");
  assert.match(page, /Promise\.allSettled/);
});

test("every button in the page does something", () => {
  const tags = buttonTags(page);
  assert.ok(tags.length >= 6, `expected several buttons, found ${tags.length}`);
  for (const tag of tags) {
    assert.ok(/onClick=/.test(tag) || /type="submit"/.test(tag), `button without a handler: ${tag.slice(0, 80)}`);
  }
  for (const label of ["New contract", "Add schedule", "Save contract", "Save schedule", "Try again", "Cancel"]) {
    assert.ok(page.includes(label), `${label} is present`);
  }
});

test("create actions are gated by role capability helpers", () => {
  assert.match(page, /canManageContracts\(role\)/);
  assert.match(page, /canManageSchedules\(role\)/);
  // The gate must wrap the actual button, not merely appear somewhere earlier.
  assert.match(page, /\{manageContracts && !contractDraft && \(\s*<button[\s\S]*?>New contract<\/button>/);
  assert.match(page, /\{manageSchedules && !scheduleDraft && openContracts\.length > 0 && \(\s*<button[\s\S]*?>Add schedule<\/button>/);
  assert.match(page, /manageContracts && isContractOpen\(contract\)/, "contract Edit is manager-only");
  assert.match(page, /manageSchedules && isContractOpen\(contract\)/, "schedule Edit is manager-only");
});

test("loading, empty, error, submitting and success states are all visible", () => {
  for (const marker of [
    "contracts-loading", "contracts-load-error", "contracts-ready", "contracts-list-empty", "schedules-list-empty",
    "contracts-lookup-warning", "contract-form-error", "schedule-form-error"
  ]) assert.ok(page.includes(`data-evidence="${marker}"`), marker);
  assert.match(page, /data-evidence=\{`\$\{notice\.kind\}-saved`\}/);
  assert.match(page, /role="alert"/);
  assert.match(page, /role="status"/);
  assert.match(page, /Saving contract/);
  assert.match(page, /Saving schedule/);
});

test("form controls are labelled and report validity", () => {
  assert.match(page, /htmlFor=\{id\}/);
  assert.match(page, /"aria-invalid"/);
  assert.match(page, /"aria-describedby"/);
  const inputs = (page.match(/<(?:input|select|textarea)\b/g) || []).length;
  assert.ok(inputs >= 10, `expected the form controls, found ${inputs}`);
});

test("new frontend files stay ASCII-only (the repo has prior mojibake)", () => {
  for (const [name, source] of [["ContractsPage.jsx", page], ["contractsModel.js", model], ["client.js additions", apiBlock]]) {
    assert.doesNotMatch(source, /[^\x00-\x7F]/, name);
  }
});
