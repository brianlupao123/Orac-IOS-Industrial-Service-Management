import React, { useCallback, useEffect, useState } from "react";
import { dispatch } from "../api/client.js";
import { listOutbox, retryItem, removeFromOutbox } from "../offlineTimesheetOutbox.js";
import { OUTBOX_CHANGED, OUTBOX_SYNC_DONE, runOutboxSync, isOutboxSyncing, subscribeOutbox, notifyOutboxChanged } from "../offlineOutboxSync.js";

// Timesheets saved on this device and not yet accepted by the server. The background sending is done by
// OfflineOutboxBar (portal-wide); this panel lists what is waiting and offers "Send now" / "Try again",
// which join the same single sync run. An item the server refuses is kept with the reason and is never
// retried silently or thrown away without the worker choosing to.
function storage() { try { return window.localStorage; } catch { return null; } }

export default function TimesheetOutboxPanel({ user, refreshKey, onSynced }) {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const reload = useCallback(() => { setItems(listOutbox(storage(), user.id)); setBusy(isOutboxSyncing(user.id)); }, [user.id]);

  const sync = useCallback(() => {
    if (isOutboxSyncing(user.id)) return;
    setMessage("");
    runOutboxSync(storage(), user.id, (dispatchId, body) => dispatch.createWorksheet(dispatchId, body)).catch(() => {});
  }, [user.id]);

  useEffect(() => { reload(); }, [reload, refreshKey]);
  // The bar (or this panel's own button) runs the sync; whoever started it, this list follows along.
  useEffect(() => {
    const offChanged = subscribeOutbox(OUTBOX_CHANGED, reload);
    const offDone = subscribeOutbox(OUTBOX_SYNC_DONE, (d) => {
      if (d.sent) { setMessage(`${d.sent} Timesheet${d.sent === 1 ? "" : "s"} sent.`); onSynced?.(); }
      if (d.refused) setMessage((m) => `${m} ${d.refused} need${d.refused === 1 ? "s" : ""} your attention.`.trim());
    });
    return () => { offChanged(); offDone(); };
  }, [reload, onSynced]);

  if (!items.length && !message) return null;
  const pending = items.filter((i) => i.state === "pending");
  const attention = items.filter((i) => i.state === "needs_attention");

  return (
    <section aria-label="Waiting to send" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Waiting to send ({pending.length}{attention.length ? ` + ${attention.length} need attention` : ""})</h2>
        {pending.length > 0 && <button type="button" onClick={sync} disabled={busy} className="rounded-md border border-amber-200 bg-white px-3 py-1 font-semibold disabled:opacity-50">{busy ? "Sending..." : "Send now"}</button>}
      </div>
      {message && <p role="status" className="mt-1 text-xs">{message}</p>}
      <ul className="mt-2 space-y-2">
        {items.map((i) => (
          <li key={i.id} className="rounded-lg bg-white/70 p-2">
            <div className="font-medium">{i.body.activity} <span className="text-xs font-normal text-gray-600">· {i.body.work_date} · saved {new Date(i.queued_at).toLocaleString()}</span></div>
            {i.state === "needs_attention" ? (
              <div className="mt-1 text-xs text-red-800">
                The server did not accept this Timesheet: {i.last_error}
                <div className="mt-1 flex gap-3">
                  <button type="button" onClick={() => { retryItem(storage(), user.id, i.id); notifyOutboxChanged(); sync(); }} className="font-semibold underline">Try again</button>
                  <button type="button" onClick={() => { if (window.confirm("Remove this unsent Timesheet from this device? It has not reached the server and cannot be recovered.")) { removeFromOutbox(storage(), user.id, i.id); notifyOutboxChanged(); } }} className="font-semibold text-red-800 underline">Remove from this device</button>
                </div>
              </div>
            ) : <div className="text-xs text-gray-600">Will be sent automatically{i.attempts ? ` (tried ${i.attempts} time${i.attempts === 1 ? "" : "s"})` : ""}.</div>}
          </li>
        ))}
      </ul>
    </section>
  );
}
