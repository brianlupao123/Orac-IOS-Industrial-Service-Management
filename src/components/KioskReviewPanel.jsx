import React, { useEffect, useState } from "react";
import { kiosk, dispatch as dispatchApi } from "../api/client.js";
import { kioskReviewLabel, kioskReviewTone, kioskNextAction, kioskCountsText } from "../fieldStatusModel.js";

const TONE = {
  green: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  red: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300"
};
const FILTERS = [["pending_review", "Pending"], ["approved", "Approved"], ["rejected", "Rejected"], ["all", "All"]];

// One kiosk entry as the reviewer sees it. Presentational; no rate or cost is ever
// part of the data it receives or shows.
export function KioskReviewRow({ row, role, children }) {
  const b = row.hours_breakdown;
  return (
    <li className="rounded-lg border border-orac-border bg-white p-4 text-sm dark:bg-transparent">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-semibold text-orac-slate">{row.technician_name || row.technician_id} · {row.dispatch_number || row.dispatch_card_id}</p>
          <p className="text-orac-secondary">
            {row.work_date} · {row.hours_logged} h{row.shift ? ` · ${row.shift}` : ""}
            {b ? ` · reported normal ${b.normal}, OT 1.5× ${b.ot_1_5}, OT 2.0× ${b.ot_2_0}` : ""}
          </p>
          {row.notes && <p className="text-orac-secondary">{row.notes}</p>}
          <p className="text-xs text-orac-secondary">Recorded by {row.recorded_by_name || "unknown"}{row.submitted_at ? ` · ${new Date(row.submitted_at).toLocaleString()}` : ""}</p>
        </div>
        <span className={`inline-flex w-fit shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${TONE[kioskReviewTone(row.review_status)]}`}>{kioskReviewLabel(row.review_status)}</span>
      </div>
      <p className="mt-2 text-xs text-orac-secondary">{kioskCountsText(row.review_status)}</p>
      {row.review_blocked_reason && <p role="alert" className="mt-2 rounded-md bg-amber-50 p-2 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">{row.review_blocked_reason}</p>}
      {row.review_status === "rejected" && row.review_comment && <p className="mt-2 text-red-700 dark:text-red-300">Rejected: {row.review_comment}</p>}
      <p className="mt-2 text-orac-slate"><span className="font-semibold">Next: </span>{kioskNextAction(role, row)}</p>
      {children}
    </li>
  );
}

function AssignSupervisor({ dispatchId, onDone }) {
  const [supervisors, setSupervisors] = useState([]);
  const [choice, setChoice] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    let cancelled = false;
    dispatchApi.roster(dispatchId).then((data) => { if (!cancelled) setSupervisors(data?.supervisors || []); }).catch(() => {});
    return () => { cancelled = true; };
  }, [dispatchId]);
  async function assign() {
    setMessage("");
    try { await dispatchApi.assignSupervisor(dispatchId, choice); setChoice(""); onDone(); }
    catch (err) { setMessage(err.message); }
  }
  if (!supervisors.length) return <p className="mt-2 text-xs text-orac-secondary">No active Supervisor accounts are available to assign.</p>;
  return (
    <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
      <div className="flex-1">
        <label htmlFor={`assign-${dispatchId}`} className="mb-1 block text-xs font-medium text-orac-slate">Assign a Supervisor</label>
        <select id={`assign-${dispatchId}`} value={choice} onChange={(e) => setChoice(e.target.value)} className="min-h-[44px] w-full rounded-md border border-orac-border bg-white p-2 text-sm dark:bg-transparent">
          <option value="">Select Supervisor...</option>
          {supervisors.map((s) => <option key={s.id} value={s.id}>{s.name || s.id}{s.assigned ? " (already assigned)" : ""}</option>)}
        </select>
      </div>
      <button type="button" disabled={!choice} onClick={assign} className="min-h-[44px] rounded-lg bg-orac-navy px-4 text-sm font-semibold text-white disabled:opacity-50">Assign</button>
      {message && <p role="alert" className="text-xs text-red-700">{message}</p>}
    </div>
  );
}

export default function KioskReviewPanel({ user }) {
  const [status, setStatus] = useState("pending_review");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [comments, setComments] = useState({});
  const isSupervisor = user.role === "Supervisor";
  const canAssign = ["Admin", "Operations"].includes(user.role);

  async function load() {
    setLoading(true);
    setError("");
    try { setRows((await kiosk.reviewQueue(status)) || []); }
    catch (err) { setRows([]); setError(err.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [status]);

  async function decide(row, decision) {
    const comment = (comments[row.id] || "").trim();
    setNotice("");
    if (decision === "reject" && !comment) { setError("Rejecting a kiosk entry needs a reason."); return; }
    try {
      await kiosk.review(row.id, decision, comment);
      setComments((prev) => ({ ...prev, [row.id]: "" }));
      setNotice(decision === "approve" ? "Entry approved. Its hours now count." : "Entry rejected. Its hours do not count.");
      await load();
    } catch (err) { setError(err.message); }
  }

  return (
    <section aria-labelledby="kiosk-review-heading" className="rounded-xl border border-orac-border bg-white p-5 shadow-sm dark:bg-transparent">
      <h2 id="kiosk-review-heading" className="text-base font-semibold text-orac-heading">Kiosk entries for review</h2>
      <p className="mb-3 text-sm text-orac-secondary">
        Crew hours entered at the kiosk do not count until an assigned Supervisor approves them.
        {isSupervisor ? "" : " Only a Supervisor can approve or reject. You can see the queue and assign a Supervisor where one is missing."}
      </p>
      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Filter kiosk entries">
        {FILTERS.map(([key, label]) => (
          <button key={key} type="button" aria-pressed={status === key} onClick={() => setStatus(key)}
            className={`min-h-[44px] rounded-full px-4 text-sm font-semibold ${status === key ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-orac-text-muted"}`}>{label}</button>
        ))}
      </div>
      {error && <p role="alert" className="mb-2 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="mb-2 text-sm text-emerald-700">{notice}</p>}
      {loading ? <p className="text-sm text-orac-secondary">Loading...</p> : rows.length === 0 ? (
        <p className="text-sm text-orac-secondary">No kiosk entries in this list.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <KioskReviewRow key={row.id} row={row} role={user.role}>
              {row.can_review && (
                <div className="mt-3 space-y-2">
                  <label htmlFor={`kc-${row.id}`} className="block text-xs font-medium text-orac-slate">Comment (required to reject)</label>
                  <textarea id={`kc-${row.id}`} rows={2} value={comments[row.id] || ""} onChange={(e) => setComments({ ...comments, [row.id]: e.target.value })} className="w-full rounded-md border border-orac-border bg-white p-2 text-sm dark:bg-transparent" />
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => decide(row, "approve")} className="min-h-[44px] rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white">Approve hours</button>
                    <button type="button" onClick={() => decide(row, "reject")} className="min-h-[44px] rounded-lg border border-gray-300 bg-white px-5 text-sm font-semibold text-gray-700 dark:bg-transparent dark:text-orac-text-muted">Reject</button>
                  </div>
                </div>
              )}
              {row.review_blocked_reason && canAssign && <AssignSupervisor dispatchId={row.dispatch_card_id} onDone={load} />}
            </KioskReviewRow>
          ))}
        </ul>
      )}
    </section>
  );
}
