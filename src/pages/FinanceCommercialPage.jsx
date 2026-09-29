import React, { useCallback, useEffect, useMemo, useState } from "react";
import { collections, purchaseOrders as poApi, quotes as quotesApi, reports } from "../api/client.js";
import PageHeaderBanner from "../components/PageHeaderBanner.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { ICONS } from "../components/icons.jsx";
import { ErrorBanner, PageEmptyState } from "../components/PageStates.jsx";
import { formatAmount } from "../quoteModel.js";
import {
  EMPTY_AMENDMENT_FORM, EMPTY_VERIFY_FORM, buildAmendmentPayload, buildVerifyPoPayload, canApproveAmendment,
  canVerifyPo, shouldTransitionAfterVerify, validateAmendmentForm, validateVerifyPoForm
} from "../financeModel.js";

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

export default function FinanceCommercialPage() {
  const [pos, setPos] = useState([]);
  const [quoteList, setQuoteList] = useState([]);
  const [clients, setClients] = useState([]);
  const [ready, setReady] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");
  const [openKey, setOpenKey] = useState(""); // "verify:<poId>" | "amend:<poId>"
  const [verifyForm, setVerifyForm] = useState({ ...EMPTY_VERIFY_FORM });
  const [amendForm, setAmendForm] = useState({ ...EMPTY_AMENDMENT_FORM });
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [poData, quoteData, clientData, readyData] = await Promise.all([
        collections.list("purchase_orders"),
        collections.list("quotes"),
        collections.list("clients"),
        reports.get("invoice-ready")
      ]);
      setPos(Array.isArray(poData) ? poData : []);
      setQuoteList(Array.isArray(quoteData) ? quoteData : []);
      setClients(Array.isArray(clientData) ? clientData : []);
      setReady(Array.isArray(readyData) ? readyData : []);
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

  function submitAmendment(event, po) {
    event.preventDefault();
    const message = validateAmendmentForm(amendForm, po.po_amount);
    if (message) { setFormError(message); return; }
    return runAction(po.id, () => poApi.approveAmendment(po.id, buildAmendmentPayload(amendForm)), `Amendment approved for PO ${po.po_reference || po.id}.`);
  }

  function invoice(row) {
    return runAction(row.id, () => quotesApi.transition(row.quotation_id, "Invoiced"), `${quoteLabel(row.quotation_id)} was invoiced.`);
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
                              <button type="button" onClick={closeForm} className={`${buttonClass} border-gray-300 text-orac-slate`}>Cancel</button>
                            </div>
                          </form>
                        ) : (
                          <button type="button" onClick={() => openVerify(po)} className={`${buttonClass} mt-3 border-orac-blue text-orac-blue hover:bg-sky-50`}>Review and verify</button>
                        )
                      ) : (
                        <p className="mt-2 text-xs text-gray-500">This PO cannot be verified yet: its quote must be approved and awaiting a PO.</p>
                      )}
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
                  const open = openKey === `amend:${po.id}`;
                  const busy = busyId === po.id;
                  return (
                    <li key={po.id} className="rounded-md border border-amber-200 bg-amber-50 p-3">
                      <p className="text-sm font-medium text-orac-slate">{po.po_reference || po.id} {"\u00b7"} {quoteLabel(po.quotation_id)}</p>
                      <p className="text-sm text-gray-700">PO amount {formatAmount(po.po_amount)} {"\u00b7"} logged work {formatAmount(po.logged_value)}</p>
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
                    <button type="button" disabled={busyId === row.id} onClick={() => invoice(row)} className={`${buttonClass} border-emerald-300 text-emerald-800 hover:bg-emerald-50`}>{busyId === row.id ? "Invoicing..." : "Create invoice"}</button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
