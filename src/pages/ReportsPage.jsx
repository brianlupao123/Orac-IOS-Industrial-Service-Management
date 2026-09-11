import React, { useEffect, useState } from "react";
import { reports } from "../api/client.js";

const REPORT_TABS = [
  { key: "pipeline", label: "Pipeline" },
  { key: "po-compliance", label: "PO Compliance" },
  { key: "dispatch", label: "Dispatch" },
  { key: "worksheets", label: "Worksheets" },
  { key: "invoice-ready", label: "Invoice Ready" },
  { key: "variance", label: "Variance" }
];

export default function ReportsPage() {
  const [active, setActive] = useState("pipeline");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    reports.get(active)
      .then((result) => { if (!cancelled) setData(result); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [active]);

  function handleExportCsv() {
    if (!data) return;
    const isArray = Array.isArray(data);
    let rowsToExport = isArray ? data : [];
    
    // Fallback logic for object-based reports
    if (!isArray && typeof data === 'object') {
       if (data.counts) rowsToExport = [data.counts];
       else if (data.by_status) rowsToExport = [data.by_status];
       else rowsToExport = [data]; 
    }

    if (rowsToExport.length === 0) return;
    const headers = Object.keys(rowsToExport[0]).join(",");
    const rows = rowsToExport.map(row => Object.values(row).map(val => `"${typeof val === 'object' ? JSON.stringify(val).replace(/"/g, '""') : val}"`).join(","));
    const csv = [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orac-report-${active}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-8rem)]">
      {/* Header and Controls */}
      <div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-orac-slate">Operational Reports</h1>
            <p className="mt-1 text-sm text-gray-400">View and export system metrics</p>
          </div>
          <button
            onClick={handleExportCsv}
            disabled={loading || !data || data.length === 0}
            className="flex items-center gap-2 rounded-lg bg-orac-blue px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:brightness-105 disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </button>
        </div>

        {/* Tab Strip */}
        <div className="mt-6 flex flex-wrap gap-2 border-b border-gray-200 pb-px">
          {REPORT_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActive(tab.key)}
              className={`relative rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
                active === tab.key
                  ? "bg-white text-orac-blue shadow-[0_-2px_4px_rgba(0,0,0,0.05)] border-t border-l border-r border-gray-200 z-10 -mb-px"
                  : "bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-orac-slate border border-transparent"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Data Viewer */}
      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 shrink-0">{error}</div>}
      
      <div className="flex-1 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm flex flex-col relative z-0">
        {loading ? (
          <div className="flex flex-1 items-center justify-center text-gray-400">Loading report data...</div>
        ) : (
          <div className="flex-1 overflow-auto">
            {!data || (Array.isArray(data) && data.length === 0) ? (
              <div className="flex h-full items-center justify-center text-sm text-gray-400">No data found for this report.</div>
            ) : Array.isArray(data) ? (
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-gray-100 shadow-sm z-10">
                  <tr className="text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    {Object.keys(data[0] || {}).map((col) => (
                      <th key={col} className="px-4 py-3 whitespace-nowrap">{col.replace(/_/g, " ")}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      {Object.values(row).map((val, j) => (
                        <td key={j} className="px-4 py-2.5 whitespace-nowrap text-orac-slate">
                          {typeof val === 'boolean' ? (val ? 'Yes' : 'No') : val}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-6 text-sm font-mono text-gray-700 bg-gray-50 h-full overflow-auto whitespace-pre">
                {JSON.stringify(data, null, 2)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}