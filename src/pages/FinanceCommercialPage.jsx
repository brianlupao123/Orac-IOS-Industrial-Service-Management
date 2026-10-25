import React, { useCallback, useEffect, useMemo, useState } from "react";
import { assistant, collections, purchaseOrders as poApi, quotes as quotesApi, reports } from "../api/client.js";
import PageHeaderBanner from "../components/PageHeaderBanner.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { ICONS } from "../components/icons.jsx";
import { ErrorBanner, PageEmptyState } from "../components/PageStates.jsx";
import RecordAnalysisModal from "../components/RecordAnalysisModal.jsx";
import { formatAmount } from "../quoteModel.js";
import V5BillingReadinessPanel from "../components/V5BillingReadinessPanel.jsx";
import V5InvoiceWriterPanel from "../components/V5InvoiceWriterPanel.jsx";
import LegacyInvoiceDraftPanel from "../components/LegacyInvoiceDraftPanel.jsx";
import InvoiceSettlementPanel from "../components/InvoiceSettlementPanel.jsx";
import {
  EMPTY_AMENDMENT_FORM, EMPTY_VERIFY_FORM, buildAmendmentPayload, buildVerifyPoPayload, canApproveAmendment,
  canVerifyPo, shouldTransitionAfterVerify, validateAmendmentForm, validateVerifyPoForm
} from "../financeModel.js";
import { recordAnalysisVisible } from "../recordAnalysisFlags.js";

// Finance commercial gates that the backend already enforces but no page
// called: verify a client-submitted PO, approve a PO amendment, and invoice a
// dispatch that is ready. Every write goes through the server, which is the
// sole authority (permissions, state machine, separation of duties). This
// page reads only collections Finance is already allowed to read
// (purchase_orders, quotes, clients) plus the Finance-permitted
// /reports/invoice-ready report; it does not widen any access, and it does
// not touch stock, dispatch or worksheets. Reports stays read-only.

const inputClass = "w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm";
const buttonClass = "rounded-md border px-3 py-1.5 text-sm font-semibold transition-colors disabled:opacity-50";

function recordedAt(value) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : date.toLocaleString();
}

// This is a compact read of the stored PO record, not an audit-log view. It
// deliberately names missing verification evidence instead of implying it.
function PurchaseOrderEvidence({ po, quote }) {
  const verified = po.status === "verified";
  const rejected = po.status === "rejected";
  return (
    <dl className="mt-3 grid gap-x-4 gap-y-2 border-t border-gray-100 pt-3 text-xs text-gray-600 sm:grid-cols-2" data-evidence="purchase-order-summary">
      <div><dt className="font-medium text-gray-700">PO record</dt><dd>{po.id}</dd></div>
      <div><dt className="font-medium text-gray-700">Linked quote</dt><dd>{quote?.quote_number || po.quotation_id || "Not linked"}</dd></div>
      <div><dt className="font-medium text-gray-700">Verification</dt><dd>{verified ? `Verified by ${po.verified_by || "an unrecorded actor"} on ${recordedAt(po.verified_at)}` : (rejected ? `Rejected: ${po.rejection_reason || "Unspecified"}` : "Awaiting Finance verification")}</dd></div>
      <div><dt className="font-medium text-gray-700">Authority amount</dt><dd>{formatAmount(po.po_amount)}</dd></div>
      {po.document_reference && <div><dt className="font-medium text-gray-700">Document ref</dt><dd>{po.document_reference}</dd></div>}
      {Number.isFinite(Number(po.logged_value)) && <div><dt className="font-medium text-gray-700">Logged evidence value</dt><dd>{formatAmount(po.logged_value)}</dd></div>}
      <div><dt className="font-medium text-gray-700">Amendment state</dt><dd>{po.requires_amendment ? "Written amendment required before invoicing" : "No amendment required on this record"}</dd></div>
    </dl>
  );
}

