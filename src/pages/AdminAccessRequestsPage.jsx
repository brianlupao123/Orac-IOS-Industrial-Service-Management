import React, { useCallback, useEffect, useRef, useState } from "react";
import { accessRequests, collections } from "../api/client.js";
import SearchableSelect from "../components/SearchableSelect.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import DataTable from "../components/DataTable.jsx";
import { ErrorBanner } from "../components/PageStates.jsx";

const ALL_ROLES = [
  "Admin", "Management", "Sales", "Finance",
  "Operations", "Technician", "Supervisor", "Client Viewer"
];

/**
 * Admin inbox for access requests. This list is the source of truth: a request is
 * here whether or not its notification was ever seen. Admin alone decides, and
 * chooses the role that is actually granted. Approval creates the account with no
 * password; the Admin then issues a one-time setup link and hands it over. The link
 * is held in component state only: never stored, logged or re-fetched.
 */
export default function AdminAccessRequestsPage({ focusId = null }) {
  const [requests, setRequests] = useState([]);
  const [clients, setClients] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [decision, setDecision] = useState({}); // id -> { role, client_id, reason }
  const [busyId, setBusyId] = useState(null);
  const [handoff, setHandoff] = useState(null); // { requestId, email, url, expiresAt }
  const [copied, setCopied] = useState(false);
  const focusRef = useRef(null);

  const load = useCallback(() => {
    setStatus((s) => (s === "ready" ? s : "loading"));
    setError("");
    return Promise.all([accessRequests.list(), collections.list("clients")])
      .then(([reqs, clientList]) => {
        setRequests(Array.isArray(reqs) ? reqs : []);
        setClients(Array.isArray(clientList) ? clientList : []);
        setStatus("ready");
      })
      .catch((err) => {
        setError(err.message || "Access requests could not be loaded.");
        setStatus("error");
      });
  }, []);

  useEffect(() => { load(); }, [load]);

  const pending = requests.filter((r) => r.status === "Pending");
  const resolved = requests.filter((r) => r.status !== "Pending");
  const focused = focusId ? requests.find((r) => r.id === focusId) : null;
  const focusMissing = status === "ready" && focusId && !focused;

  useEffect(() => {
    if (focused && focusRef.current) {
      focusRef.current.scrollIntoView?.({ block: "center" });
      focusRef.current.focus?.({ preventScroll: true });
    }
  }, [focused?.id, status]);

  const patch = (id, changes) => setDecision((d) => ({ ...d, [id]: { ...d[id], ...changes } }));

  async function handleApprove(r) {
    const chosen = decision[r.id] || {};
    const role = chosen.role || r.requested_role;
    setBusyId(r.id);
    setActionError("");
    try {
      await accessRequests.approve(r.id, { role, client_id: role === "Client Viewer" ? chosen.client_id : undefined });
      await load();
    } catch (err) {
      setActionError(`Could not approve ${r.email}: ${err.message}`);
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(r) {
    setBusyId(r.id);
    setActionError("");
    try {
      await accessRequests.reject(r.id, (decision[r.id] || {}).reason || "");
      await load();
    } catch (err) {
      setActionError(`Could not reject ${r.email}: ${err.message}`);
    } finally {
      setBusyId(null);
    }
  }

  async function handleIssueLink(r) {
    setBusyId(r.id);
    setActionError("");
    setCopied(false);
    try {
      const data = await accessRequests.issueSetupLink(r.id);
      setHandoff({ requestId: r.id, email: data.email, url: `${window.location.origin}${data.setup_path}`, expiresAt: data.expires_at });
    } catch (err) {
      setHandoff(null);
      setActionError(`Could not issue a setup link for ${r.email}: ${err.message}`);
    } finally {
      setBusyId(null);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(handoff.url);
      setCopied(true);
    } catch {
      setCopied(false);
      setActionError("Copy was blocked by the browser. Select the link text and copy it manually.");
    }
  }

  const clientOptions = clients.map((c) => ({ value: c.id, label: c.name }));
  const roleOptions = ALL_ROLES.map((r) => ({ value: r, label: r }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-orac-blue">Access requests</h1>
        {pending.length > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            {pending.length} awaiting review
          </span>
        )}
      </div>

      {status === "loading" && <p role="status" className="text-sm text-gray-600">Loading access requests&hellip;</p>}
      {status === "error" && (
        <div className="space-y-3">
          <ErrorBanner message={error} />
          <button type="button" onClick={load} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-semibold text-orac-blue hover:bg-gray-50">Try again</button>
        </div>
      )}
      {actionError && <div role="alert"><ErrorBanner message={actionError} /></div>}
      {focusMissing && (
        <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          The access request from that notification is no longer in the list. It may already have been decided. Everything still open is shown below.
        </p>
      )}

      {handoff && (
        <section aria-labelledby="handoff-title" className="rounded-lg border border-sky-300 bg-sky-50 p-4 dark:border-sky-800 dark:bg-sky-950/30">
          <h2 id="handoff-title" className="text-base font-semibold text-orac-blue">One-time setup link for {handoff.email}</h2>
          <p className="mt-1 text-sm text-gray-700">
            Shown only now. Give it to {handoff.email} through a channel you trust. It works once and expires at {new Date(handoff.expiresAt).toLocaleTimeString()}. If it is lost or expires, issue a new one; the old one stops working.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input readOnly aria-label="One-time setup link" value={handoff.url} onFocus={(e) => e.target.select()} className="min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 font-mono text-xs text-gray-800" />
            <button type="button" onClick={copyLink} className="rounded-md bg-orac-blue px-4 py-2 text-sm font-semibold text-white hover:opacity-90">{copied ? "Copied" : "Copy link"}</button>
            <button type="button" onClick={() => { setHandoff(null); setCopied(false); }} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-orac-blue hover:bg-gray-50">Done, hide link</button>
          </div>
        </section>
      )}

      {status === "ready" && (
        <>
          <section className="rounded-lg border border-gray-200 bg-white p-5" aria-labelledby="pending-title">
            <h2 id="pending-title" className="mb-4 text-base font-semibold text-orac-blue">Pending ({pending.length})</h2>
            {pending.length === 0 && <p className="text-sm text-gray-600">Nothing waiting on review.</p>}
            <div className="space-y-3">
              {pending.map((r) => {
                const chosen = decision[r.id] || {};
                const effectiveRole = chosen.role || r.requested_role;
                const needsClient = effectiveRole === "Client Viewer" && !chosen.client_id;
                const busy = busyId === r.id;
                const isFocus = r.id === focusId;
                return (
                  <div
                    key={r.id}
                    ref={isFocus ? focusRef : null}
                    tabIndex={isFocus ? -1 : undefined}
                    className={`rounded-lg border-l-4 border-amber-500 border-y border-r border-gray-200 bg-amber-50/50 p-4 dark:bg-amber-950/20 ${isFocus ? "ring-2 ring-orac-blue" : ""}`}
                  >
                    <p className="font-semibold text-orac-blue">{r.name}</p>
                    <p className="text-sm text-gray-700">{r.email}</p>
                    <p className="mt-1 text-sm text-gray-600">Requested: {r.requested_role} &middot; {new Date(r.created_at).toLocaleString()}</p>
                    {r.reason && <p className="mt-2 text-sm italic text-gray-700">&ldquo;{r.reason}&rdquo;</p>}

                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-semibold text-gray-700">Assign actual role</label>
                        <SearchableSelect options={roleOptions} value={effectiveRole} onChange={(v) => patch(r.id, { role: v })} />
                      </div>
                      {effectiveRole === "Client Viewer" && (
                        <div>
                          <label className="mb-1 block text-sm font-semibold text-gray-700">Client (required)</label>
                          <SearchableSelect options={clientOptions} value={chosen.client_id} onChange={(v) => patch(r.id, { client_id: v })} placeholder="Select client..." />
                        </div>
                      )}
                    </div>

                    <div className="mt-3">
                      <label htmlFor={`reason-${r.id}`} className="mb-1 block text-sm font-semibold text-gray-700">Reason if rejecting (optional)</label>
                      <input id={`reason-${r.id}`} maxLength={500} value={chosen.reason || ""} onChange={(e) => patch(r.id, { reason: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <button type="button" disabled={busy || needsClient} onClick={() => handleApprove(r)} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50">
                        {busy ? "Working…" : `Approve as ${effectiveRole}`}
                      </button>
                      <button type="button" disabled={busy} onClick={() => handleReject(r)} className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40">
                        Reject
                      </button>
                    </div>
                    {needsClient && <p className="mt-2 text-xs text-gray-600">Choose the client this person represents before approving.</p>}
                  </div>
                );
              })}
            </div>
          </section>

          <section aria-labelledby="history-title">
            <h2 id="history-title" className="mb-3 text-base font-semibold text-orac-blue">History</h2>
            <DataTable
              title=""
              count={resolved.length}
              columns={["Name", "Email", "Requested role", "Status", "Account setup"]}
              rows={resolved}
              emptyText="No decided requests yet."
              renderRow={(r) => (
                <tr key={r.id} ref={r.id === focusId ? focusRef : null} tabIndex={r.id === focusId ? -1 : undefined} className={`hover:bg-gray-50/80 ${r.id === focusId ? "ring-2 ring-inset ring-orac-blue" : ""}`}>
                  <td className="px-5 py-3.5 text-sm font-medium text-gray-900">{r.name}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-600">{r.email}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-600">{r.requested_role}</td>
                  <td className="px-5 py-3.5 text-sm"><StatusBadge status={r.status} /></td>
                  <td className="px-5 py-3.5 text-sm">
                    {r.status === "Approved" ? (
                      <button type="button" disabled={busyId === r.id} onClick={() => handleIssueLink(r)} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-orac-blue hover:bg-gray-50 disabled:opacity-50">
                        {busyId === r.id ? "Working…" : "Issue setup link"}
                      </button>
                    ) : <span className="text-gray-500">&mdash;</span>}
                  </td>
                </tr>
              )}
            />
          </section>
        </>
      )}
    </div>
  );
}
