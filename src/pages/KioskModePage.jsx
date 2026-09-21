import React, { useEffect, useMemo, useState } from "react";
import { Icon, ICONS } from "../components/icons.jsx";
import { collections, kiosk } from "../api/client.js";

const today = () => new Date().toISOString().slice(0, 10);
const freshEntry = () => ({ hours_logged: "", hourly_rate: "", notes: "" });

export default function KioskModePage() {
  const [jobs, setJobs] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [selectedJob, setSelectedJob] = useState("");
  const [workDate, setWorkDate] = useState(today());
  const [entries, setEntries] = useState({});
  const [loading, setLoading] = useState(true);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    collections.list("dispatch_cards")
      .then((data) => setJobs((data || []).filter((job) => ["Dispatched", "In_Progress"].includes(job.status))))
      .catch((requestError) => setError(requestError.message || "Unable to load active job cards."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedJob) {
      setTechnicians([]);
      setEntries({});
      return;
    }
    setRosterLoading(true);
    setError("");
    kiosk.roster(selectedJob)
      .then((data) => {
        const roster = data?.technicians || [];
        setTechnicians(roster);
        setEntries(Object.fromEntries(roster.map((technician) => [technician.id, freshEntry()])));
      })
      .catch((requestError) => {
        setTechnicians([]);
        setEntries({});
        setError(requestError.message || "Unable to load the assigned crew.");
      })
      .finally(() => setRosterLoading(false));
  }, [selectedJob]);

  const validEntries = useMemo(() => technicians.flatMap((technician) => {
    const entry = entries[technician.id] || freshEntry();
    const hours = Number(entry.hours_logged);
    const rate = Number(entry.hourly_rate);
    if (!hours && !rate && !entry.notes) return [];
    return [{ technician_id: technician.id, hours_logged: hours, hourly_rate: rate, notes: entry.notes.trim() }];
  }), [entries, technicians]);

  function updateEntry(technicianId, field, value) {
    setEntries((current) => ({ ...current, [technicianId]: { ...(current[technicianId] || freshEntry()), [field]: value } }));
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!selectedJob) return setError("Select an active job card first.");
    if (!validEntries.length) return setError("Enter hours, rate and an activity note for at least one assigned technician.");
    if (validEntries.some((entry) => !Number.isFinite(entry.hours_logged) || entry.hours_logged <= 0 || entry.hours_logged > 24 || !Number.isFinite(entry.hourly_rate) || entry.hourly_rate < 0 || !entry.notes)) {
      return setError("Every submitted entry needs 0-24 hours, a non-negative hourly rate and an activity note.");
    }

    setSubmitting(true);
    try {
      const data = await kiosk.submitTimesheets(selectedJob, { work_date: workDate, entries: validEntries });
      setSuccess(`${data.entries.length} time entr${data.entries.length === 1 ? "y was" : "ies were"} recorded and audited.`);
      setEntries(Object.fromEntries(technicians.map((technician) => [technician.id, freshEntry()])));
    } catch (requestError) {
      setError(requestError.message || "The kiosk batch could not be submitted.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div data-evidence="kiosk-loading" className="p-8 text-center text-orac-secondary">Loading active job cards...</div>;

  return (
    <main className="max-w-6xl mx-auto space-y-6" data-evidence="kiosk-ready">
      <header className="flex items-center gap-3 pb-4 border-b border-orac-border">
        <div className="p-2 bg-orac-navy/10 rounded-lg"><Icon path={ICONS.users} className="h-6 w-6 text-orac-navy" /></div>
        <div><h1 className="text-xl font-bold text-orac-heading">Kiosk Time Entry</h1><p className="text-sm text-orac-secondary">Record assigned crew time with an accountable Operations or Admin user.</p></div>
      </header>

      {error && <div role="alert" data-evidence="kiosk-error" className="border border-red-200 bg-red-50 p-4 text-red-700 rounded-lg">{error}</div>}
      {success && <div role="status" className="border border-green-200 bg-green-50 p-4 text-green-700 rounded-lg">{success}</div>}

      <form onSubmit={submit} className="bg-white border border-orac-border rounded-lg overflow-hidden">
        <section className="p-6 border-b border-orac-border bg-orac-surface grid grid-cols-1 md:grid-cols-2 gap-6">
          <label className="text-sm font-medium text-orac-slate">Work date<input type="date" value={workDate} onChange={(event) => setWorkDate(event.target.value)} className="mt-1 w-full rounded border border-orac-border p-2" required /></label>
          <label className="text-sm font-medium text-orac-slate">Active job card<select value={selectedJob} onChange={(event) => setSelectedJob(event.target.value)} className="mt-1 w-full rounded border border-orac-border p-2" required><option value="">Select an active job</option>{jobs.map((job) => <option key={job.id} value={job.id}>{job.dispatch_number || job.id} - {job.status}</option>)}</select></label>
        </section>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-orac-border">
            <thead className="bg-orac-surface"><tr><th className="px-4 py-3 text-left text-xs font-semibold text-orac-slate">Assigned technician</th><th className="px-4 py-3 text-left text-xs font-semibold text-orac-slate">Hours</th><th className="px-4 py-3 text-left text-xs font-semibold text-orac-slate">Hourly rate</th><th className="px-4 py-3 text-left text-xs font-semibold text-orac-slate">Activity note</th></tr></thead>
            <tbody className="divide-y divide-orac-border">
              {!selectedJob && <tr><td colSpan="4" className="p-8 text-center text-sm text-orac-secondary">Select a job card to load its assigned crew.</td></tr>}
              {selectedJob && rosterLoading && <tr><td colSpan="4" className="p-8 text-center text-sm text-orac-secondary">Loading assigned crew...</td></tr>}
              {selectedJob && !rosterLoading && !technicians.length && <tr><td colSpan="4" className="p-8 text-center text-sm text-orac-secondary">This job has no active assigned technicians.</td></tr>}
              {!rosterLoading && technicians.map((technician) => <tr key={technician.id}><td className="px-4 py-3 text-sm font-medium text-orac-slate">{technician.name || technician.email || technician.id}</td><td className="px-4 py-3"><input aria-label={`Hours for ${technician.name || technician.id}`} type="number" min="0" max="24" step="0.25" value={entries[technician.id]?.hours_logged || ""} onChange={(event) => updateEntry(technician.id, "hours_logged", event.target.value)} className="w-24 rounded border border-orac-border p-2" /></td><td className="px-4 py-3"><input aria-label={`Hourly rate for ${technician.name || technician.id}`} type="number" min="0" step="0.01" value={entries[technician.id]?.hourly_rate || ""} onChange={(event) => updateEntry(technician.id, "hourly_rate", event.target.value)} className="w-28 rounded border border-orac-border p-2" /></td><td className="px-4 py-3"><input aria-label={`Activity note for ${technician.name || technician.id}`} value={entries[technician.id]?.notes || ""} onChange={(event) => updateEntry(technician.id, "notes", event.target.value)} maxLength="500" className="w-full rounded border border-orac-border p-2" /></td></tr>)}
            </tbody>
          </table>
        </div>
        <footer className="p-6 border-t border-orac-border bg-orac-surface flex justify-end"><button type="submit" disabled={submitting || rosterLoading || !technicians.length} className="px-5 py-2 bg-orac-navy text-white rounded disabled:opacity-50">{submitting ? "Recording..." : "Record audited time"}</button></footer>
      </form>
    </main>
  );
}
