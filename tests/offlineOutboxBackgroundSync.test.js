import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { EMPTY_TIMESHEET_FORM, buildTimesheetPayload } from "../src/lib/timesheetFormLogic.js";
import { enqueueTimesheet, listOutbox, pendingCount, attentionCount } from "../src/offlineTimesheetOutbox.js";
import {
  OUTBOX_CHANGED, OUTBOX_SYNC_DONE, runOutboxSync, isOutboxSyncing, subscribeOutbox, notifyOutboxChanged, outboxBarState
} from "../src/offlineOutboxSync.js";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), removeItem: (k) => m.delete(k), setItem: (k, v) => m.set(k, String(v)), _m: m };
}
const form = (over = {}) => ({ ...EMPTY_TIMESHEET_FORM(), dispatch_card_id: "dc_1", work_date: "2026-09-02", activity: "Replaced a bearing", normal: "8", employee_name: "A Worker", employee_attest: true, client_request_id: "ts-fixed-0001", ...over });
const queueThree = (st, userId = "u1") => ["a", "b", "c"].forEach((x, n) => enqueueTimesheet(st, userId, { dispatchId: "dc_1", body: buildTimesheetPayload(form({ client_request_id: `ts-${x}-000${n}`, work_date: `2026-09-0${n + 1}` }), { submit: true }) }));
const offlineError = () => Object.assign(new Error("Could not reach the server. Check your connection and try again."), { network: true });

// A stand-in for the backend contract: one Timesheet per client_request_id; a repeat returns the original.
function fakeServer({ loseResponseOnce = false } = {}) {
  const records = new Map(); let calls = 0; let lost = loseResponseOnce;
  return {
    records, get calls() { return calls; },
    send: async (_dispatchId, body) => {
      calls += 1;
      const replayed = records.has(body.client_request_id);
      if (!replayed) records.set(body.client_request_id, { ...body });
      if (lost) { lost = false; throw offlineError(); } // saved, but the answer never reached the phone
      return { id: `ws_${body.client_request_id}`, replayed };
    }
  };
}

// ---------------- status line ----------------
test("the bar says exactly what the worker needs: pending while offline, synced when sent, attention when refused", () => {
  assert.equal(outboxBarState({ online: false, pending: 3 }).label, "🟡 3 Timesheets pending upload (Offline)");
  assert.equal(outboxBarState({ online: true, pending: 3, syncing: true }).label, "🟡 3 Timesheets pending upload (syncing...)");
  assert.equal(outboxBarState({ online: true, justSynced: 3 }).label, "🟢 3 Timesheets synced to server");
  assert.equal(outboxBarState({ online: false, pending: 1 }).label, "🟡 1 Timesheet pending upload (Offline)", "singular reads correctly");
  assert.equal(outboxBarState({ justSynced: 1 }).label, "🟢 1 Timesheet synced to server");
  assert.equal(outboxBarState({ online: true, attention: 2 }).label, "🔴 2 Timesheets need attention");
  assert.equal(outboxBarState({ online: true, attention: 1 }).label, "🔴 1 Timesheet needs attention");
  assert.equal(outboxBarState({ online: true }), null, "nothing to say, nothing shown");
  assert.equal(outboxBarState({ online: true, pending: 2, justSynced: 5 }).tone, "warning", "waiting work wins over an old confirmation");
  assert.equal(outboxBarState({ online: false, pending: 2, attention: 1 }).tone, "danger", "a refusal is never hidden behind the amber line");
});

// ---------------- offline -> online, end to end through the engine ----------------
test("three Timesheets queued offline are sent in the background when the connection returns, then confirmed", async () => {
  const st = memoryStorage(); const target = new EventTarget(); const server = fakeServer();
  queueThree(st);
  assert.equal(pendingCount(st, "u1"), 3);
  assert.equal(outboxBarState({ online: false, pending: pendingCount(st, "u1") }).label, "🟡 3 Timesheets pending upload (Offline)");

  const done = []; const changed = [];
  subscribeOutbox(OUTBOX_SYNC_DONE, (d) => done.push(d), target);
  subscribeOutbox(OUTBOX_CHANGED, () => changed.push(1), target);

  // Still no signal: nothing is lost, nothing is marked refused.
  await runOutboxSync(st, "u1", async () => { throw offlineError(); }, { target });
  assert.equal(pendingCount(st, "u1"), 3); assert.equal(attentionCount(st, "u1"), 0);
  assert.equal(done[0].sent, 0); assert.equal(done[0].stillPending, true);

  // Signal returns.
  await runOutboxSync(st, "u1", server.send, { target });
  assert.equal(listOutbox(st, "u1").length, 0, "accepted items leave the device");
  assert.equal(server.records.size, 3);
  assert.equal(done[1].sent, 3);
  assert.equal(outboxBarState({ online: true, pending: 0, justSynced: done[1].sent }).label, "🟢 3 Timesheets synced to server");
  assert.ok(changed.length >= 4, "the bar is told at the start and end of every run");
});

// ---------------- idempotency ----------------
test("a lost server answer does not create a duplicate: the retry carries the same client_request_id and the server replays it", async () => {
  const st = memoryStorage(); const server = fakeServer({ loseResponseOnce: true });
  enqueueTimesheet(st, "u1", { dispatchId: "dc_1", body: buildTimesheetPayload(form(), { submit: true }) });
  const first = await runOutboxSync(st, "u1", server.send);
  assert.equal(first[0].outcome, "still_pending", "the worker's phone never heard back, so it keeps the item");
  assert.equal(server.records.size, 1, "the server did record it");
  const second = await runOutboxSync(st, "u1", server.send);
  assert.deepEqual([second[0].outcome, second[0].replayed], ["sent", true], "the server recognised the same submission");
  assert.equal(server.records.size, 1, "still exactly one Timesheet");
  assert.equal(server.calls, 2);
  assert.equal(listOutbox(st, "u1").length, 0);
});

