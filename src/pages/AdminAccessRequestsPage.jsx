import React, { useEffect, useState } from "react";
import { accessRequests, collections } from "../api/client.js";
import SearchableSelect from "../components/SearchableSelect.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
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
    setDecision((prev) => ({ ...prev, [id]: { ...prev[id], role } }));
  }
  function setClient(id, client_id) {
    setDecision((prev) => ({ ...prev, [id]: { ...prev[id], client_id } }));
  }

  async function handleApprove(request) {
    const chosen = decision[request.id] || {};
    const role = chosen.role || request.requested_role;
    if (role === "Client Viewer" && !chosen.client_id) {
      setError("Select which client this Client Viewer belongs to before approving.");
      return;
    }
    setBusyId(request.id);
    setError("");
    try {
      await accessRequests.approve(request.id, role, chosen.client_id);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(request) {
    const reason = window.prompt("Reason for rejecting this request (shown internally only):", "");
    if (reason === null) return;
    setBusyId(request.id);
    setError("");
    try {
      await accessRequests.reject(request.id, reason);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  const clientOptions = clients.map((c) => ({ value: c.id, label: c.name }));
  const roleOptions = ALL_ROLES.map((r) => ({ value: r, label: r }));

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-orac-blue">Access Requests</h1>
      {error && <ErrorBanner message={error} />}

      <section className="rounded border border-gray-200 bg-white p-4">
        <h2 className="mb-3 font-medium text-orac-blue">
          Pending ({pending.length})
        </h2>
        {pending.length === 0 && <p className="text-sm text-gray-400">Nothing waiting on review.</p>}
        <div className="space-y-4">
          {pending.map((r) => {
            const chosen = decision[r.id] || {};
            const effectiveRole = chosen.role || r.requested_role;
            const busy = busyId === r.id;
            return (
              <div key={r.id} className="rounded border border-gray-100 p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-orac-blue">{r.name}</p>
                    <p className="text-sm text-gray-500">{r.email}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Requested: {r.requested_role} &middot; {new Date(r.created_at).toLocaleString()}
                    </p>
                    {r.reason && <p className="text-sm text-gray-600 mt-2">"{r.reason}"</p>}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Assign actual role</label>
                    <SearchableSelect
                      options={roleOptions}
                      value={effectiveRole}
                      onChange={(v) => setRole(r.id, v)}
                    />
                  </div>
                  {effectiveRole === "Client Viewer" && (
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Client</label>
                      <SearchableSelect
                        options={clientOptions}
                        value={chosen.client_id}
                        onChange={(v) => setClient(r.id, v)}
                        placeholder="Select client..."
                      />
                    </div>
                  )}
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    disabled={busy}
                    onClick={() => handleApprove(r)}
                    className="rounded bg-green-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                  >
                    {busy ? "Working..." : `Approve as ${effectiveRole}`}
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => handleReject(r)}
                    className="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded border border-gray-200 bg-white p-4">
        <h2 className="mb-3 font-medium text-orac-blue">History</h2>
        {resolved.length === 0 ? (
          <p className="text-sm text-gray-400">No decided requests yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 text-left">
                <tr>
                  <th className="p-2">Name</th><th className="p-2">Email</th>
                  <th className="p-2">Requested</th><th className="p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {resolved.map((r) => (
                  <tr key={r.id} className="border-t border-gray-100">
                    <td className="p-2">{r.name}</td>
                    <td className="p-2">{r.email}</td>
                    <td className="p-2">{r.requested_role}</td>
                    <td className="p-2"><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
