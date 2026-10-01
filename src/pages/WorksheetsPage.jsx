import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collections, worksheets, dispatch, documents } from "../api/client.js";
import StatCard from "../components/StatCard.jsx";
import Modal from "../components/Modal.jsx";
import SignaturePad from "../components/SignaturePad.jsx";
import WorksheetEvidence, { StatusPill } from "../components/WorksheetEvidence.jsx";
import KioskReviewPanel from "../components/KioskReviewPanel.jsx";
import AssignedMaterialsPanel from "../components/AssignedMaterialsPanel.jsx";
import PeriodPackPanel from "../components/PeriodPackPanel.jsx";
import { displayTrade } from "../constants/trades.js";
import { canEditWorksheet, canReviewWorksheet, canReviseWorksheet, worksheetStatusLabel } from "../fieldStatusModel.js";
import { saveDraft, loadDraft, clearDraft, isNetworkFailure } from "../offlineDraftModel.js";

const SUBMIT_ROLES = ["Admin", "Operations", "Technician", "Supervisor"];
const KIOSK_REVIEW_ROLES = ["Admin", "Operations", "Supervisor"];
const MATERIAL_ROLES = ["Admin", "Operations", "Technician", "Supervisor"];
const PERIOD_PACK_ROLES = ["Admin", "Operations"];
const EMPTY_FORM = () => ({ dispatch_card_id: "", work_date: new Date().toISOString().slice(0, 10), hours: "", activity: "", outcomes: "" });
function draftStorage() { try { return window.localStorage; } catch { return null; } }

