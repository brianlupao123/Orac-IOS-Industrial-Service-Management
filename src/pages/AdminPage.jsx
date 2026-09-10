import React, { useEffect, useState } from "react";
import { collections, admin } from "../api/client.js";
import DataTable from "../components/DataTable.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import StatCard from "../components/StatCard.jsx";

// Modal Component for Forms
function Modal({ title, isOpen, onClose, children }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h3 className="text-lg font-semibold text-orac-slate">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
}

export default function AdminPage({ user }) {
  const [users, setUsers] = useState([]);
  const [clients, setClients] = useState([]);
  const [profile, setProfile] = useState(null);
  
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("users");
  
  // Profile state
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Modal states
  const [userModal, setUserModal] = useState({ open: false, data: null });
  const [clientModal, setClientModal] = useState({ open: false, data: null });

  const canManageUsers = user.role === "Admin";
  const canManageProfile = user.role === "Admin" || user.role === "Management";

  async function load() {
    setLoading(true);
    setError("");
    try {
      const tasks = [];
      if (canManageUsers) {
        tasks.push(collections.list("users").then(setUsers));
        tasks.push(collections.list("clients").then(setClients));
      }
      if (canManageProfile) {
        tasks.push(admin.getCompanyProfile().then(setProfile));
      }
      await Promise.all(tasks);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // Profile
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

  // Users CRUD
  async function handleUserSave(e) {
    e.preventDefault();
    const form = new FormData(e.target);
    const payload = Object.fromEntries(form.entries());
    payload.is_active = payload.is_active === "true";

    try {
      if (userModal.data?.id) {
        await admin.updateUser(userModal.data.id, payload);
      } else {
        await admin.createUser(payload);
      }
      setUserModal({ open: false, data: null });
      load();
    } catch (err) {
      alert("Error saving user: " + err.message);
    }
  }

  // Clients CRUD
  async function handleClientSave(e) {
    e.preventDefault();
    const form = new FormData(e.target);
    const payload = Object.fromEntries(form.entries());

    try {
      if (clientModal.data?.id) {
        await admin.updateClient(clientModal.data.id, payload);
      } else {
        await admin.createClient(payload);
      }
      setClientModal({ open: false, data: null });
      load();
    } catch (err) {
      alert("Error saving client: " + err.message);
    }
  }

  if (!canManageUsers && !canManageProfile) {
    return <div className="p-8 text-center text-gray-500">You do not have administrative access.</div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header & Analytics */}
      <div>
        <h1 className="text-3xl font-light tracking-tight text-orac-slate mb-2">Administration Console</h1>
        <p className="text-sm text-gray-400 mb-8">Manage system users, client records, and company settings seamlessly.</p>
        
        {canManageUsers && (
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Total Active Users" value={users.filter(u => u.is_active).length} icon="👥" tone="blue" />
            <StatCard label="Registered Clients" value={clients.length} icon="🏢" tone="slate" />
            <StatCard label="System Status" value="Online" icon="✨" tone="green" />
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50/80 px-4 py-3 text-sm text-red-600 shadow-sm backdrop-blur-sm">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {canManageUsers && (
            <>
              <button
                onClick={() => setActiveTab("users")}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === "users"
                    ? "border-orac-blue text-orac-blue"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                User Management
              </button>
              <button
                onClick={() => setActiveTab("clients")}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === "clients"
                    ? "border-orac-blue text-orac-blue"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Client Directory
              </button>
            </>
          )}
          {canManageProfile && (
            <button
              onClick={() => setActiveTab("profile")}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === "profile"
                  ? "border-orac-blue text-orac-blue"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Company Profile
            </button>
          )}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="pt-2">
        
        {/* USERS TAB */}
        {activeTab === "users" && canManageUsers && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={() => setUserModal({ open: true, data: null })}
                className="px-4 py-2 bg-orac-blue text-white text-sm font-medium rounded-lg shadow-sm hover:shadow-md hover:bg-orac-blue/90 transition-all"
              >
                + Add New User
              </button>
            </div>
            {loading ? (
              <div className="py-12 text-center text-gray-400">Loading users...</div>
            ) : (
              <DataTable
                title="System Users"
                columns={["Name", "Email", "Role", "Status", "Actions"]}
                rows={users}
                emptyText="No users found."
                renderRow={(u) => (
                  <tr key={u.id} className="transition-colors hover:bg-gray-50/80 group">
                    <td className="px-5 py-4 text-sm font-medium text-orac-slate">{u.name || "—"}</td>
                    <td className="px-5 py-4 text-sm text-gray-500">{u.email}</td>
                    <td className="px-5 py-4 text-sm">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 border border-slate-200">
                        {u.role}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm">
                      <StatusBadge status={u.is_active ? "Active" : "Inactive"} />
                    </td>
                    <td className="px-5 py-4 text-sm text-right">
                      <button
                        onClick={() => setUserModal({ open: true, data: u })}
                        className="text-orac-blue font-medium hover:text-indigo-600 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                )}
              />
            )}
          </div>
        )}

        {/* CLIENTS TAB */}
        {activeTab === "clients" && canManageUsers && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={() => setClientModal({ open: true, data: null })}
                className="px-4 py-2 bg-orac-slate text-white text-sm font-medium rounded-lg shadow-sm hover:shadow-md hover:bg-slate-700 transition-all"
              >
                + Register Client
              </button>
            </div>
            {loading ? (
              <div className="py-12 text-center text-gray-400">Loading clients...</div>
            ) : (
              <DataTable
                title="Client Directory"
                columns={["Client Name", "Type", "Contact Person", "Email", "Actions"]}
                rows={clients}
                emptyText="No clients found."
                renderRow={(c) => (
                  <tr key={c.id} className="transition-colors hover:bg-gray-50/80 group">
                    <td className="px-5 py-4 text-sm font-medium text-orac-slate">{c.name}</td>
                    <td className="px-5 py-4 text-sm">
                      <span className="inline-flex items-center rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-700 border border-sky-100">
                        {c.client_type === "walk_in" ? "Walk-In" : "Permanent"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-600">{c.contact_person || "—"}</td>
                    <td className="px-5 py-4 text-sm text-gray-500">{c.email || "—"}</td>
                    <td className="px-5 py-4 text-sm text-right">
                      <button
                        onClick={() => setClientModal({ open: true, data: c })}
                        className="text-orac-slate font-medium hover:text-gray-900 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                )}
              />
            )}
          </div>
        )}

        {/* PROFILE TAB */}
        {activeTab === "profile" && canManageProfile && profile && (
          <div className="max-w-2xl mx-auto">
            <form onSubmit={saveProfile} className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-orac-slate">Company Identity</h2>
                <p className="text-sm text-gray-500">Update your trading name, legal entity, and contact details used on generated documents.</p>
              </div>
              <div className="space-y-5">
                {[
                  { key: "company_name", label: "Trading Name", help: "The main brand name presented to clients." },
                  { key: "legal_name", label: "Legal Entity Name", help: "Used for invoices and formal documents." },
                  { key: "address", label: "Registered Address", help: "Physical headquarters." },
                  { key: "phone", label: "Contact Phone" },
                  { key: "email", label: "Contact Email", type: "email" },
                ].map((field) => (
                  <div key={field.key}>
                    <label className="mb-1 block text-xs font-semibold text-gray-600 uppercase tracking-wider">{field.label}</label>
                    <input
                      type={field.type || "text"}
                      value={profile[field.key] || ""}
                      onChange={(e) => setProfile({ ...profile, [field.key]: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-orac-blue focus:outline-none focus:ring-2 focus:ring-orac-blue/20 transition-all"
                    />
                    {field.help && <p className="mt-1 text-[11px] text-gray-400">{field.help}</p>}
                  </div>
                ))}
                
                <div className="pt-4 border-t border-gray-100 mt-6">
                  <button
                    type="submit"
                    disabled={saveBusy}
                    className="w-full rounded-lg bg-gray-900 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-gray-800 disabled:opacity-50"
                  >
                    {saveBusy ? "Saving Changes..." : "Save Profile Settings"}
                  </button>
                  {saveSuccess && (
                    <div className="mt-3 text-center text-sm font-medium text-emerald-600 bg-emerald-50 py-2 rounded-lg">
                      Company profile updated successfully.
                    </div>
                  )}
                </div>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* User Modal */}
      <Modal 
        title={userModal.data ? "Edit User" : "Create New User"} 
        isOpen={userModal.open} 
        onClose={() => setUserModal({ open: false, data: null })}
      >
        <form onSubmit={handleUserSave} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600 uppercase">Full Name</label>
            <input name="name" defaultValue={userModal.data?.name || ""} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600 uppercase">Email Address</label>
            <input name="email" type="email" defaultValue={userModal.data?.email || ""} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600 uppercase">System Role</label>
            <select name="role" defaultValue={userModal.data?.role || "Technician"} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20 bg-white">
              <option value="Admin">Admin</option>
              <option value="Management">Management</option>
              <option value="Sales">Sales</option>
              <option value="Finance">Finance</option>
              <option value="Operations">Operations</option>
              <option value="Supervisor">Supervisor</option>
              <option value="Technician">Technician</option>
              <option value="Client Viewer">Client Viewer</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600 uppercase">Client ID (For Client Viewers)</label>
            <input name="client_id" defaultValue={userModal.data?.client_id || ""} placeholder="e.g. c_zimplats" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20" />
            <p className="mt-1 text-[10px] text-gray-400">Only required if role is Client Viewer.</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600 uppercase">Account Status</label>
            <select name="is_active" defaultValue={userModal.data ? String(userModal.data.is_active) : "true"} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20 bg-white">
              <option value="true">Active</option>
              <option value="false">Inactive / Suspended</option>
            </select>
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={() => setUserModal({ open: false, data: null })} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">Cancel</button>
            <button type="submit" className="px-5 py-2 bg-orac-blue text-white text-sm font-medium rounded-lg hover:bg-orac-blue/90 shadow-sm">Save User</button>
          </div>
        </form>
      </Modal>

      {/* Client Modal */}
      <Modal 
        title={clientModal.data ? "Edit Client" : "Register Client"} 
        isOpen={clientModal.open} 
        onClose={() => setClientModal({ open: false, data: null })}
      >
        <form onSubmit={handleClientSave} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600 uppercase">Client Name</label>
            <input name="name" defaultValue={clientModal.data?.name || ""} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600 uppercase">Client Type</label>
            <select name="client_type" defaultValue={clientModal.data?.client_type || "permanent"} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20 bg-white">
              <option value="permanent">Permanent Account</option>
              <option value="walk_in">Walk-In / Once-off</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600 uppercase">Contact Person</label>
            <input name="contact_person" defaultValue={clientModal.data?.contact_person || ""} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600 uppercase">Contact Email</label>
            <input name="email" type="email" defaultValue={clientModal.data?.email || ""} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20" />
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={() => setClientModal({ open: false, data: null })} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">Cancel</button>
            <button type="submit" className="px-5 py-2 bg-orac-slate text-white text-sm font-medium rounded-lg hover:bg-slate-800 shadow-sm">Save Client</button>
          </div>
        </form>
      </Modal>

    </div>
  );
}