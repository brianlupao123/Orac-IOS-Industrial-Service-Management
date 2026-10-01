import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { materialUsageProblem, materialSubmission, submitMaterialUsage } from "../src/inventoryModel.js";

// Field material entry is BLOCKED (no server-side cost source, no technician-safe item lookup).
// These tests cover the dormant idempotency helper, and pin the blocked state so nothing is wired by accident.

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const item = { catalog_item_id: "cat-1", item_code: "FX-1", item_name: "Fixture Gasket", unit_of_measure: "each", unit_cost: 5 };
const form = (o = {}) => ({ quantity_used: "2", ...o });
const keys = () => { let n = 0; return () => `ui-key-${++n}`; };
const fresh = () => ({ attempt: { signature: null, key: null }, flight: { active: false } });

test("the same entry retried after a failure reuses the same idempotency key", async () => {
  const s = fresh(); const mk = keys(); const sent = [];
  const failing = async (id, body) => { sent.push(body); throw new Error("timeout"); };
  const a = await submitMaterialUsage({ ...s, dispatchId: "d-1", form: form(), item, send: failing, makeKey: mk });
  const b = await submitMaterialUsage({ ...s, dispatchId: "d-1", form: form(), item, send: failing, makeKey: mk });
  assert.equal(a.status, "failed"); assert.equal(b.status, "failed");
  assert.equal(sent[0].idempotency_key, sent[1].idempotency_key);
});

test("a successful save clears the key, so the next entry - even an identical one - gets a new key", async () => {
  const s = fresh(); const mk = keys(); const sent = [];
  const ok = async (id, body) => { sent.push(body); return {}; };
  assert.equal((await submitMaterialUsage({ ...s, dispatchId: "d-1", form: form(), item, send: ok, makeKey: mk })).status, "saved");
  assert.equal((await submitMaterialUsage({ ...s, dispatchId: "d-1", form: form(), item, send: ok, makeKey: mk })).status, "saved");
  assert.notEqual(sent[0].idempotency_key, sent[1].idempotency_key);
});

test("editing the quantity, item or dispatch after a failure gets a new key", async () => {
  const mk = keys(); const sent = []; const s = fresh();
  const failing = async (id, body) => { sent.push(body); throw new Error("x"); };
  const run = (dispatchId, f, it = item) => submitMaterialUsage({ ...s, dispatchId, form: f, item: it, send: failing, makeKey: mk });
  await run("d-1", form());
  await run("d-1", form({ quantity_used: "3" }));
  await run("d-2", form({ quantity_used: "3" }));
  await run("d-2", form({ quantity_used: "3" }), { ...item, catalog_item_id: "cat-2", item_name: "Other" });
  assert.equal(new Set(sent.map((x) => x.idempotency_key)).size, 4);
});

test("a double click while a request is in flight is blocked and sends nothing", async () => {
  const s = fresh(); let calls = 0; let release;
  const slow = () => { calls += 1; return new Promise((resolve) => { release = resolve; }); };
  const first = submitMaterialUsage({ ...s, dispatchId: "d-1", form: form(), item, send: slow });
  const second = await submitMaterialUsage({ ...s, dispatchId: "d-1", form: form(), item, send: slow });
  assert.equal(second.status, "blocked");
  release({});
  assert.equal((await first).status, "saved");
  assert.equal(calls, 1);
  assert.equal(s.flight.active, false);
});

test("the cost is never typed: it comes only from the server-supplied item, and an item without a usable cost is refused (never defaulted to zero)", async () => {
  const s = fresh(); let calls = 0; const send = async () => { calls += 1; };
  for (const bad of [{ ...item, unit_cost: null }, { ...item, unit_cost: undefined }, { ...item, unit_cost: 0 }, { ...item, unit_cost: -1 }, { ...item, unit_cost: "abc" }]) {
    assert.equal((await submitMaterialUsage({ ...s, dispatchId: "d-1", form: form(), item: bad, send })).status, "invalid");
  }
  assert.equal(calls, 0);
  const body = materialSubmission({ signature: null, key: null }, "d-1", form({ unit_cost: "999" }), item, () => "ui-abcdef12");
  assert.equal(body.unit_cost, 5, "a cost typed into the form is ignored");
});

