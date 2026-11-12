import React, { useEffect, useState } from "react";
import { reports } from "../api/client.js";
import DataTable from "./DataTable.jsx";
import StatCard from "./StatCard.jsx";
import { ErrorBanner } from "./PageStates.jsx";
import Button from "./ui/Button.jsx";
import { defaultPayrollMonth, isPayrollMonth, pastelExportState, formatHours } from "../payrollModel.js";
import ContractorStatementModal from "./ContractorStatementModal.jsx";

// Technician Payroll Summary: certified Worksheet hours per technician for a month,
// with a one-click payroll review export. Non-posting review file: it never changes a Worksheet.
export default function TechnicianPayrollPanel({ user }) {
  const [month, setMonth] = useState(defaultPayrollMonth());
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [statementTarget, setStatementTarget] = useState(null);

  useEffect(() => {
    if (!isPayrollMonth(month)) { setReport(null); setLoading(false); return undefined; }
    let cancelled = false;
    setLoading(true); setError(""); setExportError("");
    reports.technicianPayroll(month)
      .then((result) => { if (!cancelled) setReport(result); })
      .catch((err) => { if (!cancelled) { setReport(null); setError(err.message); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [month]);

  const exportState = pastelExportState(report, user.role, month);

  async function handleExport() {
    if (!exportState.enabled || exporting) return;
    setExporting(true); setExportError("");
    try { await reports.downloadPastelPayroll(month); }
    catch (err) { setExportError(err.message || "The Pastel export could not be downloaded."); }
    finally { setExporting(false); }
  }

  const employees = report?.employees || [];
  const totals = report?.totals;
  const blocked = employees.filter((e) => !e.export_ready);

  return (
    <div data-evidence="technician-payroll" className="space-y-5 py-2">
      <section aria-labelledby="payroll-title" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="payroll-title" className="text-sm font-semibold text-gray-700">Technician Payroll Summary</h2>
            <p className="mt-1 text-sm text-gray-600">Certified hours from approved Worksheets, grouped by work date. Hours only: no rates or amounts. Non-posting review export.</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm font-medium text-gray-700">
              <span className="mb-1 block">Month</span>
              <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="min-h-11 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm" />
            </label>
            <button type="button" onClick={handleExport} disabled={!exportState.enabled || loading || exporting} data-evidence="pastel-payroll-export" className="min-h-11 rounded-lg bg-orac-blue px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-500 disabled:opacity-50">
              {exporting ? "Preparing..." : "Export to Sage Pastel Payroll (CSV) — Review Only"}
            </button>
          </div>
        </div>
        {!loading && !exportState.enabled && <p role="note" data-evidence="pastel-export-reason" className="text-sm text-gray-600">{exportState.reason}</p>}
      </section>

      {error && <ErrorBanner message={error} />}
      {exportError && <ErrorBanner message={exportError} />}

      {loading ? (
        <div className="flex min-h-40 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500">Loading payroll summary...</div>
      ) : report && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Technicians" value={employees.length} tone="blue" />
            <StatCard label="Normal hours" value={formatHours(totals?.normal_hours)} />
            <StatCard label="Overtime 1.5 / 2.0" value={`${formatHours(totals?.overtime_15_hours)} / ${formatHours(totals?.overtime_20_hours)}`} tone="amber" />
            <StatCard label="Total hours" value={formatHours(totals?.total_hours)} tone="green" />
          </div>

          {blocked.length > 0 && (
            <div role="alert" data-evidence="payroll-blockers" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-semibold">These employees must be fixed before the Pastel export is allowed:</p>
              <ul className="mt-1 list-disc pl-5">
                {blocked.map((e) => <li key={e.technician_id || e.full_name}>{e.full_name}: {e.export_blockers.join("; ")}. Ask an Admin to add the employee code or national ID on the Technician account.</li>)}
              </ul>
            </div>
          )}

          {(report.warnings || []).length > 0 && (
            <div role="note" data-evidence="payroll-warnings" className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
              {report.warnings.map((w, i) => <p key={i}>{w.message}</p>)}
            </div>
          )}

          <DataTable
            title={`Hours by technician - ${month}`}
            columns={["Full name", "National ID", "Trade", "Normal hours", "Overtime 1.5 hours", "Overtime 2.0 hours", "Total hours", "Days worked", "Statement"]}
            rows={employees}
            emptyStateClassName="px-5 py-6 flex flex-col items-center justify-center text-center"
            emptyText="No approved Worksheet hours were found for this month."
            renderRow={(row) => (
              <tr key={row.technician_id || row.full_name} className="hover:bg-gray-50">
                <td className="px-5 py-3.5 font-medium">{row.full_name}</td>
                <td className="px-5 py-3.5">{row.national_id || <span className="text-amber-800">Missing</span>}</td>
                <td className="px-5 py-3.5">{row.trade || "-"}</td>
                <td className="px-5 py-3.5 tabular-nums">{formatHours(row.normal_hours)}</td>
                <td className="px-5 py-3.5 tabular-nums">{formatHours(row.overtime_15_hours)}</td>
                <td className="px-5 py-3.5 tabular-nums">{formatHours(row.overtime_20_hours)}</td>
                <td className="px-5 py-3.5 font-semibold tabular-nums">{formatHours(row.total_hours)}</td>
                <td className="px-5 py-3.5 tabular-nums">{row.days_worked}</td>
                <td className="px-5 py-3.5 text-right">
                  <Button
                    variant="secondary"
                    onClick={() => setStatementTarget(row)}
                  >
                    Statement
                  </Button>
                </td>
              </tr>
            )}
          />

          <ContractorStatementModal
            isOpen={Boolean(statementTarget)}
            onClose={() => setStatementTarget(null)}
            employee={statementTarget}
            month={month}
          />
        </>
      )}
    </div>
  );
}
