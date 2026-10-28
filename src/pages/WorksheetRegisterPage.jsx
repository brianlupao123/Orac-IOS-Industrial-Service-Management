import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { collections, worksheetRegisters } from "../api/client.js";
import StatusBadge from "../components/StatusBadge.jsx";
import Modal from "../components/Modal.jsx";
import {
  reconciliationLabel, SEVERITY_LABEL, sortExceptions, exceptionCountsText, formatTotal, formatDateShort, formatDateFull, displayCells,
  SUB_LABEL, groupRows, refsFromException, addRowRef, removeRowRef, refsForPayload, refLabel, rosterCandidates, validateCreateForm,
  buildCreatePayload, billingNotice, cellSourceText, sourceRows, sourceLabel, HOLIDAY_NOTICE
} from "../lib/worksheetRegisterLogic.js";

// Worksheet = the monthly register, GENERATED from approved Timesheets. Nobody types hours here.
// The server decides every permission and state change; `detail.actions` drives which buttons appear.
// Every override (exclude a row, include a carry-over, acknowledge a warning) needs a reason and is audited.

const MANAGE_ROLES = ["Admin", "Operations", "Supervisor"];
const SEV_CLASS = { blocking: "bg-red-50 text-red-800 border-red-200", warning: "bg-amber-50 text-amber-800 border-amber-200", info: "bg-gray-50 text-gray-600 border-gray-200" };
const emptyForm = () => ({ title: "", period_start: "", period_end: "", client_id: "", project_title: "", department_section: "", roster: [] });

