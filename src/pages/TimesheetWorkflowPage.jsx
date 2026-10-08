import React, { useState } from "react";
import { timesheetWorkflow as api } from "../api/client.js";

// One workspace for the Timesheet workflow packet. Each section renders only for the roles the
// server allows (display convenience; the server decides every action):
//   Sales / Admin  -> Capture from signed paper, custody log
//   Finance / Admin -> Invoice hour variance, override and second approval
//   Admin          -> Owner configuration, authorisers/delegates, client cutover
// Synthetic data only in UAT. No rate or cost field exists anywhere on this page.
const input = "min-h-[44px] w-full rounded-md border border-orac-border bg-white p-2 dark:bg-transparent";
const btn = "min-h-[44px] rounded-lg bg-orac-blue px-5 text-sm font-semibold text-white";
const card = "rounded-xl border border-orac-border bg-white p-5 shadow-sm dark:bg-transparent space-y-3";

function Message({ error, notice }) {
  return (<>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="text-sm text-emerald-700">{notice}</p>}
  </>);
}
function Field({ id, label, value, onChange, type = "text", placeholder }) {
  return (<div><label htmlFor={id} className="mb-1 block text-xs font-medium text-orac-slate">{label}</label>
    <input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={input} /></div>);
}
const useForm = (initial) => { const [v, setV] = useState(initial); return [v, (k) => (val) => setV((p) => ({ ...p, [k]: val })), setV]; };
async function run(setMsg, fn, ok) {
  setMsg({ error: "", notice: "" });
  try { const r = await fn(); setMsg({ error: "", notice: ok(r) }); return r; } catch (err) { setMsg({ error: err.message, notice: "" }); return null; }
}

function PaperCapture() {
  const [f, set] = useForm({ dispatch_card_id: "", technician_id: "", work_date: "", normal: "", ot_15: "0", ot_20: "0", reason_code: "client_not_on_portal", reason_text: "",
    source_channel: "", client_paper_reference: "", received_date: "", custodian_user_id: "", custody_location: "", retention_category: "", scan_hash: "", signatory_name_on_paper: "", legible_and_signed: false });
  const [msg, setMsg] = useState({});
  const total = Number(f.normal || 0) + Number(f.ot_15 || 0) + Number(f.ot_20 || 0);
  const submit = () => run(setMsg, () => api.capturePaper({
    ...f, hours: total, hours_breakdown: { normal: Number(f.normal || 0), ot_15: Number(f.ot_15 || 0), ot_20: Number(f.ot_20 || 0) }, normal: undefined, ot_15: undefined, ot_20: undefined
  }), (r) => (r.data?.status === "Captured_From_Signed_Paper" ? "Captured. It is now an eligible daily source. No stock was moved." : `Saved as an ineligible Draft. Missing: ${(r.missing || []).join(", ")}`));
  return (
    <section className={card} aria-labelledby="pc-h">
      <h2 id="pc-h" className="text-base font-semibold text-orac-heading">Capture from signed paper</h2>
      <p className="text-sm text-orac-secondary">Records you as the capturer. The client is never recorded as acting, and the signatory name is shown as written, not authenticated. Capture never moves stock.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="pc-d" label="Dispatch card id" value={f.dispatch_card_id} onChange={set("dispatch_card_id")} />
        <Field id="pc-t" label="Technician user id" value={f.technician_id} onChange={set("technician_id")} />
        <Field id="pc-w" label="Work date" type="date" value={f.work_date} onChange={set("work_date")} />
        <Field id="pc-n" label="Normal hours (from paper)" value={f.normal} onChange={set("normal")} />
        <Field id="pc-o1" label="1.5 hours" value={f.ot_15} onChange={set("ot_15")} />
        <Field id="pc-o2" label="2.0 hours" value={f.ot_20} onChange={set("ot_20")} />
        <Field id="pc-rc" label="Reason code" value={f.reason_code} onChange={set("reason_code")} placeholder="client_not_on_portal | no_active_authoriser | connectivity_failure | short_contract | agreed_interim_period | other" />
        <Field id="pc-rt" label="Reason (required for 'other')" value={f.reason_text} onChange={set("reason_text")} />
        <Field id="pc-sc" label="Source channel (approved list)" value={f.source_channel} onChange={set("source_channel")} />
        <Field id="pc-pr" label="Client paper reference" value={f.client_paper_reference} onChange={set("client_paper_reference")} />
        <Field id="pc-rd" label="Received date" type="date" value={f.received_date} onChange={set("received_date")} />
        <Field id="pc-cu" label="Original-paper custodian (user id)" value={f.custodian_user_id} onChange={set("custodian_user_id")} />
        <Field id="pc-cl" label="Custody location" value={f.custody_location} onChange={set("custody_location")} />
        <Field id="pc-rk" label="Retention category" value={f.retention_category} onChange={set("retention_category")} />
        <Field id="pc-sh" label="Scan file hash" value={f.scan_hash} onChange={set("scan_hash")} />
        <Field id="pc-sg" label="Signatory name as written (optional)" value={f.signatory_name_on_paper} onChange={set("signatory_name_on_paper")} />
      </div>
      <label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={f.legible_and_signed} onChange={(e) => set("legible_and_signed")(e.target.checked)} />The paper is legible and signed</label>
      <p className="text-xs text-orac-secondary">Total hours {total}. Start and end times never decide the classes; type the classes shown on the paper.</p>
      <button type="button" className={btn} onClick={submit}>Capture</button>
      <Message {...msg} />
    </section>
  );
}

