import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/api/client.js", import.meta.url), "utf8").replaceAll("import.meta.env", "globalThis.__ORAC_TEST_ENV__");
const store = new Map([["orac_token", "t"]]);
globalThis.__ORAC_TEST_ENV__ = { PROD: false, VITE_API_BASE_URL: "http://api.test" };
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
const calls = [];
globalThis.fetch = async (url, options = {}) => {
  calls.push({ url, method: options.method || "GET", body: options.body === undefined ? undefined : JSON.parse(options.body) });
  return { ok: true, status: 200, json: async () => ({ success: true, data: { ok: true } }) };
};
const { accessRequests, notifications } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const last = () => calls.at(-1);

test("approve sends the Admin's chosen role and client as plain strings (regression: an object used to be sent as `role`)", async () => {
  await accessRequests.approve("areq_1", { role: "Client Viewer", client_id: "c1" });
  assert.equal(last().url, "http://api.test/access-requests/areq_1/approve");
  assert.deepEqual(last().body, { role: "Client Viewer", client_id: "c1" });
  assert.equal(typeof last().body.role, "string");
});

test("the older positional form still produces the same body", async () => {
  await accessRequests.approve("areq_2", "Technician", undefined);
  assert.deepEqual(last().body, { role: "Technician" });
});

test("reject passes the reason; setup link is a POST with no body and returns what the server sent", async () => {
  await accessRequests.reject("areq_3", "not an employee");
  assert.deepEqual(last().body, { reason: "not an employee" });
  await accessRequests.issueSetupLink("areq_4");
  assert.equal(last().url, "http://api.test/access-requests/areq_4/setup-link");
  assert.equal(last().method, "POST");
  assert.equal(last().body, undefined);
});

test("notification endpoints are per-user read endpoints", async () => {
  await notifications.markRead("n_1");
  assert.equal(last().url, "http://api.test/notifications/n_1/read");
  await notifications.markAllRead();
  assert.equal(last().url, "http://api.test/notifications/read-all");
});
