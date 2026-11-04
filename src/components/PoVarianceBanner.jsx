import React, { useCallback, useEffect, useState } from "react";
import { poVariance } from "../api/client.js";
import {
  EVIDENCE_KINDS, bannerTone, figuresLine, issueControl, canAttachEvidence, needsEvidence,
  validateEvidenceForm, buildEvidencePayload, evidenceErrorMessage
} from "../lib/poVarianceModel.js";

// Certified hours vs quoted / PO hours. Shown on the monthly Worksheet (registerId) and, through the same
// component, beside any invoice control (dispatchId). The server is the authority: this only displays its
// verdict and collects Sales evidence. `onState({ disabled, reason, loaded })` lets a neighbouring
// "Prepare / Issue invoice" button disable itself; it fails safe (disabled) until the check has loaded.
//
// The parent must pass a STABLE onState (useCallback / a state setter), or the effect below re-fires every render.
//
// Renders nothing when the server reports the feature is off (409 FEATURE_DISABLED), so it is invisible until enabled.
const TONE = {
  success: "border-orac-success-text bg-orac-success-bg text-orac-success-text",
  warning: "border-orac-warning-text bg-orac-warning-bg text-orac-warning-text",
  danger: "border-orac-danger-text bg-orac-danger-bg text-orac-danger-text",
  neutral: "border-orac-border bg-orac-surface-muted text-orac-text-secondary"
};
const emptyForm = () => ({ kind: "amendment_note", note: "", revised_po_reference: "" });

export default function PoVarianceBanner({ user, registerId, dispatchId, onState }) {
  const [variance, setVariance] = useState(null);
  const [state, setState] = useState("loading"); // loading | ready | failed | off
  const [form, setForm] = useState(emptyForm());
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState("");

  const load = useCallback(async () => {
    setState("loading");
    try {
      const data = registerId ? await poVariance.forRegister(registerId) : await poVariance.forDispatch(dispatchId);
      setVariance(data); setState("ready");
    } catch (err) {
      setVariance(null);
      setState(err?.code === "FEATURE_DISABLED" ? "off" : "failed");
    }
  }, [registerId, dispatchId]);
  useEffect(() => { load(); setSaved(""); setForm(emptyForm()); setFormError(""); }, [load]);

  useEffect(() => {
    if (!onState) return;
    if (state === "off") onState({ disabled: false, reason: "", loaded: true }); // feature dark: do not interfere
    else onState({ ...issueControl(variance, { loaded: state === "ready", failed: state === "failed" }), loaded: state === "ready" });
  }, [variance, state, onState]);

  if (state === "off") return null;
  if (state === "loading") return <p role="status" className="text-xs text-orac-text-muted">Checking the PO budget…</p>;
  if (state === "failed") {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 rounded-md border border-orac-warning-text bg-orac-warning-bg px-3 py-2 text-sm text-orac-warning-text">
        <span>The PO budget check could not be loaded, so invoicing stays disabled.</span>
        <button type="button" onClick={load} className="min-h-11 rounded border border-orac-border px-3 py-2 text-sm font-semibold">Retry</button>
      </div>
    );
  }

  const tone = bannerTone(variance);
  const overrun = variance.status === "overrun";
  const showForm = canAttachEvidence(user?.role) && needsEvidence(variance);

  async function submit(e) {
    e.preventDefault();
    const problem = validateEvidenceForm(form, variance);
    if (problem) { setFormError(problem); return; }
    setBusy(true); setFormError(""); setSaved("");
    try {
      const res = await poVariance.attachEvidence(variance.quote_id, buildEvidencePayload(form, variance));
      setVariance(res.variance); setForm(emptyForm()); setSaved("Evidence attached. Invoicing is unlocked for this overrun.");
    } catch (err) {
      setFormError(evidenceErrorMessage(err));
      if (err?.code === "STALE_VARIANCE") await load();
    } finally { setBusy(false); }
  }

  return (
    <section aria-label="PO budget check" data-po-variance={variance.status} className={`space-y-2 rounded-md border px-3 py-3 ${TONE[tone]}`}>
      <p role={overrun ? "alert" : "status"} className="text-sm font-semibold">{variance.label}</p>
      {figuresLine(variance) && <p className="text-xs">{figuresLine(variance)}</p>}
      {(variance.notes || []).map((n) => <p key={n} className="text-xs">{n}</p>)}
      {variance.status === "within_budget" && <p className="text-xs">This checks hours against the quote and PO only. Other invoice readiness checks still apply.</p>}
      {overrun && variance.evidence && (
        <p className="text-xs">
          Cleared by {variance.evidence.attached_by_name || "Sales"}: {variance.evidence.kind === "revised_po" ? `revised PO ${variance.evidence.revised_po_reference}` : "amendment note"}
          {variance.evidence.note ? ` (${variance.evidence.note})` : ""}. This applies to the hours shown here; more hours need new evidence.
        </p>
      )}
      {overrun && variance.blocks_invoicing && (
        <p className="text-xs font-semibold" data-testid="issue-locked">Invoice issuance is locked until Sales attaches an amendment note or revised PO reference.</p>
      )}
      {saved && <p role="status" className="text-xs font-semibold">{saved}</p>}

      {showForm && (
        <form onSubmit={submit} className="space-y-2 border-t border-orac-border pt-2" aria-label="Attach scope evidence">
          <fieldset className="flex flex-wrap gap-4 text-sm">
            <legend className="sr-only">Evidence type</legend>
            {EVIDENCE_KINDS.map((k) => (
              <label key={k.value} className="flex min-h-11 items-center gap-2">
                <input type="radio" name="evidence-kind" value={k.value} checked={form.kind === k.value} onChange={() => { setForm({ ...form, kind: k.value }); setFormError(""); }} />
                {k.label}
              </label>
            ))}
          </fieldset>
          {form.kind === "revised_po" && (
            <label className="block text-xs">Revised PO reference
              <input value={form.revised_po_reference} onChange={(e) => setForm({ ...form, revised_po_reference: e.target.value })} className="mt-1 block min-h-11 w-full rounded border border-orac-border bg-orac-surface px-2 text-sm text-orac-text-primary" maxLength={100} />
            </label>
          )}
          <label className="block text-xs">{form.kind === "revised_po" ? "Note (optional)" : "Amendment note"}
            <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={3} maxLength={1000} className="mt-1 block w-full rounded border border-orac-border bg-orac-surface px-2 py-1 text-sm text-orac-text-primary" />
          </label>
          {formError && <p role="alert" className="text-xs font-semibold">{formError}</p>}
          <button type="submit" disabled={busy} className="min-h-11 rounded border border-orac-border bg-orac-surface px-3 py-2 text-sm font-semibold text-orac-text-primary disabled:opacity-60">{busy ? "Attaching…" : "Attach evidence"}</button>
        </form>
      )}
      {overrun && variance.blocks_invoicing && !showForm && !canAttachEvidence(user?.role) && (
        <p className="text-xs">Ask Sales to attach the evidence.</p>
      )}
    </section>
  );
}