export default function WorksheetRegisterPage({ user }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [formError, setFormError] = useState("");
  const [clients, setClients] = useState([]);
  const [clientsNote, setClientsNote] = useState("");
  const [sources, setSources] = useState({ timesheets: [], dailySheets: [] });
  const [manualName, setManualName] = useState("");
  const [selectedKeys, setSelectedKeys] = useState({});
  const [ackNote, setAckNote] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [rowReason, setRowReason] = useState({});
  const [cancelReason, setCancelReason] = useState("");
  const canManage = MANAGE_ROLES.includes(user.role);

  async function loadList() {
    setLoading(true); setError("");
    try { setItems((await worksheetRegisters.list()) || []); } catch (err) { setError(err.message); } finally { setLoading(false); }
  }
  useEffect(() => { loadList(); }, []);

  async function openDetail(id) {
    setError(""); setNotice(""); setSelectedKeys({}); setAckNote(""); setReviewComment(""); setRowReason({}); setCancelReason("");
    try { setDetail(await worksheetRegisters.get(id)); } catch (err) { setError(err.message); }
  }

  async function act(fn, ok) {
    setBusy(true); setError(""); setNotice("");
    try {
      const next = await fn(); const data = next?.data ?? next;
      if (data?.id) setDetail(data);
      if (ok) setNotice(typeof ok === "function" ? ok(next) : ok);
      await loadList();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function openCreate() {
    setForm(emptyForm()); setFormError(""); setManualName(""); setCreateOpen(true);
    try { setClients((await collections.list("clients")) || []); setClientsNote(""); } catch { setClients([]); setClientsNote("Your role cannot list clients. Ask Operations or Admin to generate the Worksheet."); }
    const [timesheets, dailySheets] = await Promise.all([collections.list("field_worksheets").catch(() => []), collections.list("daily_timesheets").catch(() => [])]);
    setSources({ timesheets: timesheets || [], dailySheets: dailySheets || [] });
  }

  const candidates = useMemo(() => rosterCandidates(sources, form.period_start, form.period_end), [sources, form.period_start, form.period_end]);
  const onRoster = (c) => form.roster.some((r) => (c.technician_id ? r.technician_id === c.technician_id : (!r.technician_id && r.display_name.toLowerCase() === c.display_name.toLowerCase())));
  const toggle = (c) => setForm((p) => (onRoster(c)
    ? { ...p, roster: p.roster.filter((r) => !(c.technician_id ? r.technician_id === c.technician_id : (!r.technician_id && r.display_name.toLowerCase() === c.display_name.toLowerCase()))) }
    : { ...p, roster: [...p.roster, { technician_id: c.technician_id, display_name: c.display_name, group: c.group }] }));
  function addManual() {
    const name = manualName.trim(); if (!name) return;
    setForm((p) => (p.roster.some((r) => r.display_name.toLowerCase() === name.toLowerCase()) ? p : { ...p, roster: [...p.roster, { technician_id: null, display_name: name, group: "" }] }));
    setManualName("");
  }

  async function handleCreate() {
    const errors = validateCreateForm(form);
    if (errors.length) { setFormError(errors[0]); return; }
    setBusy(true); setFormError("");
    try {
      const created = await worksheetRegisters.create(buildCreatePayload(form));
      setCreateOpen(false); setDetail(created); setNotice("Generated from approved Timesheets. Review the exceptions below."); await loadList();
    } catch (err) { setFormError(err.message); } finally { setBusy(false); }
  }

  function override(exc, ref, kind) {
    const reason = (rowReason[exc.key] || "").trim();
    if (reason.length < 3) { setError("Enter a reason of at least 3 characters first."); return; }
    const field = kind === "exclude" ? "exclusions" : "carry_overs";
    act(() => worksheetRegisters.update(detail.id, { [field]: addRowRef(refsForPayload(detail[field]), ref, reason) }), kind === "exclude" ? "Excluded with a reason, and re-generated." : "Included as an explicit carry-over, and re-generated.");
  }
  const reinclude = (field, ref) => act(() => worksheetRegisters.update(detail.id, { [field]: refsForPayload(removeRowRef(detail[field], ref)) }), "Override removed and re-generated.");

  const exceptions = useMemo(() => sortExceptions(detail?.exceptions), [detail]);
  const ackable = exceptions.filter((e) => e.severity === "warning" && !e.acknowledged_at);
  const chosen = ackable.filter((e) => selectedKeys[e.key]).map((e) => e.key);
  const actions = detail?.actions || {};
  const srcRows = useMemo(() => sourceRows(detail?.lines), [detail]);
  const nameOf = (k) => detail?.roster?.find((r) => r.key === k)?.display_name || k;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:p-6">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-orac-slate">Worksheets</h1>
          <p className="max-w-3xl text-sm text-gray-500">
            The monthly register: employees down the rows, dates across, Normal / 1.5 / 2.0 hours. It is <strong>generated automatically from approved Timesheets</strong>, so hours are never typed in again.
            Record the work on a <Link to="/worksheets" className="font-semibold text-orac-cyan underline">Timesheet</Link>.
          </p>
        </div>
        {canManage && <button onClick={openCreate} className="min-h-11 self-start rounded-md bg-orac-cyan px-4 py-2 text-sm font-semibold text-white hover:opacity-90 sm:shrink-0">Generate Worksheet</button>}
      </div>
      {error && <div role="alert" className="mb-3 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}
      {notice && <div role="status" className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">{notice}</div>}
      {loading && <div data-evidence="worksheet-register-loading" className="text-sm text-gray-500">Loading...</div>}

      {!loading && (items.length === 0 ? (
        <div className="mb-6 rounded-lg border border-gray-200 bg-white px-5 py-8 text-center">
          <p className="text-base font-semibold text-orac-slate">No Worksheets yet</p>
          <p className="mt-1 text-sm text-gray-500">Generated monthly registers will appear here after approved Timesheets are available.</p>
        </div>
      ) : (
        <div className="mb-6 overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600"><tr><th className="px-4 py-2">Reference</th><th className="px-4 py-2">Period</th><th className="px-4 py-2">Client / project</th><th className="px-4 py-2">Employees</th><th className="px-4 py-2">Total hours</th><th className="px-4 py-2">Exceptions</th><th className="px-4 py-2">Status</th><th className="px-4 py-2"></th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-2 font-medium text-gray-800">{m.reference}</td>
                  <td className="px-4 py-2 text-gray-600">{formatDateFull(m.period.start)} to {formatDateFull(m.period.end)}</td>
                  <td className="px-4 py-2 text-gray-600">{m.client_name || "-"} / {m.scope.project_title}</td>
                  <td className="px-4 py-2 text-gray-600">{m.roster_size}</td>
                  <td className="px-4 py-2 text-gray-600">{formatTotal(m.totals.total_hours)}</td>
                  <td className="px-4 py-2 text-xs text-gray-600">{exceptionCountsText(m.exception_counts)}</td>
                  <td className="px-4 py-2"><StatusBadge status={m.status} /></td>
                  <td className="px-4 py-2"><button onClick={() => openDetail(m.id)} className="min-h-11 rounded-md px-3 text-sm font-semibold text-orac-cyan hover:bg-sky-50 hover:underline">Open</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {detail && (
        <section aria-label="Worksheet detail" className="space-y-5 rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-orac-slate">{detail.reference}: {detail.title}</h2>
              <p className="text-sm text-gray-500">{detail.client_name} / {detail.scope.project_title}{detail.scope.department_section ? ` / ${detail.scope.department_section}` : ""} · {formatDateFull(detail.period.start)} to {formatDateFull(detail.period.end)}</p>
              <p className="mt-1 text-xs text-gray-500">Reconciliation: <strong>{reconciliationLabel(detail.reconciliation_state)}</strong> · Approver: {detail.approved_by_name || "not yet approved"}</p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={detail.status} />
              <button onClick={() => window.open(`/monthly-worksheets/${detail.id}/print`, "_blank", "noopener")} className="min-h-11 rounded border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Print</button>
              <button onClick={() => setDetail(null)} className="min-h-11 rounded border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">Close</button>
            </div>
          </div>
          <p className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">{billingNotice(detail)}</p>
          <p className="text-xs text-gray-500">{HOLIDAY_NOTICE}</p>

          <div className="overflow-x-auto border border-gray-200">
            <table className="min-w-full text-xs" data-evidence="worksheet-grid">
              <thead className="bg-gray-50">
                <tr>
                  <th rowSpan={2} className="sticky left-0 z-10 min-w-[10rem] border border-gray-200 bg-gray-50 px-2 py-1 text-left">Employee</th>
                  {detail.grid.dates.map((d) => <th key={d.date} colSpan={2} className={`border border-gray-200 px-1 py-1 text-center ${d.day_type !== "weekday" ? "bg-amber-50" : ""}`}>{d.weekday}<br />{formatDateShort(d.date)}</th>)}
                  <th colSpan={4} className="border border-gray-200 px-1 py-1 text-center">Total hours</th>
                  <th rowSpan={2} className="border border-gray-200 px-1 py-1">Carry-over</th>
                </tr>
                <tr>
                  {detail.grid.dates.map((d) => displayCells(d, null).cells.map((c) => <th key={`${d.date}${c.bucket}`} className="border border-gray-200 px-1 text-center font-normal">{SUB_LABEL[c.bucket]}</th>))}
                  <th className="border border-gray-200 px-1 font-normal">N</th><th className="border border-gray-200 px-1 font-normal">1.5</th><th className="border border-gray-200 px-1 font-normal">2.0</th><th className="border border-gray-200 px-1">All</th>
                </tr>
              </thead>
              <tbody>
                {groupRows(detail.grid.rows).map((g) => (
                  <React.Fragment key={g.group || "_"}>
                    {g.group && <tr><td colSpan={detail.grid.dates.length * 2 + 6} className="bg-gray-100 px-2 py-1 font-semibold">{g.group}</td></tr>}
                    {g.rows.map((r) => (
                      <tr key={r.roster_key}>
                        <td className="sticky left-0 border border-gray-200 bg-white px-2 py-1 font-medium">{r.display_name}{!r.technician_id && <span title="Matched by name only" className="ml-1 text-gray-400">*</span>}</td>
                        {detail.grid.dates.map((d) => {
                          const cell = r.cells[d.date]; const v = displayCells(d, cell); const src = cellSourceText(cell);
                          return v.cells.map((c, i) => (
                            <td key={`${d.date}${c.bucket}`} title={src ? `From: ${src}` : undefined} className={`border border-gray-200 px-1 text-center ${src ? "cursor-help" : ""}`}>
                              {c.text}{i === 1 && v.hidden.map((h) => <span key={h.bucket} className="ml-0.5 rounded bg-amber-100 px-0.5 text-amber-800">{SUB_LABEL[h.bucket]}:{h.text}</span>)}
                            </td>
                          ));
                        })}
                        <td className="border border-gray-200 px-1 text-center">{formatTotal(r.totals.normal)}</td>
                        <td className="border border-gray-200 px-1 text-center">{formatTotal(r.totals.ot_15)}</td>
                        <td className="border border-gray-200 px-1 text-center">{formatTotal(r.totals.ot_20)}</td>
                        <td className="border border-gray-200 px-1 text-center font-semibold">{formatTotal(r.totals.total_hours)}</td>
                        <td className="border border-gray-200 px-1 text-center">{r.carry_over ? formatTotal(r.carry_over.normal + r.carry_over.ot_15 + r.carry_over.ot_20) : ""}</td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
                <tr className="bg-gray-50 font-semibold">
                  <td className="sticky left-0 border border-gray-200 bg-gray-50 px-2 py-1">Total hours</td>
                  {detail.grid.dates.map((d) => displayCells(d, detail.grid.totals.by_date[d.date]).cells.map((c) => <td key={`${d.date}${c.bucket}`} className="border border-gray-200 px-1 text-center">{c.text}</td>))}
                  <td className="border border-gray-200 px-1 text-center">{formatTotal(detail.grid.totals.grand.normal)}</td>
                  <td className="border border-gray-200 px-1 text-center">{formatTotal(detail.grid.totals.grand.ot_15)}</td>
                  <td className="border border-gray-200 px-1 text-center">{formatTotal(detail.grid.totals.grand.ot_20)}</td>
                  <td className="border border-gray-200 px-1 text-center">{formatTotal(detail.grid.totals.grand.total_hours)}</td>
                  <td className="border border-gray-200 px-1 text-center">{formatTotal(detail.grid.totals.carry_over.total_hours)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500">Hover a figure to see the record it came from. Totals are raw hours; no weighted hours or amounts are calculated. * = matched by name only.</p>

          <details className="text-sm">
            <summary className="cursor-pointer font-semibold text-orac-slate">Source records ({srcRows.length})</summary>
            <div className="mt-2 max-h-64 overflow-auto">
              <table className="min-w-full text-xs">
                <thead className="text-left text-gray-600"><tr><th className="px-2 py-1">Employee</th><th className="px-2 py-1">Date</th><th className="px-2 py-1">Source</th><th className="px-2 py-1">Record id</th></tr></thead>
                <tbody>{srcRows.map((s) => <tr key={`${s.roster_key}${s.date}${s.record_id}${s.row_index}`}><td className="px-2 py-0.5">{nameOf(s.roster_key)}</td><td className="px-2 py-0.5">{s.date}{s.carry_over ? " (carry-over)" : ""}</td><td className="px-2 py-0.5">{sourceLabel(s.source_type)}</td><td className="px-2 py-0.5">{s.source_type === "timesheet" ? <Link to={`/worksheets?focus=${encodeURIComponent(s.record_id)}`} className="font-semibold text-orac-cyan underline">{s.record_id}</Link> : s.record_id}</td></tr>)}</tbody>
              </table>
            </div>
          </details>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-orac-slate">Exceptions ({exceptionCountsText(detail.exception_counts)})</h3>
              {actions.can_build && <button disabled={busy} onClick={() => act(() => worksheetRegisters.build(detail.id), "Re-generated from the current Timesheets.")} className="rounded border border-gray-300 px-3 py-1 text-sm font-semibold text-gray-700 hover:bg-gray-50">Re-generate</button>}
            </div>
            {exceptions.length === 0 && <p className="text-sm text-gray-500">No exceptions.</p>}
            <ul className="space-y-2">
              {exceptions.map((e) => {
                const refs = refsFromException(e);
                return (
                  <li key={e.key} className={`rounded-md border px-3 py-2 text-sm ${SEV_CLASS[e.severity]}`}>
                    <div className="flex items-start gap-2">
                      {actions.can_acknowledge && e.severity === "warning" && !e.acknowledged_at && <input type="checkbox" aria-label={`Select to acknowledge: ${e.code}`} checked={Boolean(selectedKeys[e.key])} onChange={(ev) => setSelectedKeys((p) => ({ ...p, [e.key]: ev.target.checked }))} className="mt-1" />}
                      <div className="flex-1">
                        <div className="text-xs font-semibold">{SEVERITY_LABEL[e.severity]} · {e.code.replace(/_/g, " ").toLowerCase()}</div>
                        <div>{e.message}</div>
                        {e.acknowledged_at && <div className="mt-1 text-xs">Acknowledged: {e.acknowledgement_note}</div>}
                        {actions.can_edit && refs.length > 0 && e.code !== "ROW_EXCLUDED" && (
                          <div className="mt-2 space-y-1">
                            <input aria-label="Reason for override" value={rowReason[e.key] || ""} onChange={(ev) => setRowReason((p) => ({ ...p, [e.key]: ev.target.value }))} placeholder="Reason (required, kept in the audit trail)" className="w-72 rounded border border-gray-300 px-2 py-1 text-xs text-gray-800" />
                            {refs.map((ref) => (
                              <div key={`${ref.source_type}${ref.record_id}${ref.row_index}`} className="flex flex-wrap items-center gap-3 text-xs">
                                <span>{refLabel(ref)}</span>
                                <button disabled={busy} onClick={() => override(e, ref, "exclude")} className="font-semibold underline">Exclude</button>
                                {e.code === "OUT_OF_PERIOD" && <button disabled={busy} onClick={() => override(e, ref, "carry")} className="font-semibold underline">Include as carry-over</button>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            {actions.can_acknowledge && ackable.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input value={ackNote} onChange={(e) => setAckNote(e.target.value)} placeholder="Acknowledgement note (required)" className="w-72 rounded border border-gray-300 px-2 py-1 text-sm" />
                <button disabled={busy || !chosen.length || ackNote.trim().length < 3} onClick={() => act(() => worksheetRegisters.acknowledge(detail.id, chosen, ackNote.trim()), "Warnings acknowledged.")} className="rounded border border-amber-200 bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-900 disabled:opacity-50">Acknowledge selected ({chosen.length})</button>
              </div>
            )}
          </div>

          {((detail.exclusions || []).length > 0 || (detail.carry_overs || []).length > 0) && (
            <div>
              <h3 className="mb-1 text-sm font-semibold text-orac-slate">Overrides in force</h3>
              <ul className="space-y-1 text-xs text-gray-700">
                {[["exclusions", "Excluded"], ["carry_overs", "Carry-over"]].flatMap(([field, word]) => (detail[field] || []).map((r) => (
                  <li key={`${field}${r.source_type}${r.record_id}${r.row_index}`} className="flex flex-wrap items-center gap-2">
                    <span><strong>{word}:</strong> {refLabel(r)} · {r.reason}</span>
                    {actions.can_edit && <button disabled={busy} onClick={() => reinclude(field, r)} className="font-semibold underline">Remove</button>}
                  </li>
                )))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4">
            {actions.can_submit && <button disabled={busy} onClick={() => act(() => worksheetRegisters.submit(detail.id), "Submitted for approval.")} className="rounded bg-orac-cyan px-4 py-2 text-sm font-semibold text-white">Submit for approval</button>}
            {detail.status === "Submitted" && actions.review_blocked_reason && <p className="text-sm text-amber-800">{actions.review_blocked_reason}</p>}
            {actions.can_review && (<>
              <input value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} placeholder="Comment (required to return)" className="w-60 rounded border border-gray-300 px-2 py-1 text-sm" />
              <button disabled={busy} onClick={() => act(() => worksheetRegisters.review(detail.id, "approve", reviewComment), "Approved.")} className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Approve</button>
              <button disabled={busy || !reviewComment.trim()} onClick={() => act(() => worksheetRegisters.review(detail.id, "return", reviewComment), "Returned for correction.")} className="rounded border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">Return</button>
            </>)}
            {actions.can_reconcile && <button disabled={busy} onClick={() => { if (window.confirm("Record non-billable reconciliation evidence for this approved Worksheet? This does not bill anything.")) act(() => worksheetRegisters.reconcile(detail.id), (r) => (r?.already_recorded ? "Evidence was already recorded." : "Non-billable reconciliation evidence recorded.")); }} className="rounded border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700">Record reconciliation evidence (non-billable)</button>}
            {actions.can_cancel && (<>
              <input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Cancellation reason" className="w-52 rounded border border-gray-300 px-2 py-1 text-sm" />
              <button disabled={busy || cancelReason.trim().length < 3} onClick={() => act(() => worksheetRegisters.cancel(detail.id, cancelReason.trim()), "Cancelled.")} className="text-sm font-semibold text-red-700 underline disabled:opacity-50">Cancel</button>
            </>)}
          </div>
          {detail.supervisor_comment && <p className="text-sm text-gray-600">Reviewer comment: {detail.supervisor_comment}</p>}
          <details className="text-sm">
            <summary className="cursor-pointer font-semibold text-orac-slate">History ({(detail.history || []).length})</summary>
            <ul className="mt-2 space-y-1 text-gray-600">{[...(detail.history || [])].reverse().map((h, i) => <li key={i}>{new Date(h.at).toLocaleString()} · {h.by_name || h.by} · {h.action}{h.comment ? `: ${h.comment}` : ""}</li>)}</ul>
          </details>
        </section>
      )}

      <Modal title="Generate Worksheet" isOpen={createOpen} onClose={() => setCreateOpen(false)} size="xl">
        <div className="space-y-3 text-sm">
          {formError && <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{formError}</div>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="font-semibold text-gray-700 sm:col-span-2">Title<input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} className="mt-1 min-h-11 w-full rounded border border-gray-300 px-3 py-2" /></label>
            <label className="font-semibold text-gray-700">Period start<input type="date" value={form.period_start} onChange={(e) => setForm((p) => ({ ...p, period_start: e.target.value }))} className="mt-1 min-h-11 w-full rounded border border-gray-300 px-3 py-2" /></label>
            <label className="font-semibold text-gray-700">Period end<input type="date" value={form.period_end} onChange={(e) => setForm((p) => ({ ...p, period_end: e.target.value }))} className="mt-1 min-h-11 w-full rounded border border-gray-300 px-3 py-2" /></label>
            <label className="font-semibold text-gray-700">Client
              <select value={form.client_id} onChange={(e) => setForm((p) => ({ ...p, client_id: e.target.value }))} className="mt-1 min-h-11 w-full rounded border border-gray-300 px-3 py-2"><option value="">Select a client</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              {clientsNote && <span className="block text-xs font-normal text-amber-800">{clientsNote}</span>}
            </label>
            <label className="font-semibold text-gray-700">Project / job title<input value={form.project_title} onChange={(e) => setForm((p) => ({ ...p, project_title: e.target.value }))} className="mt-1 min-h-11 w-full rounded border border-gray-300 px-3 py-2" /></label>
            <label className="font-semibold text-gray-700 sm:col-span-2">Department / section (optional, applies to earlier records only)<input value={form.department_section} onChange={(e) => setForm((p) => ({ ...p, department_section: e.target.value }))} className="mt-1 min-h-11 w-full rounded border border-gray-300 px-3 py-2" /></label>
          </div>
          <p className="text-xs text-gray-500">Only Timesheets for this client's jobs are included. {HOLIDAY_NOTICE}</p>
          <div>
            <div className="mb-1 font-semibold text-gray-700">Employees (roster)</div>
            <div className="max-h-40 divide-y divide-gray-100 overflow-y-auto rounded border border-gray-200">
              {candidates.length === 0 && <div className="px-3 py-2 text-gray-400">Pick a period to see workers with Timesheets.</div>}
              {candidates.map((c) => (
                <label key={c.key} className="flex items-center gap-2 px-3 py-1">
                  <input type="checkbox" checked={onRoster(c)} onChange={() => toggle(c)} />
                  <span className="flex-1">{c.display_name}{!c.technician_id && <span className="text-gray-400"> (name only)</span>}</span>
                  <span className="text-xs text-gray-500">{c.approved}/{c.records} approved</span>
                </label>
              ))}
            </div>
            <div className="mt-2 flex gap-2"><input value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="Add employee by name (no linked account)" className="min-h-11 min-w-0 flex-1 rounded border border-gray-300 px-3 py-2" /><button onClick={addManual} className="min-h-11 rounded border border-gray-300 px-3 py-2 font-semibold text-gray-700">Add</button></div>
            <div className="mt-2 text-xs text-gray-600">On roster: {form.roster.length ? form.roster.map((r) => r.display_name).join(", ") : "none yet"}</div>
          </div>
          <p className="text-xs text-gray-500">There is no field to type hours or a rate: the Worksheet is generated from approved Timesheets.</p>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setCreateOpen(false)} className="min-h-11 rounded border border-gray-300 px-4 py-2 font-semibold text-gray-700">Cancel</button>
            <button disabled={busy} onClick={handleCreate} className="min-h-11 rounded bg-orac-cyan px-4 py-2 font-semibold text-white disabled:opacity-50">Generate</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