export default function FinanceCommercialPage({ user }) {
  const [pos, setPos] = useState([]);
  const [quoteList, setQuoteList] = useState([]);
  const [clients, setClients] = useState([]);
  const [ready, setReady] = useState([]);
  const [invoiceList, setInvoiceList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");
  const [openKey, setOpenKey] = useState(""); // "verify:<poId>" | "amend:<poId>"
  const [verifyForm, setVerifyForm] = useState({ ...EMPTY_VERIFY_FORM });
  const [amendForm, setAmendForm] = useState({ ...EMPTY_AMENDMENT_FORM });
  const [formError, setFormError] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [analysisError, setAnalysisError] = useState("");
  const [analysisBusyId, setAnalysisBusyId] = useState("");
  const analysisVisible = recordAnalysisVisible();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [poData, quoteData, clientData, readyData, invoiceData] = await Promise.all([
        collections.list("purchase_orders"),
        collections.list("quotes"),
        collections.list("clients"),
        reports.get("invoice-ready"),
        collections.list("invoices")
      ]);
      setPos(Array.isArray(poData) ? poData : []);
      setQuoteList(Array.isArray(quoteData) ? quoteData : []);
      setClients(Array.isArray(clientData) ? clientData : []);
      setReady(Array.isArray(readyData) ? readyData : []);
      setInvoiceList(Array.isArray(invoiceData) ? invoiceData : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const quoteFor = useCallback((quoteId) => quoteList.find((q) => q.id === quoteId), [quoteList]);
  const clientName = useCallback((clientId) => clients.find((c) => c.id === clientId)?.name || clientId || "\u2014", [clients]);
  const quoteLabel = (quoteId) => quoteFor(quoteId)?.quote_number || quoteId;

  const pending = useMemo(() => pos.filter((po) => po.status === "pending"), [pos]);
  const amendments = useMemo(() => pos.filter(canApproveAmendment), [pos]);

  function openVerify(po) {
    setOpenKey(`verify:${po.id}`);
    setVerifyForm({ po_reference: po.po_reference || "", po_amount: po.po_amount ?? "" });
    setFormError("");
  }

  function openAmend(po) {
    setOpenKey(`amend:${po.id}`);
    setAmendForm({ new_amount: po.logged_value ?? "", reason: "" });
    setFormError("");
  }

  function closeForm() {
    setOpenKey("");
    setFormError("");
  }

  async function runAction(id, work, successMessage) {
    setBusyId(id);
    setError("");
    setNotice("");
    try {
      await work();
      setNotice(successMessage);
      closeForm();
      await load();
    } catch (err) {
      // Show inside the open form when there is one, otherwise page-level.
      if (openKey) setFormError(err.message); else setError(err.message);
      // A partial success (PO verified, transition rejected) still changed
      // server state, so refresh what is shown.
      await load();
    } finally {
      setBusyId("");
    }
  }

  function submitVerify(event, po) {
    event.preventDefault();
    const message = validateVerifyPoForm(verifyForm);
    if (message) { setFormError(message); return; }
    const quote = quoteFor(po.quotation_id);
    return runAction(po.id, async () => {
      const { po_reference, po_amount } = buildVerifyPoPayload(verifyForm);
      await quotesApi.verifyPo(po.quotation_id, po_reference, po_amount);
      if (shouldTransitionAfterVerify(quote)) await quotesApi.transition(po.quotation_id, "PO_Verified");
    }, `PO ${verifyForm.po_reference.trim()} verified for ${quoteLabel(po.quotation_id)}.`);
  }

  function submitReject(po) {
    const reason = window.prompt(`Enter rejection reason for PO ${po.po_reference || po.id}:`);
    if (!reason || !reason.trim()) return;
    return runAction(po.id, () => quotesApi.rejectPo(po.quotation_id, reason.trim()), `PO ${po.po_reference || po.id} rejected.`);
  }

  function submitAmendment(event, po) {
    event.preventDefault();
    const message = validateAmendmentForm(amendForm, po.po_amount);
    if (message) { setFormError(message); return; }
    return runAction(po.id, () => poApi.approveAmendment(po.id, buildAmendmentPayload(amendForm)), `Amendment approved for PO ${po.po_reference || po.id}.`);
  }

  async function analyzePurchaseOrder(po) {
    setAnalysisBusyId(po.id);
    setAnalysisError("");
    try {
      setAnalysis(await assistant.recordAnalysis("purchase_order", po.id));
    } catch (err) {
      setAnalysisError(err.message);
    } finally {
      setAnalysisBusyId("");
    }
  }

  return (
    <div className="space-y-6" data-evidence="finance-commercial-page">
      <PageHeaderBanner
        eyebrow="Finance"
        title="PO & Invoicing"
        subtitle="Verify client purchase orders, approve PO amendments and invoice completed work. The server enforces every rule; a blocked action shows its reason."
        iconPath={ICONS.money}
      />

      {error && <ErrorBanner message={error} />}
      {analysisError && <ErrorBanner message={analysisError} />}
      {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}

      {loading ? (
        <div className="py-12 text-center text-gray-400">Loading finance work...</div>
      ) : (
        <>
          <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-gray-700">Purchase orders awaiting verification</h2>
            {pending.length === 0 ? (
              <PageEmptyState iconPath={ICONS.document} title="Nothing to verify" subtitle="Client-submitted purchase orders appear here." />
            ) : (
              <ul className="mt-3 space-y-3">
                {pending.map((po) => {
                  const quote = quoteFor(po.quotation_id);
                  const open = openKey === `verify:${po.id}`;
                  const busy = busyId === po.id;
                  return (
                    <li key={po.id} className="rounded-md border border-gray-100 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-orac-slate">{quoteLabel(po.quotation_id)} {"\u00b7"} {clientName(quote?.client_id)}</p>
                          <p className="text-sm text-gray-600">Client submitted {po.po_reference || "(no reference)"} for {formatAmount(po.po_amount)}</p>
                        </div>
                        {quote && <StatusBadge status={quote.status} />}
                      </div>
                      <PurchaseOrderEvidence po={po} quote={quote} />
                      {canVerifyPo(po, quote) ? (
                        open ? (
                          <form onSubmit={(event) => submitVerify(event, po)} className="mt-3 space-y-2">
                            {formError && <ErrorBanner message={formError} />}
                            <div className="flex flex-wrap gap-2">
                              <input aria-label="PO reference" className={`${inputClass} min-w-[10rem] flex-1`} value={verifyForm.po_reference} onChange={(e) => setVerifyForm({ ...verifyForm, po_reference: e.target.value })} placeholder="PO reference" />
                              <input aria-label="PO amount" type="number" min="0" step="any" className={`${inputClass} w-32`} value={verifyForm.po_amount} onChange={(e) => setVerifyForm({ ...verifyForm, po_amount: e.target.value })} placeholder="Amount" />
                            </div>
                            <p className="text-xs text-gray-500">Confirm these against the client's actual purchase order document before verifying.</p>
                            <div className="flex gap-2">
                              <button type="submit" disabled={busy} className={`${buttonClass} border-orac-blue bg-orac-blue text-white`}>{busy ? "Verifying..." : "Verify PO"}</button>
                              <button type="button" disabled={busy} onClick={() => submitReject(po)} className={`${buttonClass} border-red-300 text-red-600 hover:bg-red-50`}>Reject PO</button>
                              <button type="button" onClick={closeForm} className={`${buttonClass} border-gray-300 text-orac-slate`}>Cancel</button>
                            </div>
                          </form>
                        ) : (
                          <button type="button" onClick={() => openVerify(po)} className={`${buttonClass} mt-3 border-orac-blue text-orac-blue hover:bg-sky-50`}>Review and verify</button>
                        )
                      ) : (
                        <p className="mt-2 text-xs text-gray-500">This PO cannot be verified yet: its quote must be approved and awaiting a PO.</p>
                      )}
                      {analysisVisible && <button type="button" disabled={analysisBusyId === po.id} onClick={() => analyzePurchaseOrder(po)} className={`${buttonClass} mt-3 border-gray-300 text-orac-slate hover:bg-gray-50`}>{analysisBusyId === po.id ? "Analyzing..." : "Analyze evidence"}</button>}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-gray-700">PO amendments required</h2>
            {amendments.length === 0 ? (
              <PageEmptyState iconPath={ICONS.document} title="No amendments needed" subtitle="A PO appears here when logged work exceeds its approved amount." />
            ) : (
              <ul className="mt-3 space-y-3">
                {amendments.map((po) => {
                  const quote = quoteFor(po.quotation_id);
                  const open = openKey === `amend:${po.id}`;
                  const busy = busyId === po.id;
                  return (
                    <li key={po.id} className="rounded-md border border-amber-200 bg-amber-50 p-3">
                      <p className="text-sm font-medium text-orac-slate">{po.po_reference || po.id} {"\u00b7"} {quoteLabel(po.quotation_id)}</p>
                      <p className="text-sm text-gray-700">PO amount {formatAmount(po.po_amount)} {"\u00b7"} logged work {formatAmount(po.logged_value)}</p>
                      <PurchaseOrderEvidence po={po} quote={quote} />
                      {open ? (
                        <form onSubmit={(event) => submitAmendment(event, po)} className="mt-3 space-y-2">
                          {formError && <ErrorBanner message={formError} />}
                          <div className="flex flex-wrap gap-2">
                            <input aria-label="New PO amount" type="number" min="0" step="any" className={`${inputClass} w-40`} value={amendForm.new_amount} onChange={(e) => setAmendForm({ ...amendForm, new_amount: e.target.value })} placeholder="New PO amount" />
                            <input aria-label="Reason" className={`${inputClass} min-w-[10rem] flex-1`} value={amendForm.reason} onChange={(e) => setAmendForm({ ...amendForm, reason: e.target.value })} placeholder="Reason (optional)" />
                          </div>
                          <p className="text-xs text-gray-600">Approve only against the client's written amendment. The approval is recorded against your account.</p>
                          <div className="flex gap-2">
                            <button type="submit" disabled={busy} className={`${buttonClass} border-orac-blue bg-orac-blue text-white`}>{busy ? "Approving..." : "Approve amendment"}</button>
                            <button type="button" onClick={closeForm} className={`${buttonClass} border-gray-300 text-orac-slate`}>Cancel</button>
                          </div>
                        </form>
                      ) : (
                        <button type="button" onClick={() => openAmend(po)} className={`${buttonClass} mt-3 border-amber-300 text-amber-900 hover:bg-amber-100`}>Approve amendment</button>
                      )}
                      {analysisVisible && <button type="button" disabled={analysisBusyId === po.id} onClick={() => analyzePurchaseOrder(po)} className={`${buttonClass} mt-3 border-gray-300 text-orac-slate hover:bg-gray-50`}>{analysisBusyId === po.id ? "Analyzing..." : "Analyze evidence"}</button>}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-gray-700">Ready to invoice</h2>
            {ready.length === 0 ? (
              <PageEmptyState iconPath={ICONS.money} title="Nothing ready to invoice" subtitle="Work appears here once its PO is verified, no amendment is outstanding and a supervisor has approved a worksheet." />
            ) : (
              <ul className="mt-3 space-y-2">
                {ready.map((row) => (
                  <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-gray-100 px-3 py-2">
                    <p className="text-sm text-orac-slate">{row.dispatch_number || row.id} {"\u00b7"} {quoteLabel(row.quotation_id)}</p>
                    <div className="w-full"><V5BillingReadinessPanel user={user} dispatchId={row.id} label={row.dispatch_number || row.id} /></div>
                    {quoteFor(row.quotation_id)?.v5_commercial_workflow ? <div className="w-full"><V5InvoiceWriterPanel user={user} dispatchId={row.id} label={row.dispatch_number || row.id} /></div> : <div className="w-full"><LegacyInvoiceDraftPanel user={user} dispatchId={row.id} label={row.dispatch_number || row.id} onIssued={load} /></div>}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-gray-700">Issued invoices and settlement</h2>
            {invoiceList.length === 0 ? <PageEmptyState iconPath={ICONS.money} title="No issued invoices" subtitle="Issued invoices will appear here for controlled payment settlement." /> : <div className="mt-3 space-y-3">{invoiceList.map((invoice) => <InvoiceSettlementPanel key={invoice.id} invoice={invoice} user={user} onChanged={load} />)}</div>}
          </section>
        </>
      )}
      <RecordAnalysisModal title="Purchase order evidence analysis" analysis={analysis} onClose={() => setAnalysis(null)} />
    </div>
  );
}
