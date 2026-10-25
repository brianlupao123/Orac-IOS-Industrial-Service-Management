import React, { useMemo, useState } from "react";
import { v5InvoiceWriter } from "../api/client.js";
import { v5InvoiceWriterEnabled } from "../v5CommercialFlags.js";

const button = "min-h-[40px] rounded-md border px-3 py-1.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50";
const key = () => globalThis.crypto?.randomUUID?.() || `v5-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const amount = (cents) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(cents || 0) / 100);

function selectedLines(workspace, selected) {
  return workspace.lines.flatMap((line) => {
    const choice = selected[line.quote_line_id];
    if (!choice?.include) return [];
    if (line.source_rule === "supervisor_completion_required") return [{ quote_line_id: line.quote_line_id }];
    const sources = (choice.sources || []).filter((source) => source.include).map((source) => ({
      source_type: source.source_type, source_id: source.source_id, quantity: Number(source.quantity)
    }));
    return sources.length ? [{ quote_line_id: line.quote_line_id, sources }] : [];
  });
}

export default function V5InvoiceWriterPanel({ user, dispatchId, label }) {
  const [workspace, setWorkspace] = useState(null);
  const [drafts, setDrafts] = useState([]);
  const [selected, setSelected] = useState({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const lines = useMemo(() => workspace ? selectedLines(workspace, selected) : [], [workspace, selected]);
  const poIds = useMemo(() => new Set(lines.map((line) => workspace.lines.find((item) => item.quote_line_id === line.quote_line_id)?.purchase_order_id).filter(Boolean)), [lines, workspace]);

  if (!v5InvoiceWriterEnabled() || !["Admin", "Finance"].includes(user?.role) || !dispatchId) return null;

  async function reload() {
    setBusy(true); setError("");
    try {
      const [nextWorkspace, nextDrafts] = await Promise.all([v5InvoiceWriter.workspace(dispatchId), v5InvoiceWriter.drafts(dispatchId)]);
      setWorkspace(nextWorkspace); setDrafts(Array.isArray(nextDrafts) ? nextDrafts : []); setSelected({});
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  function toggleLine(line, include) {
    setSelected((current) => ({ ...current, [line.quote_line_id]: {
      include,
      sources: line.available_sources.map((source) => ({ ...source, include: false, quantity: source.available_quantity }))
    } }));
  }

  function updateSource(lineId, sourceId, changes) {
    setSelected((current) => ({ ...current, [lineId]: {
      ...current[lineId], sources: current[lineId].sources.map((source) => source.source_id === sourceId ? { ...source, ...changes } : source)
    } }));
  }

  async function prepare() {
    if (!workspace || !lines.length || poIds.size !== 1) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const draft = await v5InvoiceWriter.createDraft(dispatchId, { idempotency_key: key(), lines });
      setMessage(`Draft ${draft.id} prepared from current evidence. ${amount(draft.candidate?.grand_total_cents)} is server-calculated and still requires another authorized user to issue it.`);
      await reload();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function issue(draft) {
    setBusy(true); setError(""); setMessage("");
    try {
      const invoice = await v5InvoiceWriter.issueDraft(draft.id, { idempotency_key: key() });
      setMessage(`Invoice ${invoice.invoice_number} issued. Its evidence consumption is now immutable in V1.`);
      await reload();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <section className="mt-3 border-t border-slate-200 pt-4" aria-label="V5 invoice writer">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h3 className="text-sm font-semibold text-slate-900">V5 evidence invoice {label ? `for ${label}` : ""}</h3><p className="mt-1 text-xs text-slate-600">Drafts use current verified evidence only. Issue is a separate, two-person action.</p></div>
        <button type="button" onClick={reload} disabled={busy} className={`${button} border-slate-300 text-slate-700`}>{workspace ? "Refresh evidence" : "Review evidence"}</button>
      </div>
      {error && <p role="alert" className="mt-3 border-l-4 border-red-500 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      {message && <p role="status" className="mt-3 border-l-4 border-emerald-500 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}
      {workspace && <div className="mt-3 space-y-3">
        {workspace.blockers?.length > 0 && <ul className="border-l-4 border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-900">{workspace.blockers.map((item) => <li key={`${item.code}-${item.source_id || item.material_usage_id || ""}`}>{item.message}</li>)}</ul>}
        <div className="space-y-2">
          {workspace.lines.map((line) => {
            const choice = selected[line.quote_line_id] || { include: false, sources: [] };
            const selectable = line.authority_valid && !line.already_issued && (line.source_rule === "supervisor_completion_required" ? line.completion_current : line.available_sources.length > 0);
            return <div key={line.quote_line_id} className="border border-slate-200 px-3 py-3">
              <label className="flex items-start gap-2 text-sm text-slate-800"><input type="checkbox" checked={choice.include} disabled={!selectable || busy} onChange={(event) => toggleLine(line, event.target.checked)} /><span><strong>{line.description}</strong> <span className="text-slate-500">{line.pricing_basis} · remaining {line.remaining_quantity}</span></span></label>
              {!selectable && <p className="mt-2 text-xs text-amber-800">{line.already_issued ? "This indivisible line was already billed." : line.authority_valid ? "No current eligible evidence is available for this line." : "The linked quote or purchase-order authority is not currently valid."}</p>}
              {choice.include && line.source_rule === "exact_evidence_portions" && <div className="mt-3 space-y-2 pl-6">{choice.sources.map((source) => <div className="flex flex-wrap items-center gap-2 text-xs" key={source.source_id}><label className="flex items-center gap-1"><input type="checkbox" checked={source.include} disabled={busy} onChange={(event) => updateSource(line.quote_line_id, source.source_id, { include: event.target.checked })} />{source.source_id}</label><span>available {source.available_quantity} {source.unit}</span><input aria-label={`Quantity for ${source.source_id}`} className="w-24 border border-slate-300 px-2 py-1" type="number" min="0.000001" max={source.available_quantity} step="0.000001" value={source.quantity} disabled={!source.include || busy} onChange={(event) => updateSource(line.quote_line_id, source.source_id, { quantity: event.target.value })} /></div>)}</div>}
            </div>;
          })}
        </div>
        {poIds.size > 1 && <p className="text-sm text-amber-900">Select evidence under one purchase order per draft.</p>}
        <button type="button" disabled={busy || workspace.blockers?.length > 0 || !lines.length || poIds.size !== 1} onClick={prepare} className={`${button} border-orac-blue bg-orac-blue text-white`}>{busy ? "Working..." : "Prepare evidence draft"}</button>
        {drafts.length > 0 && <div className="border-t border-slate-200 pt-3"><h4 className="text-sm font-semibold text-slate-800">Prepared drafts</h4><ul className="mt-2 space-y-2">{drafts.map((draft) => <li className="flex flex-wrap items-center justify-between gap-2 border border-slate-200 px-3 py-2 text-sm" key={draft.id}><span>{draft.id} · prepared by {draft.prepared_by} · {draft.status}</span>{draft.status === "prepared" && draft.prepared_by !== user?.id ? <button type="button" disabled={busy} onClick={() => issue(draft)} className={`${button} border-emerald-600 text-emerald-800`}>Issue reviewed draft</button> : draft.status === "prepared" ? <span className="text-xs text-slate-500">A different Finance/Admin user must issue this draft.</span> : <span className="text-xs text-emerald-700">Issued</span>}</li>)}</ul></div>}
      </div>}
    </section>
  );
}
