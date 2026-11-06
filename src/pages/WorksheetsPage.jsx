import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { assistant, collections, worksheets, dispatch, documents } from "../api/client.js";
import { canAccessRoute, canEnterPaperTimesheet } from "../accessPolicy.js";
import StatCard from "../components/StatCard.jsx";
import { ICONS } from "../components/icons.jsx";
import Modal from "../components/Modal.jsx";
import SignaturePad from "../components/SignaturePad.jsx";
import WorksheetEvidence, { StatusPill } from "../components/WorksheetEvidence.jsx";
import KioskReviewPanel from "../components/KioskReviewPanel.jsx";
import AssignedMaterialsPanel from "../components/AssignedMaterialsPanel.jsx";
import PeriodPackPanel from "../components/PeriodPackPanel.jsx";
import RecordAnalysisModal from "../components/RecordAnalysisModal.jsx";
import { recordAnalysisVisible } from "../recordAnalysisFlags.js";
import { displayTrade } from "../constants/trades.js";
import { canEditWorksheet, canReviewWorksheet, canReviseWorksheet, worksheetStatusLabel } from "../fieldStatusModel.js";
import TimesheetFormModal from "../components/TimesheetFormModal.jsx";
import TimesheetBulkImportModal from "../components/TimesheetBulkImportModal.jsx";
import { PaperEvidenceBadge, PaperEvidenceModal } from "../components/PaperEvidence.jsx";
import PaperEntryModal from "../components/PaperEntryModal.jsx";
import EntrySourceBadge from "../components/EntrySourceBadge.jsx";
import TimesheetOutboxPanel from "../components/TimesheetOutboxPanel.jsx";
import { cacheDispatchOptions } from "../offlineTimesheetOutbox.js";
import { hoursSummary, signoffProgress, isTimesheetV2 } from "../lib/timesheetFormLogic.js";
import V5SignaturePanel from "../components/V5SignaturePanel.jsx";
import V5BillingReadinessPanel from "../components/V5BillingReadinessPanel.jsx";
import { PageLoadingSkeleton } from "../components/PageStates.jsx";
import { v5ReadinessVisible, v5SheetEligibleForPanel, v5SignatureVisible } from "../v5SignatureModel.js";

const SUBMIT_ROLES = ["Admin", "Operations", "Technician", "Supervisor"];
const BULK_IMPORT_ROLES = ["Admin", "Operations", "Supervisor", "Sales"];
const KIOSK_REVIEW_ROLES = ["Admin", "Operations", "Supervisor"];
const MATERIAL_ROLES = ["Admin", "Operations", "Technician", "Supervisor"];
const PERIOD_PACK_ROLES = ["Admin", "Operations"];
function localStore() { try { return window.localStorage; } catch { return null; } }

// Read-only verified-hours view for the commercial roles. Choose a dispatch, then load it.
function V5ReadinessByDispatch({ user, dispatches }) {
  const [id, setId] = useState("");
  const options = dispatches || [];
  return (
    <div className="space-y-2">
      <label htmlFor="v5-ready-dispatch" className="block text-sm font-semibold text-gray-600">Verified hours by dispatch (V5, read-only)</label>
      <select id="v5-ready-dispatch" value={id} onChange={(e) => setId(e.target.value)} className="min-h-[44px] w-full rounded-lg border border-gray-300 bg-white px-3 text-sm dark:bg-transparent">
        <option value="">Choose a dispatch</option>
        {options.map((d) => <option key={d.id} value={d.id}>{d.dispatch_number || d.id}</option>)}
      </select>
      {id && <V5BillingReadinessPanel key={id} user={user} dispatchId={id} label={options.find((d) => d.id === id)?.dispatch_number || id} />}
    </div>
  );
}