function Custody() {
  const [f, set] = useForm({ paper_reference: "", from: "", to: "", note: "" });
  const [msg, setMsg] = useState({});
  return (
    <section className={card} aria-labelledby="cu-h">
      <h2 id="cu-h" className="text-base font-semibold text-orac-heading">Log paper hand-over</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field id="cu-p" label="Paper reference" value={f.paper_reference} onChange={set("paper_reference")} />
        <Field id="cu-f" label="From" value={f.from} onChange={set("from")} />
        <Field id="cu-t" label="To" value={f.to} onChange={set("to")} />
      </div>
      <button type="button" className={btn} onClick={() => run(setMsg, () => api.logCustody(f), () => "Hand-over logged.")}>Log hand-over</button>
      <Message {...msg} />
    </section>
  );
}

function Variance() {
  const [dispatchId, setDispatchId] = useState("");
  const [v, setV] = useState(null);
  const [o, set] = useForm({ reason_code: "", reason_text: "", evidence_reference: "" });
  const [overrideId, setOverrideId] = useState("");
  const [msg, setMsg] = useState({});
  const check = () => run(setMsg, async () => { const r = await api.variance(dispatchId); setV(r.data || r); return r; }, () => "Checked.");
  return (
    <section className={card} aria-labelledby="va-h">
      <h2 id="va-h" className="text-base font-semibold text-orac-heading">Invoice hour variance</h2>
      <p className="text-sm text-orac-secondary">Billed hours may never exceed eligible hours. Under-billing is a warning. An override needs a reason, evidence, a different user from whoever keyed the billing rows, and a second approver.</p>
      <div className="flex gap-2"><div className="flex-1"><Field id="va-d" label="Dispatch card id" value={dispatchId} onChange={setDispatchId} /></div><button type="button" className={`${btn} self-end`} onClick={check}>Check</button></div>
      {v && (
        <div className="text-sm" aria-live="polite">
          <p>Eligible {v.eligible?.total} h · Billed {v.billed?.total} h · {v.blocked ? "BLOCKED" : "OK"}{v.warnings?.length ? ` · ${v.warnings.length} under-billing warning(s)` : ""}</p>
          {v.blocks?.map((b) => <p key={b.class} className="text-red-700">{b.class}: billed {b.billed} vs eligible {b.eligible}</p>)}
          {v.override && <p className="text-emerald-700">An approved override is in force for this exact state.</p>}
          {v.po_position?.available ? <p>PO {v.po_position.po_reference || ""}: {v.po_position.remaining_value} remaining of {v.po_position.po_value}{v.po_position.warning ? ` · ${v.po_position.warning}` : ""}</p> : <p className="text-orac-secondary">{v.po_position?.note}</p>}
        </div>
      )}
      {v?.blocked && (<>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field id="va-rc" label="Reason code" value={o.reason_code} onChange={set("reason_code")} />
          <Field id="va-rt" label="Reason" value={o.reason_text} onChange={set("reason_text")} />
          <Field id="va-ev" label="Evidence reference" value={o.evidence_reference} onChange={set("evidence_reference")} />
        </div>
        <button type="button" className={btn} onClick={() => run(setMsg, () => api.requestOverride(dispatchId, o), (r) => `Override requested (${r.data?.id}). A second approver is needed.`)}>Request override</button>
      </>)}
      <div className="flex gap-2"><div className="flex-1"><Field id="va-oid" label="Override id to approve (second approver)" value={overrideId} onChange={setOverrideId} /></div>
        <button type="button" className={`${btn} self-end`} onClick={() => run(setMsg, () => api.approveOverride(overrideId), () => "Second approval recorded.")}>Approve</button></div>
      <Message {...msg} />
    </section>
  );
}

