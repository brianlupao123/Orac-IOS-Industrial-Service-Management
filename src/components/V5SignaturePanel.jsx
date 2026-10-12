import React, { useCallback, useState } from "react";
import { v5Signature } from "../api/client.js";
import {
  canRecordV5Evidence, canShowConfirm, confirmPayload, contactPayload, emptyContactForm, emptyPaperForm, evidenceStatusLabel,
  evidenceStatusTone, hoursLine, needsReplacement, paperPayload, projectContact, projectSignatureState, reasonLabel, sha256OfFile,
  shortHash, v5ErrorAdvice, v5SignatureVisible, validateContactForm, validatePaperForm
} from "../v5SignatureModel.js";

// V5 signed-paper evidence for ONE Timesheet. Renders nothing unless
// VITE_ORAC_V5_COMMERCIAL_WORKFLOW=enabled and the role may see it; the server is the final gate.
// The client-site Supervisor is a named evidence contact only: this panel never creates a login,
// role, OTP/PIN, account or client-portal action. No rate, amount or cost appears here.
const input = "min-h-[44px] w-full rounded-md border border-gray-300 bg-white p-2 text-sm dark:bg-transparent";
const btn = "min-h-[44px] rounded-lg bg-orac-blue px-4 text-sm font-semibold text-white disabled:opacity-60";
const btnGhost = "min-h-[44px] rounded-lg border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 dark:bg-transparent disabled:opacity-60";
const TONE = {
  good: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warn: "border-amber-200 bg-amber-50 text-amber-900",
  bad: "border-red-200 bg-red-50 text-red-800",
  info: "border-sky-200 bg-sky-50 text-sky-800"
};
const Chip = ({ tone = "info", children }) => <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${TONE[tone]}`}>{children}</span>;
const todayIso = () => new Date().toISOString().slice(0, 10);

function Field({ id, label, error, children }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
      {children}
      {error && <p role="alert" className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}
function Check({ id, label, checked, onChange, error }) {
  return (
    <div>
      <label htmlFor={id} className="flex min-h-[44px] items-center gap-2 text-sm text-gray-700">
        <input id={id} type="checkbox" className="h-5 w-5" checked={checked} onChange={(e) => onChange(e.target.checked)} />{label}
      </label>
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    </div>
  );
}

function ContactsBlock({ dispatchId, contacts, reload, setMsg }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(emptyContactForm());
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
  async function add(e) {
    e.preventDefault();
    const found = validateContactForm(f); setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try { await v5Signature.addContact(dispatchId, contactPayload(f)); setF(emptyContactForm()); setOpen(false); setMsg({ notice: "Client Supervisor contact recorded. It is a named evidence contact only: no login or account was created." }); await reload(); }
    catch (err) { setMsg({ error: v5ErrorAdvice(err).message }); } finally { setBusy(false); }
  }
  async function withdraw(c) {
    setBusy(true);
    try { await v5Signature.withdrawContact(c.id); setMsg({ notice: "Contact withdrawn. Evidence already recorded keeps its own copy of the contact." }); await reload(); }
    catch (err) { setMsg({ error: v5ErrorAdvice(err).message }); } finally { setBusy(false); }
  }
  return (
    <div className="space-y-2" aria-label="Client-site Supervisor contacts">
      <h4 className="text-sm font-semibold text-gray-900">Named client-site Supervisor contacts</h4>
      <p className="text-xs text-gray-500">A named person on the client's site who signs the paper. They get no login, role, code or portal access.</p>
      {contacts.length === 0 && <p className="text-sm text-gray-500">No contact recorded for this quotation and dispatch yet.</p>}
      <ul className="space-y-1">
        {contacts.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm">
            <span className="text-gray-700">
              <strong>{c.name}</strong>{c.title ? `, ${c.title}` : ""} · named by: {c.source_reference} · {c.dispatch_card_id ? "this dispatch only" : "whole quotation"}
              {c.status === "withdrawn" && <> <Chip tone="warn">Withdrawn</Chip></>}
            </span>
            {c.status === "active" && <button type="button" disabled={busy} onClick={() => withdraw(c)} className={btnGhost}>Withdraw</button>}
          </li>
        ))}
      </ul>
      {!open ? <button type="button" className={btnGhost} onClick={() => setOpen(true)}>Add client Supervisor contact</button> : (
        <form onSubmit={add} className="space-y-3 rounded-md border border-gray-200 p-3" noValidate>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id={`cs-n-${dispatchId}`} label="Name" error={errors.name}><input id={`cs-n-${dispatchId}`} className={input} value={f.name} onChange={(e) => set("name")(e.target.value)} /></Field>
            <Field id={`cs-t-${dispatchId}`} label="Title (optional)"><input id={`cs-t-${dispatchId}`} className={input} value={f.title} onChange={(e) => set("title")(e.target.value)} /></Field>
            <Field id={`cs-p-${dispatchId}`} label="Phone (optional)"><input id={`cs-p-${dispatchId}`} className={input} value={f.phone} onChange={(e) => set("phone")(e.target.value)} /></Field>
            <Field id={`cs-e-${dispatchId}`} label="Email (optional)" error={errors.email}><input id={`cs-e-${dispatchId}`} type="email" className={input} value={f.email} onChange={(e) => set("email")(e.target.value)} /></Field>
          </div>
          <Field id={`cs-s-${dispatchId}`} label="How did the client name this person? (PO, email, minutes)" error={errors.source_reference}><input id={`cs-s-${dispatchId}`} className={input} value={f.source_reference} onChange={(e) => set("source_reference")(e.target.value)} /></Field>
          <Check id={`cs-d-${dispatchId}`} label="Valid for this dispatch only" checked={f.dispatch_scoped} onChange={set("dispatch_scoped")} />
          <div className="flex gap-2"><button type="submit" disabled={busy} className={btn}>{busy ? "Saving..." : "Save contact"}</button><button type="button" className={btnGhost} onClick={() => setOpen(false)}>Cancel</button></div>
        </form>
      )}
    </div>
  );
}

function PaperForm({ ws, state, contacts, userId, reload, setMsg }) {
  const replace = needsReplacement(state);
  const [f, setF] = useState(emptyPaperForm(userId));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
  const active = contacts.filter((c) => c.status === "active");
  async function hashFile(e) {
    const file = e.target.files?.[0]; if (!file) return;
    try { set("scan_hash")(await sha256OfFile(file)); setMsg({ notice: "Scan hash computed in this browser. The file was not uploaded." }); }
    catch { setMsg({ error: "Could not compute the hash here. Paste the SHA-256 value instead." }); }
  }
  async function submit(e) {
    e.preventDefault();
    const found = validatePaperForm(f, { workDate: ws.work_date, today: todayIso(), needsReplacementReason: replace });
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try { await v5Signature.recordPaper(ws.id, paperPayload(f, { needsReplacementReason: replace })); setF(emptyPaperForm(userId)); setMsg({ notice: "Signed-paper evidence recorded. The assigned ORAC Supervisor must now confirm it." }); await reload(); }
    catch (err) { setMsg({ error: v5ErrorAdvice(err).message }); } finally { setBusy(false); }
  }
  const id = (s) => `pp-${s}-${ws.id}`;
  return (
    <form onSubmit={submit} noValidate className="space-y-3 rounded-md border border-gray-200 p-3" aria-label="Record signed-paper evidence">
      <h4 className="text-sm font-semibold text-gray-900">{replace ? "Replace signed-paper evidence" : "Record signed-paper evidence"}</h4>
      <p className="text-xs text-gray-500">Both the worker and the client-site Supervisor signed the same paper Timesheet. You are recording evidence about that paper; the client is never recorded as acting in the system. Evidence is kept permanently and is tied to the hours shown above.</p>
      <Field id={id("c")} label="Named client Supervisor contact" error={errors.client_supervisor_contact_id}>
        <select id={id("c")} className={input} value={f.client_supervisor_contact_id} onChange={(e) => set("client_supervisor_contact_id")(e.target.value)}>
          <option value="">Select a contact</option>
          {active.map((c) => <option key={c.id} value={c.id}>{c.name}{c.title ? `, ${c.title}` : ""}</option>)}
        </select>
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id={id("w")} label="Worker's name as written on the paper" error={errors.worker_name_on_paper}><input id={id("w")} className={input} value={f.worker_name_on_paper} onChange={(e) => set("worker_name_on_paper")(e.target.value)} /></Field>
        <Field id={id("s")} label="Client Supervisor's name as written on the paper" error={errors.client_supervisor_name_on_paper}><input id={id("s")} className={input} value={f.client_supervisor_name_on_paper} onChange={(e) => set("client_supervisor_name_on_paper")(e.target.value)} /></Field>
        <Field id={id("r")} label="Paper evidence reference" error={errors.evidence_reference}><input id={id("r")} className={input} value={f.evidence_reference} onChange={(e) => set("evidence_reference")(e.target.value)} /></Field>
        <Field id={id("ch")} label="Source channel" error={errors.source_channel}><input id={id("ch")} className={input} value={f.source_channel} onChange={(e) => set("source_channel")(e.target.value)} /></Field>
        <Field id={id("cu")} label="Original-paper custodian (ORAC user id)" error={errors.custodian_user_id}><input id={id("cu")} className={input} value={f.custodian_user_id} onChange={(e) => set("custodian_user_id")(e.target.value)} /></Field>
        <Field id={id("d")} label="Date received" error={errors.received_date}><input id={id("d")} type="date" className={input} min={ws.work_date || undefined} max={todayIso()} value={f.received_date} onChange={(e) => set("received_date")(e.target.value)} /></Field>
      </div>
      <Field id={id("h")} label="Scan SHA-256 hash" error={errors.scan_hash}>
        <input id={id("h")} className={`${input} font-mono text-xs`} value={f.scan_hash} onChange={(e) => set("scan_hash")(e.target.value)} />
      </Field>
      <Field id={id("f")} label="Or choose the scan file to compute its hash here (not uploaded)"><input id={id("f")} type="file" className="block min-h-[44px] w-full text-sm" onChange={hashFile} /></Field>
      <p className="text-xs text-gray-500">The person who is custodian of the paper cannot later confirm it as the ORAC Supervisor.</p>
      {replace && (
        <Field id={id("rr")} label="Reason this replaces the current evidence" error={errors.replacement_reason}><input id={id("rr")} className={input} value={f.replacement_reason} onChange={(e) => set("replacement_reason")(e.target.value)} /></Field>
      )}
      <Check id={id("ws")} label="The worker's signature is present on the paper" checked={f.worker_signed_on_paper} onChange={set("worker_signed_on_paper")} error={errors.worker_signed_on_paper} />
      <Check id={id("cs")} label="The client Supervisor's signature is present on the paper" checked={f.client_supervisor_signed_on_paper} onChange={set("client_supervisor_signed_on_paper")} error={errors.client_supervisor_signed_on_paper} />
      <Check id={id("at")} label="I have the original signed paper Timesheet and its signatures match the hours and classification shown." checked={f.paper_attestation} onChange={set("paper_attestation")} error={errors.paper_attestation} />
      <button type="submit" disabled={busy} className={btn}>{busy ? "Recording..." : replace ? "Record replacement evidence" : "Record evidence"}</button>
    </form>
  );
}

export default function V5SignaturePanel({ ws, user }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [msg, setMsg] = useState({});
  const [attest, setAttest] = useState(false);
  const [busy, setBusy] = useState(false);
  const canRecord = canRecordV5Evidence(user?.role);

  const reload = useCallback(async () => {
    setLoading(true); setLoadError("");
    try {
      const raw = await v5Signature.state(ws.id);
      setState(projectSignatureState(raw));
      if (canRecord && ws.dispatch_card_id) {
        const rows = await v5Signature.contacts(ws.dispatch_card_id);
        setContacts((Array.isArray(rows) ? rows : []).map(projectContact));
      }
    } catch (err) { setLoadError(v5ErrorAdvice(err).message); } finally { setLoading(false); }
  }, [ws.id, ws.dispatch_card_id, canRecord]);

  if (!v5SignatureVisible(user?.role)) return null;
  const toggle = () => { const next = !open; setOpen(next); if (next && !state) reload(); };

  async function confirm() {
    if (!canShowConfirm(user.role, state) || !attest) return;
    setBusy(true); setMsg({});
    try { const raw = await v5Signature.confirm(ws.id, confirmPayload(state)); setState(projectSignatureState(raw)); setAttest(false); setMsg({ notice: "Confirmed. Your confirmation is bound to these exact hours and this evidence record." }); }
    catch (err) { const advice = v5ErrorAdvice(err); setMsg({ error: advice.message }); setAttest(false); if (advice.reload) await reload(); }
    finally { setBusy(false); }
  }

  const tone = state?.verified ? "good" : "warn";
  return (
    <section className="mt-4 rounded-lg border border-gray-200 bg-white p-4 dark:bg-transparent" aria-label="V5 signed-paper evidence">
      <button type="button" onClick={toggle} aria-expanded={open} className="flex min-h-[44px] w-full items-center justify-between text-left text-sm font-semibold text-gray-900">
        <span>Signed-paper evidence (V5)</span><span aria-hidden="true">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-4">
          {loading && <p className="text-sm text-gray-500">Loading evidence...</p>}
          {loadError && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{loadError}</p>}
          {msg.error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{msg.error}</p>}
          {msg.notice && <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{msg.notice}</p>}
          {state && (<>
            <div className="space-y-1">
              <p className="text-sm text-gray-700"><Chip tone={tone}>{state.verified ? "Verified" : "Not verified"}</Chip> <span className="ml-1">{hoursLine(state.hours)}</span></p>
              <p className="text-xs text-gray-500">Evidence is tied to these exact hours (reference {shortHash(state.current_hash)}). If the hours are corrected, earlier evidence is kept but no longer counts.</p>
              {!state.verified && state.reasons.length > 0 && (
                <ul className="list-disc pl-5 text-sm text-amber-900">{state.reasons.map((r) => <li key={r}>{reasonLabel(r)}</li>)}</ul>
              )}
            </div>

            {state.evidence ? (
              <div className="rounded-md border border-gray-200 p-3 text-sm text-gray-700" aria-label="Current paper evidence">
                <p className="font-semibold text-gray-900">Current paper evidence</p>
                <p>Worker on paper: {state.evidence.worker_name_on_paper} · Client Supervisor on paper: {state.evidence.client_supervisor_name_on_paper}</p>
                <p>Named contact: {state.evidence.contact?.name}{state.evidence.contact?.title ? `, ${state.evidence.contact.title}` : ""} (evidence only, no account)</p>
                <p>Reference {state.evidence.evidence_reference} · channel {state.evidence.source_channel} · received {state.evidence.received_date}</p>
                <p>Custodian user: {state.evidence.custodian_user_id} · scan {shortHash(state.evidence.scan_hash)}</p>
                {state.evidence.replacement_reason && <p>Replaces earlier evidence: {state.evidence.replacement_reason}</p>}
              </div>
            ) : <p className="text-sm text-gray-500">No current paper evidence for these hours.</p>}

            <div className="text-sm text-gray-700" aria-label="ORAC Supervisor confirmation">
              <p className="font-semibold text-gray-900">ORAC Supervisor confirmation</p>
              {state.confirmation ? <p><Chip tone="good">Confirmed</Chip> on {String(state.confirmation.confirmed_at || "").slice(0, 10)} for these exact hours.</p> : <p><Chip tone="warn">Not confirmed</Chip> Only the ORAC Supervisor assigned to this dispatch can confirm.</p>}
              {canShowConfirm(user.role, state) && (
                <div className="mt-2 space-y-2 rounded-md border border-gray-200 p-3">
                  <p className="text-xs text-gray-500">You are confirming the current paper evidence above for {hoursLine(state.hours)}. You cannot confirm evidence you recorded or hold, or a Timesheet you entered.</p>
                  <label htmlFor={`cf-${ws.id}`} className="flex min-h-[44px] items-center gap-2 text-sm"><input id={`cf-${ws.id}`} type="checkbox" className="h-5 w-5" checked={attest} onChange={(e) => setAttest(e.target.checked)} />I confirm this evidence matches these exact hours.</label>
                  <button type="button" disabled={!attest || busy} onClick={confirm} className={btn}>{busy ? "Confirming..." : "Confirm for these hours"}</button>
                </div>
              )}
              {canRecord && <p className="mt-1 text-xs text-gray-500">Sales and Admin record the paper evidence; they cannot provide the ORAC Supervisor confirmation.</p>}
            </div>

            {(state.evidence_history.length > 0 || state.confirmation_history.length > 0) && (
              <details className="text-sm text-gray-700">
                <summary className="min-h-[44px] cursor-pointer py-2 font-semibold text-gray-900">History (kept, never deleted)</summary>
                <ul className="space-y-1 pl-1">
                  {state.evidence_history.map((e) => <li key={e.id}>Evidence {shortHash(e.hours_hash)} · {String(e.recorded_at || "").slice(0, 10)} · <Chip tone={evidenceStatusTone(e.status)}>{evidenceStatusLabel(e.status)}</Chip></li>)}
                  {state.confirmation_history.map((c) => <li key={c.id}>Confirmation {shortHash(c.hours_hash)} · {String(c.confirmed_at || "").slice(0, 10)} · <Chip tone={c.current ? "good" : "warn"}>{c.current ? "Current" : "No longer current"}</Chip></li>)}
                </ul>
              </details>
            )}

            {canRecord && ws.dispatch_card_id && <ContactsBlock dispatchId={ws.dispatch_card_id} contacts={contacts} reload={reload} setMsg={setMsg} />}
            {canRecord && <PaperForm key={`${state.current_hash}-${state.evidence?.id || "none"}`} ws={ws} state={state} contacts={contacts} userId={user?.id || ""} reload={reload} setMsg={setMsg} />}
          </>)}
        </div>
      )}
    </section>
  );
}
