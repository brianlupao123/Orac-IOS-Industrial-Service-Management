import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { legacyTimesheets } from "../api/client.js";

// Read-only history of the older forms, shown in the one Timesheet shape. Nothing here can create,
// edit or delete a record. Records still in progress are finished on their original screens.
const KINDS = [["all", "All"], ["daily_timesheet", "Daily Time Sheets"], ["contractor_log", "Contractor Logs"], ["timesheet_without_breakdown", "Earlier Timesheets"]];
const ORIGINAL = { daily_timesheet: "/daily-timesheets", contractor_log: "/contractor-logs", timesheet_without_breakdown: "/worksheets" };

export default function LegacyHistoryPage() {
  const [params, setParams] = useSearchParams();
  const kind = params.get("kind") || "all";
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => { legacyTimesheets.list().then((d) => setRows(d || [])).catch((e) => setError(e.message)).finally(() => setLoading(false)); }, []);
  const shown = useMemo(() => rows.filter((r) => kind === "all" || r.legacy_kind === kind), [rows, kind]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-orac-slate">Earlier records (read-only)</h1>
        <p className="text-sm text-gray-500 max-w-3xl">
          Daily Time Sheets, Contractor Logs and Timesheets recorded before Normal / 1.5 / 2.0 hours were captured. They are kept exactly as they were.
          New work is recorded on a <Link to="/worksheets" className="font-semibold text-orac-cyan underline">Timesheet</Link>, and the monthly <Link to="/monthly-worksheets" className="font-semibold text-orac-cyan underline">Worksheet</Link> is generated from those.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {KINDS.map(([k, label]) => (
          <button key={k} type="button" onClick={() => setParams(k === "all" ? {} : { kind: k })} className={`min-h-[44px] rounded-full px-4 text-sm font-semibold ${kind === k ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700"}`}>{label}</button>
        ))}
      </div>
      {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}
      {loading ? <p className="text-sm text-gray-500">Loading...</p> : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600"><tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Worker</th><th className="px-3 py-2">Record</th><th className="px-3 py-2">Hours (N / 1.5 / 2.0)</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">In a Worksheet?</th><th className="px-3 py-2"></th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {shown.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-400">No earlier records.</td></tr>}
              {shown.map((r) => (
                <tr key={`${r.legacy_kind}-${r.record_id}-${r.row_index}`}>
                  <td className="px-3 py-2">{r.work_date || "-"}</td>
                  <td className="px-3 py-2">{r.worker_name || r.technician_id || "-"}</td>
                  <td className="px-3 py-2">{r.legacy_label} <span className="text-xs text-gray-500">{r.record_id}</span></td>
                  <td className="px-3 py-2">{r.hours_breakdown ? `${r.hours_breakdown.normal} / ${r.hours_breakdown.ot_15} / ${r.hours_breakdown.ot_20}` : `${r.total_hours ?? "?"} total, no breakdown`}</td>
                  <td className="px-3 py-2">{String(r.status || "").replace(/_/g, " ")}</td>
                  <td className="px-3 py-2 text-xs text-gray-600">{r.counted_in_worksheet}</td>
                  <td className="px-3 py-2"><Link to={ORIGINAL[r.legacy_kind]} className="text-xs font-semibold text-orac-cyan underline">Open original</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
