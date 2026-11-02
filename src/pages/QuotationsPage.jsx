import React, { useCallback, useEffect, useMemo, useState } from "react";
import { admin, assistant, collections, documents, quotes as quotesApi } from "../api/client.js";
import PageHeaderBanner from "../components/PageHeaderBanner.jsx";
import Modal from "../components/Modal.jsx";
import RecordAnalysisModal from "../components/RecordAnalysisModal.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { ICONS } from "../components/icons.jsx";
import { ErrorBanner, PageEmptyState, PageLoadingSkeleton } from "../components/PageStates.jsx";
import { v5CommercialEnabled } from "../v5CommercialFlags.js";
import { recordAnalysisVisible } from "../recordAnalysisFlags.js";
import {
  EMPTY_QUOTE_LINE, formatAmount, formatUSD, buildCreateQuotePayload, buildUpdateQuotePayload, canApproveQuote, canDispatchQuote, canSendQuote,
  lineTotal, prefillFromLead, quoteActionsFor, quoteTotal, validateQuoteForm,
  CANONICAL_UNITS_OF_MEASURE, COST_TYPES, ITEM_TYPES, TAX_STATUSES, PROVISIONAL_VAT_NOTICE, calculateQuoteBreakdown
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

const emptyForm = () => ({
  client_id: "",
  equipment_tag_id: "",
  currency: "USD",
  tax_status: "provisional",
  applied_tax_rate: 0.15,
  discount_percent: 0,
  validity_days: 30,
  scope_summary: "",
  assumptions: "",
  work_packages: [{ id: "wp_01", code: "WP-01", title: "General Scope", name: "General Scope", sequence: 1 }],
  lines: [{ ...EMPTY_QUOTE_LINE }]
});

function QuoteEvidenceSummary({ quote, clientName }) {
  const acceptance = quote.amended_po_evidence;
  return (
    <dl className="mt-4 grid gap-x-4 gap-y-2 border-t border-orac-border-default pt-3 text-xs text-orac-text-secondary sm:grid-cols-2" data-evidence="quote-summary">
      <div><dt className="font-medium text-orac-text-primary">Quote record</dt><dd>{quote.id}</dd></div>
      <div><dt className="font-medium text-orac-text-primary">Client record</dt><dd>{clientName(quote.client_id)}</dd></div>
      {quote.revision_of_quote_id && <div><dt className="font-medium text-orac-text-primary">Revision of</dt><dd>{quote.revision_of_quote_id}</dd></div>}
      {acceptance && <div><dt className="font-medium text-orac-text-primary">Client acceptance evidence</dt><dd>{acceptance.evidence_reference || "Reference not recorded"}{acceptance.accepted_on ? ` on ${acceptance.accepted_on}` : ""}</dd></div>}
      {quote.commercial_acceptance_status && <div><dt className="font-medium text-orac-text-primary">Commercial state</dt><dd>{quote.commercial_acceptance_status.replaceAll("_", " ")}</dd></div>}
      {!quote.revision_of_quote_id && !acceptance && !quote.commercial_acceptance_status && <div><dt className="font-medium text-orac-text-primary">Evidence position</dt><dd>No revision or client-acceptance evidence recorded on this quote.</dd></div>}
    </dl>
  );
}

export default function QuotationsPage({ user }) {
  const [quoteList, setQuoteList] = useState([]);
  const [lineItems, setLineItems] = useState([]);
  const [leads, setLeads] = useState([]);
  const [clients, setClients] = useState([]);
  const [companyProfile, setCompanyProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");

  const [modalMode, setModalMode] = useState(""); // "" | "create" | "edit"
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState(emptyForm());
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [revisionQuote, setRevisionQuote] = useState(null);
  const [revisionReason, setRevisionReason] = useState("");
  const [revisionError, setRevisionError] = useState("");
  const [acceptanceQuote, setAcceptanceQuote] = useState(null);
  const [acceptance, setAcceptance] = useState({ evidence_reference: "", evidence_channel: "amended_po", accepted_on: "", notes: "" });
  const [acceptanceError, setAcceptanceError] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [analysisError, setAnalysisError] = useState("");
  const [analysisBusyId, setAnalysisBusyId] = useState("");
  const [approvalExceptionQuote, setApprovalExceptionQuote] = useState(null);
  const [approvalExceptionReason, setApprovalExceptionReason] = useState("");
  const [approvalExceptionError, setApprovalExceptionError] = useState("");
  const [filterMode, setFilterMode] = useState("all");
  const isManagement = user?.role === "Management";
  const v5Visible = v5CommercialEnabled() && ["Sales", "Admin"].includes(user.role);
  const analysisVisible = recordAnalysisVisible();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [quotesData, linesData, leadsData, clientsData, profileData] = await Promise.all([
        collections.list("quotes"),
        collections.list("quote_lines"),
        collections.list("leads").catch(() => []),
        collections.list("clients"),
        admin.getCompanyProfile().catch(() => null)
      ]);
      setQuoteList(Array.isArray(quotesData) ? quotesData : []);
      setLineItems(Array.isArray(linesData) ? linesData : []);
      setLeads(Array.isArray(leadsData) ? leadsData : []);
      setClients(Array.isArray(clientsData) ? clientsData : []);
      setCompanyProfile(profileData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const clientName = useCallback((clientId) => clients.find((c) => c.id === clientId)?.name || clientId || "\u2014", [clients]);
  const linesFor = useCallback((quoteId) => lineItems.filter((line) => line.quotation_id === quoteId), [lineItems]);
  const quoteTaxPreview = useMemo(() => {
    const configuration = companyProfile?.quotation_tax_configuration;
    if (configuration?.approved) {
      return {
        status: configuration.tax_status,
        rate: configuration.applied_tax_rate,
        approved: true
      };
    }
    return {
      status: form.tax_status || "provisional",
      rate: form.applied_tax_rate,
      approved: false
    };
  }, [companyProfile, form.applied_tax_rate, form.tax_status]);

  // A lead is a starting point for a new quote only while nothing here can
  // tell it has already been quoted (the backend has no lead_id on a quote -
  // see quoteModel.js prefillFromLead). It always remains available; picking
  // one only prefills the form.
  const openLeads = useMemo(() => leads.filter((lead) => lead.status === "New"), [leads]);

  function openCreate(lead) {
    setModalMode("create");
    setEditingId("");
    if (lead) {
      const prefilled = prefillFromLead(lead);
      setForm({
        ...emptyForm(),
        client_id: prefilled.client_id,
        equipment_tag_id: prefilled.equipment_tag_id,
        lines: prefilled.lines.map((l) => ({ ...EMPTY_QUOTE_LINE, ...l }))
      });
    } else {
      setForm(emptyForm());
    }
    setFormError("");
  }

  function openEdit(quote) {
    setModalMode("edit");
    setEditingId(quote.id);
    const existingLines = linesFor(quote.id);
    setForm({
      client_id: quote.client_id || "",
      equipment_tag_id: quote.equipment_tag_id || "",
      currency: quote.currency || "USD",
      tax_status: quote.tax_status || "provisional",
      applied_tax_rate: quote.applied_tax_rate ?? 0.15,
      discount_percent: quote.discount_percent || 0,
      validity_days: quote.validity_days || 30,
      scope_summary: quote.scope_summary || "",
      assumptions: quote.assumptions || "",
      work_packages: quote.work_packages && quote.work_packages.length > 0 ? quote.work_packages.map((wp) => ({ ...wp, title: wp.title || wp.name, name: wp.name || wp.title })) : [{ id: "wp_01", code: "WP-01", title: "General Scope", name: "General Scope", sequence: 1 }],
      lines: existingLines.length > 0 ? existingLines.map((line) => ({
        description: line.description || "",
        quantity: line.quantity ?? 1,
        unit_price: line.unit_price ?? 0,
        unit_of_measure: line.unit_of_measure || "each",
        cost_type: line.cost_type || "material",
        resource_role: line.resource_role || "",
        work_package_id: line.work_package_id || "wp_01",
        item_type: line.item_type || "standard"
      })) : [{ ...EMPTY_QUOTE_LINE }]
    });
    setFormError("");
  }

  function closeModal() {
    setModalMode("");
    setEditingId("");
    setFormError("");
  }

  function openRevision(quote) {
    setRevisionQuote(quote);
    setRevisionReason("");
    setRevisionError("");
  }

  async function createRevision(event) {
    event.preventDefault();
    if (revisionReason.trim().length < 3) { setRevisionError("Give a short reason for the revision."); return; }
    setSaving(true); setRevisionError("");
    try {
      const lines = linesFor(revisionQuote.id).map((line) => ({
        description: line.description,
        quantity: Number(line.quantity),
        unit_price: Number(line.unit_price),
        pricing_basis: line.pricing_basis || "hourly",
        planned_hours: line.planned_hours ?? null,
        materials_included: Boolean(line.materials_included)
      }));
      await quotesApi.createRevision(revisionQuote.id, { reason: revisionReason.trim(), lines });
      setNotice("Quotation revision created as a new draft.");
      setRevisionQuote(null);
      await load();
    } catch (err) { setRevisionError(err.message); } finally { setSaving(false); }
  }

  async function recordAcceptance(event) {
    event.preventDefault();
    if (acceptance.evidence_reference.trim().length < 3 || !acceptance.accepted_on) { setAcceptanceError("Evidence reference and acceptance date are required."); return; }
    setSaving(true); setAcceptanceError("");
    try {
      await quotesApi.recordAmendedPoEvidence(acceptanceQuote.id, { ...acceptance, evidence_reference: acceptance.evidence_reference.trim(), notes: acceptance.notes.trim() || undefined });
      setNotice("Client acceptance evidence was recorded.");
      setAcceptanceQuote(null);
      await load();
    } catch (err) { setAcceptanceError(err.message); } finally { setSaving(false); }
  }

  function updateLine(index, field, value) {
    setForm((current) => {
      const lines = current.lines.map((line, i) => (i === index ? { ...line, [field]: value } : line));
      return { ...current, lines };
    });
  }

  function addWorkPackage() {
    const nextNum = form.work_packages.length + 1;
    const nextId = `wp_${String(nextNum).padStart(2, "0")}`;
    setForm((current) => ({
      ...current,
      work_packages: [...current.work_packages, { id: nextId, code: `WP-${String(nextNum).padStart(2, "0")}`, title: `Work Package ${nextNum}`, name: `Work Package ${nextNum}`, sequence: nextNum }]
    }));
  }

  function updateWorkPackage(id, val) {
    setForm((current) => ({
      ...current,
      work_packages: current.work_packages.map((wp) => (wp.id === id ? { ...wp, title: val, name: val } : wp))
    }));
  }

  function addLine(wpId) {
    const defaultWp = wpId || form.work_packages[0]?.id || "wp_01";
    setForm((current) => ({
      ...current,
      lines: [...current.lines, { ...EMPTY_QUOTE_LINE, work_package_id: defaultWp }]
    }));
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

  async function approveQuote(quote, approvalExceptionReason = "") {
    setBusyId(quote.id);
    setError("");
    setNotice("");
    try {
      if (approvalExceptionReason) {
        await quotesApi.transition(quote.id, "Approved_Pending_PO", { approval_exception_reason: approvalExceptionReason });
      } else {
        await quotesApi.transition(quote.id, "Approved_Pending_PO");
      }
      setNotice(`${quote.quote_number || quote.id} was approved.`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId("");
    }
  }

  function requestApproval(quote) {
    if (user.role === "Admin" && quote.sent_by === user.id) {
      setApprovalExceptionQuote(quote);
      setApprovalExceptionReason("");
      setApprovalExceptionError("");
      return;
    }
    approveQuote(quote);
  }

  async function submitApprovalException(event) {
    event.preventDefault();
    const reason = approvalExceptionReason.trim();
    if (reason.length < 10) {
      setApprovalExceptionError("Record why Sales could not complete this approval (at least 10 characters).");
      return;
    }
    const quote = approvalExceptionQuote;
    setApprovalExceptionQuote(null);
    await approveQuote(quote, reason);
  }

  
  async function dispatchQuote(quote) {
    setBusyId(quote.id);
    setError("");
    setNotice("");
    try {
      await quotesApi.transition(quote.id, "Field_Dispatch");
      setNotice(`${quote.quote_number || quote.id} was dispatched to the field.`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId("");
    }
  }

  async function analyzeQuote(quote) {
    setAnalysisBusyId(quote.id);
    setAnalysisError("");
    try {
      setAnalysis(await assistant.recordAnalysis("quote", quote.id));
    } catch (err) {
      setAnalysisError(err.message);
    } finally {
      setAnalysisBusyId("");
    }
  }

  const requiresManagementApproval = (q) => {
    const totalCents = Number.isInteger(q.grand_total_cents) ? q.grand_total_cents : Math.round(Number(q.total_amount || 0) * 100);
    const hasDiscount = Number(q.discount_percent || 0) > 0;
    return totalCents > 500000 || hasDiscount;
  };

  const displayedQuotes = quoteList.filter((q) => {
    if (isManagement && filterMode === "pending_management") {
      return q.status === "Sent" && requiresManagementApproval(q);
    }
    return true;
  });

  const buttonClass = "inline-flex min-h-11 items-center justify-center rounded-md border px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-50";

  return (
    <div className="space-y-6">
      <PageHeaderBanner
        eyebrow="Sales"
        title="Quotations"
        subtitle="Create, edit and send quotations. Once a quote is sent, only Management, an independent Sales colleague, or Admin fallback can approve it."
        iconPath={ICONS.document}
        aside={<button type="button" onClick={() => openCreate()} className="inline-flex min-h-11 items-center justify-center rounded-md border border-orac-blue bg-orac-blue px-3 py-2 text-sm font-semibold text-white hover:brightness-105">New quotation</button>}
      />

      {error && <ErrorBanner message={error} />}
      {analysisError && <ErrorBanner message={analysisError} />}
      {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}

      {isManagement && (
        <div className="flex gap-2 border-b border-orac-border-default pb-3" data-testid="management-quote-filter">
          <button
            type="button"
            onClick={() => setFilterMode("all")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold ${filterMode === "all" ? "bg-orac-blue text-white" : "border border-gray-300 bg-white text-orac-slate hover:bg-gray-50 dark:bg-slate-800 dark:text-slate-200"}`}
          >
            All quotations
          </button>
          <button
            type="button"
            onClick={() => setFilterMode("pending_management")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold ${filterMode === "pending_management" ? "bg-orac-blue text-white" : "border border-gray-300 bg-white text-orac-slate hover:bg-gray-50 dark:bg-slate-800 dark:text-slate-200"}`}
          >
            Pending Management Approval (&gt; $5,000 / Discounted)
          </button>
        </div>
      )}

      {openLeads.length > 0 && (
        <div className="rounded-lg border border-orac-border-default bg-orac-surface p-5 shadow-sm">
          <h2 className="text-base font-semibold text-orac-text-primary">Leads ready to quote</h2>
          <ul className="mt-3 space-y-2">
            {openLeads.map((lead) => (
              <li key={lead.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-orac-border-default bg-orac-surface-muted px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-orac-slate">{lead.company_name || clientName(lead.client_id)}</p>
                  <p className="text-sm text-orac-text-secondary">{lead.service_need}</p>
                </div>
                <button type="button" onClick={() => openCreate(lead)} className={`${buttonClass} border-orac-blue text-orac-blue hover:bg-sky-50`}>Draft a quote</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {loading ? (
        <PageLoadingSkeleton label="Loading quotations" />
      ) : quoteList.length === 0 ? (
        !error && (
          <div className="rounded-lg border border-orac-border-default bg-orac-surface shadow-sm">
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
              const showDispatch = canDispatchQuote(quote, user);
              return (
                <li key={quote.id} className="rounded-lg border border-orac-border-default bg-orac-surface p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold text-orac-slate">{quote.quote_number || quote.id}</h2>
                      <p className="text-sm text-orac-text-secondary">{clientName(quote.client_id)} · {lines.length} line{lines.length === 1 ? "" : "s"} · USD {formatAmount(quote.total_amount ?? total)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => documents.download("quotes", quote.id)}
                        className="inline-flex min-h-11 items-center justify-center rounded border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-orac-slate hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        Download PDF
                      </button>
                      <StatusBadge status={quote.status} />
                    </div>
                  </div>
                  <QuoteEvidenceSummary quote={quote} clientName={clientName} />

                  {(actions.canEdit || actions.canSend || actions.canCancel || showApprove || showDispatch) && (
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-orac-border-default pt-4">
                      {actions.canEdit && (
                        <button type="button" disabled={busy} onClick={() => openEdit(quote)} className={`${buttonClass} border-gray-300 text-orac-slate hover:bg-gray-50`}>Edit</button>
                      )}
                      {actions.canSend && (
                        <button type="button" disabled={busy || !canSendQuote(quote, lines.length)} onClick={() => sendQuote(quote)} className={`${buttonClass} border-orac-blue bg-orac-blue text-white hover:brightness-105`}>{busy ? "Working..." : "Send to client"}</button>
                      )}
                      {actions.canCancel && (
                        <button type="button" disabled={busy} onClick={() => cancelQuote(quote)} className={`${buttonClass} border-red-200 text-red-700 hover:bg-red-50`}>{busy ? "Working..." : "Cancel"}</button>
                      )}
                      {showDispatch && (
                        <button type="button" disabled={busy} onClick={() => dispatchQuote(quote)} className={`${buttonClass} border-orac-blue bg-orac-blue text-white hover:brightness-105`}>{busy ? "Working..." : "Dispatch to field"}</button>
                      )}
                      {showApprove && (
                        <button type="button" disabled={busy} onClick={() => requestApproval(quote)} className={`${buttonClass} border-emerald-300 text-emerald-800 hover:bg-emerald-50`}>{busy ? "Working..." : "Approve"}</button>
                      )}
                      {v5Visible && quote.status !== "Cancelled" && (
                        <button type="button" disabled={busy} onClick={() => openRevision(quote)} className={`${buttonClass} border-orac-blue text-orac-blue hover:bg-sky-50`}>Revise quotation</button>
                      )}
                      {v5Visible && quote.revision_of_quote_id && (
                        <button type="button" disabled={busy} onClick={() => { setAcceptanceQuote(quote); setAcceptance({ evidence_reference: "", evidence_channel: "amended_po", accepted_on: "", notes: "" }); setAcceptanceError(""); }} className={`${buttonClass} border-amber-300 text-amber-900 hover:bg-amber-50`}>Record client acceptance</button>
                      )}
                      {analysisVisible && (
                        <button type="button" disabled={analysisBusyId === quote.id} onClick={() => analyzeQuote(quote)} className={`${buttonClass} border-gray-300 text-orac-slate hover:bg-gray-50`}>{analysisBusyId === quote.id ? "Analyzing..." : "Analyze evidence"}</button>
                      )}
                      {quote.status === "Sent" && !showApprove && (
                        <p className="self-center text-xs text-gray-500">
                          {quote.sent_by && quote.sent_by === user.id
                            ? "You sent this quote - a different Sales colleague, Management, or Admin fallback must approve it."
                            : "Quotations exceeding USD $5,000 or containing commercial discounts require Management approval."}
                        </p>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
        </ul>
      )}

      <Modal title={modalMode === "create" ? "New quotation" : "Edit draft quotation"} isOpen={Boolean(modalMode)} onClose={closeModal} size="xl">
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

          {/* Commercial & Scope Settings */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="quote-scope" className="mb-1 block text-sm font-semibold text-gray-700">Scope summary</label>
              <textarea
                id="quote-scope"
                rows={2}
                placeholder="Scope of work overview..."
                value={form.scope_summary || ""}
                onChange={(e) => setForm((cur) => ({ ...cur, scope_summary: e.target.value }))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="quote-assumptions" className="mb-1 block text-sm font-semibold text-gray-700">Assumptions & exclusions</label>
              <textarea
                id="quote-assumptions"
                rows={2}
                placeholder="Key assumptions, site escort, permits..."
                value={form.assumptions || ""}
                onChange={(e) => setForm((cur) => ({ ...cur, assumptions: e.target.value }))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid gap-3 rounded-lg border border-gray-100 bg-gray-50/70 p-3 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Currency</label>
              <div className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-orac-slate">USD ($)</div>
            </div>
            <div>
              <label htmlFor="quote-validity" className="mb-1 block text-xs font-medium text-gray-600">Validity (days)</label>
              <input
                id="quote-validity"
                type="number"
                min="1"
                value={form.validity_days || 30}
                onChange={(e) => setForm((cur) => ({ ...cur, validity_days: Number(e.target.value) || 30 }))}
                className="w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs"
              />
            </div>
            <div>
              <label htmlFor="quote-discount" className="mb-1 block text-xs font-medium text-gray-600">Discount (%)</label>
              <input
                id="quote-discount"
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={form.discount_percent || 0}
                onChange={(e) => setForm((cur) => ({ ...cur, discount_percent: Number(e.target.value) || 0 }))}
                className="w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs"
              />
            </div>
            <div>
              <label htmlFor="quote-tax" className="mb-1 block text-xs font-medium text-gray-600">Tax treatment</label>
              <select
                id="quote-tax"
                value={quoteTaxPreview.status}
                onChange={(e) => setForm((cur) => ({ ...cur, tax_status: e.target.value }))}
                disabled={quoteTaxPreview.approved}
                className="w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs"
              >
                <option value="provisional">Provisional development fixture (15%)</option>
                <option value="taxable" disabled>Taxable (rate set by approved company configuration)</option>
                <option value="zero-rated">Zero-Rated (0%)</option>
                <option value="exempt">Exempt (0%)</option>
                <option value="unconfigured">Unconfigured</option>
              </select>
            </div>
          </div>

          {quoteTaxPreview.approved ? (
            <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs text-sky-900">
              <span className="font-semibold">Controlled tax preview:</span> using the current approved company configuration. The server recalculates it immediately before issue.
            </div>
          ) : (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
              <span className="font-semibold">Indicative preview only:</span> {PROVISIONAL_VAT_NOTICE} The server determines the controlled tax treatment before issue.
            </div>
          )}

          {/* Work Packages Management */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-700">Work packages</span>
              <button type="button" onClick={addWorkPackage} className="text-xs font-semibold text-orac-blue hover:underline">+ Add work package</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(form.work_packages || []).map((wp) => (
                <div key={wp.id} className="flex items-center gap-1.5 rounded border border-gray-200 bg-white px-2 py-1 text-xs">
                  <span className="font-mono text-[10px] text-gray-400">{wp.id}:</span>
                  <input
                    type="text"
                    aria-label={`Work package name ${wp.id}`}
                    value={wp.title || wp.name || ""}
                    onChange={(e) => updateWorkPackage(wp.id, e.target.value)}
                    className="w-32 rounded border-0 p-0 text-xs font-medium text-gray-700 focus:ring-0"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Line items table */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">Structured line items</span>
              <button type="button" onClick={() => addLine()} className="text-xs font-semibold text-orac-blue hover:underline">+ Add line</button>
            </div>
            <p className="mb-2 text-xs text-gray-500">Assign lines to work packages with cost type, resource role, and approved units of measure.</p>
            <div className="space-y-2">
              {form.lines.map((line, index) => (
                <div key={index} className="grid gap-3 rounded-lg border border-gray-200 bg-white p-3 sm:grid-cols-6 sm:items-center">
                  <div className="sm:col-span-2">
                    <select
                      value={line.work_package_id || "wp_01"}
                      onChange={(e) => updateLine(index, "work_package_id", e.target.value)}
                      className="w-full rounded border border-gray-300 px-2 py-2 text-sm"
                      title="Work package"
                      aria-label={`Line ${index + 1} work package`}
                    >
                      {(form.work_packages || []).map((wp) => (
                        <option key={wp.id} value={wp.id}>{wp.title || wp.name || wp.id}</option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <select
                      value={line.cost_type || "material"}
                      onChange={(e) => updateLine(index, "cost_type", e.target.value)}
                      className="w-full rounded border border-gray-300 px-2 py-2 text-sm"
                      title="Cost type"
                      aria-label={`Line ${index + 1} cost type`}
                    >
                      {COST_TYPES.map((ct) => (
                        <option key={ct} value={ct}>{ct}</option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <input
                      type="text"
                      placeholder="Role / Resource"
                      value={line.resource_role || ""}
                      onChange={(e) => updateLine(index, "resource_role", e.target.value)}
                      className="w-full rounded border border-gray-300 px-2 py-2 text-sm"
                      title="Resource role or generic trade"
                      aria-label={`Line ${index + 1} resource role`}
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <input
                      type="text"
                      placeholder="Description"
                      aria-label={`Line ${index + 1} description`}
                      value={line.description}
                      onChange={(e) => updateLine(index, "description", e.target.value)}
                      className="w-full rounded border border-gray-300 px-2 py-2 text-sm"
                    />
                  </div>
                  <div className="sm:col-span-1">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="Qty"
                      aria-label={`Line ${index + 1} quantity`}
                      value={line.quantity}
                      onChange={(e) => updateLine(index, "quantity", e.target.value)}
                      className="w-full rounded border border-gray-300 px-2 py-2 text-sm"
                    />
                  </div>
                  <div className="sm:col-span-1">
                    <select
                      value={line.unit_of_measure || "each"}
                      onChange={(e) => updateLine(index, "unit_of_measure", e.target.value)}
                      className="w-full rounded border border-gray-300 px-2 py-2 text-sm"
                      title="Unit of measure"
                      aria-label={`Line ${index + 1} unit of measure`}
                    >
                      {CANONICAL_UNITS_OF_MEASURE.map((uom) => (
                        <option key={uom} value={uom}>{uom}</option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-1">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Rate"
                      value={line.unit_price}
                      onChange={(e) => updateLine(index, "unit_price", e.target.value)}
                      className="w-full rounded border border-gray-300 px-2 py-2 text-sm"
                      title="Unit price (USD)"
                      aria-label={`Line ${index + 1} unit price in USD`}
                    />
                  </div>
                  <div className="flex items-center justify-between sm:col-span-6 sm:justify-end sm:gap-3">
                    <span className="text-xs font-semibold text-gray-600">Line: {formatUSD(lineTotal(line))}</span>
                    {form.lines.length > 1 && (
                      <button type="button" onClick={() => removeLine(index)} className="text-xs text-red-600 hover:underline">Remove</button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Commercial Breakdown Summary */}
            {(() => {
              const breakdown = calculateQuoteBreakdown(form.lines, form.discount_percent, quoteTaxPreview.status, quoteTaxPreview.rate);
              const requiresMgmt = breakdown.grandTotal > 5000 || Number(form.discount_percent) > 0;
              return (
                <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between text-gray-600">
                      <span>Subtotal (excl. VAT):</span>
                      <span className="font-medium text-gray-800">{formatUSD(breakdown.preTax)}</span>
                    </div>
                    {Number(form.discount_percent) > 0 && (
                      <>
                        <div className="flex justify-between text-emerald-700">
                          <span>Discount ({form.discount_percent}%):</span>
                          <span className="font-medium">-{formatUSD(breakdown.discount)}</span>
                        </div>
                        <div className="flex justify-between text-gray-600">
                          <span>Net Subtotal:</span>
                          <span className="font-medium text-gray-800">{formatUSD(breakdown.netSubtotal)}</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between text-gray-600">
                      <span>
                        VAT {quoteTaxPreview.status === "provisional"
                          ? "(15% provisional development fixture)"
                          : quoteTaxPreview.status === "taxable"
                            ? "(approved company configuration)"
                            : quoteTaxPreview.status === "zero-rated" ? "(Zero-Rated)"
                              : quoteTaxPreview.status === "exempt" ? "(Exempt)" : "(Unconfigured)"}:
                      </span>
                      <span className="font-medium text-gray-800">{formatUSD(breakdown.tax)}</span>
                    </div>
                    <div className="flex justify-between border-t border-gray-300 pt-1 text-sm font-bold text-orac-slate">
                      <span>Grand Total (USD):</span>
                      <span>{formatUSD(breakdown.grandTotal)}</span>
                    </div>
                  </div>
                  {requiresMgmt && (
                    <p className="mt-2 text-xs font-medium text-amber-800">
                      ⚠️ Approval note: This quotation will require Management/Director approval ({breakdown.grandTotal > 5000 && Number(form.discount_percent) > 0 ? "exceeds USD $5,000 and has commercial discount" : breakdown.grandTotal > 5000 ? "exceeds USD $5,000" : "has commercial discount"}).
                    </p>
                  )}
                </div>
              );
            })()}
          </div>

          <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
            <button type="button" onClick={closeModal} className={`${buttonClass} border-gray-300 text-orac-slate hover:bg-gray-50`}>Cancel</button>
            <button type="submit" disabled={saving} className={`${buttonClass} border-orac-blue bg-orac-blue text-white hover:brightness-105`}>{saving ? "Saving..." : modalMode === "create" ? "Create draft" : "Save changes"}</button>
          </div>
        </form>
      </Modal>

      <Modal title="Record Admin fallback approval" isOpen={Boolean(approvalExceptionQuote)} onClose={() => setApprovalExceptionQuote(null)}>
        <form onSubmit={submitApprovalException} className="space-y-4">
          <p className="text-sm text-orac-text-secondary">Use this exception only when Sales cannot complete the approval. Your reason is retained in the quotation audit trail.</p>
          {approvalExceptionError && <ErrorBanner message={approvalExceptionError} />}
          <div>
            <label htmlFor="approval-exception-reason" className="mb-1 block text-sm font-medium text-orac-text-primary">Fallback reason</label>
            <textarea id="approval-exception-reason" required minLength="10" rows="4" value={approvalExceptionReason} onChange={(event) => setApprovalExceptionReason(event.target.value)} className="w-full rounded-md border border-orac-border-strong bg-orac-surface px-3 py-2 text-sm text-orac-text-primary" placeholder="Why cannot Sales complete the approval?" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setApprovalExceptionQuote(null)} className={`${buttonClass} border-gray-300 text-orac-slate hover:bg-gray-50`}>Cancel</button>
            <button type="submit" className={`${buttonClass} border-emerald-300 bg-emerald-500 text-white hover:brightness-105`}>Approve with recorded fallback</button>
          </div>
        </form>
      </Modal>

      <Modal title="Revise quotation" isOpen={Boolean(revisionQuote)} onClose={() => setRevisionQuote(null)}>
        <form onSubmit={createRevision} className="space-y-4">
          {revisionError && <ErrorBanner message={revisionError} />}
          <p className="text-sm text-gray-600">A revision keeps the original quotation unchanged and creates a new commercial draft using its current line items.</p>
          <label className="block text-sm font-semibold text-gray-700">Reason for revision
            <textarea value={revisionReason} onChange={(event) => setRevisionReason(event.target.value)} className="mt-1 min-h-24 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </label>
          <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">{revisionQuote && `${linesFor(revisionQuote.id).length} existing line item(s) will be copied. Pricing basis defaults to hourly until the quotation editor is extended.`}</div>
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setRevisionQuote(null)} className={`${buttonClass} border-gray-300 text-orac-slate hover:bg-gray-50`}>Cancel</button><button type="submit" disabled={saving} className={`${buttonClass} border-orac-blue bg-orac-blue text-white hover:brightness-105`}>{saving ? "Creating..." : "Create revision"}</button></div>
        </form>
      </Modal>

      <RecordAnalysisModal title="Quote evidence analysis" analysis={analysis} onClose={() => setAnalysis(null)} />

      <Modal title="Record client acceptance" isOpen={Boolean(acceptanceQuote)} onClose={() => setAcceptanceQuote(null)}>
        <form onSubmit={recordAcceptance} className="space-y-4">
          {acceptanceError && <ErrorBanner message={acceptanceError} />}
          <p className="text-sm text-gray-600">Record the amended PO or written client acceptance received by Sales. This does not create an invoice.</p>
          <label className="block text-sm font-semibold text-gray-700">Evidence reference<input value={acceptance.evidence_reference} onChange={(event) => setAcceptance((value) => ({ ...value, evidence_reference: event.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" /></label>
          <label className="block text-sm font-semibold text-gray-700">Evidence type<select value={acceptance.evidence_channel} onChange={(event) => setAcceptance((value) => ({ ...value, evidence_channel: event.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"><option value="amended_po">Amended PO</option><option value="written_acceptance">Written acceptance</option></select></label>
          <label className="block text-sm font-semibold text-gray-700">Acceptance date<input type="date" value={acceptance.accepted_on} onChange={(event) => setAcceptance((value) => ({ ...value, accepted_on: event.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" /></label>
          <label className="block text-sm font-semibold text-gray-700">Notes (optional)<textarea value={acceptance.notes} onChange={(event) => setAcceptance((value) => ({ ...value, notes: event.target.value }))} className="mt-1 min-h-20 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" /></label>
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setAcceptanceQuote(null)} className={`${buttonClass} border-gray-300 text-orac-slate hover:bg-gray-50`}>Cancel</button><button type="submit" disabled={saving} className={`${buttonClass} border-orac-blue bg-orac-blue text-white hover:brightness-105`}>{saving ? "Saving..." : "Record acceptance"}</button></div>
        </form>
      </Modal>
    </div>
  );
}
