import React, { useCallback, useEffect, useMemo, useState } from "react";
import { collections, quotes as quotesApi } from "../api/client.js";
import PageHeaderBanner from "../components/PageHeaderBanner.jsx";
import Modal from "../components/Modal.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { ICONS } from "../components/icons.jsx";
import { ErrorBanner, PageEmptyState } from "../components/PageStates.jsx";
import {
  EMPTY_QUOTE_LINE, formatAmount, buildCreateQuotePayload, buildUpdateQuotePayload, canApproveQuote, canSendQuote,
  lineTotal, prefillFromLead, quoteActionsFor, quoteTotal, validateQuoteForm
} from "../quoteModel.js";

// Sales quotation workflow: create a Draft (optionally starting from an
// accepted lead), edit its lines while still Draft, send it, or cancel it.
// Every write goes through the server (createQuote / updateQuote / cancelQuote
// / transition), which is the sole authority on the lifecycle, permissions
// and tenancy - this page only decides which buttons make sense to show.
//
// Two collections this workflow would benefit from - the priced catalog and
// equipment-tag labels - are not readable by the Sales role today
// (collectionGuards in coreController.js). Rather than widen that access to
// fill a lookup, every line here is a plain, manually-priced free-text line
// (catalog_item_id is always sent as null), and equipment context is limited
// to whatever the ID a lead already carries. See ROLE_OWNER_DECISIONS in the
// delivery packet, items #C-1 and #C-2.

const emptyForm = () => ({ client_id: "", equipment_tag_id: "", lines: [{ ...EMPTY_QUOTE_LINE }] });

