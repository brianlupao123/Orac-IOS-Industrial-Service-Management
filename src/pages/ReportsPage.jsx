import React, { useEffect, useState } from "react";
import { documents, reports } from "../api/client.js";
import { canAccessRoute } from "../accessPolicy.js";
import DataTable from "../components/DataTable.jsx";
import RecordLink from "../components/RecordLink.jsx";
import StatCard from "../components/StatCard.jsx";
import StatusSummary from "../components/StatusSummary.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import PageHeaderBanner from "../components/PageHeaderBanner.jsx";
import { ErrorBanner } from "../components/PageStates.jsx";
import { ICONS } from "../components/icons.jsx";
import TechnicianPayrollPanel from "../components/TechnicianPayrollPanel.jsx";
import { csvCell } from "../csvSafe.js";
import { formatMoney, formatNumber, formatSignedMoney } from "../lib/format.js";

const REPORT_TABS = [
  { key: "pipeline", label: "Pipeline", roles: ["Admin", "Management", "Sales"] },
  { key: "po-compliance", label: "PO Compliance", roles: ["Admin", "Management", "Finance", "Operations"] },
  { key: "dispatch", label: "Dispatch", roles: ["Admin", "Management", "Operations", "Supervisor"] },
  { key: "worksheets", label: "Timesheets", roles: ["Admin", "Management", "Operations", "Supervisor"] },
  { key: "invoice-ready", label: "Invoice Ready", roles: ["Admin", "Management", "Finance"] },
  { key: "variance", label: "Variance", roles: ["Admin", "Management", "Finance", "Operations", "Supervisor"] },
  { key: "technician-payroll", label: "Technician Payroll", roles: ["Admin", "Management", "Finance"] }
];
const PAYROLL_TAB = "technician-payroll";

const QUOTE_STATUS_MEANING = {
  Draft: "Being prepared. Can still be edited or cancelled.",
  Sent: "Sent to the client, waiting for a response.",
  Approved_Pending_PO: "Client approved. Waiting for a purchase order.",
  PO_Verified: "Purchase order checked and accepted.",
  Field_Dispatch: "Work has been dispatched to the field.",
  Invoiced: "An invoice has been raised.",
  Cancelled: "Cancelled before completion.",
};
const QUOTE_STATUS_TONE = { Draft: "neutral", Sent: "info", Approved_Pending_PO: "warning", PO_Verified: "success", Field_Dispatch: "info", Invoiced: "success", Cancelled: "neutral" };