function AdminConfig() {
  const [policy, setPolicy] = useState("");
  const [auth, set] = useForm({ kind: "authoriser", client_id: "", user_id: "", title: "", start_date: "", end_date: "", evidence_reference: "", delegate_for_authority_id: "" });
  const [cut, setCut] = useForm({ client_id: "", date: "" });
  const [revokeId, setRevokeId] = useState("");
  const [msg, setMsg] = useState({});
  return (
    <section className={card} aria-labelledby="ad-h">
      <h2 id="ad-h" className="text-base font-semibold text-orac-heading">Owner configuration (Admin)</h2>
      <p className="text-sm text-orac-secondary">Unresolved owner decisions stay on safe defaults until you set them here. See OWNER_CONFIGURATION_REQUIRED.md.</p>
      <button type="button" className={btn} onClick={() => run(setMsg, async () => { const r = await api.getPolicy(); setPolicy(JSON.stringify(r.data, null, 2)); return r; }, () => "Policy loaded.")}>Load policy</button>
      <label htmlFor="ad-pol" className="block text-xs font-medium text-orac-slate">Policy (JSON; send only the keys you want to change)</label>
      <textarea id="ad-pol" rows={8} className={`${input} font-mono text-xs`} value={policy} onChange={(e) => setPolicy(e.target.value)} />
      <button type="button" className={btn} onClick={() => { let patch; try { patch = JSON.parse(policy); } catch { setMsg({ error: "Policy is not valid JSON." }); return; } run(setMsg, () => api.updatePolicy(patch), () => "Policy saved."); }}>Save policy</button>
      <h3 className="pt-2 text-sm font-semibold">Appoint authoriser or delegate</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="au-k" label="Kind (authoriser | delegate)" value={auth.kind} onChange={set("kind")} />
        <Field id="au-c" label="Client id" value={auth.client_id} onChange={set("client_id")} />
        <Field id="au-u" label="Client user id" value={auth.user_id} onChange={set("user_id")} />
        <Field id="au-t" label="Title" value={auth.title} onChange={set("title")} />
        <Field id="au-s" label="Start date" type="date" value={auth.start_date} onChange={set("start_date")} />
        <Field id="au-e" label="End date (required for delegate)" type="date" value={auth.end_date} onChange={set("end_date")} />
        <Field id="au-ev" label="Evidence reference (client letter/email)" value={auth.evidence_reference} onChange={set("evidence_reference")} />
        <Field id="au-d" label="Delegate for authority id" value={auth.delegate_for_authority_id} onChange={set("delegate_for_authority_id")} />
      </div>
      <button type="button" className={btn} onClick={() => run(setMsg, () => api.createAuthority({ ...auth, end_date: auth.end_date || null }), (r) => `Appointed (${r.data?.id}).`)}>Appoint</button>
      <div className="flex gap-2"><div className="flex-1"><Field id="au-r" label="Authority id to revoke (immediate)" value={revokeId} onChange={setRevokeId} /></div>
        <button type="button" className={`${btn} self-end`} onClick={() => run(setMsg, () => api.revokeAuthority(revokeId), () => "Revoked.")}>Revoke</button></div>
      <h3 className="pt-2 text-sm font-semibold">Client cutover date</h3>
      <div className="flex gap-2"><div className="flex-1"><Field id="cu-cid" label="Client id" value={cut.client_id} onChange={setCut("client_id")} /></div>
        <div className="flex-1"><Field id="cu-dt" label="Cutover date" type="date" value={cut.date} onChange={setCut("date")} /></div>
        <button type="button" className={`${btn} self-end`} onClick={() => run(setMsg, () => api.setClientCutover(cut.client_id, cut.date || null), () => "Cutover saved. It cannot be moved once client-confirmed records exist.")}>Save</button></div>
      <Message {...msg} />
    </section>
  );
}

export default function TimesheetWorkflowPage({ user }) {
  const role = user?.role;
  const sales = role === "Sales" || role === "Admin";
  const finance = role === "Finance" || role === "Admin";
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-orac-heading">Timesheet workflow</h1>
      {sales && <PaperCapture />}
      {sales && <Custody />}
      {finance && <Variance />}
      {role === "Admin" && <AdminConfig />}
    </div>
  );
}
