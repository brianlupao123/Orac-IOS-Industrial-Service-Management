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
    approved: items.filter((w) => w.status === "Approved" || w.status === "Completed").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-orac-slate">Field Worksheets</h1>
        <p className="mt-1 text-sm text-gray-400">Manage field work submissions and supervisor reviews</p>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total" value={counts.total} tone="slate" icon="📝" />
        <StatCard label="Draft" value={counts.draft} tone="slate" icon="✏️" />
        <StatCard label="Awaiting Review" value={counts.submitted} tone="amber" icon="⏳" />
        <StatCard label="Approved" value={counts.approved} tone="green" icon="✅" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {[["all", "All"], ["Draft", "Draft"], ["Submitted", "Submitted"], ["Approved", "Approved"], ["Returned", "Returned"]].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              filter === key ? "bg-orac-blue text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="py-12 text-center text-gray-400">Loading worksheets...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-12 text-center text-sm text-gray-400">
          No worksheets found.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((ws) => (
            <div key={ws.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-orac-slate">{ws.activity || "Worksheet"}</span>
                    <StatusBadge status={ws.status} />
                  </div>
                  <div className="mt-1 flex flex-wrap gap-4 text-sm text-gray-500">
                    <span>{ws.hours ?? "?"} hrs</span>
                    {ws.technician_name && <span>Tech: {ws.technician_name}</span>}
                    {ws.outcomes && <span className="truncate max-w-xs">{ws.outcomes}</span>}
                  </div>
                </div>
                {canSubmit && ws.status === "Draft" && (
                  <button
                    onClick={() => handleSubmit(ws.id)}
                    className="shrink-0 rounded-lg bg-orac-blue px-4 py-1.5 text-sm font-medium text-white transition-colors hover:brightness-105"
                  >
                    Submit
                  </button>
                )}
              </div>

              {canReview && ws.status === "Submitted" && (
                <div className="mt-3 border-t border-gray-100 pt-3">
                  <textarea
                    placeholder="Review comment (required to return)"
                    value={comment[ws.id] || ""}
                    onChange={(e) => setComment({ ...comment, [ws.id]: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm placeholder:text-gray-300 focus:border-orac-blue focus:outline-none focus:ring-2 focus:ring-orac-blue/20"
                    rows={2}
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => handleReview(ws.id, "approve")}
                      className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleReview(ws.id, "return")}
                      className="rounded-lg bg-orange-500 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-orange-600"
                    >
                      Return
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