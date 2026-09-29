import React, { useState, useEffect } from "react";
import { Icon, ICONS } from "../components/icons.jsx";
import { collections, kiosk } from "../api/client.js";
import { displayTrade } from "../constants/trades.js";

export default function KioskModePage({ user }) {
  const [technicians, setTechnicians] = useState([]);
  const [activeJobs, setActiveJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsError, setJobsError] = useState("");
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Form State
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedJob, setSelectedJob] = useState("");
  const [crewHours, setCrewHours] = useState({});

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

  useEffect(() => { loadJobs(); }, []);

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
      setCrewHours(Object.fromEntries(roster.map((tech) => [tech.id, { normal: 0, ot15: 0, ot20: 0, description: "" }])));
    } catch (err) {
      setTechnicians([]);
      setCrewHours({});
      setRosterError(err.message);
    } finally {
      setRosterLoading(false);
    }
  };

  useEffect(() => { loadRoster(); }, [selectedJob]);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!selectedJob) {
      setFormError("Select an active dispatch card first.");
      return;
    }

    const entries = Object.entries(crewHours).filter(([_, h]) => h.normal > 0 || h.ot15 > 0 || h.ot20 > 0);

    if (entries.length === 0) {
      setFormError("Enter hours for at least one assigned technician.");
      return;
    }

    setSubmitting(true);
    try {
      await kiosk.submit(selectedJob, {
        work_date: selectedDate,
        entries: entries.map(([technician_id, hours]) => ({
          technician_id,
          hours_logged: hours.normal + (hours.ot15 * 1.5) + (hours.ot20 * 2.0),
          hourly_rate: 45,
          notes: hours.description
        }))
      });

      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);

      // Reset hours
      const resetHours = { ...crewHours };
      Object.keys(resetHours).forEach(k => {
        resetHours[k] = { normal: 0, ot15: 0, ot20: 0, description: "" };
      });
      setCrewHours(resetHours);

    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-3 pb-4 border-b border-orac-border">
        <div className="p-2 bg-orac-navy/10 rounded-lg">
          <Icon path={ICONS.users} className="h-6 w-6 text-orac-navy" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-orac-heading">Kiosk Mode: Crew Time Entry</h1>
          <p className="text-sm text-orac-secondary">Batch submit daily hours for multiple crew members at once.</p>
        </div>
      </div>

      {success && (
        <div role="status" className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-lg flex items-center">
          <Icon path={ICONS.check} className="h-5 w-5 mr-2 text-green-600" />
          Batch timesheets submitted successfully.
        </div>
      )}

      {formError && (
        <div role="alert" className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-start gap-2">
          <Icon path={ICONS.warning} className="h-5 w-5 mt-0.5 shrink-0 text-red-600" />
          <span>{formError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-orac-border overflow-hidden">
        {/* Date & Job Selectors */}
        <fieldset className="p-6 border-b border-orac-border bg-orac-surface space-y-4">
          <legend className="text-sm font-semibold text-orac-secondary px-0 mb-2">1. Select job and date</legend>

          {jobsError && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-center justify-between gap-3">
              <span>Could not load active job cards: {jobsError}</span>
              <button type="button" onClick={loadJobs} className="shrink-0 rounded-md border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-100">Try again</button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="kiosk-work-date" className="block text-sm font-medium text-orac-slate mb-1">Work Date</label>
              <input 
                id="kiosk-work-date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full rounded-md border-orac-border shadow-sm focus:border-orac-navy focus:ring-orac-navy sm:text-sm p-2 border"
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
                className="w-full rounded-md border-orac-border shadow-sm focus:border-orac-navy focus:ring-orac-navy sm:text-sm p-2 border disabled:opacity-60"
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
          </div>
        </fieldset>

        {rosterError && (
          <div role="alert" className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-center justify-between gap-3">
            <span>Could not load the crew roster: {rosterError}</span>
            <button type="button" onClick={loadRoster} className="shrink-0 rounded-md border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-100">Try again</button>
          </div>
        )}

        {/* Crew Roster Table */}
        <div className="overflow-x-auto">
          <p className="px-6 pt-4 text-sm font-semibold text-orac-secondary">2. Enter crew hours</p>
          <table className="min-w-full divide-y divide-orac-border">
            <thead className="bg-orac-surface">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-orac-slate">Crew Member</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-orac-slate">Trade</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-orac-slate">Normal Hrs</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-orac-slate">OT 1.5×</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-orac-slate">OT 2.0×</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-orac-slate">Activity / Task</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-orac-border">
              {rosterLoading ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-orac-secondary text-sm">Loading crew roster...</td></tr>
              ) : technicians.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-orac-secondary text-sm">Select a dispatch card to load its assigned technician roster.</td></tr>
              ) : technicians.map(tech => (
                <tr key={tech.id} className="hover:bg-orac-surface/50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-orac-slate">{tech.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-orac-secondary">{displayTrade(tech.trade)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input type="number" min="0" step="0.5" max="24"
                      value={crewHours[tech.id]?.normal || ""}
                      onChange={(e) => handleHourChange(tech.id, "normal", e.target.value)}
                      className="w-20 rounded-md border p-1 text-sm border-orac-border"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input type="number" min="0" step="0.5" max="24"
                      value={crewHours[tech.id]?.ot15 || ""}
                      onChange={(e) => handleHourChange(tech.id, "ot15", e.target.value)}
                      className="w-20 rounded-md border p-1 text-sm border-orac-border"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input type="number" min="0" step="0.5" max="24"
                      value={crewHours[tech.id]?.ot20 || ""}
                      onChange={(e) => handleHourChange(tech.id, "ot20", e.target.value)}
                      className="w-20 rounded-md border p-1 text-sm border-orac-border"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <input type="text" placeholder="e.g. Belt splicing"
                      value={crewHours[tech.id]?.description || ""}
                      onChange={(e) => handleDescChange(tech.id, e.target.value)}
                      className="w-full rounded-md border p-1 text-sm border-orac-border"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Submit */}
        <div className="p-6 border-t border-orac-border bg-orac-surface flex justify-end">
          <button
            type="submit"
            disabled={submitting || rosterLoading || !selectedJob}
            className="flex items-center px-6 py-2.5 bg-orac-navy text-white rounded-lg hover:bg-orac-navy/90 focus:ring-2 focus:ring-offset-2 focus:ring-orac-navy disabled:opacity-50 font-semibold text-sm"
          >
            {submitting ? "Saving Batch..." : "Submit Kiosk Batch"}
          </button>
        </div>
      </form>
    </div>
  );
}