test("overlapping triggers (online event + retry timer + Send now) share one run, so each Timesheet is sent once", async () => {
  const st = memoryStorage(); const server = fakeServer(); queueThree(st);
  let release; const gate = new Promise((r) => { release = r; });
  const slow = async (d, b) => { await gate; return server.send(d, b); };
  const a = runOutboxSync(st, "u1", slow); const b = runOutboxSync(st, "u1", slow); const c = runOutboxSync(st, "u1", slow);
  assert.equal(a, b); assert.equal(b, c, "callers join the run already in progress");
  assert.equal(isOutboxSyncing("u1"), true);
  release(); await a;
  assert.equal(server.calls, 3, "three Timesheets, three sends - not nine");
  assert.equal(isOutboxSyncing("u1"), false, "the lock is released afterwards");
  await runOutboxSync(st, "u1", server.send);
  assert.equal(server.calls, 3, "an empty outbox sends nothing");
});

test("the lock is per user and is always released, even when the send function blows up", async () => {
  const st = memoryStorage(); queueThree(st, "u1"); queueThree(st, "u2");
  assert.notEqual(runOutboxSync(st, "u1", async () => ({})), runOutboxSync(st, "u2", async () => ({})));
  await runOutboxSync(st, "u1", async () => ({})); await runOutboxSync(st, "u2", async () => ({}));
  queueThree(st, "u3");
  await runOutboxSync(st, "u3", async () => { throw new Error("The server refused this Timesheet."); });
  assert.equal(isOutboxSyncing("u3"), false);
  assert.equal(attentionCount(st, "u3"), 3, "a server refusal is kept for the worker, not retried silently");
});

test("notifyOutboxChanged reaches subscribers and can be unsubscribed", () => {
  const target = new EventTarget(); let n = 0;
  const off = subscribeOutbox(OUTBOX_CHANGED, () => { n += 1; }, target);
  notifyOutboxChanged(target); off(); notifyOutboxChanged(target);
  assert.equal(n, 1);
});

// ---------------- the API client really sends the idempotency key ----------------
test("createWorksheet sends the client_request_id as Idempotency-Key and in the body, identically on every retry", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "orac-client-"));
  const file = path.join(dir, "client.mjs");
  writeFileSync(file, read("src/api/client.js").replaceAll("import.meta.env", "({})"));
  const seen = []; const realFetch = globalThis.fetch; const realStorage = globalThis.localStorage;
  globalThis.localStorage = memoryStorage();
  globalThis.fetch = async (url, init) => { seen.push({ url, headers: init.headers, body: JSON.parse(init.body) }); return new Response(JSON.stringify({ success: true, data: { id: "ws_1" } }), { status: 200, headers: { "content-type": "application/json" } }); };
  try {
    const { dispatch } = await import(pathToFileURL(file).href);
    const body = buildTimesheetPayload(form({ client_request_id: "ts-key-0001" }), { submit: true });
    await dispatch.createWorksheet("dc_1", body); await dispatch.createWorksheet("dc_1", body);
    assert.equal(seen.length, 2);
    for (const s of seen) {
      assert.equal(s.headers["Idempotency-Key"], "ts-key-0001");
      assert.equal(s.body.client_request_id, "ts-key-0001");
      assert.match(s.url, /\/dispatch_cards\/dc_1\/worksheets$/);
    }
    await dispatch.createWorksheet("dc_1", { activity: "x" });
    assert.equal(seen[2].headers["Idempotency-Key"], undefined, "no reference, no key");
  } finally { globalThis.fetch = realFetch; if (realStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = realStorage; }
});

// ---------------- source wiring ----------------
test("source wiring: the modal falls back to the outbox with the offline message; the bar is mounted portal-wide and owns background sync", () => {
  const modal = read("src/components/TimesheetFormModal.jsx");
  assert.match(modal, /"No network detected\. Timesheet saved securely to device outbox\."/);
  assert.match(modal, /onSaved\(OFFLINE_SAVED_MESSAGE, \{ queued: true/);
  assert.match(modal, /if \(!online\) return queue\(/, "offline at submit time goes straight to the outbox");
  assert.match(modal, /isNetworkError\(err\) && !err\.sessionExpired\) return queue\(/, "a dropped connection mid-request goes to the outbox");
  assert.match(modal, /notifyOutboxChanged\(\)/);

  const layout = read("src/layouts/PortalLayout.jsx");
  assert.match(layout, /import OfflineOutboxBar from/); assert.match(layout, /<OfflineOutboxBar user=\{user\} \/>/);

  const bar = read("src/components/OfflineOutboxBar.jsx");
  assert.match(bar, /addEventListener\("online"/); assert.match(bar, /addEventListener\("visibilitychange"|addEventListener\("visibilitychange"/);
  assert.match(bar, /setInterval\(trySync, SYNC_RETRY_MS\)/, "retries while waiting, because the online event can fire before the signal is usable");
  assert.match(bar, /runOutboxSync\(/); assert.match(bar, /dispatch\.createWorksheet\(dispatchId, body\)/);
  assert.doesNotMatch(bar, /(bg|text|border)-(amber|emerald|red|green|yellow)-\d/, "uses theme tokens so dark mode works");

  const panel = read("src/components/TimesheetOutboxPanel.jsx");
  assert.doesNotMatch(panel, /syncOutbox\(/, "the panel joins the shared run instead of sending on its own");
  assert.match(panel, /runOutboxSync\(/);

  const client = read("src/api/client.js");
  assert.match(client, /"Idempotency-Key": payload\.client_request_id/);
});
