import React, { useState } from "react";
import { dispatch as dispatchApi } from "../api/client.js";
import { projectReadiness, reasonLabel, v5ErrorAdvice, v5ReadinessVisible } from "../v5SignatureModel.js";

// Read-only, rate-free billing readiness for ONE dispatch: verified hours only, no rate, amount,
// invoice total, cost or editable invoice action. Hidden unless the V5 flag is enabled.
const btnGhost = "min-h-[44px] rounded-lg border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 dark:bg-transparent disabled:opacity-60";
export default function V5BillingReadinessPanel({ user, dispatchId, label }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  if (!v5ReadinessVisible(user?.role) || !dispatchId) return null;
  async function load() {
    setLoading(true); setError("");
    try { setData(projectReadiness(await dispatchApi.v5BillingReadiness(dispatchId))); }
    catch (err) { setError(v5ErrorAdvice(err).message); setData(null); } finally { setLoading(false); }
  }
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 dark:bg-transparent" aria-label="V5 verified hours">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900">Verified hours (V5){label ? ` · ${label}` : ""}</h3>
        <button type="button" disabled={loading} onClick={load} className={btnGhost}>{loading ? "Loading..." : data ? "Refresh" : "Show verified hours"}</button>
      </div>
      <p className="mt-1 text-xs text-gray-500">Hours only. A Timesheet counts once signed-paper evidence and the assigned ORAC Supervisor's confirmation both match its current hours. Read-only.</p>
      {error && <p role="alert" className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      {data && (
        <div className="mt-3 space-y-3 text-sm text-gray-700">
          <p><span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${data.ready ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>{data.ready ? "Ready for pricing review" : "Not ready for pricing review"}</span> <span className="ml-1">Quotation {data.quotation_number} · {data.total_hours} verified h</span></p>
          {data.blockers.length > 0 && <ul className="list-disc pl-5 text-amber-900">{data.blockers.map((b) => <li key={b}>{b}</li>)}</ul>}
          <ul className="space-y-1">
            {data.lines.map((l) => <li key={l.quote_line_id} className="rounded-md border border-gray-200 px-3 py-2">{l.description || l.quote_line_id}{l.pricing_basis ? ` (${l.pricing_basis})` : ""}: <strong>{l.canonical_hours} h</strong> from {l.source_count} Timesheet{l.source_count === 1 ? "" : "s"}</li>)}
          </ul>
          {data.unmapped_hours > 0 && <p className="text-amber-900">{data.unmapped_hours} verified h have no quotation-line link.</p>}
          {data.unverified.length > 0 && (
            <div>
              <p className="font-semibold text-gray-900">Not counted yet: {data.unverified_hours} h</p>
              <ul className="space-y-1">{data.unverified.map((t) => <li key={t.id} className="rounded-md border border-gray-200 px-3 py-2">{t.hours} h · {t.reasons.map(reasonLabel).join("; ") || "no reason given"}</li>)}</ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
