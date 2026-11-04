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
const { internalWorkRequests: api } = client;
const reset = () => { calls.length = 0; nextResponse = { status: 200, body: { success: true, data: { ok: true } } }; };
const FORGED = ["created_by_user_id", "created_by_role", "client_id", "status", "assigned_to_user_id", "history", "id", "created_at", "updated_at", "resolved_at", "resolution_note", "resolved_by_user_id"];

test("internalWorkRequests exposes exactly the eight approved operations", () => {
  assert.deepEqual(Object.keys(api).sort(), ["acknowledge", "approveTechnician", "create", "detail", "inbox", "options", "outbox", "transition"]);
});

test("options, outbox, inbox and detail are GET requests to the dedicated endpoints", async () => {
  reset();
  await api.options();
  await api.outbox();
  await api.inbox();
  await api.detail("iwr_1");
  assert.deepEqual(calls.map((call) => [call.method, call.url]), [
    ["GET", "http://api.test/internal-work-requests/options"],
    ["GET", "http://api.test/internal-work-requests/outbox"],
    ["GET", "http://api.test/internal-work-requests/inbox"],
    ["GET", "http://api.test/internal-work-requests/iwr_1"]
  ]);
  assert.ok(calls.every((call) => call.headers.Authorization === "Bearer test-token"), "the shared helper adds the token");
});

test("the status filter is a URL-encoded server query and is omitted when empty", async () => {
  reset();
  await api.outbox("In Progress");
  await api.inbox("a b&c");
  await api.outbox("");
  await api.inbox(undefined);
  assert.deepEqual(calls.map((call) => call.url), [
    "http://api.test/internal-work-requests/outbox?status=In%20Progress",
    "http://api.test/internal-work-requests/inbox?status=a%20b%26c",
    "http://api.test/internal-work-requests/outbox",
    "http://api.test/internal-work-requests/inbox"
  ]);
});

test("ids are URL-encoded so they cannot change the path", async () => {
  reset();
  await api.detail("iwr/../options");
  await api.acknowledge("a b");
  await api.transition("x/y", "start");
  assert.deepEqual(calls.map((call) => call.url), [
    "http://api.test/internal-work-requests/iwr%2F..%2Foptions",
    "http://api.test/internal-work-requests/a%20b/acknowledge",
    "http://api.test/internal-work-requests/x%2Fy/transition"
  ]);
});

test("create posts only the whitelisted fields, even if forged fields are passed", async () => {
  reset();
  await api.create({
    request_type: "STOCK_AVAILABILITY", subject: "S", description: "D", priority: "High", recipient_role: "Operations",
    related_entity_type: "quote", related_entity_id: "q_1",
    ...Object.fromEntries(FORGED.map((key) => [key, "forged"]))
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "http://api.test/internal-work-requests");
  assert.equal(calls[0].method, "POST");
  assert.deepEqual(calls[0].body, {
    request_type: "STOCK_AVAILABILITY", subject: "S", description: "D", priority: "High", recipient_role: "Operations",
    related_entity_type: "quote", related_entity_id: "q_1"
  });
  for (const key of FORGED) assert.equal(key in calls[0].body, false, `${key} must not be sent`);
});

test("create leaves out empty optional fields, and a related type without an id, because the server schema is strict", async () => {
  reset();
  await api.create({ request_type: "ADMINISTRATIVE_SUPPORT", subject: "S", description: "D", priority: "", recipient_role: "", related_entity_type: "quote", related_entity_id: "" });
  assert.deepEqual(calls[0].body, { request_type: "ADMINISTRATIVE_SUPPORT", subject: "S", description: "D" });
});

test("acknowledge posts an empty body and sends no status", async () => {
  reset();
  await api.acknowledge("iwr_9");
  assert.equal(calls[0].url, "http://api.test/internal-work-requests/iwr_9/acknowledge");
  assert.equal(calls[0].method, "POST");
  assert.deepEqual(calls[0].body, {});
});

test("transition sends the action and an optional trimmed note, never a status", async () => {
  reset();
  await api.transition("iwr_1", "start");
  await api.transition("iwr_1", "complete", "  Done  ");
  await api.transition("iwr_1", "reject", "   ");
  assert.deepEqual(calls.map((call) => call.body), [{ action: "start" }, { action: "complete", note: "Done" }, { action: "reject" }]);
  assert.ok(calls.every((call) => call.method === "POST" && call.url === "http://api.test/internal-work-requests/iwr_1/transition"));
  assert.ok(calls.every((call) => !("status" in call.body)));
});

test("responses are unwrapped and server errors keep their message and HTTP status", async () => {
  reset();
  nextResponse = { status: 200, body: { success: true, data: [{ id: "iwr_1" }] } };
  assert.deepEqual(await api.outbox(), [{ id: "iwr_1" }]);
  nextResponse = { status: 409, body: { success: false, message: "This request has already been acknowledged." } };
  await assert.rejects(() => api.acknowledge("iwr_1"), (error) => /already been acknowledged/.test(error.message) && error.status === 409 && !error.sessionExpired);
  nextResponse = { status: 403, body: { success: false, message: "Role Supervisor cannot view the internal work request inbox." } };
  await assert.rejects(() => api.inbox(), (error) => /cannot view/.test(error.message) && error.status === 403);
  nextResponse = { status: 404, body: { success: false, message: "Internal work request not found." } };
  await assert.rejects(() => api.detail("nope"), (error) => error.status === 404);
});

test("a 401 clears the session and signals expiry through the shared helper", async () => {
  reset();
  let expired = 0;
  const off = client.onSessionExpired(() => { expired += 1; });
  nextResponse = { status: 401, body: { success: false, message: "Unauthorized. Token invalid." } };
  await assert.rejects(() => api.outbox(), (error) => error.sessionExpired === true && error.status === 401);
  assert.equal(expired, 1);
  assert.equal(store.has("orac_token"), false);
  off();
});

test("the status added to errors did not change existing request handling", async () => {
  reset();
  store.set("orac_token", "test-token");
  nextResponse = { status: 500, body: { success: false } };
  await assert.rejects(() => client.collections.list("quotes"), (error) => /Request failed \(500\)/.test(error.message) && error.status === 500);
  nextResponse = { status: 200, body: { success: true, data: [1] } };
  assert.deepEqual(await client.collections.list("quotes"), [1]);
});

test("create sends a technician registration payload and no subject or description", async () => {
  reset();
  const payload = { first_name: "Tendai", last_name: "Moyo", national_id: "63-123456 A 42", trade: "Welder", worker_type: "contractor", phone_number: "0771234567" };
  await api.create({ request_type: "NEW_TECHNICIAN_REGISTRATION", recipient_role: "Admin", payload, created_by_user_id: "forged", status: "Completed" });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].body, { request_type: "NEW_TECHNICIAN_REGISTRATION", recipient_role: "Admin", payload });
  assert.equal(calls[0].url, "http://api.test/internal-work-requests");
});

test("approveTechnician is one POST to the dedicated endpoint with an empty body and an encoded id", async () => {
  reset();
  await api.approveTechnician("iwr_1");
  await api.approveTechnician("a/b?c");
  assert.deepEqual(calls.map((call) => [call.method, call.url, call.body]), [
    ["POST", "http://api.test/internal-work-requests/iwr_1/approve-technician", {}],
    ["POST", "http://api.test/internal-work-requests/a%2Fb%3Fc/approve-technician", {}]
  ]);
});
