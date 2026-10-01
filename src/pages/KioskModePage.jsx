import React, { useState, useEffect, useRef } from "react";
import { Icon, ICONS } from "../components/icons.jsx";
import { collections, kiosk, dispatch as dispatchApi } from "../api/client.js";
import { displayTrade } from "../constants/trades.js";
import {
  foldKioskHours, kioskBreakdown, hasKioskHours,
  kioskReviewLabel, kioskReviewTone, kioskCountsText
} from "../fieldStatusModel.js";
import {
  saveDraft, loadDraft, clearDraft, purgeExpiredDrafts, newBatchKey, isNetworkFailure
} from "../offlineDraftModel.js";

const KIOSK_ENTRY_ROLES = ["Admin", "Operations"];
const TONE_CLASS = {
  green: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  red: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300"
};
const EMPTY_ROW = { normal: 0, ot15: 0, ot20: 0, description: "" };
const INPUT = "min-h-[44px] w-full rounded-md border border-orac-border bg-white p-2 text-sm dark:bg-transparent";

function getStorage() {
  try { return window.localStorage; } catch { return null; }
}

// Kiosk time entry is an Admin/Operations action on the server (submitKioskTimesheets).
// Other roles that can reach this route get a clear explanation instead of a form
// that would only fail with 403.
export default function KioskModePage({ user }) {
  if (!KIOSK_ENTRY_ROLES.includes(user?.role)) {
    return (
      <div className="mx-auto max-w-3xl space-y-3 rounded-xl border border-orac-border bg-white p-6 dark:bg-transparent">
        <h1 className="text-xl font-bold text-orac-heading">Kiosk Mode: Crew Time Entry</h1>
        <p role="status" className="text-sm text-orac-secondary">
          Crew time entry is done by Operations or Admin. Supervisors review the entries it creates under
          <strong> Timesheets</strong>, in the kiosk review list.
        </p>
      </div>
    );
  }
  return <KioskEntry user={user} />;
}

