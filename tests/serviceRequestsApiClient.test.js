import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// client.js reads import.meta.env, which only Vite provides. Load the real file
// with that expression pointed at a test object, and stub fetch/localStorage.
const source = readFileSync(new URL("../src/api/client.js", import.meta.url), "utf8")
  .replaceAll("import.meta.env", "globalThis.__ORAC_TEST_ENV__");
assert.equal(source.includes("import.meta"), false, "client.js must not use import.meta for anything but env");

const store = new Map([["orac_token", "test-token"]]);
globalThis.__ORAC_TEST_ENV__ = { PROD: false, VITE_API_BASE_URL: "http://api.test" };
globalThis.localStorage = { getItem: (key) => (store.has(key) ? store.get(key) : null), setItem: (key, value) => store.set(key, String(value)), removeItem: (key) => store.delete(key) };
const calls = [];
let nextResponse = { status: 200, body: { success: true, data: { ok: true } } };
globalThis.fetch = async (url, options = {}) => {
  calls.push({ url, method: options.method || "GET", headers: options.headers, body: options.body === undefined ? undefined : JSON.parse(options.body) });
  return { ok: nextResponse.status < 400, status: nextResponse.status, json: async () => nextResponse.body };
};

const client = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const { serviceRequests } = client;
const reset = () => { calls.length = 0; nextResponse = { status: 200, body: { success: true, data: { ok: true } } }; };
const FORGED = ["client_id", "created_by_user_id", "status", "triaged_by_user_id", "triaged_at", "converted_lead_id", "id", "history"];

test("serviceRequests exposes exactly the five approved operations", () => {
  assert.deepEqual(Object.keys(serviceRequests).sort(), ["convertToLead", "create", "mine", "triage", "triageDecision"]);
});

test("create posts only the whitelisted fields to /service-requests, even if extra fields are passed", async () => {
  reset();
  await serviceRequests.create({
    title: "T", service_need: "N", urgency: "standard", requested_date: "2026-10-05",
    ...Object.fromEntries(FORGED.map((key) => [key, "forged"]))
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "http://api.test/service-requests");
  assert.equal(calls[0].method, "POST");
  assert.deepEqual(calls[0].body, { title: "T", service_need: "N", urgency: "standard", requested_date: "2026-10-05" });
  for (const key of FORGED) assert.equal(key in calls[0].body, false, `${key} must not be sent`);
  assert.equal(calls[0].headers.Authorization, "Bearer test-token");
});

test("create includes optional mine site and equipment tag only when provided", async () => {
  reset();
  await serviceRequests.create({ title: "T", service_need: "N", urgency: "standard", mine_site_id: "ms_1", equipment_tag_id: "eq_1" });
  assert.deepEqual(calls[0].body, { title: "T", service_need: "N", urgency: "standard", mine_site_id: "ms_1", equipment_tag_id: "eq_1" });
});

test("mine and triage use GET; the status filter is URL-encoded and omitted when empty", async () => {
  reset();
  await serviceRequests.mine();
  await serviceRequests.triage();
  await serviceRequests.triage("Converted_To_Lead");
  await serviceRequests.triage("a b&c");
  assert.deepEqual(calls.map((call) => [call.method, call.url]), [
    ["GET", "http://api.test/service-requests/mine"],
    ["GET", "http://api.test/service-requests/triage"],
    ["GET", "http://api.test/service-requests/triage?status=Converted_To_Lead"],
    ["GET", "http://api.test/service-requests/triage?status=a%20b%26c"]
  ]);
});

test("triageDecision sends only the decision and an optional trimmed note", async () => {
  reset();
  await serviceRequests.triageDecision("sr_1", "accept");
  await serviceRequests.triageDecision("sr_1", "decline", "  Out of scope  ");
  await serviceRequests.triageDecision("sr/../1", "acknowledge", "   ");
  assert.deepEqual(calls.map((call) => call.url), [
    "http://api.test/service-requests/sr_1/triage", "http://api.test/service-requests/sr_1/triage", "http://api.test/service-requests/sr%2F..%2F1/triage"
  ]);
  assert.deepEqual(calls.map((call) => call.body), [{ decision: "accept" }, { decision: "decline", note: "Out of scope" }, { decision: "acknowledge" }]);
  assert.ok(calls.every((call) => call.method === "POST"));
});

test("convertToLead posts an empty body to the request's convert-lead endpoint", async () => {
  reset();
  await serviceRequests.convertToLead("sr_9");
  assert.equal(calls[0].url, "http://api.test/service-requests/sr_9/convert-lead");
  assert.equal(calls[0].method, "POST");
  assert.deepEqual(calls[0].body, {});
});

test("responses are unwrapped and server errors surface their message", async () => {
  reset();
  nextResponse = { status: 200, body: { success: true, data: [{ id: "sr_1" }] } };
  assert.deepEqual(await serviceRequests.mine(), [{ id: "sr_1" }]);
  nextResponse = { status: 409, body: { success: false, message: "This service request has already been converted to a lead." } };
  await assert.rejects(() => serviceRequests.convertToLead("sr_1"), /already been converted/);
  nextResponse = { status: 403, body: { success: false, message: "Role Finance cannot triage service requests." } };
  await assert.rejects(() => serviceRequests.triage(), /cannot triage/);
});

test("a 401 clears the session and signals expiry through the shared helper", async () => {
  reset();
  let expired = 0;
  const off = client.onSessionExpired(() => { expired += 1; });
  nextResponse = { status: 401, body: { success: false, message: "Unauthorized. Token invalid." } };
  await assert.rejects(() => serviceRequests.mine(), (error) => error.sessionExpired === true);
  assert.equal(expired, 1);
  assert.equal(store.has("orac_token"), false);
  off();
});
