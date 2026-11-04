import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { dispatch } from "../api/client.js";
import { pendingCount, attentionCount } from "../offlineTimesheetOutbox.js";
import {
  OUTBOX_CHANGED, OUTBOX_SYNC_DONE, SYNC_RETRY_MS, SYNCED_BANNER_MS,
  runOutboxSync, isOutboxSyncing, subscribeOutbox, outboxBarState
} from "../offlineOutboxSync.js";

// Portal-wide status of Timesheets saved on this device. It is also the ONE place that sends them in the
// background, so it must stay mounted for as long as the worker is signed in (see PortalLayout):
//   - when the connection returns (the browser "online" event),
//   - when the portal is opened or the tab comes back into view,
//   - every 30 s while anything is waiting and the browser says it is online. The "online" event can fire
//     before the signal is usable (weak mine-site coverage), so a failed attempt is retried, not forgotten.
// Every send reuses the item's own client_request_id, and overlapping triggers share one run, so a retry
// can never create a second Timesheet. The server still validates everything it receives.

function storage() { try { return window.localStorage; } catch { return null; } }
const isOnlineNow = () => (typeof navigator === "undefined" ? true : navigator.onLine !== false);
const send = (dispatchId, body) => dispatch.createWorksheet(dispatchId, body);

const TONE_STYLE = {
  warning: { background: "var(--orac-warning-bg)", color: "var(--orac-warning-text)", borderColor: "var(--orac-warning-border)" },
  success: { background: "var(--orac-success-bg)", color: "var(--orac-success-text)", borderColor: "var(--orac-success-border)" },
  danger: { background: "var(--orac-danger-bg)", color: "var(--orac-danger-text)", borderColor: "var(--orac-danger-border)" }
};

export default function OfflineOutboxBar({ user }) {
  const userId = user?.id;
  const [online, setOnline] = useState(isOnlineNow);
  const [counts, setCounts] = useState({ pending: 0, attention: 0 });
  const [syncing, setSyncing] = useState(false);
  const [syncedTotal, setSyncedTotal] = useState(0);
  const countsRef = useRef(counts);
  countsRef.current = counts;

  const refresh = useCallback(() => {
    const st = storage();
    setCounts({ pending: pendingCount(st, userId), attention: attentionCount(st, userId) });
    setSyncing(isOutboxSyncing(userId));
  }, [userId]);

  const trySync = useCallback(() => {
    const st = storage();
    if (!userId || !st || !isOnlineNow() || pendingCount(st, userId) === 0) return;
    runOutboxSync(st, userId, send).catch(() => { /* per-item outcomes are kept in the outbox */ });
  }, [userId]);

  // Keep counts in step with the outbox (queued from the form, sent, retried, removed, or changed in another tab).
  useEffect(() => {
    refresh();
    const offChanged = subscribeOutbox(OUTBOX_CHANGED, refresh);
    const offDone = subscribeOutbox(OUTBOX_SYNC_DONE, (d) => { if (d.sent > 0) setSyncedTotal((n) => n + d.sent); });
    const onStorage = (e) => { if (!e.key || e.key.startsWith("orac.timesheet.outbox.v1")) refresh(); };
    window.addEventListener("storage", onStorage);
    return () => { offChanged(); offDone(); window.removeEventListener("storage", onStorage); };
  }, [refresh]);

  // Connectivity: send as soon as the connection returns, and when the portal is opened or refocused.
  useEffect(() => {
    const goOnline = () => { setOnline(true); trySync(); };
    const goOffline = () => setOnline(false);
    const onVisible = () => { if (document.visibilityState === "visible") { setOnline(isOnlineNow()); trySync(); } };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    document.addEventListener("visibilitychange", onVisible);
    trySync();
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [trySync]);

  // Retry while something is waiting and the browser believes it is online.
  useEffect(() => {
    if (!online || counts.pending === 0) return undefined;
    const t = setInterval(trySync, SYNC_RETRY_MS);
    return () => clearInterval(t);
  }, [online, counts.pending, trySync]);

  // The green confirmation shows once everything has been accepted, then goes away by itself.
  const showSynced = counts.pending === 0 && syncedTotal > 0;
  useEffect(() => {
    if (!showSynced) return undefined;
    const t = setTimeout(() => setSyncedTotal(0), SYNCED_BANNER_MS);
    return () => clearTimeout(t);
  }, [showSynced]);

  const state = outboxBarState({ online, pending: counts.pending, attention: counts.attention, syncing, justSynced: showSynced ? syncedTotal : 0 });
  if (!state) return null;

  return (
    <div
      data-testid="offline-outbox-bar"
      data-tone={state.tone}
      role="status"
      aria-live="polite"
      className="border-b px-4 py-2 text-sm font-semibold sm:px-6"
      style={TONE_STYLE[state.tone]}
    >
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {state.lines.map((l) => (
            <span key={l.tone}><span aria-hidden="true">{l.icon}</span> {l.text}</span>
          ))}
        </div>
        {(counts.pending > 0 || counts.attention > 0) && (
          <Link to="/worksheets" className="underline underline-offset-2">View in Timesheets</Link>
        )}
      </div>
    </div>
  );
}
