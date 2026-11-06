import React, { useEffect, useMemo, useRef, useState } from "react";
import Modal from "./Modal.jsx";
import SearchableSelect from "./SearchableSelect.jsx";
import { dispatch, technicianProfiles } from "../api/client.js";
import { TECHNICIAN_TRADES, displayTrade } from "../constants/trades.js";
import { newRequestId } from "../lib/timesheetFormLogic.js";
import {
  BULK_DRAFT_KEY,
  parseDelimitedText,
  matchTechnician,
  reconstructFailedText,
  validateImportBatch,
  computeRowFingerprint
} from "../lib/timesheetBulkImportLogic.js";

export default function TimesheetBulkImportModal({ isOpen, onClose, user, dispatches, onImportComplete }) {
  const [rawText, setRawText] = useState("");
  const [parsedRows, setParsedRows] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [defaultDispatchId, setDefaultDispatchId] = useState("");
  const [allowExternalContractors, setAllowExternalContractors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState("");
  const [resultSummary, setResultSummary] = useState(null);
  const fileInputRef = useRef(null);
  const clientRequestIdsRef = useRef({});

  // Initialize once when the modal opens: load cached draft, fetch active technicians,
  // and auto-select default dispatch ONLY if exactly one dispatch exists.
  useEffect(() => {
    if (!isOpen) return;
    setError("");
    setResultSummary(null);

    technicianProfiles.list()
      .then((data) => setTechnicians(Array.isArray(data) ? data : []))
      .catch(() => setTechnicians([]));

    try {
      const cached = localStorage.getItem(BULK_DRAFT_KEY(user?.id));
      if (cached) {
        setRawText(cached);
        const parsed = parseDelimitedText(cached);
        setParsedRows(parsed);
      }
    } catch { /* storage fallback */ }

    // Only auto-select if there is exactly 1 dispatch card. If multiple, user must explicitly select.
    if (dispatches && dispatches.length === 1) {
      setDefaultDispatchId(dispatches[0].id);
    }
  }, [isOpen, user?.id]);

  function handleTextChange(val) {
    setRawText(val);
    if (!val || !val.trim()) {
      clientRequestIdsRef.current = {};
    }
    try {
      if (val) localStorage.setItem(BULK_DRAFT_KEY(user?.id), val);
      else localStorage.removeItem(BULK_DRAFT_KEY(user?.id));
    } catch { /* storage fallback */ }
    setParsedRows(parseDelimitedText(val));
    setResultSummary(null);
  }

  function handleClear() {
    setRawText("");
    setParsedRows([]);
    setResultSummary(null);
    clientRequestIdsRef.current = {};
    try { localStorage.removeItem(BULK_DRAFT_KEY(user?.id)); } catch { /* ignore */ }
  }

  function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    clientRequestIdsRef.current = {};
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = String(event.target.result || "");
      handleTextChange(content);
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function downloadSampleTemplate() {
    const defaultJob = dispatches?.[0]?.dispatch_number || "DC-2026-001";
    const sampleCsv = [
      "Date,Technician Name,National ID,Trade,Dispatch Card,Normal Hours,1.5x OT,2.0x OT,Work Description",
      `2026-11-05,Tapiwa Marufu,63-294819-B-42,Boilermaker,${defaultJob},8.0,2.0,0.0,"Conveyor structure realignment and chute liner replacement"`,
      `2026-11-05,Farai Ndlovu,63-102938-K-19,Fitter,${defaultJob},8.0,1.5,0.0,"Slurry pump impeller overhaul and seal replacement"`,
      `2026-11-05,Nyasha Moyo,63-582910-R-88,Electrician,${defaultJob},8.0,0.0,2.0,"MCC substation transformer routine insulation testing"`,
      `2026-11-06,Kudakwashe Chiwenga,63-491029-P-33,Coded Welder,${defaultJob},8.0,3.0,0.0,"High-pressure piping spool fabrication and radiographic weld prep"`,
      `2026-11-06,Simbarashe Dube,63-391028-M-04,Rigger,${defaultJob},8.0,1.0,0.0,"Heavy mill motor rigging, alignment and secure placement"`
    ].join("\n");

    const blob = new Blob([sampleCsv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "orac_timesheet_bulk_import_sample.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // Exact match on dispatch number or id
  function matchDispatch(row) {
    if (row.jobRef) {
      const refClean = row.jobRef.trim().toLowerCase();
      const found = (dispatches || []).find((d) => {
        const dNum = (d.dispatch_number || "").trim().toLowerCase();
        const dId = (d.id || "").trim().toLowerCase();
        return dNum === refClean || dId === refClean;
      });
      if (found) return found.id;
      return null; // Ref provided but not matched
    }
    return defaultDispatchId || "";
  }

  const validatedRows = useMemo(() => {
    return validateImportBatch(parsedRows, technicians, dispatches, defaultDispatchId, {
      allowExternalContractors
    });
  }, [parsedRows, technicians, dispatches, defaultDispatchId, allowExternalContractors]);

  const summary = useMemo(() => {
    const total = validatedRows.length;
    const valid = validatedRows.filter((r) => r.isValid).length;
    const invalid = total - valid;
    const totalHours = validatedRows.reduce((acc, r) => acc + (r.isValid ? r.totalHours : 0), 0);
    return { total, valid, invalid, totalHours };
  }, [validatedRows]);

  async function handleImport() {
    if (validatedRows.length === 0) {
      setError("Please paste or upload timesheet data first.");
      return;
    }

    const invalidRows = validatedRows.filter((r) => !r.isValid);
    if (invalidRows.length > 0) {
      setError(`Cannot import: ${invalidRows.length} row(s) contain validation errors. Please correct them in the table above.`);
      return;
    }

    setBusy(true);
    setError("");
    let created = 0;
    let failed = 0;
    const failures = [];
    const failedRowIds = [];

    const toImport = validatedRows.filter((r) => r.isValid);

    for (let i = 0; i < toImport.length; i++) {
      const item = toImport[i];
      setProgress({ current: i + 1, total: toImport.length });

      const trade = item.matchedTech?.trade || item.trade || "Unclassified";
      const displayName = item.matchedTech?.name || (item.matchedTech ? `${item.matchedTech.first_name || ""} ${item.matchedTech.last_name || ""}`.trim() : item.workerName);

      // Stable client_request_id derived from content fingerprint across retries
      const fingerprint = computeRowFingerprint(item);
      const reqId = clientRequestIdsRef.current[fingerprint] || (clientRequestIdsRef.current[fingerprint] = newRequestId());

      const payload = {
        work_date: item.date,
        activity: item.activity || "Field engineering operations",
        hours_breakdown: {
          normal: item.normal,
          ot_15: item.ot15,
          ot_20: item.ot20
        },
        client_request_id: reqId,
        submit: false
      };

      if (item.matchedTech && !item.matchedTech.ambiguous) {
        payload.technician_id = item.matchedTech.id;
        payload.worker_name = displayName;
        payload.technician_trade = trade;
        payload.worker_category = trade;
        if (item.matchedTech.national_id) payload.national_id = item.matchedTech.national_id;
        payload.worker_type = item.matchedTech.worker_type || "permanent";
      } else {
        payload.worker_type = "contractor";
        payload.worker_name = item.workerName;
        payload.technician_trade = trade;
        payload.worker_category = trade;
      }

      try {
        await dispatch.createWorksheet(item.resolvedDispatchId, payload);
        created++;
      } catch (err) {
        failed++;
        failedRowIds.push(item.rowId);
        failures.push(`Row ${item.rowId} (${item.workerName}): ${err.message || "Failed to create"}`);
      }
    }

    setBusy(false);
    setResultSummary({
      created,
      failed,
      failures
    });

    if (created > 0 && failed === 0) {
      clientRequestIdsRef.current = {};
      try { localStorage.removeItem(BULK_DRAFT_KEY(user?.id)); } catch { /* ignore */ }
      setRawText("");
      setParsedRows([]);
      if (onImportComplete) {
        onImportComplete(`Successfully imported ${created} timesheet draft(s).`);
      }
    } else if (created > 0 && failed > 0) {
      // Partial failure: Retain ONLY failed rows to prevent duplicate re-imports on retry
      const remainingText = reconstructFailedText(validatedRows, failedRowIds);
      setRawText(remainingText);
      try {
        if (remainingText) localStorage.setItem(BULK_DRAFT_KEY(user?.id), remainingText);
        else localStorage.removeItem(BULK_DRAFT_KEY(user?.id));
      } catch { /* storage fallback */ }
      setParsedRows(parseDelimitedText(remainingText));
      setError(`Partial import: ${created} timesheet(s) imported successfully. ${failed} row(s) failed and remain in the editor below for review.`);
    }
  }

  return (
    <Modal title="Bulk Timesheet Import (Spreadsheet / CSV)" isOpen={isOpen} onClose={onClose} size="xl">
      <div className="space-y-6">
        {/* Operational Notice Banner */}
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-xs text-sky-950 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <p className="font-semibold text-sm text-sky-900 dark:text-sky-100 mb-1">
                Field Operations & Time Tracking
              </p>
              <p className="text-sky-800 dark:text-sky-300">
                Bulk timesheets are imported as drafts, preserving maker-checker integrity. Each technician or field supervisor certifies their hours during regular on-device sign-off or paper submission. Commercial billing and payroll rates are managed centrally by Finance.
              </p>
            </div>
            <button
              type="button"
              onClick={downloadSampleTemplate}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-sky-300 bg-white px-3 py-1.5 font-semibold text-sky-800 shadow-sm transition hover:bg-sky-50 dark:border-sky-700 dark:bg-sky-900/50 dark:text-sky-100"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Sample CSV
            </button>
          </div>
        </div>

        {error && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {error}
          </div>
        )}

        {resultSummary && (
          <div className={`rounded-xl border p-4 text-xs ${resultSummary.failed > 0 ? "border-amber-200 bg-amber-50 text-amber-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
            <p className="font-semibold text-sm mb-1">
              Import Completed: {resultSummary.created} created, {resultSummary.failed} failed.
            </p>
            {resultSummary.failures.length > 0 && (
              <ul className="list-disc pl-5 mt-2 space-y-1">
                {resultSummary.failures.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Dispatch & Entry Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-800/40 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-orac-text-muted mb-1">
              Fallback Dispatch Card (when omitted in CSV)
            </label>
            <SearchableSelect
              options={(dispatches || []).map((d) => ({
                value: d.id,
                label: `${d.dispatch_number || d.id} — ${d.title || "Dispatch"}`,
                hint: d.site_name || d.mine_site_name
              }))}
              value={defaultDispatchId}
              onChange={setDefaultDispatchId}
              placeholder={dispatches?.length === 1 ? "Auto-selected single dispatch" : "Select fallback dispatch card..."}
            />
          </div>

          <div className="flex flex-col justify-end">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-700 dark:text-orac-text-muted">
              <input
                type="checkbox"
                checked={allowExternalContractors}
                onChange={(e) => setAllowExternalContractors(e.target.checked)}
                className="rounded border-gray-300 text-orac-blue focus:ring-orac-blue w-4 h-4"
              />
              <span>Allow external contractor rows (unmatched names in registry)</span>
            </label>
          </div>
        </div>

        {/* Input Textarea & File Upload */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-semibold text-gray-700 dark:text-orac-text-muted">
              Paste Spreadsheet Rows or CSV Text
            </label>
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".csv,.txt,.tsv"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-orac-blue hover:underline font-medium"
              >
                Upload File (.csv, .tsv)
              </button>
              {rawText && (
                <>
                  <span className="text-orac-border-strong">|</span>
                  <button
                    type="button"
                    onClick={handleClear}
                    className="text-xs text-red-600 hover:underline font-medium"
                  >
                    Clear Draft
                  </button>
                </>
              )}
            </div>
          </div>
          <textarea
            rows={5}
            value={rawText}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder="Paste cells directly from Excel/Google Sheets, or paste CSV text here..."
            className="orac-control w-full font-mono text-xs p-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-orac-blue"
          />
        </div>

        {/* Live Validation Table */}
        {validatedRows.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-medium text-gray-600 dark:text-orac-text-muted">
              <span>
                Parsed {summary.total} row(s) &bull; <strong className="text-emerald-700 dark:text-emerald-400">{summary.valid} valid</strong> &bull; <strong className={summary.invalid > 0 ? "text-red-700 dark:text-red-400" : ""}>{summary.invalid} invalid</strong> &bull; Total hours: <strong>{summary.totalHours.toFixed(1)}h</strong>
              </span>
            </div>

            <div className="max-h-60 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-orac-text-muted sticky top-0">
                  <tr>
                    <th className="p-2 border-b">Row</th>
                    <th className="p-2 border-b">Status</th>
                    <th className="p-2 border-b">Date</th>
                    <th className="p-2 border-b">Technician / Trade</th>
                    <th className="p-2 border-b">Normal</th>
                    <th className="p-2 border-b">1.5x</th>
                    <th className="p-2 border-b">2.0x</th>
                    <th className="p-2 border-b">Dispatch</th>
                    <th className="p-2 border-b">Issues / Warnings</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {validatedRows.map((r) => (
                    <tr key={r.rowId} className={r.isValid ? "bg-white dark:bg-gray-900" : "bg-red-50/50 dark:bg-red-950/20"}>
                      <td className="p-2 font-mono">{r.rowId}</td>
                      <td className="p-2">
                        {r.isValid ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
                            Ready
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200">
                            Error
                          </span>
                        )}
                      </td>
                      <td className="p-2 font-mono">{r.date}</td>
                      <td className="p-2">
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {r.workerName}
                        </div>
                        <div className="text-xs text-gray-500">
                          {r.trade || r.matchedTech?.trade || "Unclassified"} {r.matchedTech && "(Technician)"}
                        </div>
                      </td>
                      <td className="p-2 font-mono">{r.normal}h</td>
                      <td className="p-2 font-mono">{r.ot15}h</td>
                      <td className="p-2 font-mono">{r.ot20}h</td>
                      <td className="p-2 font-mono">{r.jobRef || defaultDispatchId}</td>
                      <td className="p-2">
                        {r.errors.length > 0 && (
                          <div className="text-red-600 dark:text-red-400 font-medium">
                            {r.errors.join(", ")}
                          </div>
                        )}
                        {r.warnings.length > 0 && (
                          <div className="text-amber-600 dark:text-amber-400">
                            {r.warnings.join(", ")}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Progress Bar when busy */}
        {busy && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-gray-600 dark:text-orac-text-muted">
              <span>Importing rows...</span>
              <span>{progress.current} / {progress.total}</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
              <div
                className="bg-orac-blue h-full transition-all duration-150"
                style={{ width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {/* Modal Action Footer */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-orac-text-muted hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || validatedRows.length === 0 || summary.invalid > 0}
            onClick={handleImport}
            className="px-5 py-2 text-sm font-semibold text-white bg-orac-blue hover:bg-orac-blue/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition"
          >
            {busy ? "Importing..." : `Import ${summary.valid} Draft Timesheet(s)`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
