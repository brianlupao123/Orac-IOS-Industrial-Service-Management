import React, { useEffect, useState } from "react";
import { assistant } from "../api/client.js";
import { Icon } from "./icons.jsx";

function ResponseLabel({ label }) {
  const unavailable = label === "Unavailable";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${unavailable ? "bg-gray-100 text-gray-600" : "bg-emerald-50 text-emerald-800"}`}>
      {label}
    </span>
  );
}

export default function AIAssistantPanel({ user }) {
  const [config, setConfig] = useState(null);
  const [open, setOpen] = useState(false);
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [flagged, setFlagged] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setConfig(null);
    setOpen(false);
    setResponse(null);
    assistant.health()
      .then((data) => {
        if (!cancelled) setConfig(data);
      })
      .catch(() => {
        if (!cancelled) setConfig({ enabled: false });
      });
    return () => { cancelled = true; };
  }, [user.role]);

  if (!config?.enabled) return null;

  async function run(action) {
    setLoading(true);
    setError("");
    setFlagged(false);
    try {
      setResponse(await action());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function flagResponse() {
    if (!response?.requestId) return;
    try {
      await assistant.flag(response.requestId);
      setFlagged(true);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="rounded-lg border border-sky-200 bg-sky-50 p-5 shadow-sm" aria-label="Dashboard assistant">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-orac-blue">Dashboard assistant</p>
          <h2 className="mt-1 text-xl font-semibold text-orac-slate">Review your dashboard information</h2>
          <p className="mt-1 text-sm leading-5 text-slate-700">Responses use the same verified figures shown on this page.</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="rounded-lg bg-orac-blue px-5 py-2.5 text-base font-semibold text-white transition-colors hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-orac-blue/40"
          aria-expanded={open}
        >
          {open ? "Close assistant" : "Ask assistant"}
        </button>
      </div>

      {open && (
        <div className="mt-4 border-t border-sky-200 pt-4">
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={loading} onClick={() => run(() => assistant.briefing())} className="rounded-lg border border-sky-300 bg-white px-4 py-2.5 text-base font-semibold text-orac-blue hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60">
              Brief me
            </button>
            <button type="button" disabled={loading} onClick={() => run(() => assistant.attention())} className="rounded-lg border border-sky-300 bg-white px-4 py-2.5 text-base font-semibold text-orac-blue hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60">
              What needs attention
            </button>
            {config.metrics?.map((metric) => (
              <button key={metric.key} type="button" disabled={loading} onClick={() => run(() => assistant.explain(metric.key))} className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-base text-slate-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60">
                Why: {metric.label}
              </button>
            ))}
          </div>

          {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
          {loading && <p className="mt-3 text-sm text-gray-600">Checking your verified dashboard summary...</p>}

          {response && (
            <div className="mt-4 rounded-lg border border-white bg-white p-4" aria-live="polite">
              <div className="flex items-start justify-between gap-3">
                <ResponseLabel label={response.label} />
                <button type="button" onClick={flagResponse} disabled={flagged} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-orac-slate disabled:opacity-60" title={flagged ? "Flag submitted" : "Flag this answer for review"} aria-label={flagged ? "Flag submitted" : "Flag this answer for review"}>
                  <Icon path="M5 21V4m0 0h10l-1 4 1 4H5" className="h-4 w-4" />
                </button>
              </div>
              {response.label === "Unavailable" ? (
                <p className="mt-3 text-sm text-gray-600">This request cannot be verified from your current dashboard summary.</p>
              ) : response.claims.length === 0 ? (
                <p className="mt-3 text-sm text-gray-600">Nothing in the selected dashboard checks currently needs attention.</p>
              ) : (
                <ul className="mt-3 space-y-2 text-sm text-gray-700">
                  {response.claims.map((claim) => <li key={claim.metric}>{claim.sentence}</li>)}
                </ul>
              )}
              {flagged && <p className="mt-3 text-xs font-semibold text-emerald-700">Flag submitted for review.</p>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
