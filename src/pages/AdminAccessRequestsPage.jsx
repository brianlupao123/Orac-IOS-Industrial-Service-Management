import React, { useCallback, useEffect, useRef, useState } from "react";
import { accessRequests, collections } from "../api/client.js";
import SearchableSelect from "../components/SearchableSelect.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import DataTable from "../components/DataTable.jsx";
import { ErrorBanner } from "../components/PageStates.jsx";
import Button from "../components/ui/Button.jsx";
import Badge from "../components/ui/Badge.jsx";

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
        <h1 className="text-ux-title font-bold text-orac-accent">Access requests</h1>
        {pending.length > 0 && (
          <Badge tone="warning">
            {pending.length} awaiting review
          </Badge>
        )}
      </div>

      {status === "loading" && <p role="status" className="text-ux-body text-orac-text-secondary">Loading access requests&hellip;</p>}
      {status === "error" && (
        <div className="space-y-3">
          <ErrorBanner message={error} />
          <Button type="button" variant="secondary" onClick={load}>Try again</Button>
        </div>
      )}
      {actionError && <div role="alert"><ErrorBanner message={actionError} /></div>}
      {focusMissing && (
        <p role="status" className="rounded-lg border border-orac-warning-border bg-orac-warning-surface px-4 py-3 text-ux-body text-orac-warning-text">
          The access request from that notification is no longer in the list. It may already have been decided. Everything still open is shown below.
        </p>
      )}

      {handoff && (
        <section aria-labelledby="handoff-title" className="rounded-xl border border-orac-info-border bg-orac-info-surface p-6">
          <h2 id="handoff-title" className="text-ux-section font-semibold text-orac-text-primary">One-time setup link for {handoff.email}</h2>
          <p className="mt-1 text-ux-body text-orac-text-secondary">
            Shown only now. Give it to {handoff.email} through a channel you trust. It works once and expires at {new Date(handoff.expiresAt).toLocaleTimeString()}. If it is lost or expires, issue a new one; the old one stops working.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input readOnly aria-label="One-time setup link" value={handoff.url} onFocus={(e) => e.target.select()} className="min-w-0 min-h-[44px] flex-1 rounded-lg border border-orac-border-strong bg-orac-canvas px-3.5 py-2 font-mono text-ux-caption text-orac-text-primary focus:border-orac-accent focus:ring-2 focus:ring-orac-focus-ring/30" />
            <Button type="button" variant="primary" onClick={copyLink}>{copied ? "Copied" : "Copy link"}</Button>
            <Button type="button" variant="secondary" onClick={() => { setHandoff(null); setCopied(false); }}>Done, hide link</Button>
          </div>
        </section>
      )}

      {status === "ready" && (
        <>
          <section className="rounded-xl border border-orac-border-default bg-orac-surface p-6" aria-labelledby="pending-title">
            <h2 id="pending-title" className="mb-4 text-ux-section font-semibold text-orac-text-primary">Pending ({pending.length})</h2>
            {pending.length === 0 && <p className="text-ux-body text-orac-text-secondary">Nothing waiting on review.</p>}
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
                    className={`rounded-xl border-l-4 border-orac-warning-border border-y border-r border-orac-border-default bg-orac-warning-surface p-5 ${isFocus ? "ring-2 ring-orac-accent" : ""}`}
                  >
                    <p className="text-ux-section font-semibold text-orac-text-primary">{r.name}</p>
                    <p className="text-ux-body text-orac-text-secondary">{r.email}</p>
                    <p className="mt-1 text-ux-caption text-orac-text-muted">Requested: {r.requested_role} &middot; {new Date(r.created_at).toLocaleString()}</p>
                    {r.reason && <p className="mt-2 text-ux-body italic text-orac-text-secondary">&ldquo;{r.reason}&rdquo;</p>}

                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-ux-label font-semibold text-orac-text-primary">Assign actual role</label>
                        <SearchableSelect ariaLabel="Assign actual role" options={roleOptions} value={effectiveRole} onChange={(v) => patch(r.id, { role: v })} />
                      </div>
                      {effectiveRole === "Client Viewer" && (
                        <div>
                          <label className="mb-1 block text-ux-label font-semibold text-orac-text-primary">Client (required)</label>
                          <SearchableSelect ariaLabel="Client required" options={clientOptions} value={chosen.client_id} onChange={(v) => patch(r.id, { client_id: v })} placeholder="Select client..." />
                        </div>
                      )}
                    </div>

                    <div className="mt-3">
                      <label htmlFor={`reason-${r.id}`} className="mb-1 block text-ux-label font-semibold text-orac-text-primary">Reason if rejecting (optional)</label>
                      <input id={`reason-${r.id}`} maxLength={500} value={chosen.reason || ""} onChange={(e) => patch(r.id, { reason: e.target.value })} className="w-full min-h-[44px] rounded-lg border border-orac-border-strong bg-orac-canvas px-3.5 py-2 text-ux-body text-orac-text-primary focus:border-orac-accent focus:ring-2 focus:ring-orac-focus-ring/30" />
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <Button type="button" variant="primary" disabled={busy || needsClient} onClick={() => handleApprove(r)} className="bg-emerald-600 hover:bg-emerald-700">
                        {busy ? "Working…" : `Approve as ${effectiveRole}`}
                      </Button>
                      <Button type="button" variant="danger" disabled={busy} onClick={() => handleReject(r)}>
                        Reject
                      </Button>
                    </div>
                    {needsClient && <p className="mt-2 text-ux-caption text-orac-warning-text">Choose the client this person represents before approving.</p>}
                  </div>
                );
              })}
            </div>
          </section>

          <section aria-labelledby="history-title">
            <h2 id="history-title" className="mb-3 text-ux-section font-semibold text-orac-text-primary">History</h2>
            <DataTable
              title=""
              count={resolved.length}
              columns={["Name", "Email", "Requested role", "Status", "Account setup"]}
              rows={resolved}
              emptyText="No decided requests yet."
              renderRow={(r) => (
                <tr key={r.id} ref={r.id === focusId ? focusRef : null} tabIndex={r.id === focusId ? -1 : undefined} className={`transition-colors hover:bg-orac-row-hover ${r.id === focusId ? "ring-2 ring-inset ring-orac-accent" : ""}`}>
                  <td className="px-6 py-4 text-ux-body font-semibold text-orac-text-primary">{r.name}</td>
                  <td className="px-6 py-4 text-ux-body text-orac-text-secondary">{r.email}</td>
                  <td className="px-6 py-4 text-ux-body text-orac-text-secondary">{r.requested_role}</td>
                  <td className="px-6 py-4"><StatusBadge status={r.status} /></td>
                  <td className="px-6 py-4">
                    {r.status === "Approved" ? (
                      <Button type="button" variant="secondary" size="sm" disabled={busyId === r.id} onClick={() => handleIssueLink(r)}>
                        {busyId === r.id ? "Working…" : "Issue setup link"}
                      </Button>
                    ) : <span className="text-orac-text-muted">&mdash;</span>}
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
