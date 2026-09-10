import React, { useEffect, useState } from "react";
import { collections, admin } from "../api/client.js";
import DataTable from "../components/DataTable.jsx";
import StatusBadge from "../components/StatusBadge.jsx";

export default function AdminPage({ user }) {
  const [users, setUsers] = useState([]);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const canManageUsers = user.role === "Admin";
  const canManageProfile = user.role === "Admin" || user.role === "Management";

  async function load() {
    setLoading(true);
    setError("");
    try {
      const tasks = [];
      if (canManageUsers) tasks.push(collections.list("users").then(setUsers));
      if (canManageProfile) tasks.push(admin.getCompanyProfile().then(setProfile));
      await Promise.all(tasks);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function saveProfile(e) {
    e.preventDefault();
    setError("");
    setSaveBusy(true);
    setSaveSuccess(false);
    try {
      const updated = await admin.updateCompanyProfile(profile);
      setProfile(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaveBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-orac-slate">Administration</h1>
        <p className="mt-1 text-sm text-gray-400">Manage system settings and user access</p>
      </div>

      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        {/* Left Column: Company Profile */}
        <div>
          {canManageProfile && profile ? (
            <form onSubmit={saveProfile} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold text-orac-slate">Company Profile</h2>
              <div className="space-y-4">
                {[
                  { key: "company_name", label: "Trading Name" },
                  { key: "legal_name", label: "Legal Entity Name" },
                  { key: "address", label: "Registered Address" },
                  { key: "phone", label: "Contact Phone" },
                  { key: "email", label: "Contact Email", type: "email" },
                ].map((field) => (
                  <div key={field.key}>
                    <label className="mb-1 block text-xs font-medium text-gray-500 uppercase tracking-wider">{field.label}</label>
                    <input
                      type={field.type || "text"}
                      value={profile[field.key] || ""}
                      onChange={(e) => setProfile({ ...profile, [field.key]: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-orac-slate focus:border-orac-blue focus:outline-none focus:ring-2 focus:ring-orac-blue/20"
                    />
                  </div>
                ))}
                
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={saveBusy}
                    className="w-full rounded-lg bg-orac-blue py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:brightness-105 disabled:opacity-50"
                  >
                    {saveBusy ? "Saving..." : "Save Profile Settings"}
                  </button>
                  {saveSuccess && <p className="mt-2 text-center text-xs font-medium text-emerald-600">Settings saved successfully</p>}
                </div>
              </div>
            </form>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-5 text-center text-sm text-gray-500">
              You do not have permission to edit the company profile.
            </div>
          )}
        </div>

        {/* Right Column: User Management */}
        <div>
          {canManageUsers && (
            loading ? (
              <div className="py-12 text-center text-gray-400">Loading users...</div>
            ) : (
              <DataTable
                title="System Users"
                columns={["Name", "Email", "Role", "Status"]}
                rows={users}
                emptyText="No users found."
                renderRow={(u) => (
                  <tr key={u.id} className="transition-colors hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-orac-slate">{u.name || "—"}</td>
                    <td className="px-4 py-2.5 text-gray-500">{u.email}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={u.is_active ? "Active" : "Inactive"} />
                    </td>
                  </tr>
                )}
              />
            )
          )}
        </div>
      </div>
    </div>
  );
}