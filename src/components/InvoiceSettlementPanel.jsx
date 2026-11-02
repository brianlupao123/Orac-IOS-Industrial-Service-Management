import React, { useState } from "react";
import { invoices } from "../api/client.js";
import { formatAmount } from "../quoteModel.js";

const button = "min-h-[42px] rounded-md border px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const field = "mt-1 min-h-[42px] w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs";
const newKey = () => globalThis.crypto?.randomUUID?.() || `payment-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const today = () => new Date().toISOString().slice(0, 10);

export default function InvoiceSettlementPanel({ invoice, user, onChanged }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ amount: "", payment_method: "bank_transfer", reference: "", received_on: today(), notes: "" });
  const [creditForm, setCreditForm] = useState({ amount: "", reason: "" });
  const canSettle = ["Admin", "Finance"].includes(user?.role);
  const isSales = user?.role === "Sales";

  async function load() {
    setBusy(true); setError("");
    try { setData(await invoices.settlement(invoice.id)); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  async function record(event) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      await invoices.recordPayment(invoice.id, { ...form, amount: Number(form.amount), notes: form.notes.trim() || null, idempotency_key: newKey() });
      setNotice("Payment receipt recorded."); setForm({ amount: "", payment_method: "bank_transfer", reference: "", received_on: today(), notes: "" }); await load(); await onChanged?.();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  async function reverse(payment) {
    const reason = window.prompt(`Reason for reversing receipt ${payment.reference}:`);
    if (!reason?.trim()) return;
    setBusy(true); setError(""); setNotice("");
    try { await invoices.voidPayment(invoice.id, payment.id, reason.trim()); setNotice("Payment receipt reversed."); await load(); await onChanged?.(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  async function prepareCreditNote(event) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      await invoices.createCreditNote(invoice.id, { amount: Number(creditForm.amount), reason: creditForm.reason.trim(), idempotency_key: newKey() });
      setNotice("Credit note prepared for independent issue."); setCreditForm({ amount: "", reason: "" }); await load(); await onChanged?.();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  async function issueCreditNote(note) {
    if (!window.confirm(`Issue credit note ${note.id} for ${formatAmount(note.amount)}? A different Finance/Admin user must issue it.`)) return;
    setBusy(true); setError(""); setNotice("");
    try { await invoices.issueCreditNote(note.id, newKey()); setNotice("Credit note issued and settlement updated."); await load(); await onChanged?.(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return <section className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:p-5" aria-label={`Invoice settlement for ${invoice.invoice_number || invoice.id}`}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase text-slate-500">Issued invoice</p><h3 className="mt-1 text-base font-semibold text-slate-900">{invoice.invoice_number || invoice.id}</h3><p className="mt-1 text-sm text-slate-600">Issued {formatAmount(invoice.total_amount)} · {invoice.status || "sent"}</p></div><button type="button" className={`${button} border-slate-300 bg-white text-slate-700 hover:border-orac-blue hover:text-orac-blue`} disabled={busy} onClick={load}>{data ? "Refresh settlement" : "View settlement"}</button></div>
    {error && <p role="alert" className="mt-3 border-l-4 border-red-500 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" className="mt-3 border-l-4 border-emerald-500 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}
    {isSales && data && (
      <div className="mt-5 space-y-4" data-testid="sales-settlement-summary">
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-md border border-slate-200 bg-white p-3">
            <dt className="text-xs font-medium text-slate-500">Invoice total</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{formatAmount(data.invoice_total)} USD</dd>
          </div>
          <div className="rounded-md border border-sky-100 bg-sky-50 p-3">
            <dt className="text-xs font-medium text-sky-800">Credit notes</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums text-sky-900">{formatAmount(data.credit_note_total)} USD</dd>
          </div>
          <div className="rounded-md border border-emerald-100 bg-emerald-50 p-3">
            <dt className="text-xs font-medium text-emerald-800">Received</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums text-emerald-900">{formatAmount(data.received_total)} USD</dd>
          </div>
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
            <dt className="text-xs font-medium text-amber-800">Outstanding</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums text-amber-900">{formatAmount(data.outstanding_total)} USD</dd>
          </div>
        </dl>
        <p className="text-xs text-slate-600">Settlement status: <span className="font-semibold text-slate-900 capitalize">{data.settlement_status}</span></p>
      </div>
    )}
    {!isSales && data && <div className="mt-5 space-y-5"><dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-md border border-slate-200 bg-white p-3"><dt className="text-xs font-medium text-slate-500">Invoice total</dt><dd className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{formatAmount(data.settlement?.total_amount)}</dd></div><div className="rounded-md border border-sky-100 bg-sky-50 p-3"><dt className="text-xs font-medium text-sky-800">Credit notes</dt><dd className="mt-1 text-lg font-semibold tabular-nums text-sky-900">{formatAmount(data.settlement?.credited_amount)}</dd></div><div className="rounded-md border border-emerald-100 bg-emerald-50 p-3"><dt className="text-xs font-medium text-emerald-800">Received</dt><dd className="mt-1 text-lg font-semibold tabular-nums text-emerald-900">{formatAmount(data.settlement?.paid_amount)}</dd></div><div className="rounded-md border border-amber-200 bg-amber-50 p-3"><dt className="text-xs font-medium text-amber-800">Outstanding</dt><dd className="mt-1 text-lg font-semibold tabular-nums text-amber-900">{formatAmount(data.settlement?.outstanding_amount)}</dd></div></dl>
      {canSettle && data.settlement?.outstanding_amount > 0 && <form onSubmit={record} className="border-t border-slate-200 pt-5"><div className="flex flex-wrap items-baseline justify-between gap-2"><div><h4 className="text-sm font-semibold text-slate-900">Record payment receipt</h4><p className="mt-1 text-xs leading-5 text-slate-600">Record only a confirmed client payment. The receipt reference and date are retained in the audit trail.</p></div></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium text-slate-700">Amount (USD)<input required aria-label="Payment amount" className={field} type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" /></label><label className="text-sm font-medium text-slate-700">Payment method<select aria-label="Payment method" className={field} value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}><option value="bank_transfer">Bank transfer</option><option value="cash">Cash</option><option value="card">Card</option><option value="other">Other</option></select></label><label className="text-sm font-medium text-slate-700">Receipt reference<input required aria-label="Receipt reference" className={field} value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="Client receipt or bank reference" /></label><label className="text-sm font-medium text-slate-700">Received date<input required aria-label="Receipt date" className={field} type="date" value={form.received_on} onChange={(e) => setForm({ ...form, received_on: e.target.value })} /></label><label className="text-sm font-medium text-slate-700 sm:col-span-2">Notes <span className="font-normal text-slate-500">(optional)</span><input aria-label="Receipt notes" className={field} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Supporting detail for this receipt" /></label></div><button type="submit" disabled={busy} className={`${button} mt-4 border-orac-blue bg-orac-blue text-white hover:bg-orac-navy`}>{busy ? "Recording..." : "Record payment"}</button></form>}
      {data.payments?.length > 0 && <div className="border-t border-slate-200 pt-5"><h4 className="text-sm font-semibold text-slate-900">Receipt history</h4><ul className="mt-2  text-sm">{data.payments.map((payment) => <li className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 py-3" key={payment.id}><div><p className="font-medium text-slate-900">{payment.reference} <span className={`ml-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${payment.voided_at ? "bg-gray-200 text-slate-700" : "bg-emerald-100 text-emerald-800"}`}>{payment.voided_at ? "Reversed" : "Recorded"}</span></p><p className="mt-1 text-xs text-slate-600">{payment.received_on} · {formatAmount(payment.amount)}</p></div>{canSettle && !payment.voided_at && <button type="button" disabled={busy} onClick={() => reverse(payment)} className="text-sm font-semibold text-red-700 hover:underline">Reverse receipt</button>}</li>)}</ul></div>}
      {canSettle && data.settlement?.outstanding_amount > 0 && <form onSubmit={prepareCreditNote} className="border-t border-slate-200 pt-5"><h4 className="text-sm font-semibold text-slate-900">Prepare credit note</h4><p className="mt-1 text-xs leading-5 text-slate-600">Use only for an approved correction. It remains a draft until a different Finance/Admin user issues it; the review export is not accounting posting.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium text-slate-700">Amount (USD)<input required aria-label="Credit note amount" className={field} type="number" min="0.01" step="0.01" max={data.settlement.outstanding_amount} value={creditForm.amount} onChange={(e) => setCreditForm({ ...creditForm, amount: e.target.value })} placeholder="0.00" /></label><label className="text-sm font-medium text-slate-700">Correction reason<input required aria-label="Credit note reason" className={field} value={creditForm.reason} onChange={(e) => setCreditForm({ ...creditForm, reason: e.target.value })} placeholder="Approved correction reason" /></label></div><button type="submit" disabled={busy} className={`${button} mt-4 border-orac-blue bg-orac-blue text-white hover:bg-sky-700`}>{busy ? "Preparing..." : "Prepare credit note"}</button></form>}
      {data.credit_notes?.length > 0 && <div className="border-t border-slate-200 pt-5"><h4 className="text-sm font-semibold text-slate-900">Credit-note history</h4><ul className="mt-2 text-sm">{data.credit_notes.map((note) => <li className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 py-3" key={note.id}><div><p className="font-medium text-slate-900">{formatAmount(note.amount)} <span className={`ml-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${note.status === "issued" ? "bg-sky-100 text-sky-800" : "bg-amber-100 text-amber-800"}`}>{note.status === "issued" ? "Issued" : "Prepared"}</span></p><p className="mt-1 text-xs text-slate-600">{note.reason}</p></div>{canSettle && note.status === "prepared" && note.prepared_by !== user?.id && <button type="button" disabled={busy} onClick={() => issueCreditNote(note)} className="text-sm font-semibold text-orac-blue hover:underline">Issue credit note</button>}</li>)}</ul></div>}
    </div>}
  </section>;
}
