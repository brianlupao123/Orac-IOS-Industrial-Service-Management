import React, { useEffect, useState } from "react";
import { assistant } from "../api/client.js";
import { Icon, ICONS } from "./icons.jsx";

function ResponseLabel({ label }) {
  const unavailable = label === "Unavailable";
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1.5 text-sm font-semibold ${unavailable ? "bg-slate-100 text-slate-700" : "bg-emerald-50 text-emerald-800"}`}>
      {label}
    </span>
  );
}

const ROLE_COPY = {
  Admin: {
    scope: "System oversight evidence",
    briefing: "Summarize system attention",
    attention: "Find blocked approvals"
  },
  Management: {
    scope: "Management dashboard evidence",
    briefing: "Summarize business performance",
    attention: "Find operational risks"
  },
  Sales: {
    scope: "Sales dashboard evidence",
    briefing: "Summarize sales pipeline",
    attention: "Find follow-ups"
  },
  Finance: {
    scope: "Finance dashboard evidence",
    briefing: "Summarize finance",
    attention: "Find finance risks"
  },
  Operations: {
    scope: "Operations dashboard evidence",
    briefing: "Summarize operations",
    attention: "Find operational risks"
  },
  Supervisor: {
    scope: "Supervisor review evidence",
    briefing: "Summarize team workload",
    attention: "Find review priorities"
  },
  Technician: {
    scope: "Assigned-work evidence",
    briefing: "Summarize my work",
    attention: "Find my priority work"
  },
  "Client Viewer": {
    scope: "Your organisation's dashboard evidence",
    briefing: "Summarize my service status",
    attention: "Find items needing my attention"
  }
};

export default function AIAssistantPanel({ user }) {
  const [config, setConfig] = useState(null);
  const [open, setOpen] = useState(false);
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [flagged, setFlagged] = useState(false);
  const assistantEnabledForRole = Object.hasOwn(ROLE_COPY, user.role);
  const copy = ROLE_COPY[user.role] || {
    scope: `${user.role} dashboard evidence`,
    briefing: "Summarize dashboard",
    attention: "Find items needing attention"
  };

  useEffect(() => {
    let cancelled = false;
    setConfig(null);
    setOpen(false);
    setResponse(null);

    if (!assistantEnabledForRole) {
      setConfig({ enabled: false });
      return () => { cancelled = true; };
    }

    assistant.health()
      .then((data) => {
        if (!cancelled) setConfig(data);
      })
      .catch(() => {
        if (!cancelled) setConfig({ enabled: false });
      });
    return () => { cancelled = true; };
  }, [user.role, assistantEnabledForRole]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  if (!config?.enabled) return null;

  function focusEvidence(ref) {
    if (!ref?.targetId) return;
    const target = document.getElementById(ref.targetId) || document.querySelector(`[data-evidence-target="${ref.targetId}"]`);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.classList.add("ring-4", "ring-orac-blue/50", "ring-offset-2", "transition-shadow");
    window.setTimeout(() => {
      target.classList.remove("ring-4", "ring-orac-blue/50", "ring-offset-2", "transition-shadow");
    }, 2600);
  }

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
    <>
      <section className="w-full max-w-sm rounded-lg border border-sky-200 bg-white p-4 shadow-sm" aria-label="Dashboard assistant">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-orac-blue">
            <Icon path={ICONS.report} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-orac-slate">AI assistant</h2>
            <p className="mt-1 text-sm leading-5 text-slate-600">{copy.scope}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 w-full rounded-lg border border-orac-blue bg-sky-50 px-4 py-2.5 text-sm font-semibold text-orac-blue transition-colors hover:bg-sky-100 focus:outline-none focus:ring-2 focus:ring-orac-blue/40"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls="dashboard-assistant-panel"
        >
          Open assistant
        </button>
      </section>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default bg-slate-950/30"
            onClick={() => setOpen(false)}
            aria-label="Close assistant"
          />
          <aside id="dashboard-assistant-panel" role="dialog" aria-modal="true" aria-labelledby="assistant-title" className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-slate-200 bg-white shadow-2xl">
            <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <p className="text-sm font-semibold text-orac-blue">{copy.scope}</p>
                <h2 id="assistant-title" className="mt-1 text-2xl font-semibold text-orac-slate">Dashboard assistant</h2>
                <p className="mt-2 text-sm leading-5 text-slate-600">Ask for a short explanation of the verified information currently available to your role.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orac-blue/40">
                Close
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-6 py-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <button type="button" disabled={loading} onClick={() => run(() => assistant.briefing())} className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-left text-sm font-semibold text-orac-blue hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60">
                  {copy.briefing}
                </button>
                <button type="button" disabled={loading} onClick={() => run(() => assistant.attention())} className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60">
                  {copy.attention}
                </button>
                {config.metrics?.map((metric) => (
                  <button key={metric.key} type="button" disabled={loading} onClick={() => run(() => assistant.explain(metric.key))} className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">
                    Explain {metric.label}
                  </button>
                ))}
              </div>

              {error && <p className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
              {loading && <p className="mt-5 text-sm text-slate-600">Checking your verified dashboard summary...</p>}

              {response && (
                <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-5" aria-live="polite">
                  <div className="flex items-start justify-between gap-3">
                    <ResponseLabel label={response.label} />
                    <button type="button" onClick={flagResponse} disabled={flagged} className="rounded-md p-2 text-slate-500 hover:bg-white hover:text-orac-slate disabled:opacity-60" title={flagged ? "Flag submitted" : "Flag this answer for review"} aria-label={flagged ? "Flag submitted" : "Flag this answer for review"}>
                      <Icon path={ICONS.flag} className="h-5 w-5" />
                    </button>
                  </div>
                  {response.label === "Unavailable" ? (
                    <p className="mt-4 text-sm leading-6 text-slate-700">This request cannot be verified from your current dashboard summary.</p>
                  ) : response.claims.length === 0 ? (
                    <p className="mt-4 text-sm leading-6 text-slate-700">Nothing in the selected dashboard checks currently needs attention.</p>
                  ) : (
                    <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
                      {response.claims.map((claim) => <li key={claim.metric}>{claim.sentence}</li>)}
                    </ul>
                  )}
                  {response.evidenceRefs?.length > 0 && (
                    <div className="mt-5 border-t border-slate-200 pt-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Evidence links</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {response.evidenceRefs.map((ref) => (
                          <button
                            key={`${ref.metric}-${ref.targetId}`}
                            type="button"
                            onClick={() => focusEvidence(ref)}
                            className="rounded-full border border-sky-200 bg-white px-3 py-1.5 text-xs font-semibold text-orac-blue hover:bg-sky-50 focus:outline-none focus:ring-2 focus:ring-orac-blue/40"
                          >
                            {ref.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {flagged && <p className="mt-4 text-sm font-semibold text-emerald-800">Flag submitted for review.</p>}
                </div>
              )}
            </div>
          </aside>
        </>
      )}
    </>
  );
}
