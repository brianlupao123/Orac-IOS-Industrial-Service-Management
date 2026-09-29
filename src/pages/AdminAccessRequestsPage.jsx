import React, { useEffect, useState } from "react";
import { accessRequests, collections } from "../api/client.js";
import SearchableSelect from "../components/SearchableSelect.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import DataTable from "../components/DataTable.jsx";
import { ErrorBanner } from "../components/PageStates.jsx";

const ALL_ROLES = [
  "Admin", "Management", "Sales", "Finance",
  "Operations", "Technician", "Supervisor", "Client Viewer"
];

export default function AdminAccessRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [clients, setClients] = useState([]);
  const [error, setError] = useState("");
  const [decision, setDecision] = useState({}); // id -> { role, client_id }
  const [busyId, setBusyId] = useState(null);

  function load() {
    Promise.all([accessRequests.list(), collections.list("clients")])
      .then(([reqs, clientList]) => {
        setRequests(reqs);
        setClients(clientList);
      })
      .catch((err) => setError(err.message));
  }

  useEffect(load, []);

  const pending = requests.filter((r) => r.status === "Pending");
  const resolved = requests.filter((r) => r.status !== "Pending");

  function setRole(id, role) {
    setDecision((d) => ({ ...d, [id]: { ...d[id], role } }));
  }
  function setClient(id, client_id) {
    setDecision((d) => ({ ...d, [id]: { ...d[id], client_id } }));
  }

  async function handleApprove(r) {
    const chosen = decision[r.id] || {};
    const role = chosen.role || r.requested_role;
    setBusyId(r.id);
    try {
      await accessRequests.approve(r.id, { role, client_id: chosen.client_id });
      load();
    } catch (err) {
      alert("Error approving request: " + err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(r) {
    setBusyId(r.id);
    try {
      await accessRequests.reject(r.id);
      load();
    } catch (err) {
      alert("Error rejecting request: " + err.message);
    } finally {
      setBusyId(null);
    }
  }

  const clientOptions = clients.map((c) => ({ value: c.id, label: c.name }));
  const roleOptions = ALL_ROLES.map((r) => ({ value: r, label: r }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-orac-blue">Access requests</h1>
        {pending.length > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            {pending.length} awaiting review
          </span>
        )}
      </div>
      {error && <ErrorBanner message={error} />}

      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-base font-semibold text-orac-blue">
          Pending ({pending.length})
        </h2>
        {pending.length === 0 && <p className="text-sm text-gray-500">Nothing waiting on review.</p>}
        <div className="space-y-3">
          {pending.map((r) => {
            const chosen = decision[r.id] || {};
            const effectiveRole = chosen.role || r.requested_role;
            const busy = busyId === r.id;
            return (
              <div key={r.id} className="rounded-lg border-l-4 border-amber-500 border-y border-r border-gray-200 bg-amber-50/50 p-4 dark:bg-amber-950/20">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-orac-blue">{r.name}</p>
                    <p className="text-sm text-gray-600">{r.email}</p>
                    <p className="mt-1 text-sm text-gray-500">
                      Requested: {r.requested_role} &middot; {new Date(r.created_at).toLocaleString()}
                    </p>
                    {r.reason && <p className="mt-2 text-sm italic text-gray-600">&ldquo;{r.reason}&rdquo;</p>}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-gray-700">Assign actual role</label>
                    <SearchableSelect
                      options={roleOptions}
                      value={effectiveRole}
                      onChange={(v) => setRole(r.id, v)}
                    />
                  </div>
                  {effectiveRole === "Client Viewer" && (
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-gray-700">Client</label>
                      <SearchableSelect
                        options={clientOptions}
                        value={chosen.client_id}
                        onChange={(v) => setClient(r.id, v)}
                        placeholder="Select client..."
                      />
                    </div>
                  )}
                </div>

                <div className="mt-4 flex gap-3">
                  <button
                    disabled={busy}
                    onClick={() => handleApprove(r)}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {busy ? "Working…" : `Approve as ${effectiveRole}`}
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => handleReject(r)}
                    className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
                  >
                    Reject
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold text-orac-blue">History</h2>
        <DataTable
          title=""
          count={resolved.length}
          columns={["Name", "Email", "Requested role", "Status"]}
          rows={resolved}
          emptyText="No decided requests yet."
          renderRow={(r) => (
            <tr key={r.id} className="hover:bg-gray-50/80">
              <td className="px-5 py-3.5 text-sm font-medium text-gray-900">{r.name}</td>
              <td className="px-5 py-3.5 text-sm text-gray-500">{r.email}</td>
              <td className="px-5 py-3.5 text-sm text-gray-600">{r.requested_role}</td>
              <td className="px-5 py-3.5 text-sm"><StatusBadge status={r.status} /></td>
            </tr>
          )}
        />
      </section>
    </div>
  );
}
