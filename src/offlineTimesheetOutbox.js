// Offline outbox for NEW Timesheets only.
//
// A Timesheet created without a connection is kept on this device and sent when the
// connection returns. Every item carries a client_request_id generated on the device;
// the server uses it to make the send idempotent (a retry after a dropped connection
// can never create a second Timesheet). The server still validates, classifies and
// duplicate-checks everything: offline capture changes WHEN a record arrives, never
// what is accepted. Unlike the draft store (offlineDraftModel.js, which keeps text
// only and never sends), this outbox keeps the worker's sign-off and sends on its own
// when online, because a signed Timesheet that cannot be sent would be lost work.
//
// Never stored: passwords, tokens, rates, amounts. Storage is per user and is removed
// item by item as the server confirms it.

const PREFIX = "orac.timesheet.outbox.v1";
const DISPATCH_PREFIX = "orac.timesheet.dispatches.v1";
const MAX_ITEM_BYTES = 1_500_000;
const MAX_ITEMS = 100;
const SECRET_KEY = /(^|_)(password|token|authorization|secret|hourly_rate|rate|amount|cost|price)(_|$)/i;

const key = (userId) => `${PREFIX}.${userId}`;

function readAll(storage, userId) {
  try { const raw = storage?.getItem(key(userId)); const list = raw ? JSON.parse(raw) : []; return Array.isArray(list) ? list : []; } catch { return []; }
}
function writeAll(storage, userId, list) {
  try { storage.setItem(key(userId), JSON.stringify(list)); return { ok: true }; }
  catch { return { ok: false, error: "This device has no room left to keep the Timesheet. Free up space or connect and send it now." }; }
}

function stripSecrets(value) {
  if (Array.isArray(value)) return value.map(stripSecrets);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).filter(([k]) => !SECRET_KEY.test(k)).map(([k, v]) => [k, stripSecrets(v)]));
  }
  return value;
}

export function listOutbox(storage, userId) { return readAll(storage, userId); }
export const pendingCount = (storage, userId) => readAll(storage, userId).filter((i) => i.state !== "needs_attention").length;
export const attentionCount = (storage, userId) => readAll(storage, userId).filter((i) => i.state === "needs_attention").length;

export function enqueueTimesheet(storage, userId, { dispatchId, body, now = new Date() }) {
  if (!storage) return { ok: false, error: "This browser cannot keep data on the device, so the Timesheet could not be saved offline." };
  if (!dispatchId || !body?.client_request_id) return { ok: false, error: "The Timesheet is missing its job or its submission reference." };
  const clean = stripSecrets(body);
  const bytes = JSON.stringify(clean).length;
  if (bytes > MAX_ITEM_BYTES) return { ok: false, error: "The signed copy photo is too large to keep offline. Remove it or use the on-device declaration." };
  const list = readAll(storage, userId);
  if (list.some((i) => i.body.client_request_id === clean.client_request_id)) return { ok: true, duplicate: true, item: list.find((i) => i.body.client_request_id === clean.client_request_id) };
  if (list.length >= MAX_ITEMS) return { ok: false, error: "Too many unsent Timesheets on this device. Connect and send them first." };
  const item = { id: clean.client_request_id, dispatchId, body: { ...clean, captured_offline_at: clean.captured_offline_at || now.toISOString() }, state: "pending", attempts: 0, last_error: null, queued_at: now.toISOString() };
  const w = writeAll(storage, userId, [...list, item]);
  return w.ok ? { ok: true, item } : w;
}

export function removeFromOutbox(storage, userId, id) { writeAll(storage, userId, readAll(storage, userId).filter((i) => i.id !== id)); }

function patch(storage, userId, id, changes) {
  writeAll(storage, userId, readAll(storage, userId).map((i) => (i.id === id ? { ...i, ...changes } : i)));
}

// The API client marks a dropped connection with error.network and an expired session with
// error.sessionExpired. Neither is a refusal of the Timesheet: it stays queued and is sent after
// the worker is back online / signed in again.
export const isNetworkError = (err) => Boolean(err?.network || err?.sessionExpired || err?.status === 401)
  || err instanceof TypeError || /failed to fetch|load failed/i.test(String(err?.message || ""));

// Sends every pending item, one at a time and in order. `send(dispatchId, body)` is the
// API call. Outcomes per item:
//   sent             server accepted it (or recognised the same submission reference)
//   needs_attention  the server refused it (duplicate, invalid, sign-off, permission): it is kept,
//                    with the server's reason, and is never retried silently
//   still_pending    no connection: kept untouched for the next attempt
export async function syncOutbox(storage, userId, send) {
  const results = [];
  for (const item of readAll(storage, userId).filter((i) => i.state === "pending")) {
    try {
      const res = await send(item.dispatchId, item.body);
      removeFromOutbox(storage, userId, item.id);
      results.push({ id: item.id, outcome: "sent", replayed: Boolean(res?.replayed) });
    } catch (err) {
      if (isNetworkError(err)) {
        patch(storage, userId, item.id, { attempts: item.attempts + 1 });
        results.push({ id: item.id, outcome: "still_pending" });
        break; // offline: do not hammer the remaining items
      }
      patch(storage, userId, item.id, { state: "needs_attention", attempts: item.attempts + 1, last_error: String(err?.message || "The server refused this Timesheet.") });
      results.push({ id: item.id, outcome: "needs_attention", reason: String(err?.message || "") });
    }
  }
  return results;
}

// Returns a refused item to the queue after the worker has fixed the content on the same reference.
export function retryItem(storage, userId, id) { patch(storage, userId, id, { state: "pending", last_error: null }); }

// Dispatch choices cached while online so a Timesheet can be started offline.
export function cacheDispatchOptions(storage, userId, dispatches) {
  try {
    const slim = (dispatches || []).map((d) => ({ id: d.id, label: d.dispatch_number || d.title || d.id, quotation_id: d.quotation_id || null }));
    storage?.setItem(`${DISPATCH_PREFIX}.${userId}`, JSON.stringify({ at: new Date().toISOString(), items: slim }));
  } catch { /* cache is best effort */ }
}
export function loadDispatchOptions(storage, userId) {
  try { return JSON.parse(storage?.getItem(`${DISPATCH_PREFIX}.${userId}`) || "null")?.items || []; } catch { return []; }
}
export function clearOutboxOnLogout(storage, userId) {
  try { storage?.removeItem(`${DISPATCH_PREFIX}.${userId}`); } catch { /* ignore */ }
  // The outbox itself is NOT cleared on logout: unsent signed work must survive it. The user
  // sees it again after signing back in, and it is removed only when the server confirms it.
}