export default function ReportsPage({ user }) {
  const visibleTabs = REPORT_TABS.filter((tab) => tab.roles.includes(user.role));
  // Record links use the same route guard as the router. They only navigate; they never write.
  const canQuote = canAccessRoute(user.role, "/quotations");
  const canFinance = canAccessRoute(user.role, "/finance");
  const canTimesheets = canAccessRoute(user.role, "/worksheets");
  const canJobCards = canAccessRoute(user.role, "/job-cards");
  const canInvoiceReadiness = canAccessRoute(user.role, "/invoice-readiness");
  const [active, setActive] = useState(visibleTabs[0]?.key || "");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloadError, setDownloadError] = useState("");
  const [downloadingId, setDownloadingId] = useState("");
  const canExport = Boolean(data) && (Array.isArray(data) ? data.length > 0 : Object.keys(data).length > 0);

  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.key === active)) {
      setActive(visibleTabs[0]?.key || "");
    }
  }, [active, user.role]);

  useEffect(() => {
    let cancelled = false;
    // The payroll tab loads its own month-based data inside TechnicianPayrollPanel.
    if (active === PAYROLL_TAB) { setData(null); setError(""); setLoading(false); return undefined; }
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

  async function handleEvidenceDownload(type, id) {
    if (!id || downloadingId) return;
    setDownloadError("");
    setDownloadingId(id);
    try {
      await documents.download(type, id);
    } catch (err) {
      setDownloadError(err.message || "The evidence document could not be downloaded.");
    } finally {
      setDownloadingId("");
    }
  }

  function evidenceAction(type, id, label = "Download PDF") {
    return <button type="button" onClick={() => handleEvidenceDownload(type, id)} disabled={!id || Boolean(downloadingId)} className="min-h-11 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-orac-navy hover:bg-gray-50 disabled:opacity-50" aria-label={`${label}: ${id || "record"}`}>
      {downloadingId === id ? "Preparing..." : label}
    </button>;
  }

  function renderStructuredReport() {
    if (active === "pipeline" && data?.counts && data?.by_status && typeof data.counts === "object" && typeof data.by_status === "object") {
      return <div className="space-y-5 py-2">
        <section aria-labelledby="pipeline-summary-title" className="space-y-3">
          <h2 id="pipeline-summary-title" className="text-sm font-semibold text-gray-700">Quotation pipeline</h2>
          <StatusSummary label="Quotes by stage" items={Object.entries(data.counts).map(([status, count]) => ({ key: status, label: status.replace(/_/g, " "), meaning: QUOTE_STATUS_MEANING[status], count, tone: QUOTE_STATUS_TONE[status] || "neutral" }))} />
        </section>
        <section aria-label="Quotation stages" className="space-y-4">
          {Object.entries(data.by_status).map(([status, rows]) => <DataTable key={status} title={`${status.replace(/_/g, " ")} (${Array.isArray(rows) ? rows.length : 0})`} columns={["Quote", "Client", "Total"]} rows={Array.isArray(rows) ? rows : []} renderActions={(row) => <div className="flex flex-wrap items-center gap-2">{canQuote && <RecordLink user={user} path="/quotations" param="quote" id={row.id} what="quote" name={row.quote_number} />}{evidenceAction("quotes", row.id)}</div>} emptyStateClassName="px-5 py-6 flex flex-col items-center justify-center text-center" emptyText="No quotes in this stage." renderRow={(row) => <tr key={row.id} className="hover:bg-gray-50"><td className="px-5 py-3.5 font-medium">{row.quote_number || row.id}</td><td className="px-5 py-3.5">{row.client_id || "-"}</td><td className="px-5 py-3.5">{formatMoney(row.total_amount)}</td></tr>} />)}
        </section>
      </div>;
    }
    if (active === "po-compliance" && Array.isArray(data?.approved_awaiting_po) && Array.isArray(data?.requires_amendment) && Array.isArray(data?.urgent_pending_verification)) {
      return <div className="space-y-5 py-2">
        <section aria-labelledby="po-summary-title" className="space-y-3">
          <h2 id="po-summary-title" className="text-sm font-semibold text-gray-700">Purchase order overview</h2>
          <StatusSummary label="Purchase order compliance" items={[
            { key: "awaiting", label: "Approved awaiting PO", meaning: "Approved quotes with no purchase order received yet.", count: data.approved_awaiting_po.length, tone: data.approved_awaiting_po.length ? "warning" : "neutral" },
            { key: "amendment", label: "Requires amendment", meaning: "Purchase orders flagged for amendment.", count: data.requires_amendment.length, tone: data.requires_amendment.length ? "danger" : "neutral" },
            { key: "legacy", label: "Legacy dispatch exceptions", meaning: "Work started before PO verification (legacy records).", count: data.urgent_pending_verification.length, tone: data.urgent_pending_verification.length ? "danger" : "neutral" },
          ]} />
          <p role="note" className="text-sm text-red-800">Legacy records only: work started before PO verification. This exception list does not authorize dispatch; current policy requires a verified PO first.</p>
        </section>
        <section aria-label="Purchase order compliance lists" className="space-y-4">
          <DataTable title="Approved Quotes Awaiting PO" columns={["Quote", "Client"]} rows={data.approved_awaiting_po} renderActions={(row) => <div className="flex flex-wrap items-center gap-2">{canQuote && <RecordLink user={user} path="/quotations" param="quote" id={row.id} what="quote" name={row.quote_number} />}{evidenceAction("quotes", row.id)}</div>} emptyStateClassName="px-5 py-6 flex flex-col items-center justify-center text-center" emptyText="No approved quotes are waiting for a purchase order." renderRow={(row) => <tr key={row.id} className="hover:bg-gray-50"><td className="px-5 py-3.5 font-medium">{row.quote_number || row.id}</td><td className="px-5 py-3.5">{row.client_id || "-"}</td></tr>} />
          <DataTable title="Purchase Orders Requiring Amendment" columns={["PO", "PO Amount", "Logged Value"]} rows={data.requires_amendment} renderActions={(row) => <div className="flex flex-wrap items-center gap-2">{canFinance && <RecordLink user={user} path="/finance" param="po" id={row.id} what="purchase order" name={row.po_reference || row.id} />}{evidenceAction("purchase_orders", row.id)}</div>} emptyStateClassName="px-5 py-6 flex flex-col items-center justify-center text-center" emptyText="No purchase orders require amendment." renderRow={(row) => <tr key={row.id} className="hover:bg-gray-50"><td className="px-5 py-3.5 font-medium">{row.po_reference || row.id}</td><td className="px-5 py-3.5">{formatMoney(row.po_amount)}</td><td className="px-5 py-3.5 text-red-600">{formatMoney(row.logged_value)}</td></tr>} />
          <DataTable title="Legacy Exceptions: Dispatch Started Before PO Verification" columns={["PO", "Quotation", "Risk"]} rows={data.urgent_pending_verification} renderActions={(row) => <div className="flex flex-wrap items-center gap-2">{canFinance && <RecordLink user={user} path="/finance" param="po" id={row.id} what="purchase order" name={row.po_reference || row.id} />}{evidenceAction("purchase_orders", row.id)}</div>} emptyStateClassName="px-5 py-6 flex flex-col items-center justify-center text-center" emptyText="No legacy dispatch exceptions are awaiting PO verification." renderRow={(row) => <tr key={row.id} className="hover:bg-gray-50"><td className="px-5 py-3.5">{row.id}</td><td className="px-5 py-3.5">{row.quotation_id || "-"}</td><td className="px-5 py-3.5"><span role="status" className="inline-block rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800">Exception - PO unverified</span></td></tr>} />
        </section>
      </div>;
    }
    if (active === "worksheets" && Array.isArray(data?.pending_review) && Array.isArray(data?.returned_for_correction) && typeof data?.approved_count === "number") {
      return <div className="space-y-5 py-2"><section aria-labelledby="timesheet-summary-title" className="space-y-3"><h2 id="timesheet-summary-title" className="text-sm font-semibold text-gray-700">Timesheet review overview</h2><StatusSummary label="Timesheet review" items={[{ key: "pending", label: "Pending review", meaning: "Timesheets waiting for review.", count: data.pending_review.length, tone: data.pending_review.length ? "warning" : "neutral" }, { key: "returned", label: "Returned", meaning: "Returned to the technician for correction.", count: data.returned_for_correction.length, tone: data.returned_for_correction.length ? "danger" : "neutral" }, { key: "approved", label: "Approved", meaning: "Reviewed and approved.", count: data.approved_count, tone: "success" }]} /></section><section aria-label="Timesheet review lists" className="space-y-4"><DataTable title="Timesheets Pending Review" columns={["Timesheet", "Dispatch", "Date", "Hours"]} rows={data.pending_review} renderActions={(row) => <div className="flex flex-wrap items-center gap-2">{canTimesheets && <RecordLink user={user} path="/worksheets" param="timesheet" id={row.id} what="timesheet" name={row.id} />}{evidenceAction("field_worksheets", row.id)}</div>} emptyStateClassName="px-5 py-6 flex flex-col items-center justify-center text-center" emptyText="No timesheets are pending review." renderRow={(row) => <tr key={row.id} className="hover:bg-gray-50"><td className="px-5 py-3.5">{row.id}</td><td className="px-5 py-3.5">{row.dispatch_card_id}</td><td className="px-5 py-3.5">{row.work_date || "-"}</td><td className="px-5 py-3.5">{row.hours ?? "-"}</td></tr>} /><DataTable title="Timesheets Returned for Correction" columns={["Timesheet", "Dispatch", "Comment"]} rows={data.returned_for_correction} renderActions={(row) => <div className="flex flex-wrap items-center gap-2">{canTimesheets && <RecordLink user={user} path="/worksheets" param="timesheet" id={row.id} what="timesheet" name={row.id} />}{evidenceAction("field_worksheets", row.id)}</div>} emptyStateClassName="px-5 py-6 flex flex-col items-center justify-center text-center" emptyText="No timesheets have been returned." renderRow={(row) => <tr key={row.id} className="hover:bg-gray-50"><td className="px-5 py-3.5">{row.id}</td><td className="px-5 py-3.5">{row.dispatch_card_id}</td><td className="px-5 py-3.5">{row.supervisor_comment || "-"}</td></tr>} /></section></div>;
    }
    if (active === "dispatch" && Array.isArray(data)) {
      const startedBeforePoCount = data.filter((row) => row.started_before_po).length;
      return <div className="space-y-5 py-2">
        <StatusSummary label="Dispatch overview" items={[
          { key: "all", label: "Dispatches", meaning: "All dispatch cards in this report.", count: data.length, tone: "info" },
          { key: "early", label: "Started Before PO", meaning: "Work began before a purchase order was verified.", count: startedBeforePoCount, tone: startedBeforePoCount ? "warning" : "neutral" },
          { key: "approved", label: "Fully Approved", meaning: "Every timesheet on the card is approved.", count: data.filter((row) => row.worksheet_count > 0 && row.approved_worksheet_count === row.worksheet_count).length, tone: "success" },
        ]} />
        <DataTable title="Dispatch Cards" columns={["Dispatch", "Status", "Scheduled Start", "Timesheets", "PO Risk"]} rows={data} renderActions={(row) => <div className="flex flex-wrap items-center gap-2">{canJobCards && <RecordLink user={user} path="/job-cards" param="id" id={row.id} what="job card" name={row.dispatch_number} />}{evidenceAction("dispatch_cards", row.id)}</div>} emptyStateClassName="px-5 py-6 flex flex-col items-center justify-center text-center" emptyText="No dispatch cards found." renderRow={(row) => <tr key={row.id} className="hover:bg-gray-50">
          <td className="px-5 py-3.5 font-medium">{row.dispatch_number || row.id}</td>
          <td className="px-5 py-3.5"><StatusBadge status={row.status} /></td>
          <td className="px-5 py-3.5">{row.scheduled_start || "-"}</td>
          <td className="px-5 py-3.5">{row.approved_worksheet_count ?? 0} of {row.worksheet_count ?? 0} approved</td>
          <td className="px-5 py-3.5">{row.started_before_po ? <span data-evidence="dispatch-started-before-po" className="inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">Started before PO</span> : <span className="text-orac-border-strong">-</span>}</td>
        </tr>} />
      </div>;
    }
    if (active === "invoice-ready" && Array.isArray(data)) {
      return <div className="space-y-5 py-2">
        <section aria-labelledby="invoice-ready-summary-title" className="space-y-3">
          <h2 id="invoice-ready-summary-title" className="text-sm font-semibold text-gray-700">Billing handoff</h2>
          <StatusSummary label="Billing handoff summary" items={[{ key: "ready", label: "Dispatches ready for pricing review", count: data.length, tone: data.length ? "success" : "neutral" }]} />
        </section>
        <DataTable title="Dispatches Ready to Invoice" columns={["Dispatch", "Quotation"]} rows={data} actionLabel="Evidence" renderActions={(row) => <div className="flex flex-wrap items-center gap-2">{canInvoiceReadiness && <RecordLink user={user} path="/invoice-readiness" param="id" id={row.id} what="invoice readiness" name={row.dispatch_number} />}{canJobCards && <RecordLink user={user} path="/job-cards" param="id" id={row.id} what="job card" name={row.dispatch_number} />}{evidenceAction("dispatch_cards", row.id, "Job card PDF")}</div>} emptyStateClassName="px-5 py-6 flex flex-col items-center justify-center text-center" emptyText="No dispatches are ready for pricing review." renderRow={(row) => <tr key={row.id} className="hover:bg-gray-50"><td className="px-5 py-3.5 font-medium">{row.dispatch_number || row.id}</td><td className="px-5 py-3.5">{row.quotation_id || "-"}</td></tr>} />
      </div>;
    }
    if (active === "variance" && Array.isArray(data)) {
      const totalVariance = data.reduce((sum, row) => sum + Number(row.variance || 0), 0);
      return <div className="space-y-5 py-2">
        <div className="grid gap-3 sm:grid-cols-2"><StatCard label="Purchase Orders Over Budget" value={data.length} tone={data.length ? "red" : "slate"} /><StatCard label="Total Variance" value={formatMoney(totalVariance)} tone={totalVariance > 0 ? "red" : "slate"} /></div>
        <DataTable title="PO Variance (Logged Value vs PO Amount)" columns={["PO", "PO Amount", "Logged Value", "Variance"]} rows={data} renderActions={(row) => user.role === "Supervisor" ? <span className="text-sm text-gray-500">Not available to this role</span> : <div className="flex flex-wrap items-center gap-2">{canFinance && <RecordLink user={user} path="/finance" param="po" id={row.id} what="purchase order" name={row.po_reference || row.id} />}{evidenceAction("purchase_orders", row.id)}</div>} emptyStateClassName="px-5 py-6 flex flex-col items-center justify-center text-center" emptyText="No purchase orders have a variance." renderRow={(row) => {
          const variance = Number(row.variance || 0);
          return <tr key={row.id} className="hover:bg-gray-50">
            <td className="px-5 py-3.5 font-medium">{row.po_reference || row.id}</td>
            <td className="px-5 py-3.5">{formatMoney(row.po_amount)}</td>
            <td className="px-5 py-3.5">{formatMoney(row.logged_value)}</td>
            <td className="px-5 py-3.5"><span data-evidence="variance-amount" className={`font-semibold ${variance > 0 ? "text-red-600" : variance < 0 ? "text-emerald-600" : "text-gray-500"}`}>{formatSignedMoney(variance)}</span></td>
          </tr>;
        }} />
      </div>;
    }
    return null;
  }

  return (
    <div data-evidence="reports-page" className="min-w-0 space-y-4 animate-in fade-in duration-500">
      {/* Header and Controls */}
      <div>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <PageHeaderBanner className="min-w-0" eyebrow="Operational intelligence" title="Operational Reports" subtitle="Read-only views and exports. Reports do not change quotes, purchase orders, dispatches, stock, or invoices." iconPath={ICONS.report} />
          {active !== PAYROLL_TAB && <button
            onClick={handleExportCsv}
            disabled={loading || !canExport}
            className="flex min-h-11 items-center justify-center gap-2 self-start rounded-lg bg-orac-blue px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sky-500 disabled:opacity-50 sm:self-auto"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </button>}
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
      {downloadError && <ErrorBanner message={downloadError} />}
      
      <div className="min-w-0">
        {active === PAYROLL_TAB ? (
          <TechnicianPayrollPanel user={user} />
        ) : loading ? (
          <div data-evidence="reports-loading" className="flex min-h-40 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500">Loading report data...</div>
        ) : (
          <div>
            {!data || (Array.isArray(data) && data.length === 0) ? (
              <div data-evidence="reports-empty" className="flex min-h-36 items-center justify-center rounded-lg border border-gray-200 bg-white px-5 text-sm text-gray-500">No data found for this report.</div>
            ) : renderStructuredReport() ? (
              renderStructuredReport()
            ) : Array.isArray(data) ? (
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-gray-100 shadow-sm z-10">
                  <tr className="text-left text-sm font-medium text-gray-500">
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
