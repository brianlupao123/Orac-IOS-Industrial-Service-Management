import React, { useEffect, useRef, useState } from "react";
import { assistant } from "../api/client.js";
import { Icon, ICONS } from "./icons.jsx";

const ROLE_COPY = {
  Admin: {
    scope: "Admin role-scoped dashboard evidence",
    placeholder: "Ask about clients, quotes, blocked amendments, or system attention...",
    quick: [
      { label: "Summarize admin view", type: "briefing" },
      { label: "Find admin attention", type: "attention" },
      { label: "Explain clients", type: "explain", metric: "clients" },
      { label: "Explain blocked amendments", type: "explain", metric: "blocked_amendments" }
    ]
  },
  Management: {
    scope: "Management role-scoped dashboard evidence",
    placeholder: "Ask about pipeline, dispatches, invoices, or review pressure...",
    quick: [
      { label: "Summarize management", type: "briefing" },
      { label: "Find business risks", type: "attention" },
      { label: "Explain dispatches", type: "explain", metric: "dispatches" },
      { label: "Explain reviews", type: "explain", metric: "pending_review" }
    ]
  },
  Sales: {
    scope: "Sales role-scoped dashboard evidence",
    placeholder: "Ask about clients, active quotes, or sales follow-up...",
    quick: [
      { label: "Summarize sales", type: "briefing" },
      { label: "Find follow-ups", type: "attention" },
      { label: "Explain clients", type: "explain", metric: "clients" },
      { label: "Explain quotes", type: "explain", metric: "quotes" }
    ]
  },
  Finance: {
    scope: "Finance role-scoped dashboard evidence",
    placeholder: "Ask about invoices, quotes, PO items, or finance risks...",
    quick: [
      { label: "Summarize finance", type: "briefing" },
      { label: "Find finance risks", type: "attention" },
      { label: "Explain invoices", type: "explain", metric: "invoices" },
      { label: "Explain awaiting PO", type: "explain", metric: "pending_po" }
    ]
  },
  Operations: {
    scope: "Operations role-scoped dashboard evidence",
    placeholder: "Ask about dispatches, worksheets, reviews, or corrections...",
    quick: [
      { label: "Summarize operations", type: "briefing" },
      { label: "Find operational risks", type: "attention" },
      { label: "Explain worksheets", type: "explain", metric: "worksheets" },
      { label: "Explain review queue", type: "explain", metric: "pending_review" }
    ]
  },
  Supervisor: {
    scope: "Supervisor role-scoped dashboard evidence",
    placeholder: "Ask about dispatches, worksheet reviews, or returned work...",
    quick: [
      { label: "Summarize review work", type: "briefing" },
      { label: "Find review priorities", type: "attention" },
      { label: "Explain pending review", type: "explain", metric: "pending_review" },
      { label: "Explain returned work", type: "explain", metric: "returned_for_correction" }
    ]
  },
  Technician: {
    scope: "Technician role-scoped dashboard evidence",
    placeholder: "Ask about assigned dispatches, worksheets, or submitted work...",
    quick: [
      { label: "Summarize my work", type: "briefing" },
      { label: "Find my priorities", type: "attention" },
      { label: "Explain dispatches", type: "explain", metric: "dispatches" },
      { label: "Explain worksheets", type: "explain", metric: "worksheets" }
    ]
  },
  "Client Viewer": {
    scope: "Client role-scoped dashboard evidence",
    placeholder: "Ask about your organisation's quotes, dispatches, or invoices...",
    quick: [
      { label: "Summarize my service", type: "briefing" },
      { label: "Find items to watch", type: "attention" },
      { label: "Explain quotes", type: "explain", metric: "quotes" },
      { label: "Explain invoices", type: "explain", metric: "invoices" }
    ]
  }
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
  const [lastContext, setLastContext] = useState(null);
  const conversationEnd = useRef(null);
  const copy = ROLE_COPY[user.role];

  useEffect(() => {
    let cancelled = false;
    setConfig(null);
    setOpen(false);
    setMessages([]);
    setLastContext(null);
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

  if (!config?.enabled || !copy) return null;

  function focusEvidence(ref) {
    const target = document.getElementById(ref.targetId) || document.querySelector(`[data-evidence-target="${ref.targetId}"]`);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.classList.add("ring-4", "ring-orac-blue/50", "ring-offset-2", "transition-shadow");
    window.setTimeout(() => target.classList.remove("ring-4", "ring-orac-blue/50", "ring-offset-2", "transition-shadow"), 2600);
  }

  function rememberEvidence(response) {
    const first = response?.evidenceRefs?.[0];
    if (first?.metric && first?.targetId) {
      setLastContext({ metric: first.metric, targetId: first.targetId, label: first.label });
    }
  }

  async function send(label, request) {
    if (loading) return;
    setError("");
    setLoading(true);
    setMessages((current) => [...current, { id: crypto.randomUUID(), sender: "user", text: label }]);
    try {
      const response = await request();
      rememberEvidence(response);
      setMessages((current) => [...current, { id: response.requestId || crypto.randomUUID(), sender: "assistant", text: messageText(response), response }]);
    } catch (err) {
      setError(err.message);
      setMessages((current) => [...current, { id: crypto.randomUUID(), sender: "assistant", text: "I could not verify that from your current dashboard evidence.", response: { evidenceRefs: [] } }]);
    } finally {
      setLoading(false);
    }
  }

  function runQuick(action) {
    if (action.type === "briefing") send(action.label, () => assistant.briefing());
    if (action.type === "attention") send(action.label, () => assistant.attention());
    if (action.type === "explain") send(action.label, () => assistant.explain(action.metric));
  }

  function submitQuestion(event) {
    event.preventDefault();
    const question = input.trim();
    if (!question) return;
    setInput("");
    send(question, () => assistant.chat(question, lastContext));
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
    <button type="button" onClick={() => setOpen(true)} className="fixed bottom-6 right-6 z-30 flex items-center gap-3 rounded-full bg-orac-blue px-4 py-3 text-white shadow-lg transition-transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-orac-blue/30" aria-label={`Open ${user.role} dashboard assistant`} title={`Open ${copy.scope}`} aria-haspopup="dialog" aria-expanded={open} aria-controls="dashboard-assistant-panel"><Icon path={ICONS.report} className="h-5 w-5" /><span className="text-sm font-semibold">Ask AI</span></button>

    {open && <>
      <button type="button" className="fixed inset-0 z-40 cursor-default bg-slate-950/20" onClick={() => setOpen(false)} aria-label="Close assistant" />
      <aside id="dashboard-assistant-panel" role="dialog" aria-modal="true" aria-labelledby="assistant-title" className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-700">
        <header className="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <p className="text-xs font-semibold uppercase tracking-wide text-orac-blue">{user.role}</p>
              </div>
              <h2 id="assistant-title" className="mt-1 text-xl font-semibold text-orac-blue">Dashboard assistant</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Role-scoped dashboard evidence</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">Close</button>
          </div>
        </header>

        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div className="grid gap-2 sm:grid-cols-2">
            {copy.quick.map((action) => <button key={action.label} type="button" disabled={loading} onClick={() => runQuick(action)} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-sm font-semibold text-slate-700 hover:border-orac-blue hover:bg-sky-50 disabled:opacity-60 dark:border-slate-700 dark:bg-transparent dark:text-slate-200 dark:hover:bg-sky-950/40">{action.label}</button>)}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {messages.length === 0 && <div className="rounded-lg border border-sky-100 bg-sky-50 p-4 text-sm leading-6 text-slate-700 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-slate-300"><p className="font-semibold text-slate-800 dark:text-slate-100">How can I help?</p><p className="mt-1">Ask about the numbers on this dashboard. I will answer using only evidence available to your role.</p></div>}
          <div className="mt-4 space-y-4">
            {messages.map((message) => <div key={message.id} className={message.sender === "user" ? "ml-auto max-w-[85%] rounded-2xl bg-orac-blue px-4 py-3 text-sm leading-6 text-white" : "mr-auto max-w-[92%] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200"}>
              <div className="flex items-start gap-2">
                <p className="min-w-0 flex-1 whitespace-pre-line">{message.text}</p>
                {message.sender === "assistant" && message.response?.requestId && <button type="button" onClick={() => flagResponse(message.response.requestId)} disabled={flagged.has(message.response.requestId)} className="shrink-0 rounded-md p-1 text-slate-500 hover:bg-white disabled:opacity-60 dark:text-slate-400 dark:hover:bg-slate-700" title="Flag this answer for review" aria-label="Flag this answer for review"><Icon path={ICONS.flag} className="h-4 w-4" /></button>}
              </div>
              {message.response?.evidenceRefs?.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{message.response.evidenceRefs.map((ref) => <button key={`${message.id}-${ref.metric}-${ref.targetId}`} type="button" onClick={() => focusEvidence(ref)} className="rounded-full border border-sky-200 bg-white px-3 py-1 text-xs font-semibold text-orac-blue hover:bg-sky-50 dark:border-sky-800/60 dark:bg-transparent dark:hover:bg-sky-950/40">Show evidence: {ref.label}</button>)}</div>}
            </div>)}
            {loading && <div className="mr-auto max-w-sm rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">Checking verified dashboard evidence...</div>}
            <div ref={conversationEnd} />
          </div>
        </div>

        <form className="border-t border-slate-200 p-4 dark:border-slate-700" onSubmit={submitQuestion}>
          {error && <p className="mb-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
          <div className="flex gap-3">
            <input value={input} onChange={(event) => setInput(event.target.value)} maxLength={500} placeholder={copy.placeholder} className="min-w-0 flex-1 rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20 dark:border-slate-600" />
            <button type="submit" disabled={loading || !input.trim()} className="rounded-lg bg-orac-blue px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Send</button>
          </div>
        </form>
      </aside>
    </>}
  </>;
}
