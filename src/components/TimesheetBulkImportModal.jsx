import React, { useEffect, useMemo, useRef, useState } from "react";
import Modal from "./Modal.jsx";
import SearchableSelect from "./SearchableSelect.jsx";
import { dispatch, technicianProfiles } from "../api/client.js";
import { TECHNICIAN_TRADES, displayTrade } from "../constants/trades.js";
import { newRequestId } from "../lib/timesheetFormLogic.js";

const BULK_DRAFT_KEY = (userId) => `orac_draft_bulk_timesheets_${userId || "anon"}`;

// Helper: strictly parses and validates real calendar dates (prevents 2026-02-30 or garbage)
function parseAndValidateDate(raw) {
  if (!raw || typeof raw !== "string") return { valid: false, date: "" };
  let trimmed = raw.trim();
  if (trimmed.includes("T")) trimmed = trimmed.split("T")[0];

  let y, m, d;
  if (/^\d{4}[/-]\d{1,2}[/-]\d{1,2}$/.test(trimmed)) {
    const parts = trimmed.split(/[/-]/).map(Number);
    y = parts[0]; m = parts[1]; d = parts[2];
  } else if (/^\d{1,2}[/.-]\d{1,2}[/.-]\d{4}$/.test(trimmed)) {
    const parts = trimmed.split(/[/.-]/).map(Number);
    d = parts[0]; m = parts[1]; y = parts[2];
  } else {
    return { valid: false, date: "" };
  }

  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) {
    return { valid: false, date: "" };
  }

  const testDate = new Date(Date.UTC(y, m - 1, d));
  if (testDate.getUTCFullYear() !== y || testDate.getUTCMonth() !== m - 1 || testDate.getUTCDate() !== d) {
    return { valid: false, date: "" };
  }

  const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return { valid: true, date: iso };
}

// Helper: parse hours with decimal comma support and strict validation
function parseHours(val, delimiter) {
  if (val === undefined || val === null || val === "") return { ok: true, hours: 0 };
  let str = String(val).trim();
  if ((delimiter === ";" || delimiter === "\t") && str.includes(",") && !str.includes(".")) {
    str = str.replace(",", ".");
  }
  str = str.replace(/hrs?$/i, "").trim();
  const num = Number(str);
  if (Number.isNaN(num)) return { ok: false, hours: 0, error: `Invalid number: "${val}"` };
  if (num < 0) return { ok: false, hours: num, error: "Hours cannot be negative" };
  if (num > 24) return { ok: false, hours: num, error: "Hours cannot exceed 24h" };
  return { ok: true, hours: num };
}

