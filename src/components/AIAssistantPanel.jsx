import React, { useEffect, useRef, useState } from "react";
import { assistant } from "../api/client.js";
import { Icon, ICONS } from "./icons.jsx";

const ROLE_COPY = {
  Admin: { scope: "System oversight evidence", briefing: "Summarize system attention", attention: "Find blocked approvals" },
  Management: { scope: "Management dashboard evidence", briefing: "Summarize business performance", attention: "Find operational risks" },
  Sales: { scope: "Sales dashboard evidence", briefing: "Summarize sales pipeline", attention: "Find follow-ups" },
  Finance: { scope: "Finance dashboard evidence", briefing: "Summarize finance", attention: "Find finance risks" },
  Operations: { scope: "Operations dashboard evidence", briefing: "Summarize operations", attention: "Find operational risks" },
  Supervisor: { scope: "Supervisor review evidence", briefing: "Summarize team workload", attention: "Find review priorities" },
  Technician: { scope: "Assigned-work evidence", briefing: "Summarize my work", attention: "Find my priority work" },
  "Client Viewer": { scope: "Your organisation's dashboard evidence", briefing: "Summarize my service status", attention: "Find items needing my attention" }
};

function messageText(response) {
  return response.message || response.claims?.map((claim) => claim.sentence).join(" ") || "I could not verify that from your current dashboard evidence.";
}

