import React, { useState } from "react";
import { legacyInvoiceDrafts } from "../api/client.js";
import { formatAmount } from "../quoteModel.js";

const button = "min-h-[40px] rounded-md border px-3 py-1.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50";
const key = () => globalThis.crypto?.randomUUID?.() || `legacy-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export default function LegacyInvoiceDraftPanel({ user, dispatchId, label, onIssued }) {
  const [drafts, setDrafts] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  if (!dispatchId || !["Admin", "Finance", "Sales"].includes(user?.role)) return null;

  async function reload() {
    setBusy(true); setError("");
    try {
      const data = await legacyInvoiceDrafts.list(dispatchId);
      setDrafts(Array.isArray(data) ? data : []);
      setLoaded(true);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function prepare() {
    setBusy(true); setError(""); setMessage("");
    try {
      const draft = await legacyInvoiceDrafts.create(dispatchId, { idempotency_key: key() });
      setMessage(`Draft prepared at ${formatAmount(draft.candidate?.total)}. A different Finance/Admin user must issue it.`);
      await reload();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function issue(draft) {
    setBusy(true); setError(""); setMessage("");
    try {
      const invoice = await legacyInvoiceDrafts.issue(draft.id, { idempotency_key: key() });
      setMessage(`Invoice ${invoice.invoice_number} was issued from the reviewed draft.`);
      await reload();
      await onIssued?.();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  const prepared = drafts.find((draft) => draft.status === "prepared");
  return <section className="mt-3 border-t border-slate-200 pt-4" aria-label="Controlled legacy invoice draft">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h3 className="text-sm font-semibold text-slate-900">Controlled invoice {label ? `for ${label}` : ""}</h3><p className="mt-1 text-xs text-slate-600">The server uses the verified PO and approved field evidence. Preparation does not create an invoice.</p></div>
      <button type="button" onClick={reload} disabled={busy} className={`${button} border-slate-300 text-slate-700`}>{loaded ? "Refresh drafts" : "Review draft status"}</button>
    </div>
    {error && <p role="alert" className="mt-3 border-l-4 border-red-500 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
    {message && <p role="status" className="mt-3 border-l-4 border-emerald-500 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}
    {loaded && <div className="mt-3 space-y-3">
      {!prepared && <button type="button" onClick={prepare} disabled={busy} className={`${button} border-orac-blue bg-orac-blue text-white`}>{busy ? "Working..." : "Prepare invoice draft"}</button>}
      {drafts.length > 0 && <ul className="space-y-2">{drafts.map((draft) => <li key={draft.id} className="flex flex-wrap items-center justify-between gap-2 border border-slate-200 px-3 py-2 text-sm"><span>{draft.status === "issued" ? "Issued" : "Prepared"} · {formatAmount(draft.candidate?.total)} · prepared by {draft.prepared_by}</span>{draft.status === "prepared" && ["Admin", "Finance"].includes(user?.role) && draft.prepared_by !== user?.id ? (
            <button type="button" disabled={busy} onClick={() => issue(draft)} className={`${button} border-emerald-600 text-emerald-800`}>Issue reviewed draft</button>
          ) : draft.status === "prepared" && user?.role === "Sales" ? (
            <span className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1">Issuance restricted to Finance or Admin under two-person maker-checker policy</span>
          ) : draft.status === "prepared" ? (
            <span className="text-xs text-slate-500 bg-slate-100 border border-slate-200 rounded px-2 py-1">Awaiting independent issuer (maker cannot issue)</span>
          ) : (
            <span className="text-xs text-emerald-700">Invoice issued</span>
          )}</li>)}</ul>}
    </div>}
  </section>;
}