// RFC-4180 quote-aware delimited text parser with zero regex infinite loop risk
function parseDelimitedText(text) {
  if (!text || !text.trim()) return [];
  const clean = text.replace(/^\uFEFF/, "").trim();
  if (!clean) return [];

  const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const firstLine = lines[0];
  let delimiter = ",";
  if (firstLine.includes("\t")) delimiter = "\t";
  else if (firstLine.includes(";") && !firstLine.includes(",")) delimiter = ";";

  function parseLine(line) {
    const fields = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        fields.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    fields.push(current.trim());
    return fields;
  }

  const rawRows = lines.map(parseLine);
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

  const findCol = (terms, defaultIdx) => {
    if (!headers.length) return defaultIdx;
    const idx = headers.findIndex((h) => terms.some((t) => h.includes(t)));
    return idx >= 0 ? idx : defaultIdx;
  };

  const colDate = findCol(["date", "day"], 0);
  const colWorker = findCol(["technician", "worker", "artisan", "name"], 1);
  const colTrade = findCol(["trade", "discipline"], 2);
  const colJob = findCol(["job", "dispatch", "dc"], 3);
  const colNormal = findCol(["normal", "regular", "std", "basic", "hours"], 4);
  const colOt15 = findCol(["1.5", "ot15", "ot 1.5", "sat"], 5);
  const colOt20 = findCol(["2.0", "ot20", "ot 2.0", "sun", "double"], 6);
  const colActivity = findCol(["activity", "description", "scope", "task"], 7);

  return dataRows.map((cols, idx) => {
    const rawDate = cols[colDate] || "";
    const dateParsed = parseAndValidateDate(rawDate);

    const workerName = cols[colWorker] || "";
    const trade = cols[colTrade] || "";
    const jobRef = cols[colJob] || "";

    const parsedNormal = parseHours(cols[colNormal], delimiter);
    const parsedOt15 = parseHours(cols[colOt15], delimiter);
    const parsedOt20 = parseHours(cols[colOt20], delimiter);

    const activity = cols[colActivity] || cols.slice(colActivity).join(" ") || "General field engineering operations";

    const rowErrors = [];
    if (!dateParsed.valid) rowErrors.push(`Invalid date "${rawDate}" (YYYY-MM-DD or DD/MM/YYYY required)`);
    if (!parsedNormal.ok) rowErrors.push(parsedNormal.error);
    if (!parsedOt15.ok) rowErrors.push(parsedOt15.error);
    if (!parsedOt20.ok) rowErrors.push(parsedOt20.error);

    return {
      rowId: idx + 1,
      date: dateParsed.valid ? dateParsed.date : rawDate,
      isDateValid: dateParsed.valid,
      workerName: workerName.trim(),
      trade: trade.trim(),
      jobRef: jobRef.trim(),
      normal: parsedNormal.hours,
      ot15: parsedOt15.hours,
      ot20: parsedOt20.hours,
      activity: activity.trim(),
      parseErrors: rowErrors
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

    if (dispatches && dispatches.length > 0 && !defaultDispatchId) {
      setDefaultDispatchId(dispatches[0].id);
    }
  }, [isOpen, user?.id, dispatches, defaultDispatchId]);

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

  // Exact matching for active technician profiles (no loose substring or trade fallback)
  function matchTechnician(row) {
    if (!row.workerName) return null;
    const cleanInput = row.workerName.trim().toLowerCase();
    const activeTechs = (technicians || []).filter((t) => t.is_active !== false);

    // 1. Match by exact national ID if supplied
    const byId = activeTechs.find((t) => {
      if (!t.national_id) return false;
      const cleanId = t.national_id.replace(/[-\s]/g, "").toLowerCase();
      return cleanId === cleanInput.replace(/[-\s]/g, "");
    });
    if (byId) return byId;

    // 2. Match by exact normalized full name
    const byName = activeTechs.find((t) => {
      const full1 = (t.name || "").trim().toLowerCase();
      const full2 = `${t.first_name || ""} ${t.last_name || ""}`.trim().toLowerCase();
      return full1 === cleanInput || full2 === cleanInput;
    });
    if (byName) return byName;

    return null;
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
    return parsedRows.map((row) => {
      const tech = matchTechnician(row);
      const dispatchId = matchDispatch(row);
      const totalH = row.normal + row.ot15 + row.ot20;

      const warnings = [];
      const errors = [...(row.parseErrors || [])];

      if (!row.workerName) errors.push("Missing technician name");
      if (row.jobRef && !dispatchId) errors.push(`Dispatch card "${row.jobRef}" not found`);
      if (!row.jobRef && !dispatchId) errors.push("No default dispatch card selected");
      if (totalH <= 0) errors.push("Zero hours logged");
      if (totalH > 24) errors.push(`Total hours (${totalH}h) exceeds maximum 24h per day`);
      if (!tech && row.workerName) warnings.push("Technician not found in active registry; will be entered as external contractor");

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

    if (created > 0 && failed === 0) {
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
        {/* Operational Notice Banner */}
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-xs text-sky-950 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <p className="font-semibold text-sm text-sky-900 dark:text-sky-100 mb-1">
                Field Operations & Time Tracking
              </p>
              <p className="text-sky-800 dark:text-sky-300">
                Bulk timesheets record verified operational hours only. Commercial billing and payroll rates are managed centrally by Finance.
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
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
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
              placeholder="Select fallback dispatch card..."
            />
          </div>

          <div className="flex flex-col justify-end">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={submitDirectly}
                onChange={(e) => setSubmitDirectly(e.target.checked)}
                className="rounded border-gray-300 text-orac-blue focus:ring-orac-blue w-4 h-4"
              />
              <span>Submit directly for Client Acknowledgement (bypass draft state)</span>
            </label>
          </div>
        </div>

        {/* Input Textarea & File Upload */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
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
                  <span className="text-gray-300">|</span>
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
            <div className="flex items-center justify-between text-xs font-medium text-gray-600 dark:text-gray-400">
              <span>
                Parsed {summary.total} row(s) &bull; <strong className="text-emerald-700 dark:text-emerald-400">{summary.valid} valid</strong> &bull; <strong className={summary.invalid > 0 ? "text-red-700 dark:text-red-400" : ""}>{summary.invalid} invalid</strong> &bull; Total hours: <strong>{summary.totalHours.toFixed(1)}h</strong>
              </span>
            </div>

            <div className="max-h-60 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 sticky top-0">
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
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
                            Ready
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200">
                            Error
                          </span>
                        )}
                      </td>
                      <td className="p-2 font-mono">{r.date}</td>
                      <td className="p-2">
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {r.workerName}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          {r.trade || r.matchedTech?.trade || "General"} {r.matchedTech && "(Technician)"}
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
            <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
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
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || validatedRows.length === 0 || summary.invalid > 0}
            onClick={handleImport}
            className="px-5 py-2 text-sm font-semibold text-white bg-orac-blue hover:bg-orac-blue/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition"
          >
            {busy ? "Importing..." : `Import ${summary.valid} Valid Timesheet(s)`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
