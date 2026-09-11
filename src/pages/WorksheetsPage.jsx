import React, { useEffect, useState } from "react";
import { collections, worksheets } from "../api/client.js";
import StatusBadge from "../components/StatusBadge.jsx";
import StatCard from "../components/StatCard.jsx";

const REVIEW_ROLES = ["Admin", "Operations", "Supervisor"];
const SUBMIT_ROLES = ["Admin", "Operations", "Technician", "Supervisor"];

export default function WorksheetsPage({ user }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [comment, setComment] = useState({});
  const [filter, setFilter] = useState("all");

  const canReview = REVIEW_ROLES.includes(user.role);
  const canSubmit = SUBMIT_ROLES.includes(user.role);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await collections.list("field_worksheets");
      setItems(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit(id) {
    try {
      await worksheets.submit(id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleReview(id, decision) {
    const note = comment[id] || "";
    if (decision === "return" && !note.trim()) {
      setError("A comment is required when returning a worksheet.");
      return;
    }
    try {
      await worksheets.review(id, decision, note);
      setComment({ ...comment, [id]: "" });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  const filtered = filter === "all" ? items : items.filter((ws) => ws.status === filter);
  const counts = {
    total: items.length,
    draft: items.filter((w) => w.status === "Draft").length,
    submitted: items.filter((w) => w.status === "Submitted").length,
    approved: items.filter((w) => w.status === "Supervisor_Approved").length,
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-light tracking-tight text-gray-900 mb-2">Field Worksheets</h1>
        <p className="text-sm text-gray-500 max-w-3xl leading-relaxed">
          <strong>Field Worksheets</strong> document the actual work performed on-site, including safety checks and daily outcomes. 
          They are distinct from <em>Timesheets</em>, which only log labor hours, and <em>Dispatch Cards</em>, which represent the overall assignment. 
          Technicians draft and submit Worksheets; Supervisors review and approve them.
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Worksheets" value={counts.total} tone="slate" icon="📝" />
        <StatCard label="In Draft" value={counts.draft} tone="slate" icon="✏️" />
        <StatCard label="Awaiting Review" value={counts.submitted} tone="amber" icon="⏳" />
        <StatCard label="Approved" value={counts.approved} tone="green" icon="✅" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 pb-2 border-b border-gray-100">
        {[["all", "All Worksheets"], ["Draft", "Draft"], ["Submitted", "Submitted"], ["Supervisor_Approved", "Approved"], ["Returned_For_Correction", "Returned"]].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold tracking-wide transition-all ${
              filter === key 
                ? "bg-gray-900 text-white shadow-md" 
                : "bg-gray-100/50 text-gray-600 hover:bg-gray-200/80"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50/80 px-4 py-3 text-sm text-red-600 shadow-sm backdrop-blur-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-gray-400">Loading worksheets...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white px-4 py-16 flex flex-col items-center justify-center shadow-sm">
          <div className="h-12 w-12 rounded-full bg-gray-50 flex items-center justify-center text-gray-300 mb-4">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          </div>
          <p className="text-sm font-medium text-gray-500">No field worksheets found.</p>
          <p className="mt-1 text-xs text-gray-400">Adjust your filters or create a new worksheet from a dispatch card.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((ws) => (
            <div key={ws.id} className="group rounded-xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:shadow-md hover:border-gray-200">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-semibold text-gray-900 tracking-tight text-lg">{ws.activity || "Worksheet"}</span>
                    <StatusBadge status={ws.status} />
                  </div>
                  
                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-500 mb-3">
                    <div className="flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      {ws.hours ?? "?"} hours logged
                    </div>
                    {ws.technician_name && (
                      <div className="flex items-center gap-1.5">
                        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        {ws.technician_name}
                      </div>
                    )}
                  </div>
                  
                  {ws.outcomes && (
                    <div className="mt-3 bg-gray-50/80 rounded-lg p-3 border border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Activity Outcomes</p>
                      <p className="text-sm text-gray-700">{ws.outcomes}</p>
                    </div>
                  )}
                </div>
                
                {canSubmit && (ws.status === "Draft" || ws.status === "Returned_For_Correction") && (
                  <button
                    onClick={() => handleSubmit(ws.id)}
                    className="shrink-0 rounded-lg bg-gray-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-gray-800 focus:ring-2 focus:ring-gray-900/20"
                  >
                    Submit for Review
                  </button>
                )}
              </div>

              {canReview && ws.status === "Submitted" && (
                <div className="mt-5 border-t border-gray-100 pt-5 bg-gray-50/30 -mx-5 -mb-5 px-5 pb-5 rounded-b-xl">
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-2">Supervisor Review</label>
                  <textarea
                    placeholder="Enter review comments (required if returning)"
                    value={comment[ws.id] || ""}
                    onChange={(e) => setComment({ ...comment, [ws.id]: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm placeholder:text-gray-400 focus:border-orac-blue focus:outline-none focus:ring-4 focus:ring-orac-blue/10 transition-all shadow-sm"
                    rows={2}
                  />
                  <div className="mt-3 flex gap-3">
                    <button
                      onClick={() => handleReview(ws.id, "approve")}
                      className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-700"
                    >
                      Approve Worksheet
                    </button>
                    <button
                      onClick={() => handleReview(ws.id, "return")}
                      className="rounded-lg bg-white border border-gray-300 px-5 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:text-red-600 hover:border-red-200"
                    >
                      Return for Corrections
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}