function KioskEntry({ user }) {
  const [technicians, setTechnicians] = useState([]);
  const [activeJobs, setActiveJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsError, setJobsError] = useState("");
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine !== false);
  const [draftSavedAt, setDraftSavedAt] = useState(null);
  const [recorded, setRecorded] = useState([]);
  const [recordedError, setRecordedError] = useState("");
  const [supervisorInfo, setSupervisorInfo] = useState(null);
  const [supervisorChoice, setSupervisorChoice] = useState("");
  const [supervisorMessage, setSupervisorMessage] = useState("");

  // Form State
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedJob, setSelectedJob] = useState("");
  const [shift, setShift] = useState("");
  const [crewHours, setCrewHours] = useState({});
  // One reference per submission attempt. A retry after a dropped connection reuses it,
  // so the server recognises the retry and does not record the hours twice.
  const batchKeyRef = useRef(null);
  const restoredRef = useRef(false);

  const loadJobs = async () => {
    setJobsLoading(true);
    setJobsError("");
    try {
      const jobsData = await collections.list("dispatch_cards");
      const active = (jobsData || []).filter(j => j.status === "Dispatched" || j.status === "In_Progress");
      setActiveJobs(active);
    } catch (err) {
      setJobsError(err.message);
    } finally {
      setJobsLoading(false);
    }
  };

  useEffect(() => { purgeExpiredDrafts(getStorage()); loadJobs(); }, []);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, []);

  const draftScope = selectedJob ? `${selectedJob}:${selectedDate}` : "";

  const loadRecorded = async () => {
    if (!selectedJob) { setRecorded([]); return; }
    setRecordedError("");
    try {
      const rows = await dispatchApi.timesheets(selectedJob, selectedDate);
      setRecorded((rows || []).filter((row) => row.entry_source === "kiosk"));
    } catch (err) {
      setRecorded([]);
      setRecordedError(err.message);
    }
  };

  const loadSupervisorInfo = async () => {
    setSupervisorMessage("");
    if (!selectedJob) { setSupervisorInfo(null); return; }
    try {
      setSupervisorInfo(await dispatchApi.roster(selectedJob));
    } catch {
      setSupervisorInfo(null); // the banner is an aid; the server still enforces review
    }
  };

  const loadRoster = async () => {
    if (!selectedJob) {
      setTechnicians([]);
      setCrewHours({});
      return;
    }
    setRosterLoading(true);
    setRosterError("");
    try {
      const data = await kiosk.roster(selectedJob);
      const roster = data?.technicians || [];
      setTechnicians(roster);
      const blank = Object.fromEntries(roster.map((tech) => [tech.id, { ...EMPTY_ROW }]));
      // Restore an unsent draft for this user, job and date. Only technicians still on
      // the roster are restored, and nothing is sent until the user presses Submit.
      const saved = loadDraft(getStorage(), user.id, "kiosk", draftScope);
      if (saved?.data?.crewHours) {
        for (const tech of roster) {
          const row = saved.data.crewHours[tech.id];
          if (row) blank[tech.id] = { normal: Number(row.normal) || 0, ot15: Number(row.ot15) || 0, ot20: Number(row.ot20) || 0, description: String(row.description || "") };
        }
        if (typeof saved.data.shift === "string") setShift(saved.data.shift);
        batchKeyRef.current = typeof saved.data.batch_key === "string" ? saved.data.batch_key : null;
        setDraftSavedAt(saved.saved_at);
      } else {
        batchKeyRef.current = null;
        setShift("");
      }
      restoredRef.current = true;
      setCrewHours(blank);
    } catch (err) {
      setTechnicians([]);
      setCrewHours({});
      setRosterError(err.message);
    } finally {
      setRosterLoading(false);
    }
  };

  useEffect(() => {
    restoredRef.current = false;
    setSubmitResult(null);
    loadRoster();
    loadRecorded();
    loadSupervisorInfo();
  }, [selectedJob, selectedDate]);

  // Keep an on-device copy of what has been typed (hours, notes, shift label, retry
  // reference). It never contains a rate, and it expires.
  useEffect(() => {
    if (!restoredRef.current || !selectedJob) return;
    const anyEntered = Object.values(crewHours).some((row) => hasKioskHours(row) || row.description);
    if (!anyEntered) { clearDraft(getStorage(), user.id, "kiosk", draftScope); return; }
    const saved = saveDraft(getStorage(), user.id, "kiosk", draftScope, { crewHours, shift, batch_key: batchKeyRef.current });
    if (saved) setDraftSavedAt(Date.now());
  }, [crewHours, shift]);

  const handleHourChange = (techId, field, value) => {
    const num = parseFloat(value) || 0;
    setCrewHours(prev => ({
      ...prev,
      [techId]: { ...prev[techId], [field]: num }
    }));
  };

  const handleDescChange = (techId, value) => {
    setCrewHours(prev => ({
      ...prev,
      [techId]: { ...prev[techId], description: value }
    }));
  };

  const handleAssignSupervisor = async () => {
    if (!supervisorChoice) return;
    setSupervisorMessage("");
    try {
      await dispatchApi.assignSupervisor(selectedJob, supervisorChoice);
      setSupervisorChoice("");
      await loadSupervisorInfo();
      await loadRecorded();
      setSupervisorMessage("Supervisor assigned. Pending kiosk entries on this dispatch can now be reviewed.");
    } catch (err) {
      setSupervisorMessage(`Could not assign the Supervisor: ${err.message}`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setSubmitResult(null);
    if (!selectedJob) {
      setFormError("Select an active dispatch card first.");
      return;
    }

    const entries = Object.entries(crewHours).filter(([_, h]) => hasKioskHours(h));

    if (entries.length === 0) {
      setFormError("Enter hours for at least one assigned technician.");
      return;
    }
    for (const [technicianId, hours] of entries) {
      if (foldKioskHours(hours) > 24) {
        const name = technicians.find((tech) => tech.id === technicianId)?.name || "A crew member";
        setFormError(`${name}'s entry totals more than 24 hours after overtime weighting. Check the hours entered.`);
        return;
      }
    }
    if (!batchKeyRef.current) {
      batchKeyRef.current = newBatchKey();
      // Persist the reference now, so a retry after a reload still carries it.
      saveDraft(getStorage(), user.id, "kiosk", draftScope, { crewHours, shift, batch_key: batchKeyRef.current });
    }

    setSubmitting(true);
    try {
      const result = await kiosk.submit(selectedJob, {
        work_date: selectedDate,
        batch_key: batchKeyRef.current,
        entries: entries.map(([technician_id, hours]) => ({
          technician_id,
          hours_logged: foldKioskHours(hours),
          hours_breakdown: kioskBreakdown(hours),
          ...(shift.trim() ? { shift: shift.trim() } : {}),
          notes: hours.description
        }))
      });

      setSubmitResult({ count: entries.length, replayed: Boolean(result?.replayed) });
      clearDraft(getStorage(), user.id, "kiosk", draftScope);
      setDraftSavedAt(null);
      batchKeyRef.current = null;

      // Reset hours
      const resetHours = { ...crewHours };
      Object.keys(resetHours).forEach(k => {
        resetHours[k] = { ...EMPTY_ROW };
      });
      setCrewHours(resetHours);
      setShift("");
      await loadRecorded();
    } catch (err) {
      if (isNetworkFailure(err)) {
        setFormError("Not sent: the connection dropped. Your entries are saved on this device. Press Submit again when you are back online; the same submission will not be recorded twice.");
      } else {
        // A server answer (duplicate, 24-hour limit, roster, frozen dispatch) is final for
        // this attempt. Start a fresh reference next time so a corrected entry is not
        // mistaken for a retry of the rejected one.
        batchKeyRef.current = null;
        setFormError(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const blockedReason = supervisorInfo?.dispatch?.review_blocked_reason || null;
  const supervisors = supervisorInfo?.supervisors || [];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-3 pb-4 border-b border-orac-border">
        <div className="p-2 bg-orac-navy/10 rounded-lg">
          <Icon path={ICONS.users} className="h-6 w-6 text-orac-navy" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-orac-heading">Kiosk Mode: Crew Time Entry</h1>
          <p className="text-sm text-orac-secondary">Batch submit daily hours for multiple crew members at once. Every kiosk entry needs Supervisor review before it counts.</p>
        </div>
      </div>

      {!online && (
        <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          You are offline. What you type is kept on this device as a draft. Submit once the connection is back.
        </div>
      )}

      {submitResult && (
        <div role="status" className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-lg flex items-start dark:bg-green-950/30 dark:text-green-300">
          <Icon path={ICONS.check} className="h-5 w-5 mr-2 mt-0.5 shrink-0 text-green-600" />
          <span>
            {submitResult.replayed ? "This submission was already recorded; nothing was added. " : ""}
            {submitResult.count} {submitResult.count === 1 ? "entry is" : "entries are"} now <strong>pending Supervisor review</strong>.
            {" "}{kioskCountsText("pending_review")}
          </span>
        </div>
      )}

      {formError && (
        <div role="alert" className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-start gap-2 dark:bg-red-950/30 dark:text-red-300">
          <Icon path={ICONS.warning} className="h-5 w-5 mt-0.5 shrink-0 text-red-600" />
          <span>{formError}</span>
        </div>
      )}

      {selectedJob && blockedReason && (
        <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200 space-y-3">
          <p><strong>Review is blocked.</strong> {blockedReason}</p>
          {supervisors.length > 0 ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label htmlFor="kiosk-assign-supervisor" className="mb-1 block text-sm font-medium">Assign a Supervisor to this dispatch</label>
                <select id="kiosk-assign-supervisor" value={supervisorChoice} onChange={(e) => setSupervisorChoice(e.target.value)} className={INPUT}>
                  <option value="">Select Supervisor...</option>
                  {supervisors.map((sup) => <option key={sup.id} value={sup.id}>{sup.name || sup.id}</option>)}
                </select>
              </div>
              <button type="button" onClick={handleAssignSupervisor} disabled={!supervisorChoice} className="min-h-[44px] rounded-lg bg-orac-navy px-4 text-sm font-semibold text-white disabled:opacity-50">
                Assign Supervisor
              </button>
            </div>
          ) : (
            <p>No active Supervisor accounts are available to assign. An Admin needs to set one up.</p>
          )}
        </div>
      )}
      {supervisorMessage && <p role="status" className="text-sm text-orac-secondary">{supervisorMessage}</p>}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-orac-border overflow-hidden dark:bg-transparent">
        {/* Date & Job Selectors */}
        <fieldset className="p-6 border-b border-orac-border bg-orac-surface space-y-4">
          <legend className="text-sm font-semibold text-orac-secondary px-0 mb-2">1. Select job and date</legend>

          {jobsError && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-center justify-between gap-3">
              <span>Could not load active job cards: {jobsError}</span>
              <button type="button" onClick={loadJobs} className="shrink-0 min-h-[44px] rounded-md border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-100">Try again</button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label htmlFor="kiosk-work-date" className="block text-sm font-medium text-orac-slate mb-1">Work Date</label>
              <input
                id="kiosk-work-date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className={INPUT}
                required
              />
            </div>
            <div>
              <label htmlFor="kiosk-job" className="block text-sm font-medium text-orac-slate mb-1">Active Job Card</label>
              <select
                id="kiosk-job"
                value={selectedJob}
                onChange={(e) => setSelectedJob(e.target.value)}
                disabled={jobsLoading}
                className={`${INPUT} disabled:opacity-60`}
                required
              >
                <option value="">{jobsLoading ? "Loading active jobs..." : "-- Select Active Job --"}</option>
                {activeJobs.map(j => (
                  <option key={j.id} value={j.id}>{j.dispatch_number} — {j.status}</option>
                ))}
              </select>
              {!jobsLoading && !jobsError && activeJobs.length === 0 && (
                <p className="mt-1 text-xs text-orac-secondary">No dispatch cards are currently Dispatched or In Progress.</p>
              )}
            </div>
            <div>
              <label htmlFor="kiosk-shift" className="block text-sm font-medium text-orac-slate mb-1">Shift label (optional)</label>
              <input id="kiosk-shift" type="text" maxLength={40} value={shift} onChange={(e) => setShift(e.target.value)} placeholder="e.g. Night shift" className={INPUT} />
              <p className="mt-1 text-xs text-orac-secondary">Use a different label for a second, separate shift on the same day.</p>
            </div>
          </div>
        </fieldset>

        {rosterError && (
          <div role="alert" className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-center justify-between gap-3">
            <span>Could not load the crew roster: {rosterError}</span>
            <button type="button" onClick={loadRoster} className="shrink-0 min-h-[44px] rounded-md border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-100">Try again</button>
          </div>
        )}

        {/* Crew roster: one card per crew member on narrow screens, one row per member on wide screens */}
        <div>
          <p className="px-6 pt-4 text-sm font-semibold text-orac-secondary">2. Enter crew hours</p>
          {rosterLoading ? (
            <p className="px-6 py-8 text-center text-orac-secondary text-sm">Loading crew roster...</p>
          ) : technicians.length === 0 ? (
            <p className="px-6 py-8 text-center text-orac-secondary text-sm">Select a dispatch card to load its assigned technician roster.</p>
          ) : (
            <ul className="divide-y divide-orac-border">
              {technicians.map(tech => (
                <li key={tech.id} className="grid grid-cols-3 gap-3 px-4 py-4 md:grid-cols-[1.4fr_repeat(3,6rem)_2fr] md:items-end md:px-6">
                  <div className="col-span-3 md:col-span-1">
                    <p className="text-sm font-medium text-orac-slate">{tech.name}</p>
                    <p className="text-xs text-orac-secondary">{displayTrade(tech.trade)}</p>
                  </div>
                  {[["normal", "Normal hrs"], ["ot15", "OT 1.5×"], ["ot20", "OT 2.0×"]].map(([field, label]) => (
                    <div key={field}>
                      <label htmlFor={`kiosk-${tech.id}-${field}`} className="mb-1 block text-xs font-medium text-orac-slate">{label}</label>
                      <input id={`kiosk-${tech.id}-${field}`} type="number" inputMode="decimal" min="0" step="0.5" max="24"
                        value={crewHours[tech.id]?.[field] || ""}
                        onChange={(e) => handleHourChange(tech.id, field, e.target.value)}
                        className={INPUT}
                      />
                    </div>
                  ))}
                  <div className="col-span-3 md:col-span-1">
                    <label htmlFor={`kiosk-${tech.id}-desc`} className="mb-1 block text-xs font-medium text-orac-slate">Activity / Task</label>
                    <input id={`kiosk-${tech.id}-desc`} type="text" placeholder="e.g. Belt splicing"
                      value={crewHours[tech.id]?.description || ""}
                      onChange={(e) => handleDescChange(tech.id, e.target.value)}
                      className={INPUT}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Submit */}
        <div className="p-6 border-t border-orac-border bg-orac-surface flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-orac-secondary" aria-live="polite">
            {draftSavedAt ? "Draft saved on this device. It is removed when you submit or log out." : "Entries are saved on this device as you type."}
          </p>
          <button
            type="submit"
            disabled={submitting || rosterLoading || !selectedJob || !online}
            className="flex items-center justify-center min-h-[44px] px-6 py-2.5 bg-orac-navy text-white rounded-lg hover:bg-orac-navy/90 focus:ring-2 focus:ring-offset-2 focus:ring-orac-navy disabled:opacity-50 font-semibold text-sm"
          >
            {submitting ? "Saving Batch..." : online ? "Submit Kiosk Batch for Review" : "Offline: submit when connected"}
          </button>
        </div>
      </form>

      {selectedJob && (
        <section aria-labelledby="kiosk-recorded-heading" className="rounded-xl border border-orac-border bg-white p-4 dark:bg-transparent">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="kiosk-recorded-heading" className="text-sm font-semibold text-orac-secondary">Kiosk entries already recorded for this job and date</h2>
            <button type="button" onClick={loadRecorded} className="min-h-[44px] rounded-md border border-orac-border px-3 text-xs font-semibold">Refresh</button>
          </div>
          {recordedError && <p role="alert" className="text-sm text-red-700">Could not load recorded entries: {recordedError}</p>}
          {!recordedError && recorded.length === 0 && <p className="text-sm text-orac-secondary">Nothing recorded yet.</p>}
          <ul className="space-y-2">
            {recorded.map((row) => (
              <li key={row.id} className="flex flex-col gap-1 rounded-lg border border-orac-border p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span className="font-medium text-orac-slate">{row.technician_name || row.technician_id}: {row.hours_logged} h{row.notes ? ` · ${row.notes}` : ""}</span>
                <span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${TONE_CLASS[kioskReviewTone(row.review_status)]}`}>{kioskReviewLabel(row.review_status)}</span>
                {row.review_comment && row.review_status === "rejected" && <span className="text-xs text-orac-secondary">Reason: {row.review_comment}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
