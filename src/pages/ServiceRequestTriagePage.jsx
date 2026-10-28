import React, { useCallback, useEffect, useState } from "react";
import { serviceRequests, assistant } from "../api/client.js";
import PageHeaderBanner from "../components/PageHeaderBanner.jsx";
import { ICONS } from "../components/icons.jsx";
import { ErrorBanner, PageEmptyState, PageLoadingSkeleton } from "../components/PageStates.jsx";
import RecordAnalysisModal from "../components/RecordAnalysisModal.jsx";
import { recordAnalysisVisible } from "../recordAnalysisFlags.js";
import {
  SERVICE_REQUEST_LIMITS, SERVICE_REQUEST_STATUSES, canConvertToLead,
  statusLabel, statusTone, triageActionsFor, urgencyLabel
} from "../serviceRequestModel.js";

// Sales / Operations triage queue. Every list and every decision goes through the
// server, which enforces the role, the allowed transitions and the one-time
// conversion. The status filter is a server query, not browser-side filtering.
export default function ServiceRequestTriagePage() {
  const [filter, setFilter] = useState("Submitted");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");
  const [notes, setNotes] = useState({});
  const [confirmId, setConfirmId] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [analysisId, setAnalysisId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setItems(await serviceRequests.triage(filter || undefined));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function decide(item, decision) {
    setBusyId(item.id);
    setError("");
    setNotice("");
    try {
      await serviceRequests.triageDecision(item.id, decision, notes[item.id]);
      setNotes((current) => ({ ...current, [item.id]: "" }));
      setNotice(`"${item.title}" was ${decision === "decline" ? "declined" : decision === "accept" ? "accepted" : "acknowledged"}.`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId("");
    }
  }

  async function convert(item) {
    setBusyId(item.id);
    setError("");
    setNotice("");
    try {
      await serviceRequests.convertToLead(item.id);
      setConfirmId("");
      setNotice(`"${item.title}" was converted to one lead. No quote, purchase order, dispatch, invoice, email or notification was created.`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId("");
    }
  }

  async function openAnalysis(id) {
    setAnalysisId(id);
    setError("");
    try {
      setAnalysis(await assistant.recordAnalysis("service_request", id));
    } catch (err) {
      setError(err.message);
    } finally {
      setAnalysisId("");
    }
  }

  const buttonClass = "min-h-11 rounded-md border px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-50";
  // Presentation-only accent so an urgent queue can be scanned at a glance; the
  // server's urgency value drives it, nothing here changes behaviour or order.
  const URGENCY_ACCENT = { urgent_downtime: "border-l-4 border-l-red-400", planned_shutdown: "border-l-4 border-l-amber-300", standard: "border-l-4 border-l-transparent" };
  const urgencyAccent = (urgency) => URGENCY_ACCENT[urgency] || URGENCY_ACCENT.standard;
  const analysisVisible = recordAnalysisVisible();

  return (
    <div className="space-y-6">
      <PageHeaderBanner eyebrow="Sales and operations" title="Service Requests" subtitle="Triage requests raised by client accounts and convert accepted requests into leads." iconPath={ICONS.clipboard} />

      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="sr-filter" className="text-sm font-medium text-gray-600">Status</label>
        <select id="sr-filter" value={filter} onChange={(event) => { setFilter(event.target.value); setConfirmId(""); }} className="min-h-11 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
          <option value="">All requests</option>
          {SERVICE_REQUEST_STATUSES.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
        </select>
        <button type="button" onClick={load} disabled={loading} className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-orac-slate hover:bg-gray-50 disabled:opacity-50">Refresh</button>
      </div>

      {error && <ErrorBanner message={error} />}
      {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}

      {loading ? (
        <PageLoadingSkeleton label="Loading service requests" />
      ) : items.length === 0 ? (
        !error && (
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
            <PageEmptyState iconPath={ICONS.clipboard} title="No service requests" subtitle={filter ? `There are no ${statusLabel(filter).toLowerCase()} requests.` : "No client has submitted a service request yet."} />
          </div>
        )
      ) : (
        <ul className="space-y-4">
          {items.map((item) => {
            const actions = triageActionsFor(item.status);
            const busy = busyId === item.id;
            return (
              <li key={item.id} className={`rounded-lg border border-gray-200 bg-white p-5 shadow-sm ${urgencyAccent(item.urgency)}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-orac-slate">{item.title}</h2>
                    <p className="text-sm text-gray-600">{item.client_name || "Unknown client"}{item.created_by_name ? ` · requested by ${item.created_by_name}` : ""}</p>
                  </div>
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusTone(item.status)}`}>{statusLabel(item.status)}</span>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm text-gray-800">{item.service_need}</p>
                <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm text-gray-600 sm:grid-cols-2 lg:grid-cols-4">
                  <div><dt className="inline font-medium">Urgency: </dt><dd className="inline">{urgencyLabel(item.urgency)}</dd></div>
                  <div><dt className="inline font-medium">Requested date: </dt><dd className="inline">{item.requested_date || "—"}</dd></div>
                  <div><dt className="inline font-medium">Mine site: </dt><dd className="inline">{item.mine_site_name || "—"}</dd></div>
                  <div><dt className="inline font-medium">Equipment: </dt><dd className="inline">{item.equipment_tag_code || "—"}</dd></div>
                  <div><dt className="inline font-medium">Submitted: </dt><dd className="inline">{item.created_at ? new Date(item.created_at).toLocaleString() : "—"}</dd></div>
                  {item.triaged_by_name && <div><dt className="inline font-medium">Last triaged by: </dt><dd className="inline">{item.triaged_by_name}</dd></div>}
                </dl>
                {item.triage_note && <p className="mt-2 text-sm text-gray-600"><span className="font-medium">Triage note:</span> {item.triage_note}</p>}
                {analysisVisible && <div className="mt-4 border-t border-gray-100 pt-4"><button type="button" disabled={Boolean(analysisId)} onClick={() => openAnalysis(item.id)} className={`${buttonClass} border-gray-300 text-orac-slate hover:bg-gray-50`}>{analysisId === item.id ? "Loading analysis..." : "Analyze evidence"}</button></div>}

                {actions.length > 0 && (
                  <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
                    <div>
                      <label htmlFor={`note-${item.id}`} className="mb-1 block text-sm font-medium text-gray-600">Note (optional, internal)</label>
                      <textarea id={`note-${item.id}`} rows={2} value={notes[item.id] || ""} maxLength={SERVICE_REQUEST_LIMITS.note} onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:outline-none focus:ring-2 focus:ring-orac-blue/20" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {actions.map((action) => (
                        <button key={action.decision} type="button" disabled={busy} onClick={() => decide(item, action.decision)}
                          className={`${buttonClass} ${action.decision === "decline" ? "border-red-200 text-red-700 hover:bg-red-50" : "border-orac-blue bg-orac-blue text-white hover:brightness-105"}`}>
                          {busy ? "Working..." : action.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {canConvertToLead(item.status) && (
                  <div className="mt-4 border-t border-gray-100 pt-4">
                    {confirmId === item.id ? (
                      <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                        <p>This creates <strong>one</strong> lead for {item.client_name || "this client"} and cannot be repeated. It does not create a quote, purchase order, dispatch, invoice, email or notification.</p>
                        <div className="flex gap-2">
                          <button type="button" disabled={busy} onClick={() => convert(item)} className={`${buttonClass} border-orac-blue bg-orac-blue text-white hover:brightness-105`}>{busy ? "Converting..." : "Confirm conversion"}</button>
                          <button type="button" disabled={busy} onClick={() => setConfirmId("")} className={`${buttonClass} border-gray-300 text-orac-slate hover:bg-white`}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setConfirmId(item.id)} className={`${buttonClass} border-orac-blue text-orac-blue hover:bg-sky-50`}>Convert to lead</button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <RecordAnalysisModal title="Service request evidence analysis" analysis={analysis} onClose={() => setAnalysis(null)} />
    </div>
  );
}
