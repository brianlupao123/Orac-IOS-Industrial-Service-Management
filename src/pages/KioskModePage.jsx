import React, { useState, useEffect } from "react";
import { Icon, ICONS } from "../components/icons.jsx";
import { collections, worksheets } from "../api/client.js";

export default function KioskModePage({ user }) {
  const [technicians, setTechnicians] = useState([]);
  const [activeJobs, setActiveJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Form State
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedJob, setSelectedJob] = useState("");
  const [crewHours, setCrewHours] = useState({});

  useEffect(() => {
    const loadData = async () => {
      try {
        const usersData = await collections.list("users");
        const techs = (usersData || []).filter(u => u.role === "Technician" && u.is_active);
        setTechnicians(techs);

        const jobsData = await collections.list("dispatch_cards");
        const active = (jobsData || []).filter(j => j.status === "Dispatched" || j.status === "In_Progress");
        setActiveJobs(active);

        const initialHours = {};
        techs.forEach(t => {
          initialHours[t.id] = { normal: 0, ot15: 0, ot20: 0, description: "" };
        });
        setCrewHours(initialHours);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

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
    if (!selectedJob) {
      alert("Please select a Job Card.");
      return;
    }

    try {
      setLoading(true);
      const entries = Object.entries(crewHours).filter(([_, h]) => h.normal > 0 || h.ot15 > 0 || h.ot20 > 0);
      
      if (entries.length === 0) {
        alert("Please enter hours for at least one crew member.");
        setLoading(false);
        return;
      }

      // Submit batch timesheets — each crew member gets their own entry
      for (const [techId, hours] of entries) {
        const totalWeighted = hours.normal + (hours.ot15 * 1.5) + (hours.ot20 * 2.0);
        // POST /dispatch_cards/:id/timesheets
        await fetch(`${import.meta.env.VITE_API_BASE_URL || ""}/api/dispatch_cards/${selectedJob}/timesheets`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`
          },
          body: JSON.stringify({
            technician_id: techId,
            hours_logged: totalWeighted,
            hourly_rate: 45
          })
        });
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
      
      // Reset hours
      const resetHours = { ...crewHours };
      Object.keys(resetHours).forEach(k => {
        resetHours[k] = { normal: 0, ot15: 0, ot20: 0, description: "" };
      });
      setCrewHours(resetHours);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !technicians.length) {
    return <div className="p-8 text-center text-orac-secondary">Loading Kiosk Mode...</div>;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 mb-4">{error}</p>
        <button onClick={() => window.location.reload()} className="px-4 py-2 bg-orac-navy text-white rounded">Retry</button>
      </div>
    );
  }

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
        <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-lg flex items-center">
          <Icon path={ICONS.check} className="h-5 w-5 mr-2 text-green-600" />
          Batch timesheets submitted successfully.
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-orac-border overflow-hidden">
        {/* Date & Job Selectors */}
        <div className="p-6 border-b border-orac-border bg-orac-surface space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-orac-slate mb-1">Work Date</label>
              <input 
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full rounded-md border-orac-border shadow-sm focus:border-orac-navy focus:ring-orac-navy sm:text-sm p-2 border"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-orac-slate mb-1">Active Job Card</label>
              <select 
                value={selectedJob}
                onChange={(e) => setSelectedJob(e.target.value)}
                className="w-full rounded-md border-orac-border shadow-sm focus:border-orac-navy focus:ring-orac-navy sm:text-sm p-2 border"
                required
              >
                <option value="">-- Select Active Job --</option>
                {activeJobs.map(j => (
                  <option key={j.id} value={j.id}>{j.dispatch_number} — {j.status}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Crew Roster Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-orac-border">
            <thead className="bg-orac-surface">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-orac-slate uppercase tracking-wider">Crew Member</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-orac-slate uppercase tracking-wider">Normal Hrs</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-orac-slate uppercase tracking-wider">OT 1.5×</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-orac-slate uppercase tracking-wider">OT 2.0×</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-orac-slate uppercase tracking-wider">Activity / Task</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-orac-border">
              {technicians.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-orac-secondary text-sm">No active technicians found.</td></tr>
              ) : technicians.map(tech => (
                <tr key={tech.id} className="hover:bg-orac-surface/50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-orac-slate">{tech.name}</td>
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
            disabled={loading}
            className="flex items-center px-6 py-2.5 bg-orac-navy text-white rounded-lg hover:bg-orac-navy/90 focus:ring-2 focus:ring-offset-2 focus:ring-orac-navy disabled:opacity-50 font-semibold text-sm"
          >
            {loading ? "Saving Batch..." : "Submit Kiosk Batch"}
          </button>
        </div>
      </form>
    </div>
  );
}