export default function QuotationsPage({ user }) {
  const [quoteList, setQuoteList] = useState([]);
  const [lineItems, setLineItems] = useState([]);
  const [leads, setLeads] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");

  const [modalMode, setModalMode] = useState(""); // "" | "create" | "edit"
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState(emptyForm());
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [quotesData, linesData, leadsData, clientsData] = await Promise.all([
        collections.list("quotes"),
        collections.list("quote_lines"),
        collections.list("leads").catch(() => []),
        collections.list("clients")
      ]);
      setQuoteList(Array.isArray(quotesData) ? quotesData : []);
      setLineItems(Array.isArray(linesData) ? linesData : []);
      setLeads(Array.isArray(leadsData) ? leadsData : []);
      setClients(Array.isArray(clientsData) ? clientsData : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const clientName = useCallback((clientId) => clients.find((c) => c.id === clientId)?.name || clientId || "\u2014", [clients]);
  const linesFor = useCallback((quoteId) => lineItems.filter((line) => line.quotation_id === quoteId), [lineItems]);

  // A lead is a starting point for a new quote only while nothing here can
  // tell it has already been quoted (the backend has no lead_id on a quote -
  // see quoteModel.js prefillFromLead). It always remains available; picking
  // one only prefills the form.
  const openLeads = useMemo(() => leads.filter((lead) => lead.status === "New"), [leads]);

  function openCreate(lead) {
    setModalMode("create");
    setEditingId("");
    setForm(lead ? prefillFromLead(lead) : emptyForm());
    setFormError("");
  }

  function openEdit(quote) {
    setModalMode("edit");
    setEditingId(quote.id);
    setForm({
      client_id: quote.client_id || "",
      equipment_tag_id: quote.equipment_tag_id || "",
      lines: linesFor(quote.id).map((line) => ({ description: line.description, quantity: line.quantity, unit_price: line.unit_price })) || [{ ...EMPTY_QUOTE_LINE }]
    });
    setFormError("");
  }

  function closeModal() {
    setModalMode("");
    setEditingId("");
    setFormError("");
  }

  function updateLine(index, field, value) {
    setForm((current) => {
      const lines = current.lines.map((line, i) => (i === index ? { ...line, [field]: value } : line));
      return { ...current, lines };
    });
  }

  function addLine() {
    setForm((current) => ({ ...current, lines: [...current.lines, { ...EMPTY_QUOTE_LINE }] }));
  }

  function removeLine(index) {
    setForm((current) => ({ ...current, lines: current.lines.filter((_, i) => i !== index) }));
  }

  async function submitForm(event) {
    event.preventDefault();
    const message = validateQuoteForm(form);
    if (message) { setFormError(message); return; }
    setSaving(true);
    setFormError("");
    try {
      if (modalMode === "create") {
        await quotesApi.create(buildCreateQuotePayload(form));
        setNotice("Draft quotation created.");
      } else {
        await quotesApi.update(editingId, buildUpdateQuotePayload(form));
        setNotice("Draft quotation updated.");
      }
      closeModal();
      await load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function sendQuote(quote) {
    setBusyId(quote.id);
    setError("");
    setNotice("");
    try {
      await quotesApi.transition(quote.id, "Sent");
      setNotice(`${quote.quote_number || quote.id} was sent to the client.`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId("");
    }
  }

  async function cancelQuote(quote) {
    setBusyId(quote.id);
    setError("");
    setNotice("");
    try {
      await quotesApi.cancel(quote.id);
      setNotice(`${quote.quote_number || quote.id} was cancelled.`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId("");
    }
  }

  async function approveQuote(quote) {
    setBusyId(quote.id);
    setError("");
    setNotice("");
    try {
      await quotesApi.transition(quote.id, "Approved_Pending_PO");
      setNotice(`${quote.quote_number || quote.id} was approved.`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId("");
    }
  }

  const buttonClass = "rounded-md border px-3 py-1.5 text-sm font-semibold transition-colors disabled:opacity-50";

  return (
    <div className="space-y-6">
      <PageHeaderBanner
        eyebrow="Sales"
        title="Quotations"
        subtitle="Create, edit and send quotations. Once a quote is sent, only Operations, Finance or a different Sales colleague can approve it."
        iconPath={ICONS.document}
        aside={<button type="button" onClick={() => openCreate()} className="rounded-md border border-orac-blue bg-orac-blue px-3 py-2 text-sm font-semibold text-white hover:brightness-105">New quotation</button>}
      />

      {error && <ErrorBanner message={error} />}
      {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}

      {openLeads.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-700">Leads ready to quote</h2>
          <ul className="mt-3 space-y-2">
            {openLeads.map((lead) => (
              <li key={lead.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-gray-100 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-orac-slate">{lead.company_name || clientName(lead.client_id)}</p>
                  <p className="text-sm text-gray-600">{lead.service_need}</p>
                </div>
                <button type="button" onClick={() => openCreate(lead)} className={`${buttonClass} border-orac-blue text-orac-blue hover:bg-sky-50`}>Draft a quote</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-gray-400">Loading quotations...</div>
      ) : quoteList.length === 0 ? (
        !error && (
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
            <PageEmptyState iconPath={ICONS.document} title="No quotations yet" subtitle="Create a quotation to start the client-to-invoice flow, or draft one from a lead above." />
          </div>
        )
      ) : (
        <ul className="space-y-3">
          {quoteList
            .slice()
            .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))
            .map((quote) => {
              const actions = quoteActionsFor(quote);
              const lines = linesFor(quote.id);
              const total = quoteTotal(lines);
              const busy = busyId === quote.id;
              const showApprove = canApproveQuote(quote, user);
              return (
                <li key={quote.id} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold text-orac-slate">{quote.quote_number || quote.id}</h2>
                      <p className="text-sm text-gray-600">{clientName(quote.client_id)} · {lines.length} line{lines.length === 1 ? "" : "s"} · {formatAmount(quote.total_amount ?? total)}</p>
                    </div>
                    <StatusBadge status={quote.status} />
                  </div>

                  {(actions.canEdit || actions.canSend || actions.canCancel || showApprove) && (
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
                      {actions.canEdit && (
                        <button type="button" disabled={busy} onClick={() => openEdit(quote)} className={`${buttonClass} border-gray-300 text-orac-slate hover:bg-gray-50`}>Edit</button>
                      )}
                      {actions.canSend && (
                        <button type="button" disabled={busy || !canSendQuote(quote, lines.length)} onClick={() => sendQuote(quote)} className={`${buttonClass} border-orac-blue bg-orac-blue text-white hover:brightness-105`}>{busy ? "Working..." : "Send to client"}</button>
                      )}
                      {actions.canCancel && (
                        <button type="button" disabled={busy} onClick={() => cancelQuote(quote)} className={`${buttonClass} border-red-200 text-red-700 hover:bg-red-50`}>{busy ? "Working..." : "Cancel"}</button>
                      )}
                      {showApprove && (
                        <button type="button" disabled={busy} onClick={() => approveQuote(quote)} className={`${buttonClass} border-emerald-300 text-emerald-800 hover:bg-emerald-50`}>{busy ? "Working..." : "Approve"}</button>
                      )}
                      {quote.status === "Sent" && !showApprove && (
                        <p className="self-center text-xs text-gray-500">You sent this quote - a different Sales colleague, Operations, or Admin must approve it.</p>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
        </ul>
      )}

      <Modal title={modalMode === "create" ? "New quotation" : "Edit draft quotation"} isOpen={Boolean(modalMode)} onClose={closeModal}>
        <form onSubmit={submitForm} className="space-y-4">
          {formError && <ErrorBanner message={formError} />}

          <div>
            <label htmlFor="quote-client" className="mb-1 block text-sm font-semibold text-gray-700">Client</label>
            <select
              id="quote-client"
              value={form.client_id}
              disabled={modalMode === "edit"}
              onChange={(event) => setForm((current) => ({ ...current, client_id: event.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
            >
              <option value="">Select a client…</option>
              {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
            </select>
            {modalMode === "edit" && <p className="mt-1 text-xs text-gray-500">The client cannot be changed once a quotation is created.</p>}
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">Line items</span>
              <button type="button" onClick={addLine} className="text-xs font-semibold text-orac-blue hover:underline">+ Add line</button>
            </div>
            <p className="mb-2 text-xs text-gray-500">Manually priced lines only. Catalog pricing lookup is not yet available to Sales accounts.</p>
            <div className="space-y-2">
              {form.lines.map((line, index) => (
                <div key={index} className="flex flex-wrap items-start gap-2 rounded-md border border-gray-100 p-2">
                  <input type="text" placeholder="Description" value={line.description} onChange={(event) => updateLine(index, "description", event.target.value)} className="min-w-[10rem] flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
                  <input type="number" min="0" step="any" placeholder="Qty" value={line.quantity} onChange={(event) => updateLine(index, "quantity", event.target.value)} className="w-20 rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
                  <input type="number" min="0" step="any" placeholder="Unit price" value={line.unit_price} onChange={(event) => updateLine(index, "unit_price", event.target.value)} className="w-28 rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
                  <span className="pt-1.5 text-sm text-gray-600">{formatAmount(lineTotal(line))}</span>
                  {form.lines.length > 1 && (
                    <button type="button" onClick={() => removeLine(index)} className="pt-1.5 text-sm text-red-600 hover:underline">Remove</button>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-2 text-right text-sm font-semibold text-orac-slate">Total: {formatAmount(quoteTotal(form.lines))}</p>
          </div>

          <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
            <button type="button" onClick={closeModal} className={`${buttonClass} border-gray-300 text-orac-slate hover:bg-gray-50`}>Cancel</button>
            <button type="submit" disabled={saving} className={`${buttonClass} border-orac-blue bg-orac-blue text-white hover:brightness-105`}>{saving ? "Saving..." : modalMode === "create" ? "Create draft" : "Save changes"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
