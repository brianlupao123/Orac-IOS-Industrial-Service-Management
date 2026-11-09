import assert from "node:assert/strict";
import test from "node:test";
import { runCommit, runPreview } from "../src/importer/importerFlow.js";

// Synthetic data only. The API is a fake: no network, no server.
const file = (name, text, size = text.length) => ({ name, size, text: async () => text });
const fakeApi = (over = {}) => ({
  calls: [],
  async preview(entity, text) { this.calls.push(["preview", entity, text]); return { file_sha256: "h", row_count: 1, confirmation_phrase: "IMPORT_CLIENTS" }; },
  async commit(entity, body) { this.calls.push(["commit", entity, body]); return { job_id: "imp_1", created_count: 1, entity }; },
  ...over
});

test("preview reads the file text and returns the server's answer", async () => {
  const api = fakeApi();
  const out = await runPreview({ api, entity: "clients", file: file("c.csv", "name,client_type\nA,B\n") });
  assert.equal(out.ok, true);
  assert.equal(out.csvText, "name,client_type\nA,B\n");
  assert.deepEqual(api.calls, [["preview", "clients", "name,client_type\nA,B\n"]]);
});

test("a file that cannot be sent never reaches the server", async () => {
  const api = fakeApi();
  for (const f of [null, file("c.xlsx", "x"), file("c.csv", "", 0), file("c.csv", "x", 600 * 1024)]) {
    const out = await runPreview({ api, entity: "clients", file: f });
    assert.equal(out.ok, false);
    assert.ok(out.message.length > 5);
  }
  assert.deepEqual(api.calls, []);
});

test("server errors and expired sessions are reported, not thrown", async () => {
  const boom = Object.assign(new Error("Role Sales cannot perform manageClients."), { status: 403 });
  const out = await runPreview({ api: fakeApi({ preview: async () => { throw boom; } }), entity: "clients", file: file("c.csv", "x") });
  assert.deepEqual([out.ok, out.forbidden, out.message], [false, true, "Role Sales cannot perform manageClients."]);
  const expired = Object.assign(new Error("Your session has expired."), { sessionExpired: true });
  const out2 = await runCommit({ api: fakeApi({ commit: async () => { throw expired; } }), entity: "clients", csvText: "x", preview: { file_sha256: "h", confirmation_phrase: "IMPORT_CLIENTS", row_count: 1 }, phrase: "IMPORT_CLIENTS", count: "1" });
  assert.equal(out2.sessionExpired, true);
});

test("commit sends exactly the typed phrase and count with the preview's hash, and keeps the server's code", async () => {
  const api = fakeApi();
  const preview = { file_sha256: "h", confirmation_phrase: "IMPORT_CLIENTS", row_count: 2 };
  const out = await runCommit({ api, entity: "clients", csvText: "t", preview, phrase: "IMPORT_CLIENTS", count: "2" });
  assert.equal(out.ok, true);
  assert.deepEqual(api.calls[0], ["commit", "clients", { csv_content: "t", confirmation: "IMPORT_CLIENTS", expected_row_count: 2, file_sha256: "h" }]);
  const dup = Object.assign(new Error("This exact file has already been imported."), { code: "DUPLICATE_FILE" });
  const bad = await runCommit({ api: fakeApi({ commit: async () => { throw dup; } }), entity: "clients", csvText: "t", preview, phrase: "IMPORT_CLIENTS", count: "2" });
  assert.deepEqual([bad.ok, bad.code], [false, "DUPLICATE_FILE"]);
});