export default function WorksheetsPage({ user }) {
  const [items, setItems] = useState([]);
  const [dispatches, setDispatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [comment, setComment] = useState({});
  const [filter, setFilter] = useState("all");
  const [tradeFilter, setTradeFilter] = useState("all");

  // Timesheet form (create or edit) and the offline outbox panel
  const [formOpen, setFormOpen] = useState(false);
  const [editingWs, setEditingWs] = useState(null);
  const [outboxKey, setOutboxKey] = useState(0);
  const [paperOpen, setPaperOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [paperView, setPaperView] = useState(null); // the Timesheet whose signed paper copy is open
  const [searchParams, setSearchParams] = useSearchParams();
  const [notice, setNotice] = useState("");

  // Revision (a new linked draft after acknowledgement or approval)
  const [reviseTarget, setReviseTarget] = useState(null);
  const [reviseReason, setReviseReason] = useState("");
  const [reviseError, setReviseError] = useState("");

  const [analysis, setAnalysis] = useState(null);
  const [analyzingId, setAnalyzingId] = useState(null);

  async function handleAnalysis(id) {
    try {
      setAnalyzingId(id);
      const res = await assistant.recordAnalysis("field_worksheet", id);
      setAnalysis(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setAnalyzingId(null);
    }
  }

  function dispatchLabel(id) {
    const d = dispatches.find((item) => item.id === id);
    return d?.dispatch_number || id;
  }

  const canSubmit = SUBMIT_ROLES.includes(user.role);
  const canPaperEntry = canEnterPaperTimesheet(user.role);

  // Deep link from the Daily Time Sheets page: /worksheets?paperEntry=1 opens the paper form once.
  useEffect(() => {
    if (searchParams.get("paperEntry") !== "1") return;
    if (canPaperEntry) setPaperOpen(true);
    const next = new URLSearchParams(searchParams); next.delete("paperEntry");
    setSearchParams(next, { replace: true });
  }, [searchParams, canPaperEntry]);

  function openCreate() { setEditingWs(null); setFormOpen(true); }
  function openEdit(ws) { setEditingWs(ws); setFormOpen(true); }
  function handleSaved(message, extra = {}) {
    setNotice(message);
    if (extra.queued) setOutboxKey((k) => k + 1);
    load();
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [wsData, dcData] = await Promise.all([
        collections.list("field_worksheets"),
        collections.list("dispatch_cards").catch(() => [])
      ]);
      setItems(wsData || []);
      if (dcData) { setDispatches(dcData); cacheDispatchOptions(localStore(), user.id, dcData); }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signatureTarget, setSignatureTarget] = useState(null);

  async function handleSubmitTrigger(id) {
    setSignatureTarget(id);
    setShowSignatureModal(true);
  }

  async function confirmSubmit(signatureDataUrl) {
    try {
      // The on-screen signature is a courtesy capture only: the server does not store it
      // as acknowledgement evidence. The client's acknowledgement is recorded when the
      // client representative signs in to the Client Portal.
      await worksheets.submit(signatureTarget, { signature: signatureDataUrl });
      await load();
      setShowSignatureModal(false);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRevise(e) {
    e.preventDefault();
    if (!reviseReason.trim()) { setReviseError("A reason is required."); return; }
    try {
      await worksheets.revise(reviseTarget.id, reviseReason.trim());
      setReviseTarget(null);
      setReviseReason("");
      setReviseError("");
      setNotice("A new Draft revision was created. The signed original is kept unchanged.");
      await load();
    } catch (err) {
      setReviseError(err.message);
    }
  }

  async function downloadPdf(id) {
    try { await documents.download("field_worksheets", id); }
    catch (err) { setError(err.message); }
  }

  async function handleReview(id, decision) {
    const note = comment[id] || "";
    if (decision === "return" && !note.trim()) {
      setError("A comment is required when returning a worksheet.");
      return;
    }
    try {
      await worksheets.review(id, decision, note);
      setComment({ ...comment, [id]: "" });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  const statusFiltered = filter === "all" ? items : items.filter((ws) => ws.status === filter);
  const tradeOptions = [...new Set(items.map((ws) => displayTrade(ws.technician_trade)))].sort();
  const filtered = tradeFilter === "all" ? statusFiltered : statusFiltered.filter((ws) => displayTrade(ws.technician_trade) === tradeFilter);
  const counts = {
    total: items.length,
    draft: items.filter((w) => w.status === "Draft").length,
    awaitingClient: items.filter((w) => w.status === "Submitted").length,
    awaitingSupervisor: items.filter((w) => w.status === "Client_Acknowledged").length,
    approved: items.filter((w) => w.status === "Supervisor_Approved").length,
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-orac-text-primary sm:text-3xl mb-2">Timesheets</h1>
          <p className="text-sm text-orac-text-secondary max-w-3xl leading-relaxed">
            <strong>Timesheets</strong> record skilled labour, hours, field activity and outcomes against a dispatch card.
            The technical system record remains a field worksheet. The client representative acknowledges a submitted timesheet first, then an ORAC Supervisor reviews and approves it.
            This is separate from an <strong>Internal Request</strong>, which only coordinates between teams and never logs field hours.
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 self-start sm:flex-row sm:self-auto">
          {BULK_IMPORT_ROLES.includes(user.role) && (
            <button
              type="button"
              onClick={() => setBulkImportOpen(true)}
              className="min-h-11 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:bg-gray-50 dark:border-gray-700 dark:bg-transparent dark:text-orac-text-muted"
            >
              Bulk Import (CSV / Excel)
            </button>
          )}
          {canPaperEntry && (
            <button
              type="button"
              onClick={() => setPaperOpen(true)}
              className="min-h-11 rounded-lg bg-orac-blue px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:brightness-105"
            >
              Add Timesheet (Paper Entry)
            </button>
          )}
          {canSubmit && (
            <button
              onClick={openCreate}
              className={`min-h-11 rounded-lg px-4 py-2.5 text-sm font-semibold shadow-sm transition-all hover:brightness-105 ${canPaperEntry ? "border border-gray-300 bg-white text-gray-700 dark:bg-transparent dark:text-orac-text-muted" : "bg-orac-blue text-white"}`}
            >
              + New Timesheet
            </button>
          )}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total Timesheets" value={counts.total} tone="slate" iconPath={ICONS.clipboard} />
        <StatCard label="In Draft" value={counts.draft} tone="slate" iconPath={ICONS.document} />
        <StatCard label="Awaiting Client" value={counts.awaitingClient} tone="amber" iconPath={ICONS.clock} />
        <StatCard label="Awaiting Supervisor" value={counts.awaitingSupervisor} tone="amber" iconPath={ICONS.search} />
        <StatCard label="Approved" value={counts.approved} tone="green" iconPath={ICONS.check} />
      </div>

      <TimesheetOutboxPanel user={user} refreshKey={outboxKey} onSynced={load} />

      {/* Filters */}
      <div className="flex flex-wrap gap-2 pb-2 border-b border-orac-border-default">
        {[["all", "All Timesheets"], ["Draft", "Draft"], ["Submitted", "Awaiting client"], ["Client_Acknowledged", "Awaiting Supervisor"], ["Supervisor_Approved", "Approved"], ["Returned_For_Correction", "Returned"]].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`min-h-[44px] rounded-full px-4 py-1.5 text-sm font-semibold transition-all ${
              filter === key 
                ? "bg-gray-900 text-white shadow-md" 
                : "bg-orac-surface-muted text-orac-text-secondary hover:bg-orac-surface"
            }`}
          >
            {label}
          </button>
        ))}
        {tradeOptions.length > 1 && (
          <select
            aria-label="Filter timesheets by trade"
            value={tradeFilter}
            onChange={(event) => setTradeFilter(event.target.value)}
            className="ml-auto min-h-11 rounded-full border border-orac-border-default bg-orac-surface px-3 py-1.5 text-sm font-semibold text-orac-text-secondary"
          >
            <option value="all">All trades</option>
            {tradeOptions.map((trade) => <option key={trade} value={trade}>{trade}</option>)}
          </select>
        )}
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-red-100 bg-red-50/80 px-4 py-3 text-sm text-red-600 shadow-sm backdrop-blur-sm">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 shadow-sm">
          {notice}
        </div>
      )}

      {loading ? (
        <PageLoadingSkeleton label="Loading timesheets" />
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-orac-border-default bg-orac-surface px-4 py-16 flex flex-col items-center justify-center shadow-sm">
          <div className="h-12 w-12 rounded-full bg-orac-surface-muted flex items-center justify-center text-orac-text-muted mb-4">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          </div>
          <p className="text-sm font-medium text-orac-text-muted">No timesheets found.</p>
          <p className="mt-1 text-xs text-orac-text-muted">Adjust your filters or create a new timesheet from a dispatch card.</p>
          {canSubmit && (
            <button
              onClick={openCreate}
              className="mt-4 min-h-11 rounded-lg bg-orac-blue px-4 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-105 transition-all"
            >
              + Create Timesheet
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((ws) => (
            <div key={ws.id} className="group rounded-xl border border-orac-border-default bg-orac-surface p-5 shadow-sm transition-all hover:shadow-md hover:border-orac-accent">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <span className="font-semibold text-orac-text-primary text-lg">{ws.activity || "Timesheet"}</span>
                    <StatusPill status={ws.status} />
                    <EntrySourceBadge worksheet={ws} />
                  </div>
                  <div data-evidence="timesheet-record-context" className="flex flex-wrap items-center gap-3 text-xs text-orac-text-muted mb-2">
                    <span>Timesheet {ws.id}</span>
                    {canAccessRoute(user.role, "/job-cards") ? (
                      <Link to={`/job-cards/${encodeURIComponent(ws.dispatch_card_id)}`} className="text-orac-blue hover:underline">
                        Dispatch {dispatchLabel(ws.dispatch_card_id)}
                      </Link>
                    ) : (
                      <span>Dispatch {dispatchLabel(ws.dispatch_card_id)}</span>
                    )}
                    <PaperEvidenceBadge worksheet={ws} onOpen={setPaperView} />
                  </div>
                  
                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-500 mb-3">
                    <div className="flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-orac-border-strong" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      {hoursSummary(ws)}
                    </div>
                    {(ws.worker_name || ws.technician_name) && (
                      <div className="flex items-center gap-1.5">
                        <svg className="w-4 h-4 text-orac-border-strong" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        {ws.worker_name || ws.technician_name}{ws.worker_type === "contractor" ? " (contractor)" : ""}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-gray-500">Trade</span>
                      {displayTrade(ws.technician_trade)}
                    </div>
                  </div>
                  
                  {ws.outcomes && (
                    <div className="mt-3 bg-gray-50/80 rounded-lg p-3 border border-gray-100">
                      <p className="text-sm font-semibold text-gray-500 mb-1">Activity Outcomes</p>
                      <p className="text-sm text-gray-700">{ws.outcomes}</p>
                    </div>
                  )}
                  {isTimesheetV2(ws) && (
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600" aria-label="Sign-off progress">
                      {signoffProgress(ws).map((p) => (
                        <span key={p.party} className={p.done ? "font-semibold text-emerald-700" : "text-gray-500"}>{p.done ? "Signed" : "Waiting"}: {p.party}</span>
                      ))}
                      {ws.synced_at && <span className="rounded bg-sky-50 px-1.5 py-0.5 text-sky-800">Captured offline</span>}
                    </div>
                  )}
                  {isTimesheetV2(ws) && (ws.server_checks?.flags || []).filter((f) => f.severity !== "info").map((f) => (
                    <p key={f.code + (f.date || "")} className={`mt-2 rounded-md px-2 py-1 text-xs ${f.severity === "blocking" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-900"}`}>{f.message}</p>
                  ))}
                  {ws.materials_used?.length > 0 && isTimesheetV2(ws) && (
                    <p className="mt-2 text-xs text-gray-600">Materials: {ws.materials_used.map((m) => `${m.quantity}${m.unit ? ` ${m.unit}` : ""} ${m.description}`).join("; ")}</p>
                  )}
                  <WorksheetEvidence worksheet={ws} role={user.role} />
                  {v5SignatureVisible(user.role) && v5SheetEligibleForPanel(ws) && <V5SignaturePanel ws={ws} user={user} />}
                </div>
                
                <div className="flex shrink-0 flex-col gap-2">
                  {canSubmit && (ws.status === "Draft" || ws.status === "Returned_For_Correction") && (
                    <button
                      onClick={() => handleSubmitTrigger(ws.id)}
                      className="min-h-[44px] rounded-lg bg-gray-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-gray-800 focus:ring-2 focus:ring-gray-900/20"
                    >
                      Submit for Client Acknowledgement
                    </button>
                  )}
                  {canEditWorksheet(user.role, ws) && (
                    <button type="button" onClick={() => openEdit(ws)} className="min-h-[44px] rounded-lg border border-gray-300 bg-white px-5 py-2 text-sm font-semibold text-gray-700 dark:bg-transparent dark:text-orac-text-muted">Edit</button>
                  )}
                  {canReviseWorksheet(user.role, ws) && (
                    <button type="button" onClick={() => { setReviseTarget(ws); setReviseReason(""); setReviseError(""); }} className="min-h-[44px] rounded-lg border border-gray-300 bg-white px-5 py-2 text-sm font-semibold text-gray-700 dark:bg-transparent dark:text-orac-text-muted">Revise (new draft)</button>
                  )}
                  <button type="button" onClick={() => downloadPdf(ws.id)} className="min-h-[44px] rounded-lg border border-gray-300 bg-white px-5 py-2 text-sm font-semibold text-gray-700 dark:bg-transparent dark:text-orac-text-muted">Download PDF</button>
                  {recordAnalysisVisible() && (
                    <button
                      type="button"
                      onClick={() => handleAnalysis(ws.id)}
                      disabled={analyzingId === ws.id}
                      className="min-h-[44px] rounded-lg border border-gray-300 bg-white px-5 py-2 text-sm font-semibold text-gray-700 dark:bg-transparent dark:text-orac-text-muted"
                    >
                      {analyzingId === ws.id ? "Analyzing..." : "Timesheet evidence analysis"}
                    </button>
                  )}
                </div>
              </div>

              {canReviewWorksheet(user.role, ws) && (
                <div className="mt-5 border-t border-gray-100 pt-5 bg-gray-50/30 -mx-5 -mb-5 px-5 pb-5 rounded-b-xl">
                  <label htmlFor={`review-${ws.id}`} className="block text-sm font-semibold text-gray-600 mb-2">Supervisor Review (the client has acknowledged this work)</label>
                  <textarea
                    id={`review-${ws.id}`}
                    placeholder="Enter review comments (required if returning)"
                    value={comment[ws.id] || ""}
                    onChange={(e) => setComment({ ...comment, [ws.id]: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm placeholder:text-orac-border-strong focus:border-orac-blue focus:outline-none focus:ring-4 focus:ring-orac-blue/10 transition-all shadow-sm"
                    rows={2}
                  />
                  <div className="mt-3 flex flex-wrap gap-3">
                    <button
                      onClick={() => handleReview(ws.id, "approve")}
                      className="min-h-[44px] rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-700"
                    >
                      Approve Timesheet
                    </button>
                    <button
                      onClick={() => handleReview(ws.id, "return")}
                      className="min-h-[44px] rounded-lg bg-white border border-gray-300 px-5 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:text-red-600 hover:border-red-200"
                    >
                      Return for Corrections
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {KIOSK_REVIEW_ROLES.includes(user.role) && <KioskReviewPanel user={user} />}
      {["Admin", "Operations"].includes(user.role) && (
        <p className="text-sm text-gray-500">Entering crew hours for a whole crew? Use <Link to="/kiosk" className="font-semibold text-orac-blue underline">Kiosk Mode: Crew Time Entry</Link>. Those hours wait for Supervisor review.</p>
      )}
      {["Admin", "Management", "Operations", "Supervisor"].includes(user.role) && (
        <p className="text-sm text-gray-500">Looking for an older Daily Time Sheet, Contractor Log or a Timesheet without Normal / 1.5 / 2.0? See <Link to="/legacy-history" className="font-semibold text-orac-blue underline">earlier records (read-only)</Link>. The monthly register is under <Link to="/monthly-worksheets" className="font-semibold text-orac-blue underline">Worksheets</Link>.</p>
      )}
      {MATERIAL_ROLES.includes(user.role) && <AssignedMaterialsPanel dispatches={dispatches} />}
      {v5ReadinessVisible(user.role) && <V5ReadinessByDispatch user={user} dispatches={dispatches} />}
      {PERIOD_PACK_ROLES.includes(user.role) && <PeriodPackPanel worksheets={items} />}

      {/* Revise Modal */}
      <Modal
        title="Revise acknowledged or approved Timesheet"
        isOpen={Boolean(reviseTarget)}
        onClose={() => { setReviseTarget(null); setReviseError(""); }}
      >
        <form onSubmit={handleRevise} className="space-y-3">
          <p className="text-sm text-gray-600">Signed or approved records are never edited in place. This creates a new linked Draft that must be submitted, acknowledged and approved again.</p>
          {reviseError && <div role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200">{reviseError}</div>}
          <label htmlFor="ws-revise-reason" className="block text-sm font-semibold text-gray-600">Reason for the revision</label>
          <textarea id="ws-revise-reason" rows={3} required value={reviseReason} onChange={(e) => setReviseReason(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setReviseTarget(null)} className="min-h-[44px] px-4 text-sm font-medium text-gray-600">Cancel</button>
            <button type="submit" className="min-h-[44px] rounded-lg bg-orac-blue px-5 text-sm font-semibold text-white">Create revision</button>
          </div>
        </form>
      </Modal>

      {/* Audit view of the photo of the signed physical sheet */}
      <PaperEvidenceModal worksheet={paperView} onClose={() => setPaperView(null)} />

      {/* The one Timesheet form (create or edit) */}
      <TimesheetFormModal isOpen={formOpen} onClose={() => { setFormOpen(false); setEditingWs(null); }} user={user} dispatches={dispatches} editing={editingWs} onSaved={handleSaved} />
      {canPaperEntry && (
        <PaperEntryModal isOpen={paperOpen} onClose={() => setPaperOpen(false)} user={user} dispatches={dispatches} worksheets={items} onSaved={handleSaved} />
      )}
      {BULK_IMPORT_ROLES.includes(user.role) && (
        <TimesheetBulkImportModal
          isOpen={bulkImportOpen}
          onClose={() => setBulkImportOpen(false)}
          user={user}
          dispatches={dispatches}
          onImportComplete={(msg) => {
            setNotice(msg);
            load();
          }}
        />
      )}
      {showSignatureModal && (
        <Modal title="Client Representative Sign-Off" isOpen={showSignatureModal} onClose={() => setShowSignatureModal(false)}>
          <div className="p-4">
            <p className="text-sm text-orac-slate mb-2">This on-screen signature is a courtesy capture on this device. It is not stored as the client's acknowledgement.</p>
            <p className="text-sm text-orac-slate mb-4">The client representative's acknowledgement is recorded separately, under their own sign-in, in the Client Portal.</p>
            <SignaturePad
               onSave={confirmSubmit}
               onCancel={() => setShowSignatureModal(false)}
            />
          </div>
        </Modal>
      )}
      {analysis && (
        <RecordAnalysisModal
          title="Timesheet evidence analysis"
          analysis={analysis}
          onClose={() => setAnalysis(null)}
        />
      )}
    </div>
  );
}
