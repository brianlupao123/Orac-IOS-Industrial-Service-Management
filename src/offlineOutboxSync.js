// Background sync engine and status model for the Timesheet offline outbox.
//
// offlineTimesheetOutbox.js stores items and sends them. This file adds what the whole portal needs
// around it:
//   - ONE sync at a time per user (single-flight). The online event, the 30 s retry, the "Send now"
//     button and a tab refocus can all fire together; they share the same run instead of each
//     sending the same Timesheet. Combined with the client_request_id that every item carries (and
//     that the API client also sends as the Idempotency-Key header), a retry can never create a
//     second Timesheet.
//   - a tiny event channel so the bar, the "Waiting to send" panel and the Timesheets page stay in
//     step without sharing React state.
//   - outboxBarState(): the plain-words status line shown at the top of the portal.
//
// This file never touches the network itself: the caller passes `send`.

import { syncOutbox } from "./offlineTimesheetOutbox.js";

export const OUTBOX_CHANGED = "orac:outbox-changed";
export const OUTBOX_SYNC_DONE = "orac:outbox-sync-done";
export const SYNC_RETRY_MS = 30_000;
export const SYNCED_BANNER_MS = 8_000;

const inflight = new Map();

function defaultTarget() {
  return typeof window !== "undefined" && typeof window.dispatchEvent === "function" ? window : null;
}

export function emitOutboxEvent(name, detail = {}, target = defaultTarget()) {
  if (!target || typeof CustomEvent === "undefined") return;
  try { target.dispatchEvent(new CustomEvent(name, { detail })); } catch { /* UI notification is best effort */ }
}

// Call after anything changes the outbox (a Timesheet was queued, retried or removed).
export const notifyOutboxChanged = (target) => emitOutboxEvent(OUTBOX_CHANGED, {}, target);

export function subscribeOutbox(name, handler, target = defaultTarget()) {
  if (!target) return () => {};
  const listener = (e) => handler(e.detail || {});
  target.addEventListener(name, listener);
  return () => target.removeEventListener(name, listener);
}

export const isOutboxSyncing = (userId) => inflight.has(String(userId));

// Runs a sync, or joins the one already running for this user. `send(dispatchId, body)` is the API call.
export function runOutboxSync(storage, userId, send, { target } = {}) {
  const k = String(userId);
  if (inflight.has(k)) return inflight.get(k);
  const run = (async () => {
    notifyOutboxChanged(target);
    try {
      const results = await syncOutbox(storage, userId, send);
      const detail = {
        userId,
        sent: results.filter((r) => r.outcome === "sent").length,
        replayed: results.filter((r) => r.outcome === "sent" && r.replayed).length,
        refused: results.filter((r) => r.outcome === "needs_attention").length,
        stillPending: results.some((r) => r.outcome === "still_pending")
      };
      emitOutboxEvent(OUTBOX_SYNC_DONE, detail, target);
      return results;
    } finally {
      inflight.delete(k);
      notifyOutboxChanged(target);
    }
  })();
  inflight.set(k, run);
  return run;
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// What the bar says. Returns null when there is nothing to show.
//   offline + waiting      🟡 3 Timesheets pending upload (Offline)
//   online + waiting       🟡 3 Timesheets pending upload (syncing...)
//   all sent               🟢 3 Timesheets synced to server
//   server refused         🔴 1 Timesheet needs attention
export function outboxBarState({ online = true, pending = 0, attention = 0, syncing = false, justSynced = 0 } = {}) {
  const lines = [];
  if (pending > 0) {
    const suffix = !online ? " (Offline)" : syncing ? " (syncing...)" : "";
    lines.push({ tone: "warning", icon: "🟡", text: `${plural(pending, "Timesheet", "Timesheets")} pending upload${suffix}` });
  } else if (justSynced > 0) {
    lines.push({ tone: "success", icon: "🟢", text: `${plural(justSynced, "Timesheet", "Timesheets")} synced to server` });
  }
  if (attention > 0) {
    lines.push({ tone: "danger", icon: "🔴", text: `${plural(attention, "Timesheet needs", "Timesheets need")} attention` });
  }
  if (!lines.length) return null;
  const tone = lines.some((l) => l.tone === "danger") ? "danger" : lines[0].tone;
  return { tone, lines: lines.map((l) => ({ ...l, label: `${l.icon} ${l.text}` })), label: lines.map((l) => `${l.icon} ${l.text}`).join("  ·  ") };
}
