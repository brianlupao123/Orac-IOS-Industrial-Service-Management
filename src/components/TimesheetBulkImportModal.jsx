import React, { useEffect, useMemo, useRef, useState } from "react";
import Modal from "./Modal.jsx";
import SearchableSelect from "./SearchableSelect.jsx";
import { dispatch, technicianProfiles } from "../api/client.js";
import { TECHNICIAN_TRADES, displayTrade } from "../constants/trades.js";
import { newRequestId } from "../lib/timesheetFormLogic.js";

// Commercial Rates Context:
// Standard Client Billing: $10.00 – $15.00/hr.
// Internal Technician Payroll: $3.50 – $7.50/hr (retained confidentially by Finance).
const BULK_DRAFT_KEY = (userId) => `orac_draft_bulk_timesheets_${userId || "anon"}`;

function parseDelimitedText(text) {
  if (!text || !text.trim()) return [];
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  // Detect delimiter: comma, tab, or semicolon
  const firstLine = lines[0];
  let delimiter = ",";
  if (firstLine.includes("\t")) delimiter = "\t";
  else if (firstLine.includes(";") && !firstLine.includes(",")) delimiter = ";";

  function splitLine(line) {
    if (delimiter === "\t") return line.split("\t").map((c) => c.trim().replace(/^["']|["']$/g, ""));
    const regex = new RegExp(`(?:^|${delimiter})(?:"([^"]*)"|([^"${delimiter}]*))`, "g");
    const cells = [];
    let match;
    while ((match = regex.exec(line)) !== null) {
      cells.push((match[1] !== undefined ? match[1] : match[2] || "").trim());
    }
    return cells;
  }

  const rawRows = lines.map(splitLine);
  if (rawRows.length === 0) return [];

  // Check if first row is header
  const headerCandidates = ["date", "technician", "worker", "trade", "job", "dispatch", "normal", "activity", "hours", "ot"];
  const isHeader = rawRows[0].some((c) => headerCandidates.some((h) => c.toLowerCase().includes(h)));

  let headers = [];
  let dataRows = rawRows;
  if (isHeader) {
    headers = rawRows[0].map((h) => h.toLowerCase());
    dataRows = rawRows.slice(1);
  }

  // Column index finders
  const findCol = (terms, defaultIdx) => {
    if (!headers.length) return defaultIdx;
    const idx = headers.findIndex((h) => terms.some((t) => h.includes(t)));
    return idx >= 0 ? idx : defaultIdx;
  };

  const colDate = findCol(["date", "day"], 0);
  const colWorker = findCol(["technician", "worker", "artisan", "name"], 1);
  const colTrade = findCol(["trade", "discipline", "category"], 2);
  const colJob = findCol(["job", "dispatch", "dc", "po"], 3);
  const colNormal = findCol(["normal", "regular", "std", "basic"], 4);
  const colOt15 = findCol(["1.5", "ot15", "ot 1.5", "sat"], 5);
  const colOt20 = findCol(["2.0", "ot20", "ot 2.0", "sun", "double"], 6);
  const colActivity = findCol(["activity", "work", "description", "scope", "task"], 7);

  return dataRows.map((cols, idx) => {
    const rawDate = cols[colDate] || "";
    // Normalize date format DD/MM/YYYY or YYYY-MM-DD
    let normalizedDate = rawDate;
    if (/^\d{2}[/-]\d{2}[/-]\d{4}$/.test(rawDate)) {
      const parts = rawDate.split(/[/-]/);
      normalizedDate = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
      normalizedDate = new Date().toISOString().slice(0, 10);
    }

    const workerName = cols[colWorker] || "";
    const trade = cols[colTrade] || "";
    const jobRef = cols[colJob] || "";
    const normal = parseFloat(cols[colNormal]) || 0;
    const ot15 = parseFloat(cols[colOt15]) || 0;
    const ot20 = parseFloat(cols[colOt20]) || 0;
    const activity = cols[colActivity] || cols.slice(colActivity).join(" ") || "General field engineering operations";

    return {
      rowId: idx + 1,
      date: normalizedDate,
      workerName: workerName.trim(),
      trade: trade.trim(),
      jobRef: jobRef.trim(),
      normal: Math.max(0, Math.min(24, normal)),
      ot15: Math.max(0, Math.min(24, ot15)),
      ot20: Math.max(0, Math.min(24, ot20)),
      activity: activity.trim()
    };
  });
}

export default function TimesheetBulkImportModal({ isOpen, onClose, user, dispatches, onImportComplete }) {
  const [rawText, setRawText] = useState("");
  const [parsedRows, setParsedRows] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [defaultDispatchId, setDefaultDispatchId] = useState("");
  const [submitDirectly, setSubmitDirectly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState("");
  const [resultSummary, setResultSummary] = useState(null);
  const fileInputRef = useRef(null);

  // Load technician profiles for auto-matching
  useEffect(() => {
    if (!isOpen) return;
    setError("");
    setResultSummary(null);
    technicianProfiles.list()
      .then((data) => setTechnicians(Array.isArray(data) ? data : []))
      .catch(() => setTechnicians([]));

    // Restore draft from localStorage
    try {
      const cached = localStorage.getItem(BULK_DRAFT_KEY(user?.id));
      if (cached) {
        setRawText(cached);
        const parsed = parseDelimitedText(cached);
        setParsedRows(parsed);
      }
    } catch { /* storage fallback */ }

    if (dispatches && dispatches.length > 0 && !defaultDispatchId) {
      setDefaultDispatchId(dispatches[0].id);
    }
  }, [isOpen, user?.id, dispatches]);

  // Handle text change and draft auto-saving
  function handleTextChange(val) {
    setRawText(val);
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
    try { localStorage.removeItem(BULK_DRAFT_KEY(user?.id)); } catch { /* ignore */ }
  }

  // Handle CSV file upload
  function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = String(event.target.result || "");
      handleTextChange(content);
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  // Generate and download a 100% sanitized example template
  function downloadSampleTemplate() {
    const defaultJob = dispatches?.[0]?.dispatch_number || "DC-2026-001";
    const sampleCsv = [
      "Date,Technician Name,Trade,Dispatch Card,Normal Hours,1.5x OT,2.0x OT,Work Description",
      `2026-11-05,Tapiwa Marufu,Boilermaker,${defaultJob},8.0,2.0,0.0,"Conveyor structure realignment and chute liner replacement"`,
      `2026-11-05,Farai Ndlovu,Fitter,${defaultJob},8.0,1.5,0.0,"Slurry pump impeller overhaul and seal replacement"`,
      `2026-11-05,Nyasha Moyo,Electrician,${defaultJob},8.0,0.0,2.0,"MCC substation transformer routine insulation testing"`,
      `2026-11-06,Kudakwashe Chiwenga,Coded Welder,${defaultJob},8.0,3.0,0.0,"High-pressure piping spool fabrication and radiographic weld prep"`,
      `2026-11-06,Simbarashe Dube,Rigger,${defaultJob},8.0,1.0,0.0,"Heavy mill motor rigging, alignment and secure placement"`
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

  // Match row to system technician profile
  function matchTechnician(row) {
    if (!row.workerName) return null;
    const nameLower = row.workerName.toLowerCase();
    // Match by exact or partial name
    const found = technicians.find((t) => {
      const tName = (t.name || `${t.first_name || ""} ${t.last_name || ""}`).toLowerCase().trim();
      return tName === nameLower || tName.includes(nameLower) || nameLower.includes(tName);
    });
    if (found) return found;

    // Fallback: match by trade
    if (row.trade) {
      const tradeLower = row.trade.toLowerCase();
      const byTrade = technicians.find((t) => (t.trade || "").toLowerCase() === tradeLower);
      if (byTrade) return byTrade;
    }
    return null;
  }

  // Match row to dispatch card
  function matchDispatch(row) {
    if (row.jobRef) {
      const refLower = row.jobRef.toLowerCase();
      const found = (dispatches || []).find((d) => {
        const dNum = (d.dispatch_number || "").toLowerCase();
        const dTitle = (d.title || "").toLowerCase();
        const dId = (d.id || "").toLowerCase();
        return dNum === refLower || dNum.includes(refLower) || dTitle.includes(refLower) || dId === refLower;
      });
      if (found) return found.id;
    }
    return defaultDispatchId || dispatches?.[0]?.id || "";
  }

  // Pre-validate rows and decorate with status
  const validatedRows = useMemo(() => {
    return parsedRows.map((row) => {
      const tech = matchTechnician(row);
      const dispatchId = matchDispatch(row);
      const totalH = row.normal + row.ot15 + row.ot20;

      const warnings = [];
      const errors = [];

      if (!row.workerName) errors.push("Missing technician / worker name");
      if (!dispatchId) errors.push("No valid dispatch card linked");
      if (totalH <= 0) errors.push("Zero hours logged");
      if (totalH > 24) errors.push("Total hours exceeds 24h per day");
      if (!tech && row.workerName) warnings.push("Artisan not found in active technician registry; will record as contractor");

      return {
        ...row,
        matchedTech: tech,
        resolvedDispatchId: dispatchId,
        totalHours: totalH,
        warnings,
        errors,
        isValid: errors.length === 0
      };
    });
  }, [parsedRows, technicians, dispatches, defaultDispatchId]);

  const validCount = validatedRows.filter((r) => r.isValid).length;
  const invalidCount = validatedRows.length - validCount;

  // Execute bulk import
  async function handleImport() {
    if (validatedRows.length === 0) {
      setError("Please paste or upload timesheet records first.");
      return;
    }
    if (validCount === 0) {
      setError("None of the parsed rows are valid. Please correct the errors before importing.");
      return;
    }

    setBusy(true);
    setError("");
    setProgress({ current: 0, total: validCount });

    let created = 0;
    let failed = 0;
    const failures = [];

    const toImport = validatedRows.filter((r) => r.isValid);

    for (let i = 0; i < toImport.length; i++) {
      const item = toImport[i];
      setProgress({ current: i + 1, total: toImport.length });

      const payload = {
        work_date: item.date,
        activity: item.activity || "Field engineering operations",
        hours_breakdown: {
          normal: item.normal,
          ot_15: item.ot15,
          ot_20: item.ot20
        },
        client_request_id: newRequestId(),
        submit: submitDirectly
      };

      if (item.matchedTech) {
        payload.technician_id = item.matchedTech.id;
        payload.worker_name = item.matchedTech.name;
        payload.technician_trade = item.matchedTech.trade || item.trade || "Fitter";
        payload.worker_category = payload.technician_trade;
        if (item.matchedTech.national_id) payload.national_id = item.matchedTech.national_id;
        payload.worker_type = item.matchedTech.worker_type || "permanent";
      } else {
        payload.worker_type = "contractor";
        payload.worker_name = item.workerName;
        if (item.trade) payload.worker_category = item.trade;
      }

      try {
        await dispatch.createWorksheet(item.resolvedDispatchId, payload);
        created++;
      } catch (err) {
        failed++;
        failures.push(`Row ${item.rowId} (${item.workerName}): ${err.message || "Failed to create"}`);
      }
    }

    setBusy(false);
    setResultSummary({
      created,
      failed,
      failures
    });

    if (created > 0) {
      // Clear draft on successful import
      try { localStorage.removeItem(BULK_DRAFT_KEY(user?.id)); } catch { /* ignore */ }
      setRawText("");
      setParsedRows([]);
      if (onImportComplete) {
        onImportComplete(`Successfully imported ${created} timesheet(s)${submitDirectly ? " and submitted for client acknowledgement" : " as drafts"}.`);
      }
    }
  }

  return (
    <Modal title="Bulk Timesheet Import (Spreadsheet / CSV)" isOpen={isOpen} onClose={onClose} size="xl">
      <div className="space-y-6">
        {/* Commercial Banner */}
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-xs text-sky-950 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <p className="font-semibold text-sm text-sky-900 dark:text-sky-100 mb-1">
                Standard Client Billing: $10.00 – $15.00 / hr
              </p>
              <p className="text-sky-800 dark:text-sky-300">
                Bulk timesheets capture operational hours only. Internal technician payroll rates ($3.50 – $7.50 / hr) remain confidential to Finance to safeguard ORAC commercial margins.
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

        {/* Input Controls */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="csv-paste-area" className="text-sm font-semibold text-gray-700 dark:text-gray-200">
              Paste Spreadsheet Data or Upload CSV
            </label>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.tsv,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              >
                Upload CSV File
              </button>
              {rawText && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-red-600"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <textarea
            id="csv-paste-area"
            rows={5}
            value={rawText}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder="Paste columns from Excel or CSV: Date, Technician Name, Trade, Dispatch Ref, Normal Hours, 1.5x OT, 2.0x OT, Work Description..."
            className="w-full rounded-lg border border-gray-300 bg-white p-3 font-mono text-xs focus:border-orac-blue focus:outline-none focus:ring-2 focus:ring-orac-blue/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
          <p className="text-[11px] text-gray-500">
            Auto-saves draft to memory. Delimiters (comma, tab, semicolon) and column headers are recognized automatically.
          </p>
        </div>

        {/* Default Dispatch Selector */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-gray-100 dark:border-gray-800">
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
              Default Dispatch Card (for rows without job ref)
            </label>
            <select
              value={defaultDispatchId}
              onChange={(e) => setDefaultDispatchId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs focus:border-orac-blue focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            >
              <option value="">Select a default job</option>
              {(dispatches || []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.dispatch_number || d.title || d.id}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 pt-4 sm:pt-6">
            <input
              id="bulk-submit-toggle"
              type="checkbox"
              checked={submitDirectly}
              onChange={(e) => setSubmitDirectly(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-orac-blue focus:ring-orac-blue"
            />
            <label htmlFor="bulk-submit-toggle" className="text-xs text-gray-700 dark:text-gray-300">
              Submit directly for Client Acknowledgement (otherwise saved as Drafts)
            </label>
          </div>
        </div>

        {/* Live Preview Table */}
        {validatedRows.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Preview: {validatedRows.length} rows parsed ({validCount} ready, {invalidCount} with issues)
              </span>
            </div>

            <div className="max-h-60 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Technician / Trade</th>
                    <th className="px-3 py-2">Hours (N/1.5/2.0)</th>
                    <th className="px-3 py-2">Total</th>
                    <th className="px-3 py-2">Description</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
                  {validatedRows.map((r) => (
                    <tr key={r.rowId} className={r.isValid ? "hover:bg-gray-50/50" : "bg-red-50"}>
                      <td className="px-3 py-2 font-mono text-gray-400">{r.rowId}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{r.date}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {r.matchedTech?.name || r.workerName}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          Trade: {displayTrade(r.matchedTech?.trade || r.trade)}
                          {r.matchedTech ? " (Artisan)" : " [Contractor]"}
                        </div>
                      </td>
                      <td className="px-3 py-2 font-mono whitespace-nowrap">
                        {r.normal} / {r.ot15} / {r.ot20}
                      </td>
                      <td className="px-3 py-2 font-semibold">
                        {r.totalHours}h
                      </td>
                      <td className="px-3 py-2 max-w-xs truncate" title={r.activity}>
                        {r.activity}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {r.isValid ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            Ready
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" title={r.errors.join(", ")}>
                            Error: {r.errors[0]}
                          </span>
                        )}
                        {r.warnings.length > 0 && r.isValid && (
                          <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800" title={r.warnings.join(", ")}>
                            Notice
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
          <div className="text-xs text-gray-500">
            {busy && (
              <span className="font-medium text-orac-blue">
                Importing records ({progress.current} of {progress.total})...
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="min-h-[44px] px-4 text-sm font-medium text-gray-600 hover:text-gray-800 dark:text-gray-300"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={busy || validCount === 0}
              className="min-h-[44px] rounded-lg bg-orac-blue px-6 text-sm font-semibold text-white shadow-sm hover:brightness-105 disabled:opacity-50"
            >
              {busy ? "Importing..." : `Import ${validCount} Timesheet${validCount === 1 ? "" : "s"}`}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
