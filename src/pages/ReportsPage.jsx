import React, { useEffect, useState } from "react";
import { reports } from "../api/client.js";
import DataTable from "../components/DataTable.jsx";
import StatCard from "../components/StatCard.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import PageHeaderBanner from "../components/PageHeaderBanner.jsx";
import { ErrorBanner } from "../components/PageStates.jsx";
import { ICONS } from "../components/icons.jsx";
import { csvCell } from "../csvSafe.js";

const REPORT_TABS = [
  { key: "pipeline", label: "Pipeline", roles: ["Admin", "Management", "Sales"] },
  { key: "po-compliance", label: "PO Compliance", roles: ["Admin", "Management", "Finance", "Operations"] },
  { key: "dispatch", label: "Dispatch", roles: ["Admin", "Management", "Operations", "Supervisor"] },
  { key: "worksheets", label: "Worksheets", roles: ["Admin", "Management", "Operations", "Supervisor"] },
  { key: "invoice-ready", label: "Invoice Ready", roles: ["Admin", "Management", "Finance"] },
  { key: "variance", label: "Variance", roles: ["Admin", "Management", "Finance", "Operations", "Supervisor"] }
];

export default function ReportsPage({ user }) {
  const visibleTabs = REPORT_TABS.filter((tab) => tab.roles.includes(user.role));
  const [active, setActive] = useState(visibleTabs[0]?.key || "");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const canExport = Boolean(data) && (Array.isArray(data) ? data.length > 0 : Object.keys(data).length > 0);

  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.key === active)) {
      setActive(visibleTabs[0]?.key || "");
    }
  }, [active, user.role]);

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
    let rowsToExport = Array.isArray(data) ? data : [];
    if (active === "pipeline" && data?.by_status && typeof data.by_status === "object") {
      rowsToExport = Object.entries(data.by_status).flatMap(([status, rows]) =>
        Array.isArray(rows) ? rows.map((row) => ({ report_category: status, ...row })) : []
      );
    } else if (active === "po-compliance") {
      rowsToExport = [
        ...(Array.isArray(data?.approved_awaiting_po) ? data.approved_awaiting_po.map((row) => ({ report_category: "Approved Awaiting PO", ...row })) : []),
        ...(Array.isArray(data?.requires_amendment) ? data.requires_amendment.map((row) => ({ report_category: "Requires Amendment", ...row })) : []),
        ...(Array.isArray(data?.urgent_pending_verification) ? data.urgent_pending_verification.map((row) => ({ report_category: "Urgent Pending Verification", ...row })) : [])
      ];
    } else if (active === "worksheets") {
      rowsToExport = [
        ...(Array.isArray(data?.pending_review) ? data.pending_review.map((row) => ({ report_category: "Pending Review", ...row })) : []),
        ...(Array.isArray(data?.returned_for_correction) ? data.returned_for_correction.map((row) => ({ report_category: "Returned For Correction", ...row })) : []),
        { report_category: "Summary", approved_count: data?.approved_count || 0 }
      ];
    } else if (!Array.isArray(data) && typeof data === "object") {
      rowsToExport = [data];
    }

    if (rowsToExport.length === 0) return;
    const columnNames = [...new Set(rowsToExport.flatMap((row) => Object.keys(row)))];
    const headers = columnNames.join(",");
    const rows = rowsToExport.map((row) => columnNames.map((column) => {
      return csvCell(row[column]);
    }).join(","));
    const csv = [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orac-report-${active}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function renderStructuredReport() {
    if (active === "pipeline" && data?.counts && data?.by_status && typeof data.counts === "object" && typeof data.by_status === "object") {
      return <div className="space-y-6 p-5">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">{Object.entries(data.counts).map(([status, count]) => <StatCard key={status} label={status.replace(/_/g, " ")} value={count} tone="blue" />)}</div>
        {Object.entries(data.by_status).map(([status, rows]) => <DataTable key={status} title={`${status.replace(/_/g, " ")} (${Array.isArray(rows) ? rows.length : 0})`} columns={["Quote", "Client", "Total"]} rows={Array.isArray(rows) ? rows : []} emptyText="No quotes in this stage." renderRow={(row) => <tr key={row.id} className="hover:bg-gray-50"><td className="px-5 py-3.5 font-medium">{row.quote_number || row.id}</td><td className="px-5 py-3.5">{row.client_id || "-"}</td><td className="px-5 py-3.5">R {Number(row.total_amount || 0).toLocaleString()}</td></tr>} />)}</div>;
    }
    if (active === "po-compliance" && Array.isArray(data?.approved_awaiting_po) && Array.isArray(data?.requires_amendment) && Array.isArray(data?.urgent_pending_verification)) {
      return <div className="space-y-6 p-5">
        <DataTable title="Approved Quotes Awaiting PO" columns={["Quote", "Client"]} rows={data.approved_awaiting_po} emptyText="No quotes awaiting a purchase order." renderRow={(row) => <tr key={row.id} className="hover:bg-gray-50"><td className="px-5 py-3.5 font-medium">{row.quote_number || row.id}</td><td className="px-5 py-3.5">{row.client_id || "-"}</td></tr>} />
        <DataTable title="Purchase Orders Requiring Amendment" columns={["PO", "PO Amount", "Logged Value"]} rows={data.requires_amendment} emptyText="No purchase orders require amendment." renderRow={(row) => <tr key={row.id} className="hover:bg-gray-50"><td className="px-5 py-3.5 font-medium">{row.po_reference || row.id}</td><td className="px-5 py-3.5">R {Number(row.po_amount || 0).toLocaleString()}</td><td className="px-5 py-3.5 text-red-600">R {Number(row.logged_value || 0).toLocaleString()}</td></tr>} />
        <DataTable title="Urgent Dispatch Awaiting PO Verification" columns={["PO", "Quotation", "Status"]} rows={data.urgent_pending_verification} emptyText="No urgent dispatches await PO verification." renderRow={(row) => <tr key={row.id} className="hover:bg-gray-50"><td className="px-5 py-3.5">{row.id}</td><td className="px-5 py-3.5">{row.quotation_id || "-"}</td><td className="px-5 py-3.5"><StatusBadge status="Approved_Pending_PO" /></td></tr>} />
      </div>;
    }
    if (active === "worksheets" && Array.isArray(data?.pending_review) && Array.isArray(data?.returned_for_correction) && typeof data?.approved_count === "number") {
      return <div className="space-y-6 p-5"><div className="grid gap-3 sm:grid-cols-3"><StatCard label="Approved" value={data.approved_count} tone="green" /><StatCard label="Pending Review" value={data.pending_review.length} tone={data.pending_review.length ? "amber" : "slate"} /><StatCard label="Returned" value={data.returned_for_correction.length} tone={data.returned_for_correction.length ? "red" : "slate"} /></div><DataTable title="Worksheets Pending Review" columns={["Worksheet", "Dispatch", "Date", "Hours"]} rows={data.pending_review} emptyText="No worksheets are pending review." renderRow={(row) => <tr key={row.id} className="hover:bg-gray-50"><td className="px-5 py-3.5">{row.id}</td><td className="px-5 py-3.5">{row.dispatch_card_id}</td><td className="px-5 py-3.5">{row.work_date || "-"}</td><td className="px-5 py-3.5">{row.hours ?? "-"}</td></tr>} /><DataTable title="Worksheets Returned for Correction" columns={["Worksheet", "Dispatch", "Comment"]} rows={data.returned_for_correction} emptyText="No worksheets have been returned." renderRow={(row) => <tr key={row.id} className="hover:bg-gray-50"><td className="px-5 py-3.5">{row.id}</td><td className="px-5 py-3.5">{row.dispatch_card_id}</td><td className="px-5 py-3.5">{row.supervisor_comment || "-"}</td></tr>} /></div>;
    }
    return null;
  }

  return (
    <div data-evidence="reports-page" className="flex h-[calc(100vh-8rem)] flex-col gap-4 animate-in fade-in duration-500">
      {/* Header and Controls */}
      <div>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-stretch">
          <PageHeaderBanner className="min-w-0" eyebrow="Operational intelligence" title="Operational Reports" subtitle="View and export system metrics." iconPath={ICONS.report} />
          <button
            onClick={handleExportCsv}
            disabled={loading || !canExport}
            className="flex items-center justify-center gap-2 rounded-lg bg-orac-blue px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sky-500 disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </button>
        </div>

        {/* Tab Strip */}
        <div className="mt-4 flex flex-wrap items-center gap-1 rounded-lg bg-gray-100 p-1">
          {visibleTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActive(tab.key)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-all ${
                active === tab.key
                  ? "bg-orac-navy text-white shadow-sm"
                  : "text-gray-600 hover:bg-white hover:text-orac-navy hover:shadow-sm"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Data Viewer */}
      {error && <ErrorBanner message={error} />}
      
      <div className="flex-1 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm flex flex-col relative z-0">
        {loading ? (
          <div data-evidence="reports-loading" className="flex flex-1 items-center justify-center text-gray-400">Loading report data...</div>
        ) : (
          <div className="flex-1 overflow-auto">
            {!data || (Array.isArray(data) && data.length === 0) ? (
              <div data-evidence="reports-empty" className="flex h-full items-center justify-center text-sm text-gray-400">No data found for this report.</div>
            ) : renderStructuredReport() ? (
              renderStructuredReport()
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