export default function WorksheetsPage({ user }) {
  const [items, setItems] = useState([]);
  const [dispatches, setDispatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [comment, setComment] = useState({});
  const [filter, setFilter] = useState("all");
  const [tradeFilter, setTradeFilter] = useState("all");

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalError, setModalError] = useState("");
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM());
  const [editingId, setEditingId] = useState(null);
  const [draftNote, setDraftNote] = useState("");
  const [notice, setNotice] = useState("");

  // Revision (a new linked draft after acknowledgement or approval)
  const [reviseTarget, setReviseTarget] = useState(null);
  const [reviseReason, setReviseReason] = useState("");
  const [reviseError, setReviseError] = useState("");

  const canSubmit = SUBMIT_ROLES.includes(user.role);
  const draftScope = editingId ? `edit:${editingId}` : "new";

  function openCreate() {
    setModalError("");
    setEditingId(null);
    const saved = loadDraft(draftStorage(), user.id, "worksheet", "new");
    setForm(saved?.data?.form ? { ...EMPTY_FORM(), ...saved.data.form } : EMPTY_FORM());
    setDraftNote(saved ? "Restored an unsent draft saved on this device." : "");
    setIsModalOpen(true);
  }

  function openEdit(ws) {
    setModalError("");
    setEditingId(ws.id);
    setForm({ dispatch_card_id: ws.dispatch_card_id || "", work_date: ws.work_date || EMPTY_FORM().work_date, hours: ws.hours ?? "", activity: ws.activity || "", outcomes: ws.outcomes || "" });
    setDraftNote("");
    setIsModalOpen(true);
  }

  // Unsent form text is kept on this device (no rates, expires, cleared on logout).
  useEffect(() => {
    if (!isModalOpen || editingId) return;
    if (form.activity || form.outcomes || form.hours) saveDraft(draftStorage(), user.id, "worksheet", "new", { form });
  }, [form, isModalOpen, editingId]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [wsData, dcData] = await Promise.all([
        collections.list("field_worksheets"),
        collections.list("dispatch_cards").catch(() => [])
      ]);
      setItems(wsData || []);
      if (dcData) setDispatches(dcData);
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

  async function handleCreateWorksheet(e) {
    e.preventDefault();
    if (!form.dispatch_card_id) {
      setModalError("Please select a dispatch card.");
      return;
    }
    setModalSubmitting(true);
    setModalError("");
    try {
      if (editingId) {
        await worksheets.update(editingId, { activity: form.activity, hours: Number(form.hours), outcomes: form.outcomes });
        setNotice("Timesheet updated.");
      } else {
        await dispatch.createWorksheet(form.dispatch_card_id, {
          work_date: form.work_date,
          hours: Number(form.hours),
          activity: form.activity,
          outcomes: form.outcomes
        });
        clearDraft(draftStorage(), user.id, "worksheet", "new");
        setNotice("Timesheet created as a Draft. Submit it when it is ready for the client to acknowledge.");
      }
      setIsModalOpen(false);
      setEditingId(null);
      setForm(EMPTY_FORM());
      await load();
    } catch (err) {
      setModalError(isNetworkFailure(err) ? "Not saved: the connection dropped. What you typed is kept on this device. Try again when you are back online." : err.message);
    } finally {
      setModalSubmitting(false);
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
          <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl mb-2">Timesheets</h1>
          <p className="text-sm text-gray-500 max-w-3xl leading-relaxed">
            <strong>Timesheets</strong> record skilled labour, hours, field activity and outcomes against a dispatch card.
            The technical system record remains a field worksheet. The client representative acknowledges a submitted timesheet first, then an ORAC Supervisor reviews and approves it.
            This is separate from an <strong>Internal Request</strong>, which only coordinates between teams and never logs field hours.
          </p>
        </div>
        {canSubmit && (
          <button
            onClick={openCreate}
            className="shrink-0 self-start sm:self-auto rounded-lg bg-orac-blue px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:brightness-105"
          >
            + New Timesheet
          </button>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total Timesheets" value={counts.total} tone="slate" icon="📝" />
        <StatCard label="In Draft" value={counts.draft} tone="slate" icon="✏️" />
        <StatCard label="Awaiting Client" value={counts.awaitingClient} tone="amber" icon="⏳" />
        <StatCard label="Awaiting Supervisor" value={counts.awaitingSupervisor} tone="amber" icon="🔎" />
        <StatCard label="Approved" value={counts.approved} tone="green" icon="✅" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 pb-2 border-b border-gray-100">
        {[["all", "All Timesheets"], ["Draft", "Draft"], ["Submitted", "Awaiting client"], ["Client_Acknowledged", "Awaiting Supervisor"], ["Supervisor_Approved", "Approved"], ["Returned_For_Correction", "Returned"]].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`min-h-[44px] rounded-full px-4 py-1.5 text-sm font-semibold transition-all ${
              filter === key 
                ? "bg-gray-900 text-white shadow-md" 
                : "bg-gray-100/50 text-gray-600 hover:bg-gray-200/80"
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
            className="ml-auto rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600"
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
        <div className="py-12 text-center text-gray-400">Loading timesheets...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white px-4 py-16 flex flex-col items-center justify-center shadow-sm">
          <div className="h-12 w-12 rounded-full bg-gray-50 flex items-center justify-center text-gray-300 mb-4">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          </div>
          <p className="text-sm font-medium text-gray-500">No timesheets found.</p>
          <p className="mt-1 text-xs text-gray-400">Adjust your filters or create a new timesheet from a dispatch card.</p>
          {canSubmit && (
            <button
              onClick={openCreate}
              className="mt-4 rounded-lg bg-orac-blue px-4 py-2 text-xs font-semibold text-white shadow-sm hover:brightness-105 transition-all"
            >
              + Create Timesheet
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((ws) => (
            <div key={ws.id} className="group rounded-xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:shadow-md hover:border-gray-200">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-semibold text-gray-900 text-lg">{ws.activity || "Timesheet"}</span>
                    <StatusPill status={ws.status} />
                  </div>
                  
                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-500 mb-3">
                    <div className="flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      {ws.hours ?? "?"} hours logged
                    </div>
                    {ws.technician_name && (
                      <div className="flex items-center gap-1.5">
                        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        {ws.technician_name}
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
                  <WorksheetEvidence worksheet={ws} role={user.role} />
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
                    <button type="button" onClick={() => openEdit(ws)} className="min-h-[44px] rounded-lg border border-gray-300 bg-white px-5 py-2 text-sm font-semibold text-gray-700 dark:bg-transparent dark:text-slate-200">Edit</button>
                  )}
                  {canReviseWorksheet(user.role, ws) && (
                    <button type="button" onClick={() => { setReviseTarget(ws); setReviseReason(""); setReviseError(""); }} className="min-h-[44px] rounded-lg border border-gray-300 bg-white px-5 py-2 text-sm font-semibold text-gray-700 dark:bg-transparent dark:text-slate-200">Revise (new draft)</button>
                  )}
                  <button type="button" onClick={() => downloadPdf(ws.id)} className="min-h-[44px] rounded-lg border border-gray-300 bg-white px-5 py-2 text-sm font-semibold text-gray-700 dark:bg-transparent dark:text-slate-200">Download PDF</button>
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
                    className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm placeholder:text-gray-400 focus:border-orac-blue focus:outline-none focus:ring-4 focus:ring-orac-blue/10 transition-all shadow-sm"
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
      {MATERIAL_ROLES.includes(user.role) && <AssignedMaterialsPanel dispatches={dispatches} />}
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

      {/* New Timesheet Modal */}
      <Modal
        title={editingId ? "Edit Timesheet" : "Create Timesheet"}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setModalError("");
          setEditingId(null);
        }}
      >
        <form onSubmit={handleCreateWorksheet} className="space-y-4">
          {modalError && (
            <div role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200">
              {modalError}
            </div>
          )}
          {draftNote && <p role="status" className="text-xs text-gray-500">{draftNote}</p>}

          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-gray-500">Dispatch &amp; date</legend>
            <div>
              <label htmlFor="ws-dispatch" className="mb-1 block text-sm font-semibold text-gray-600">
                Dispatch Card
              </label>
              <select
                id="ws-dispatch"
                required
                disabled={Boolean(editingId)}
                value={form.dispatch_card_id}
                onChange={(e) => setForm({ ...form, dispatch_card_id: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20 bg-white"
              >
                <option value="">Select dispatch card...</option>
                {dispatches.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.dispatch_number || d.id} {d.status ? `(${d.status})` : ""} {d.site_name ? `— ${d.site_name}` : ""}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">This timesheet is created against the field worksheet record for the selected dispatch.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="ws-date" className="mb-1 block text-sm font-semibold text-gray-600">
                  Work Date
                </label>
                <input
                  id="ws-date"
                  type="date"
                  required
                  disabled={Boolean(editingId)}
                  value={form.work_date}
                  onChange={(e) => setForm({ ...form, work_date: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20"
                />
              </div>
              <div>
                <label htmlFor="ws-hours" className="mb-1 block text-sm font-semibold text-gray-600">
                  Hours
                </label>
                <input
                  id="ws-hours"
                  type="number"
                  step="0.5"
                  min="0.5"
                  required
                  placeholder="e.g. 8"
                  value={form.hours}
                  onChange={(e) => setForm({ ...form, hours: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20"
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-4 border-t border-gray-100 pt-4">
            <legend className="text-sm font-semibold text-gray-500">Work details</legend>
            <div>
              <label htmlFor="ws-activity" className="mb-1 block text-sm font-semibold text-gray-600">
                Activity
              </label>
              <input
                id="ws-activity"
                type="text"
                required
                placeholder="e.g. Ceramic liner replacement"
                value={form.activity}
                onChange={(e) => setForm({ ...form, activity: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20"
              />
            </div>

            <div>
              <label htmlFor="ws-outcomes" className="mb-1 block text-sm font-semibold text-gray-600">
                Outcomes
              </label>
              <textarea
                id="ws-outcomes"
                rows={3}
                placeholder="Summary of work completed and observations"
                value={form.outcomes}
                onChange={(e) => setForm({ ...form, outcomes: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20"
              />
            </div>
          </fieldset>

          <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => { setIsModalOpen(false); setEditingId(null); }}
              className="min-h-[44px] px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={modalSubmitting}
              className="px-5 py-2 bg-orac-blue text-white text-sm font-semibold rounded-lg hover:brightness-105 shadow-sm disabled:opacity-50"
            >
              {modalSubmitting ? "Saving..." : editingId ? "Save changes" : "Create Timesheet"}
            </button>
          </div>
        </form>
      </Modal>
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
    </div>
  );
}
