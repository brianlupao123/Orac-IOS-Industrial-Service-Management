import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/api/client.js", import.meta.url), "utf8")
  .replaceAll("import.meta.env", "globalThis.__ORAC_TEST_ENV__");
const storage = new Map();
globalThis.__ORAC_TEST_ENV__ = { PROD: false, VITE_API_BASE_URL: "http://api.test" };
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key)
};
let response;
let lastRequest;
globalThis.fetch = async (url, options) => {
  lastRequest = { url, body: JSON.parse(options.body) };
  return {
    ok: response.status < 400,
    status: response.status,
    headers: { get: () => "application/json" },
    text: async () => JSON.stringify(response.body)
  };
};
const { auth, onSessionExpired } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);

test("password challenge does not create a session; verified TOTP does", async () => {
  response = { status: 200, body: { success: true, data: { status: "verification_required", challenge_id: "challenge-1", expires_in_seconds: 300 } } };
  const challenge = await auth.login("finance@example.invalid", "password");
  assert.equal(challenge.status, "verification_required");
  assert.equal(storage.has("orac_token"), false);
  response = { status: 200, body: { success: true, data: { user: { id: "u1", role: "Finance" }, token: "verified-token" } } };
  const user = await auth.verifyLoginCode("finance@example.invalid", challenge.challenge_id, "123456");
  assert.equal(user.id, "u1");
  assert.deepEqual(lastRequest.body, { email: "finance@example.invalid", challenge_id: "challenge-1", code: "123456" });
  assert.equal(storage.get("orac_token"), "verified-token");
});

test("recovery code uses its own field and a rejected factor does not emit session-expired", async () => {
  storage.clear();
  let expired = 0;
  const unsubscribe = onSessionExpired(() => { expired += 1; });
  response = { status: 401, body: { success: false, message: "Invalid verification code." } };
  await assert.rejects(auth.verifyLoginCode("finance@example.invalid", "challenge-1", "recovery-value", true), (error) => {
    assert.equal(error.status, 401);
    assert.equal(error.sessionExpired, undefined);
    return true;
  });
  assert.deepEqual(lastRequest.body, { email: "finance@example.invalid", challenge_id: "challenge-1", recovery_code: "recovery-value" });
  assert.equal(expired, 0);
  assert.equal(storage.has("orac_token"), false);
  unsubscribe();
});

test("unprotected login still stores the ordinary backend session", async () => {
  storage.clear();
  response = { status: 200, body: { success: true, data: { user: { id: "u2", role: "Sales" }, token: "ordinary-token" } } };
  const user = await auth.login("sales@example.invalid", "password");
  assert.equal(user.role, "Sales");
  assert.equal(storage.get("orac_token"), "ordinary-token");
});