test("invalid entries are refused locally with no request and no key consumed", async () => {
  const s = fresh(); let calls = 0; const send = async () => { calls += 1; };
  for (const f of [form({ quantity_used: "" }), form({ quantity_used: "0" }), form({ quantity_used: "-1" }), form({ quantity_used: "abc" })]) {
    assert.equal((await submitMaterialUsage({ ...s, dispatchId: "d-1", form: f, item, send })).status, "invalid");
  }
  assert.equal((await submitMaterialUsage({ ...s, dispatchId: "", form: form(), item, send })).status, "invalid");
  assert.equal((await submitMaterialUsage({ ...s, dispatchId: "d-1", form: form(), item: null, send })).status, "invalid");
  assert.equal(calls, 0);
  assert.equal(s.attempt.key, null);
  assert.match(materialUsageProblem(form({ quantity_used: "0" }), item), /greater than zero/);
});

test("the request body has exactly the fields the server schema accepts and a valid key; never an override", () => {
  const body = materialSubmission({ signature: null, key: null }, "d-1", form({ quantity_used: "2.5" }), item, () => "ui-abcdef12");
  assert.deepEqual(body, { catalog_item_id: "cat-1", description: "Fixture Gasket", quantity_used: 2.5, unit_cost: 5, unit_of_measure: "each", idempotency_key: "ui-abcdef12" });
  assert.match(materialSubmission({ signature: null, key: null }, "d-1", form(), item).idempotency_key, /^[A-Za-z0-9._:-]{8,128}$/);
});

test("BLOCKED STATE: no screen or API client exposes field material entry, a technician item lookup, or the stock/catalog lists to field roles", () => {
  const root = fileURLToPath(new URL("../src", import.meta.url));
  const walk = (dir) => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
  const callers = walk(root).filter((f) => /\.(js|jsx)$/.test(f) && !f.endsWith("inventoryModel.js") && !f.endsWith("client.js"))
    .filter((f) => /addMaterialUsage|submitMaterialUsage|materialSubmission/.test(readFileSync(f, "utf8")));
  assert.deepEqual(callers, [], "nothing may call the material-entry helper until the server contract exists");
  const page = read("src/pages/WorksheetsPage.jsx");
  assert.doesNotMatch(page, /addMaterialUsage|submitMaterialUsage|materialSubmission/, "WorksheetsPage has no material-entry action");
  assert.doesNotMatch(read("src/components/AssignedMaterialsPanel.jsx"), /addMaterialUsage|submitMaterialUsage|materialSubmission/, "assigned-material status is read-only");
  const client = read("src/api/client.js");
  assert.doesNotMatch(client, /materials\/options/, "no technician item lookup exists in the client");
  assert.match(client, /materials\/status/, "read-only assigned-job material status remains allowed");
});

test("pilot boundary: no direct-sale / cash-sale path exists in the frontend - no API call, route, form option or action", () => {
  const root = fileURLToPath(new URL("../src", import.meta.url));
  const walk = (dir) => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
  const banned = /direct[-_ ]?sale|cash[-_ ]?sale|walk[-_ ]?in[-_ ]sale|counter[-_ ]sale/i;
  // The single permitted occurrence is InventoryPage's pre-existing READ-ONLY display label that
  // names a reference type if such a record ever exists. It creates, selects and sends nothing.
  const allowedLabel = /^\s*direct_sale:\s*"Direct sale issue",?\s*$/;
  const hits = [];
  for (const file of walk(root).filter((f) => /\.(js|jsx)$/.test(f))) {
    readFileSync(file, "utf8").split(/\r?\n/).forEach((line, i) => {
      if (banned.test(line) && !(file.endsWith("InventoryPage.jsx") && allowedLabel.test(line))) hits.push(`${file}:${i + 1}`);
    });
  }
  assert.deepEqual(hits, []);
  const pageSrc = read("src/pages/InventoryPage.jsx");
  assert.equal((pageSrc.match(/direct_sale/g) || []).length, 1, "only the display label; no option value, payload or handler");
  assert.equal(/<option[^>]*direct_sale/.test(pageSrc), false);
  assert.equal(/movements\/direct-sale/.test(read("src/api/client.js")), false, "the client has no call to the dormant endpoint");
});