export default function AIAssistantPanel({ user }) {
  const [config, setConfig] = useState(null);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [flagged, setFlagged] = useState(new Set());
  const conversationEnd = useRef(null);
  const copy = ROLE_COPY[user.role];

  useEffect(() => {
    let cancelled = false;
    setConfig(null);
    setOpen(false);
    setMessages([]);
    if (!copy) {
      setConfig({ enabled: false });
      return () => { cancelled = true; };
    }
    assistant.health()
      .then((data) => { if (!cancelled) setConfig(data); })
      .catch(() => { if (!cancelled) setConfig({ enabled: false }); });
    return () => { cancelled = true; };
  }, [user.role, copy]);

  useEffect(() => {
    if (open) conversationEnd.current?.scrollIntoView({ block: "end" });
  }, [messages, open, loading]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  if (!config?.enabled) return null;

  function focusEvidence(ref) {
    const target = document.getElementById(ref.targetId) || document.querySelector(`[data-evidence-target="${ref.targetId}"]`);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.classList.add("ring-4", "ring-orac-blue/50", "ring-offset-2", "transition-shadow");
    window.setTimeout(() => target.classList.remove("ring-4", "ring-orac-blue/50", "ring-offset-2", "transition-shadow"), 2600);
  }

  async function send(label, request) {
    if (loading) return;
    setError("");
    setLoading(true);
    setMessages((current) => [...current, { id: crypto.randomUUID(), sender: "user", text: label }]);
    try {
      const response = await request();
      setMessages((current) => [...current, { id: response.requestId || crypto.randomUUID(), sender: "assistant", text: messageText(response), response }]);
    } catch (err) {
      setError(err.message);
      setMessages((current) => [...current, { id: crypto.randomUUID(), sender: "assistant", text: "I could not verify that from your current dashboard evidence.", response: { evidenceRefs: [] } }]);
    } finally {
      setLoading(false);
    }
  }

  function submitQuestion(event) {
    event.preventDefault();
    const question = input.trim();
    if (!question) return;
    setInput("");
    send(question, () => assistant.chat(question));
  }

  async function flagResponse(requestId) {
    if (!requestId || flagged.has(requestId)) return;
    try {
      await assistant.flag(requestId);
      setFlagged((current) => new Set([...current, requestId]));
    } catch (err) {
      setError(err.message);
    }
  }

  return <>
    <section className="w-full max-w-sm rounded-lg border border-sky-200 bg-white p-4 shadow-sm" aria-label="Dashboard assistant">
      <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-orac-blue"><Icon path={ICONS.report} /></span><div className="min-w-0 flex-1"><h2 className="text-base font-semibold text-orac-slate">AI assistant</h2><p className="mt-1 text-sm leading-5 text-slate-600">{copy.scope}</p></div></div>
      <button type="button" onClick={() => setOpen(true)} className="mt-4 w-full rounded-lg border border-orac-blue bg-sky-50 px-4 py-2.5 text-sm font-semibold text-orac-blue hover:bg-sky-100 focus:outline-none focus:ring-2 focus:ring-orac-blue/40" aria-haspopup="dialog" aria-expanded={open} aria-controls="dashboard-assistant-panel">Open assistant</button>
    </section>

    {open && <>
      <button type="button" className="fixed inset-0 z-40 cursor-default bg-slate-950/20" onClick={() => setOpen(false)} aria-label="Close assistant" />
      <aside id="dashboard-assistant-panel" role="dialog" aria-modal="true" aria-labelledby="assistant-title" className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5"><div><p className="text-sm font-semibold text-orac-blue">{copy.scope}</p><h2 id="assistant-title" className="mt-1 text-2xl font-semibold text-orac-slate">Dashboard assistant</h2><p className="mt-2 text-sm leading-5 text-slate-600">Ask about the verified information available to your role.</p></div><button type="button" onClick={() => setOpen(false)} className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Close</button></header>
        <div className="border-b border-slate-200 px-6 py-4"><div className="grid gap-3 sm:grid-cols-2"><button type="button" disabled={loading} onClick={() => send(copy.briefing, () => assistant.briefing())} className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-left text-sm font-semibold text-orac-blue hover:bg-sky-100 disabled:opacity-60">{copy.briefing}</button><button type="button" disabled={loading} onClick={() => send(copy.attention, () => assistant.attention())} className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-60">{copy.attention}</button>{config.metrics?.map((metric) => <button key={metric.key} type="button" disabled={loading} onClick={() => send(`Explain ${metric.label}`, () => assistant.explain(metric.key))} className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">Explain {metric.label}</button>)}</div></div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{messages.length === 0 && <div className="max-w-md rounded-lg border border-sky-100 bg-sky-50 p-4 text-sm leading-6 text-slate-700">Ask a dashboard question or choose a quick action. Answers use only the data visible to your role.</div>}<div className="mt-4 space-y-4">{messages.map((message) => <div key={message.id} className={message.sender === "user" ? "ml-auto max-w-[85%] rounded-lg bg-orac-blue p-4 text-sm leading-6 text-white" : "mr-auto max-w-[92%] rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700"}><div className="flex items-start gap-2"><p className="min-w-0 flex-1">{message.text}</p>{message.sender === "assistant" && message.response?.requestId && <button type="button" onClick={() => flagResponse(message.response.requestId)} disabled={flagged.has(message.response.requestId)} className="shrink-0 rounded-md p-1 text-slate-500 hover:bg-white disabled:opacity-60" title="Flag this answer for review" aria-label="Flag this answer for review"><Icon path={ICONS.flag} className="h-4 w-4" /></button>}</div>{message.response?.evidenceRefs?.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{message.response.evidenceRefs.map((ref) => <button key={`${message.id}-${ref.metric}`} type="button" onClick={() => focusEvidence(ref)} className="rounded-full border border-sky-200 bg-white px-3 py-1 text-xs font-semibold text-orac-blue hover:bg-sky-50">View evidence: {ref.label}</button>)}</div>}</div>)}{loading && <div className="mr-auto max-w-sm rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Checking verified dashboard evidence...</div>}<div ref={conversationEnd} /></div></div>
        <form className="border-t border-slate-200 p-4" onSubmit={submitQuestion}>{error && <p className="mb-3 text-sm text-red-700">{error}</p>}<div className="flex gap-3"><input value={input} onChange={(event) => setInput(event.target.value)} maxLength={500} placeholder={`Ask about your ${user.role.toLowerCase()} dashboard...`} className="min-w-0 flex-1 rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20" /><button type="submit" disabled={loading || !input.trim()} className="rounded-lg bg-orac-blue px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Send</button></div></form>
      </aside>
    </>}
  </>;
}
