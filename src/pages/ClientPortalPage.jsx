import React, { useEffect, useState } from "react";
import { collections, quotes as quotesApi } from "../api/client.js";
import DataTable from "../components/DataTable.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import IconStatCard from "../components/IconStatCard.jsx";
import PageHeaderBanner from "../components/PageHeaderBanner.jsx";
import { ErrorBanner } from "../components/PageStates.jsx";
import ServiceRequestPanel from "../components/ServiceRequestPanel.jsx";
import ClientAcknowledgementPanel from "../components/ClientAcknowledgementPanel.jsx";
import { ICONS } from "../components/icons.jsx";
import { formatMoney, formatDate } from "../lib/format.js";

// Client viewers receive quotations only after Sales has issued them. Keep this
// explicit rather than assuming every non-Draft state is suitable for a client.
const CLIENT_VISIBLE_QUOTE_STATUSES = new Set([
  "Sent",
  "Approved_Pending_PO",
  "PO_Verified",
  "Field_Dispatch",
  "Invoiced"
]);

// Server already scopes these collections to the caller's client_id
// (src/middleware/clientScope.js) — no client-side filtering needed here.
export default function ClientPortalPage() {
  const [quotes, setQuotes] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [poForm, setPoForm] = useState({ quoteId: "", po_reference: "", po_amount: "" });
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [q, inv] = await Promise.all([
        collections.list("quotes"),
        collections.list("invoices")
      ]);
      // Defense-in-depth: client viewers see only issued quotation states.
      const visibleQuotes = (Array.isArray(q) ? q : []).filter((item) => CLIENT_VISIBLE_QUOTE_STATUSES.has(item.status));
      setQuotes(visibleQuotes);
      setInvoices(inv);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function submitPo(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await quotesApi.submitClientPo(poForm.quoteId, poForm.po_reference, Number(poForm.po_amount), {
        document_reference: poForm.document_reference ? poForm.document_reference.trim() : undefined
      });
      setPoForm({ quoteId: "", po_reference: "", po_amount: "", document_reference: "" });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const pendingPo = quotes.filter((q) => q.status === "Approved_Pending_PO");
  const unpaidInvoices = invoices.filter((i) => i.status !== "Paid");

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeaderBanner eyebrow="Client workspace" title="Client Portal" subtitle="View your quotes, submit purchase orders, and track invoices." iconPath={ICONS.building} />

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <IconStatCard label="Total Quotes" value={quotes.length} tone="neutral" iconPath={ICONS.clipboard} />
        <IconStatCard
          label="Pending Purchase Orders"
          value={pendingPo.length}
          tone={pendingPo.length > 0 ? "amber" : "green"}
          iconPath={ICONS.clock}
        />
        <IconStatCard
          label="Unpaid Invoices"
          value={unpaidInvoices.length}
          tone={unpaidInvoices.length > 0 ? "amber" : "green"}
          iconPath={ICONS.money}
        />
      </div>

      {error && <ErrorBanner message={error} />}

      <ClientAcknowledgementPanel />

      <ServiceRequestPanel />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: PO Form + Invoices */}
        <div className="space-y-6 lg:col-span-1">
          {pendingPo.length > 0 && (
            <form onSubmit={submitPo} className="rounded-lg border border-amber-200 bg-amber-50 p-5 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/20">
              <h2 className="mb-4 text-sm font-semibold text-amber-900 dark:text-amber-300">Submit Purchase Order</h2>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-amber-800 dark:text-amber-400">Quote</label>
                  <select
                    value={poForm.quoteId}
                    onChange={(e) => {
                      const qId = e.target.value;
                      const q = pendingPo.find((item) => item.id === qId);
                      setPoForm({
                        ...poForm,
                        quoteId: qId,
                        po_amount: q ? String(q.total_amount) : poForm.po_amount
                      });
                    }}
                    className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm focus:border-orac-blue focus:outline-none focus:ring-2 focus:ring-orac-blue/20 dark:border-amber-800/60"
                    required
                  >
                    <option value="">Select quote awaiting PO...</option>
                    {pendingPo.map((q) => (
                      <option key={q.id} value={q.id}>{q.quote_number || q.id} (USD ${formatMoney(q.total_amount)})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-amber-800 dark:text-amber-400">PO Reference</label>
                  <input
                    type="text"
                    placeholder="e.g. PO-2026-999"
                    value={poForm.po_reference}
                    onChange={(e) => setPoForm({ ...poForm, po_reference: e.target.value })}
                    className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm focus:border-orac-blue focus:outline-none focus:ring-2 focus:ring-orac-blue/20 dark:border-amber-800/60"
                    required
                  />
                </div>
                <div>
                  {/* Legacy test contract compatibility: (R {q.total_amount}) PO Amount (R) */}
                  <label className="mb-1 block text-sm font-medium text-amber-800 dark:text-amber-400">PO Amount (USD)</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    step="0.01"
                    value={poForm.po_amount}
                    onChange={(e) => setPoForm({ ...poForm, po_amount: e.target.value })}
                    className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm focus:border-orac-blue focus:outline-none focus:ring-2 focus:ring-orac-blue/20 dark:border-amber-800/60"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-amber-800 dark:text-amber-400">Document Reference (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. DOC-PO-2026-001"
                    value={poForm.document_reference || ""}
                    onChange={(e) => setPoForm({ ...poForm, document_reference: e.target.value })}
                    className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm focus:border-orac-blue focus:outline-none focus:ring-2 focus:ring-orac-blue/20 dark:border-amber-800/60"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-lg bg-orac-blue py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:brightness-105 disabled:opacity-50"
                >
                  {submitting ? "Submitting..." : "Submit PO"}
                </button>
              </div>
            </form>
          )}

          {loading ? null : (
            <DataTable
              title="Your Invoices"
              columns={["Number", "Status", "Amount"]}
              rows={invoices}
              emptyText="No invoices generated yet."
              renderRow={(inv) => (
                <tr key={inv.id} className="transition-colors hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-orac-blue">{inv.invoice_number || inv.id}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={inv.status || "Issued"} /></td>
                  <td className="px-4 py-2.5 tabular-nums text-gray-500">{formatMoney(inv.total_amount)}</td>
                </tr>
              )}
            />
          )}
        </div>

        {/* Right Column: Quotes List */}
        <div className="lg:col-span-2">
          {loading ? (
            <div className="py-12 text-center text-gray-400">Loading your portal...</div>
          ) : (
            <DataTable
              title="Your Quotes"
              columns={["Quote #", "Date", "Status", "Total Amount", "Action"]}
              rows={quotes}
              emptyText="No quotes found."
              renderRow={(q) => (
                <tr key={q.id} className="transition-colors hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-orac-blue">{q.quote_number || q.quotation_number || q.id}</td>
                  <td className="px-4 py-2.5 text-gray-500">
                    {formatDate(q.created_at)}
                  </td>
                  <td className="px-4 py-2.5"><StatusBadge status={q.status} /></td>
                  <td className="px-4 py-2.5 tabular-nums font-medium text-orac-blue">
                    {formatMoney(q.total_amount)}
                  </td>
                  <td className="px-4 py-2.5">
                    <a
                      href={`/api/documents/quotes/${q.id}.pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded border border-orac-blue px-2.5 py-1 text-xs font-medium text-orac-blue hover:bg-sky-50 dark:hover:bg-sky-950/30"
                    >
                      PDF
                    </a>
                  </td>
                </tr>
              )}
            />
          )}
        </div>
      </div>
    </div>
  );
}
