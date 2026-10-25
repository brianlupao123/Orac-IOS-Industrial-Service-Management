import React, { useState } from "react";
import { invoices } from "../api/client.js";
import { formatAmount } from "../quoteModel.js";

const button = "min-h-[40px] rounded-md border px-3 py-1.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50";
const newKey = () => globalThis.crypto?.randomUUID?.() || `payment-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const today = () => new Date().toISOString().slice(0, 10);

export default function InvoiceSettlementPanel({ invoice, user, onChanged }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ amount: "", payment_method: "bank_transfer", reference: "", received_on: today(), notes: "" });
  const canSettle = ["Admin", "Finance"].includes(user?.role);

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

  return <section className="mt-3 border-t border-slate-200 pt-3" aria-label={`Invoice settlement for ${invoice.invoice_number || invoice.id}`}>
    <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-semibold text-slate-900">{invoice.invoice_number || invoice.id}</h3><p className="text-xs text-slate-600">Issued {formatAmount(invoice.total_amount)} · {invoice.status || "sent"}</p></div><button type="button" className={`${button} border-slate-300 text-slate-700`} disabled={busy} onClick={load}>{data ? "Refresh settlement" : "View settlement"}</button></div>
    {error && <p role="alert" className="mt-3 border-l-4 border-red-500 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" className="mt-3 border-l-4 border-emerald-500 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}
    {data && <div className="mt-3 space-y-3"><dl className="grid gap-2 text-sm sm:grid-cols-3"><div><dt className="text-slate-500">Invoice total</dt><dd className="font-semibold">{formatAmount(data.settlement?.total_amount)}</dd></div><div><dt className="text-slate-500">Received</dt><dd className="font-semibold">{formatAmount(data.settlement?.paid_amount)}</dd></div><div><dt className="text-slate-500">Outstanding</dt><dd className="font-semibold">{formatAmount(data.settlement?.outstanding_amount)}</dd></div></dl>
      {canSettle && data.settlement?.outstanding_amount > 0 && <form onSubmit={record} className="grid gap-2 border-t border-slate-100 pt-3 sm:grid-cols-2"><input required aria-label="Payment amount" className="border border-slate-300 px-2 py-1.5 text-sm" type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="USD amount" /><select aria-label="Payment method" className="border border-slate-300 px-2 py-1.5 text-sm" value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}><option value="bank_transfer">Bank transfer</option><option value="cash">Cash</option><option value="card">Card</option><option value="other">Other</option></select><input required aria-label="Receipt reference" className="border border-slate-300 px-2 py-1.5 text-sm" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="Receipt reference" /><input required aria-label="Receipt date" className="border border-slate-300 px-2 py-1.5 text-sm" type="date" value={form.received_on} onChange={(e) => setForm({ ...form, received_on: e.target.value })} /><input aria-label="Receipt notes" className="border border-slate-300 px-2 py-1.5 text-sm sm:col-span-2" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes (optional)" /><button type="submit" disabled={busy} className={`${button} border-orac-blue bg-orac-blue text-white sm:w-fit`}>{busy ? "Recording..." : "Record payment"}</button></form>}
      {data.payments?.length > 0 && <ul className="border-t border-slate-100 pt-3 text-sm">{data.payments.map((payment) => <li className="flex flex-wrap items-center justify-between gap-2 py-1" key={payment.id}><span>{payment.received_on} · {payment.reference} · {formatAmount(payment.amount)}{payment.voided_at ? " · reversed" : ""}</span>{canSettle && !payment.voided_at && <button type="button" disabled={busy} onClick={() => reverse(payment)} className="text-xs font-semibold text-red-700 hover:underline">Reverse receipt</button>}</li>)}</ul>}
    </div>}
  </section>;
}
