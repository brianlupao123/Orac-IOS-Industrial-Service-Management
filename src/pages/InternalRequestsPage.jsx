import React, { useCallback, useEffect, useState } from "react";
import { internalWorkRequests } from "../api/client.js";
import PageHeaderBanner from "../components/PageHeaderBanner.jsx";
import InternalRequestCard from "../components/InternalRequestCard.jsx";
import InternalRequestForm from "../components/InternalRequestForm.jsx";
import { ICONS } from "../components/icons.jsx";
import { ErrorBanner, PageEmptyState } from "../components/PageStates.jsx";
import {
  COORDINATION_ONLY_NOTICE, INTERNAL_REQUEST_STATUSES, asRequestList, isForbidden, isStaleState, normaliseOptions
} from "../internalWorkRequestModel.js";

const EMPTY_LIST = { items: [], loading: true, loaded: false, error: "", forbidden: false };

// One page: the person's own requests and, where the server allows it, the team
// inbox. The server scopes both lists from the session and supplies the create
// options and each request's allowed_actions; this page renders them and
// reloads from the server after every successful change.
export default function InternalRequestsPage({ user }) {
  const [options, setOptions] = useState(null);
  const [optionsState, setOptionsState] = useState({ loading: true, error: "", forbidden: false });
  const [outbox, setOutbox] = useState(EMPTY_LIST);
  const [inbox, setInbox] = useState(EMPTY_LIST);
  const [tab, setTab] = useState("mine");
  const [filter, setFilter] = useState("");
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [notes, setNotes] = useState({});
  const [openId, setOpenId] = useState("");
  const [detail, setDetail] = useState(null);

  const loadOptions = useCallback(async () => {
    setOptionsState({ loading: true, error: "", forbidden: false });
    try {
      setOptions(normaliseOptions(await internalWorkRequests.options()));
      setOptionsState({ loading: false, error: "", forbidden: false });
    } catch (err) {
      setOptionsState({ loading: false, error: err.message, forbidden: isForbidden(err) });
    }
  }, []);

  const loadList = useCallback(async (kind, status) => {
    const setList = kind === "inbox" ? setInbox : setOutbox;
    // forbidden is kept while reloading so the Team Inbox tab does not flicker.
    setList((current) => ({ ...current, loading: true, error: "" }));
    try {
      const rows = kind === "inbox" ? await internalWorkRequests.inbox(status || undefined) : await internalWorkRequests.outbox(status || undefined);
      setList({ items: asRequestList(rows, kind === "inbox" ? "the team inbox" : "your requests"), loading: false, loaded: true, error: "", forbidden: false });
    } catch (err) {
      setList({ items: [], loading: false, loaded: true, error: err.message, forbidden: isForbidden(err) });
    }
  }, []);

  const refreshAll = useCallback(() => Promise.all([loadList("mine", filter), loadList("inbox", filter)]), [loadList, filter]);

  const loadDetail = useCallback(async (id) => {
    setDetail({ id, loading: true, error: "", data: null });
    try {
      setDetail({ id, loading: false, error: "", data: await internalWorkRequests.detail(id) });
    } catch (err) {
      setDetail({ id, loading: false, error: err.message, data: null });
    }
  }, []);

  useEffect(() => { loadOptions(); }, [loadOptions]);
  useEffect(() => { refreshAll(); }, [refreshAll]);

  // "Team Inbox" exists only when the server has answered the inbox request for
  // this session without refusing it. A refusal is not an error to show.
  const showInbox = inbox.loaded && !inbox.forbidden;
  const activeTab = tab === "inbox" && showInbox ? "inbox" : "mine";
  const list = activeTab === "inbox" ? inbox : outbox;

  async function create(payload) {
    await internalWorkRequests.create(payload);
    setNotice("");
    setActionError("");
    await refreshAll();
  }

  async function act(item, action) {
    setBusyId(item.id);
    setActionError("");
    setNotice("");
    try {
      const updated = action === "acknowledge"
        ? await internalWorkRequests.acknowledge(item.id)
        : await internalWorkRequests.transition(item.id, action, notes[item.id]);
      setNotes((current) => ({ ...current, [item.id]: "" }));
      setNotice(`"${item.subject}" is now ${updated?.status || "updated"}. Nothing else in ORAC was changed by this.`);
      await refreshAll();
      if (openId === item.id) await loadDetail(item.id);
    } catch (err) {
      if (err.sessionExpired) return;
      setActionError(err.message);
      if (isStaleState(err)) {
        await refreshAll();
        if (openId === item.id) await loadDetail(item.id);
      }
    } finally {
      setBusyId("");
    }
  }

  function toggle(id) {
    if (openId === id) {
      setOpenId("");
      setDetail(null);
      return;
    }
    setOpenId(id);
    loadDetail(id);
  }

  const tabClass = (active) => `rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${active ? "bg-orac-navy text-white shadow-sm" : "text-gray-600 hover:bg-white hover:text-orac-navy"}`;

  return (
    <div className="space-y-6" data-evidence="internal-requests-page">
      <PageHeaderBanner eyebrow="Staff coordination" title="Internal Requests" subtitle="Coordinate with another team and respond to requests sent to you. Every step is recorded." iconPath={ICONS.clipboard} />
      <p data-evidence="coordination-notice" className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">{COORDINATION_ONLY_NOTICE}</p>

      <div className="grid gap-6 lg:grid-cols-3">
        <section aria-label="Raise a request" className="lg:col-span-1">
          {optionsState.loading ? (
            <div className="py-12 text-center text-gray-400">Loading request options...</div>
          ) : optionsState.forbidden ? (
            <div data-evidence="internal-requests-read-only" className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-700 shadow-sm">
              New internal requests are not available to your role. Use the Team Inbox to review and respond to requests sent to your team.
            </div>
          ) : optionsState.error ? (
            <div className="space-y-3">
              <ErrorBanner message={optionsState.error} />
              <button type="button" onClick={loadOptions} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-orac-slate hover:bg-gray-50">Try again</button>
            </div>
          ) : (
            <InternalRequestForm options={options} requesterRole={user?.role} onCreate={create} />
          )}
        </section>

        <section aria-label="Requests" className="space-y-4 lg:col-span-2">
          <div className="flex flex-wrap items-center gap-3">
            <div role="group" aria-label="Request lists" className="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
              <button type="button" aria-pressed={activeTab === "mine"} onClick={() => setTab("mine")} className={tabClass(activeTab === "mine")}>My Requests</button>
              {showInbox && <button type="button" aria-pressed={activeTab === "inbox"} onClick={() => setTab("inbox")} className={tabClass(activeTab === "inbox")}>Team Inbox</button>}
            </div>
            <label htmlFor="iwr-filter" className="text-sm font-medium text-gray-600">Status</label>
            <select id="iwr-filter" value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
              <option value="">All statuses</option>
              {INTERNAL_REQUEST_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
            <button type="button" onClick={refreshAll} disabled={list.loading} className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-orac-slate hover:bg-gray-50 disabled:opacity-50">Refresh</button>
          </div>

          {actionError && <ErrorBanner message={actionError} />}
          {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}

          {list.loading ? (
            <div className="py-12 text-center text-gray-400">{activeTab === "inbox" ? "Loading the team inbox..." : "Loading your requests..."}</div>
          ) : list.error ? (
            <div className="space-y-3">
              <div data-evidence={list.forbidden ? "forbidden-state" : undefined}><ErrorBanner message={list.error} /></div>
              {!list.forbidden && (
                <button type="button" onClick={refreshAll} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-orac-slate hover:bg-gray-50">Try again</button>
              )}
            </div>
          ) : list.items.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
              <PageEmptyState
                iconPath={ICONS.clipboard}
                title={activeTab === "inbox" ? "The team inbox is empty" : "No requests yet"}
                subtitle={filter ? `There are no ${filter.toLowerCase()} requests here.` : activeTab === "inbox" ? "Requests sent to your team will appear here." : "Requests you send will appear here with their status."}
              />
            </div>
          ) : (
            <ul className="space-y-4">
              {list.items.map((item) => (
                <InternalRequestCard
                  key={item.id}
                  item={item}
                  mode={activeTab}
                  open={openId === item.id}
                  detail={detail && detail.id === item.id ? detail : null}
                  note={notes[item.id] || ""}
                  noteLimit={options ? options.limits.note : undefined}
                  busy={busyId === item.id}
                  onToggle={toggle}
                  onNoteChange={(value) => setNotes((current) => ({ ...current, [item.id]: value }))}
                  onAction={act}
                />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
