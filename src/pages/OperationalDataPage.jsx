import React, { useState } from "react";
import { operationalData } from "../api/client.js";
import PageHeaderBanner from "../components/PageHeaderBanner.jsx";
import { ErrorBanner, PageEmptyState } from "../components/PageStates.jsx";
import { ICONS } from "../components/icons.jsx";

const canPreviewLeads = (role) => ["Admin", "Management", "Sales"].includes(role);
const canExportPastel = (role) => ["Admin", "Finance"].includes(role);
const today = new Date().toISOString().slice(0, 10);
const monthStart = `${today.slice(0, 8)}01`;

export default function OperationalDataPage({ user }) {
  const [csv, setCsv] = useState("company_name,contact_name,email,service_need\n");
  const [preview, setPreview] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function run(action, task) {
    setBusy(action); setError("");
    try { await task(); } catch (err) { setError(err.message); } finally { setBusy(""); }
  }

  async function commitPreview() {
    await run("commit", async () => {
      const result = await operationalData.commitLeads(csv);
      setImportResult(result);
      setPreview(null);
    });
  }

  return (
    <div data-evidence="operational-data-ready" className="mx-auto max-w-7xl space-y-6">
      <PageHeaderBanner eyebrow="Controlled operations" title="Operational Data" subtitle="Review data before import, export Pastel-ready files, and inspect role-scoped activity." iconPath={ICONS.document} />
      {error && <ErrorBanner message={error} />}

      <section className="border-y border-slate-200 bg-white px-5 py-6 sm:px-7" aria-labelledby="analytics-heading">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div><h2 id="analytics-heading" className="text-lg font-semibold text-orac-slate">Operational analytics</h2><p className="mt-1 text-sm text-slate-600">Date-bounded activity in your permitted scope.</p></div>
          <div className="flex flex-wrap items-end gap-3"><label className="text-sm font-medium text-slate-700">From<input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} className="mt-1 block rounded-md border border-slate-300 px-3 py-2" /></label><label className="text-sm font-medium text-slate-700">To<input type="date" value={to} min={from} max={today} onChange={(event) => setTo(event.target.value)} className="mt-1 block rounded-md border border-slate-300 px-3 py-2" /></label><button type="button" disabled={busy === "analytics"} onClick={() => run("analytics", async () => setAnalytics(await operationalData.analytics(from, to)))} className="rounded-md bg-orac-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy === "analytics" ? "Loading..." : "Refresh"}</button></div>
        </div>
        {analytics ? <dl data-evidence="operational-analytics-result" className="mt-5 grid gap-3 sm:grid-cols-3"><Metric label="Dispatches" value={analytics.dispatches?.total} /><Metric label="Timesheets" value={analytics.worksheets?.total} /><Metric label="Invoice-ready" value={analytics.invoice_ready ?? "Not available"} /></dl> : <p className="mt-5 text-sm text-slate-500">Choose a period and refresh to load the role-scoped summary.</p>}
      </section>

      {canExportPastel(user.role) && <section className="border-y border-slate-200 bg-white px-5 py-6 sm:px-7" aria-labelledby="pastel-heading"><h2 id="pastel-heading" className="text-lg font-semibold text-orac-slate">Pastel review exports</h2><p className="mt-1 text-sm text-slate-600">Downloads are review files only. They do not connect to or post into Pastel.</p><div className="mt-4 flex flex-wrap gap-3"><button type="button" disabled={Boolean(busy)} onClick={() => run("quotes", () => operationalData.exportPastelReviewQuotes())} className="rounded-md border border-orac-blue px-4 py-2 text-sm font-semibold text-orac-blue hover:bg-sky-50 disabled:opacity-50">{busy === "quotes" ? "Preparing..." : "Download quote review CSV"}</button><button type="button" disabled={Boolean(busy)} onClick={() => run("invoices", () => operationalData.exportPastelReviewInvoiceReady())} className="rounded-md border border-orac-blue px-4 py-2 text-sm font-semibold text-orac-blue hover:bg-sky-50 disabled:opacity-50">{busy === "invoices" ? "Preparing..." : "Download invoice-ready CSV"}</button></div></section>}

      {canPreviewLeads(user.role) && <section className="border-y border-slate-200 bg-white px-5 py-6 sm:px-7" aria-labelledby="lead-preview-heading"><h2 id="lead-preview-heading" className="text-lg font-semibold text-orac-slate">Lead CSV import</h2><p className="mt-1 text-sm text-slate-600">Preview first. Import is available only when every row passes server validation.</p><label className="mt-4 block text-sm font-medium text-slate-700">CSV content<textarea value={csv} onChange={(event) => { setCsv(event.target.value); setPreview(null); setImportResult(null); }} rows={8} spellCheck="false" className="mt-1 block w-full resize-y rounded-md border border-slate-300 p-3 font-mono text-xs" /></label><button type="button" disabled={Boolean(busy)} onClick={() => run("preview", async () => { setImportResult(null); setPreview(await operationalData.previewLeads(csv)); })} className="mt-3 rounded-md bg-orac-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy === "preview" ? "Checking..." : "Preview rows"}</button>{preview && <div data-evidence="lead-preview-result" className="mt-5"><p className="text-sm font-semibold text-orac-slate">{preview.valid_rows} valid, {preview.invalid_rows} requiring attention.</p>{preview.invalid_rows === 0 && preview.valid_rows > 0 && <div className="mt-4 border-l-4 border-amber-500 bg-amber-50 px-4 py-3"><p className="text-sm font-semibold text-amber-900">Ready to import {preview.valid_rows} lead(s)</p><p className="mt-1 text-sm text-amber-800">This creates new lead records and writes an audit batch. Review the CSV above before continuing.</p><button type="button" disabled={Boolean(busy)} onClick={commitPreview} className="mt-3 rounded-md bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800 disabled:opacity-50">{busy === "commit" ? "Importing..." : "Confirm and import"}</button></div>}{preview.rows?.some((row) => !row.valid) && <ul className="mt-2 space-y-1 text-sm text-red-700">{preview.rows.filter((row) => !row.valid).map((row) => <li key={row.row}>Row {row.row}: {row.errors.join(" ")}</li>)}</ul>}</div>}{importResult && <p data-evidence="lead-import-complete" className="mt-4 border-l-4 border-emerald-500 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">Imported {importResult.imported_count} lead(s). Batch: {importResult.batch_id}</p>}</section>}
      {!canExportPastel(user.role) && !canPreviewLeads(user.role) && !analytics && <PageEmptyState iconPath={ICONS.document} title="No data actions are available" subtitle="Your role can view its operational analytics only." />}
    </div>
  );
}

function Metric({ label, value }) {
  return <div className="border-l-4 border-sky-500 bg-slate-50 px-4 py-3"><dt className="text-sm text-slate-600">{label}</dt><dd className="mt-1 text-2xl font-semibold tabular-nums text-orac-slate">{value ?? 0}</dd></div>;
}
