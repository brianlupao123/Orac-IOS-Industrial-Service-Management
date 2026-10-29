import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { collections, admin } from "../api/client.js";
import DataTable from "../components/DataTable.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import IconStatCard from "../components/IconStatCard.jsx";
import AdminAccessRequestsPage from "./AdminAccessRequestsPage.jsx";
import AdminAnalyticsPage from "./AdminAnalyticsPage.jsx";
import AdminEntitiesTab from "./AdminEntitiesTab.jsx";
import Modal from "../components/Modal.jsx";
import PageHeaderBanner from "../components/PageHeaderBanner.jsx";
import TabNav from "../components/TabNav.jsx";
import { ErrorBanner, PageLoadingSkeleton } from "../components/PageStates.jsx";
import { ICONS } from "../components/icons.jsx";
import { TECHNICIAN_TRADES } from "../constants/trades.js";

function SearchField({ label, value, onChange, placeholder }) {
  return (
    <label className="block w-full max-w-sm">
      <span className="sr-only">{label}</span>
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-orac-border-strong bg-orac-surface px-3 py-2 text-sm text-orac-text-primary focus:border-orac-blue focus:outline-none focus:ring-2 focus:ring-orac-blue/20"
      />
    </label>
  );
}

export default function AdminPage({ user }) {
  const [users, setUsers] = useState([]);
  const [clients, setClients] = useState([]);
  const [profile, setProfile] = useState(null);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const initialTab =
    user.role === "Admin" ? "users" :
    user.role === "Operations" ? "entities" :
    "clients";
  const [searchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const focusedRequestId = searchParams.get("focus");
  const [activeTab, setActiveTab] = useState(
    requestedTab === "access-requests" && user.role === "Admin" ? "access-requests" : initialTab
  );
  // A second notification click while already on this page must still switch tabs.
  useEffect(() => {
    if (requestedTab === "access-requests" && user.role === "Admin") setActiveTab("access-requests");
  }, [requestedTab, focusedRequestId, user.role]);

  const [saveBusy, setSaveBusy] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [userModal, setUserModal] = useState({ open: false, data: null });
  const [clientModal, setClientModal] = useState({ open: false, data: null });
  const [userQuery, setUserQuery] = useState("");
  const [clientQuery, setClientQuery] = useState("");

  const canManageUsers = user.role === "Admin";
  const canManageClients = user.role === "Admin" || user.role === "Management";
  const canManageProfile = user.role === "Admin" || user.role === "Management";
  const canManageEntities = user.role === "Admin" || user.role === "Management" || user.role === "Operations";

  async function load() {
    setLoading(true);
    setError("");
    try {
      const tasks = [];
      // FIX: previously clients were only fetched under canManageUsers,
      // even though the Client Directory tab is visible to canManageClients
      // (Admin or Management) - Management would see the tab but no data.
      if (canManageUsers) {
        tasks.push(collections.list("users").then(setUsers));
      }
      if (canManageClients) {
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

  const filteredUsers = useMemo(() => {
    const query = userQuery.trim().toLowerCase();
    if (!query) return users;
    return users.filter((entry) =>
      [entry.name, entry.email, entry.role]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query))
    );
  }, [users, userQuery]);

  const filteredClients = useMemo(() => {
    const query = clientQuery.trim().toLowerCase();
    if (!query) return clients;
    return clients.filter((entry) =>
      [entry.name, entry.contact_person, entry.email, entry.client_type]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query))
    );
  }, [clients, clientQuery]);

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

  async function handleUserSave(e) {
    e.preventDefault();
    const form = new FormData(e.target);
    const payload = Object.fromEntries(form.entries());
    payload.is_active = payload.is_active === "true";
    if (!payload.password) delete payload.password;

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

  if (!canManageUsers && !canManageProfile && !canManageEntities && !canManageClients) {
    return <div className="p-8 text-center text-gray-500">You do not have administrative access.</div>;
  }

  const tabs = [
    canManageUsers && { id: "users", label: "User management" },
    canManageClients && { id: "clients", label: "Client directory" },
    canManageUsers && { id: "access-requests", label: "Access requests" },
    (canManageUsers || canManageProfile) && { id: "analytics", label: "Analytics" },
    canManageEntities && { id: "entities", label: "Entity management" },
    canManageProfile && { id: "profile", label: "Company profile" },
  ].filter(Boolean);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="space-y-6">
        <PageHeaderBanner eyebrow="Administration" title="Administration Console" subtitle="Manage system users, client records, and company settings." iconPath={ICONS.users} />

        {canManageUsers && (
          <div className="grid gap-4 sm:grid-cols-3">
            <IconStatCard label="Total Active Users" labelFirst value={users.filter(u => u.is_active).length} iconPath={ICONS.users} tone="blue" />
            <IconStatCard label="Registered Clients" labelFirst value={clients.length} iconPath={ICONS.building} tone="neutral" />
            <IconStatCard label="System Status" labelFirst value="Online" iconPath={ICONS.check} tone="green" />
          </div>
        )}
      </div>

      {error && <ErrorBanner message={error} />}

      <TabNav tabs={tabs} activeId={activeTab} onChange={setActiveTab} label="Administration sections" />

      <div className="pt-2" role="tabpanel" id={`panel-${activeTab}`} aria-labelledby={`tab-${activeTab}`} tabIndex={-1}>

        {activeTab === "users" && canManageUsers && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SearchField label="Search users" value={userQuery} onChange={setUserQuery} placeholder="Search users" />
              <button onClick={() => setUserModal({ open: true, data: null })} className="px-4 py-2 bg-orac-blue text-white text-sm font-medium rounded-lg shadow-sm hover:shadow-md hover:bg-orac-blue/90 transition-all">
                + Add New User
              </button>
            </div>
            {loading ? (
              <PageLoadingSkeleton label="Loading users" />
            ) : (
              <DataTable
                title="System Users"
                columns={["Name", "Email", "Role", "Status", "Actions"]}
                rows={filteredUsers}
                emptyText="No users found."
                renderRow={(u) => (
                  <tr key={u.id} className="transition-colors hover:bg-gray-50/80 group">
                    <td className="px-5 py-4 text-sm font-medium text-orac-blue">{u.name || "—"}</td>
                    <td className="px-5 py-4 text-sm text-gray-500">{u.email}</td>
                    <td className="px-5 py-4 text-sm">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 border border-slate-200 dark:bg-slate-800/70 dark:text-slate-200 dark:border-slate-700">{u.role}</span>
                    </td>
                    <td className="px-5 py-4 text-sm">
                      <StatusBadge status={u.is_active ? "Active" : "Inactive"} />
                    </td>
                    <td className="px-5 py-4 text-sm text-right space-x-3">
                      <button onClick={() => setUserModal({ open: true, data: u })} className="text-orac-blue font-medium hover:underline transition-colors opacity-70 group-hover:opacity-100 focus-visible:opacity-100">
                        Edit
                      </button>
                      <button onClick={async()=>{if(!confirm((u.is_active?"Deactivate ":"Reactivate ")+u.email))return;try{u.is_active?await admin.deactivateEntity("users",u.id):await admin.reactivateEntity("users",u.id);load()}catch(e){alert(e.message)}}} className={`font-medium transition-colors opacity-70 group-hover:opacity-100 focus-visible:opacity-100 ${u.is_active?"text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300":"text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"}`}>{u.is_active?"Disable":"Enable"}</button>
                    </td>
                  </tr>
                )}
              />
            )}
          </div>
        )}

        {activeTab === "clients" && canManageClients && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-xs text-gray-400">
                Top of the client-owned hierarchy: Client → Mine Site → Plant → Plant Section → Equipment Tag.
                Manage mine sites, plants, plant sections and equipment tags under Entity Management.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <SearchField label="Search clients" value={clientQuery} onChange={setClientQuery} placeholder="Search clients" />
                <button onClick={() => setClientModal({ open: true, data: null })} className="px-4 py-2 bg-orac-slate text-white text-sm font-medium rounded-lg shadow-sm hover:shadow-md hover:bg-slate-700 transition-all whitespace-nowrap">
                  + Register Client
                </button>
              </div>
            </div>
            {loading ? (
              <PageLoadingSkeleton label="Loading clients" />
            ) : (
              <DataTable
                title="Client Directory"
                columns={["Client Name", "Type", "Contact Person", "Email", "Status", "Actions"]}
                rows={filteredClients}
                emptyText="No clients found."
                renderRow={(c) => {
                  // FIX: is_active must be read defensively (!== false, not a
                  // truthy check) — clients created before this field existed
                  // have no is_active at all, so a plain `c.is_active` read
                  // treated a fully active client as inactive: no Status
                  // column was shown at all, and this row's own Disable/
                  // Enable button read backwards ("Enable" on an active
                  // client) because of the same gap. See services/
                  // entityHierarchy.js on the backend for the matching fix.
                  const isActive = c.is_active !== false;
                  return (
                  <tr key={c.id} className="transition-colors hover:bg-gray-50/80 group">
                    <td className="px-5 py-4 text-sm font-medium text-orac-blue">{c.name}</td>
                    <td className="px-5 py-4 text-sm">
                      <span className="inline-flex items-center rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-700 border border-sky-100 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900/50">
                        {c.client_type === "walk_in" ? "Walk-In" : "Permanent"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-600">{c.contact_person || "—"}</td>
                    <td className="px-5 py-4 text-sm text-gray-500">{c.email || "—"}</td>
                    <td className="px-5 py-4 text-sm">
                      <StatusBadge status={isActive ? "Active" : "Inactive"} />
                    </td>
                    <td className="px-5 py-4 text-sm text-right">
                      <button onClick={() => setClientModal({ open: true, data: c })} className="text-orac-blue font-medium hover:underline transition-colors opacity-70 group-hover:opacity-100 focus-visible:opacity-100">
                        Edit
                      </button>
                      <button onClick={async()=>{if(!confirm((isActive?"Deactivate ":"Reactivate ")+(c.name||c.email)))return;try{isActive?await admin.deactivateEntity("clients",c.id):await admin.reactivateEntity("clients",c.id);load()}catch(e){alert(e.message)}}} className={`font-medium transition-colors opacity-70 group-hover:opacity-100 focus-visible:opacity-100 ${isActive?"text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300":"text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"}`}>{isActive?"Disable":"Enable"}</button>
                    </td>
                  </tr>
                  );
                }}
              />
            )}
          </div>
        )}

        {activeTab === "profile" && canManageProfile && profile && (
          <div className="max-w-2xl mx-auto">
            <form onSubmit={saveProfile} className="rounded-xl border border-orac-border-default bg-orac-surface p-8 shadow-sm">
              <div className="mb-6">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-orac-blue">Company Identity</h2>
                  <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold border bg-sky-50 text-sky-700 border-sky-100 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900/50">
                    ORAC-owned internal configuration
                  </span>
                </div>
                <p className="text-sm text-orac-text-muted">Update your trading name, legal entity, and contact details used on generated documents. This is ORAC's own record, not a client's — it is not part of the Client → Mine Site → Plant → Plant Section → Equipment Tag hierarchy.</p>
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
                    <label className="mb-1 block text-sm font-semibold text-orac-text-primary">{field.label}</label>
                    <input
                      type={field.type || "text"}
                      value={profile[field.key] || ""}
                      onChange={(e) => setProfile({ ...profile, [field.key]: e.target.value })}
                      className="w-full rounded-lg border border-orac-border-strong bg-orac-surface px-4 py-2.5 text-sm text-orac-text-primary focus:border-orac-blue focus:outline-none focus:ring-2 focus:ring-orac-blue/20 transition-all"
                    />
                    {field.help && <p className="mt-1 text-xs text-orac-text-muted">{field.help}</p>}
                  </div>
                ))}
                <section className="space-y-4 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20" aria-labelledby="quotation-tax-heading">
                  <div>
                    <h3 id="quotation-tax-heading" className="text-sm font-semibold text-orac-text-primary">Controlled quotation tax</h3>
                    <p className="mt-1 text-xs text-orac-text-muted">Only an approved configuration is used when production tax controls are enabled. Sales-entered tax values are ignored by the server. Record the accountant approval reference before marking this configuration approved.</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="quotation-tax-status" className="mb-1 block text-sm font-semibold text-orac-text-primary">Tax treatment</label>
                      <select
                        id="quotation-tax-status"
                        value={profile.quotation_tax_configuration?.tax_status || "taxable"}
                        onChange={(e) => setProfile({ ...profile, quotation_tax_configuration: { ...(profile.quotation_tax_configuration || {}), tax_status: e.target.value } })}
                        className="w-full rounded-lg border border-orac-border-strong bg-orac-surface px-4 py-2.5 text-sm text-orac-text-primary focus:border-orac-blue focus:outline-none focus:ring-2 focus:ring-orac-blue/20"
                      >
                        <option value="taxable">Taxable</option>
                        <option value="zero-rated">Zero-rated</option>
                        <option value="exempt">Exempt</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="quotation-tax-rate" className="mb-1 block text-sm font-semibold text-orac-text-primary">Applied tax rate (%)</label>
                      <input
                        id="quotation-tax-rate"
                        type="number"
                        min="0"
                        max="100"
                        step="0.001"
                        value={profile.quotation_tax_configuration?.applied_tax_rate == null ? "" : Number(profile.quotation_tax_configuration.applied_tax_rate) * 100}
                        onChange={(e) => {
                          const rawRate = e.target.value;
                          setProfile({ ...profile, quotation_tax_configuration: { ...(profile.quotation_tax_configuration || {}), applied_tax_rate: rawRate === "" ? null : Number(rawRate) / 100 } });
                        }}
                        className="w-full rounded-lg border border-orac-border-strong bg-orac-surface px-4 py-2.5 text-sm text-orac-text-primary focus:border-orac-blue focus:outline-none focus:ring-2 focus:ring-orac-blue/20"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="quotation-tax-approval-reference" className="mb-1 block text-sm font-semibold text-orac-text-primary">Accountant approval reference</label>
                    <input
                      id="quotation-tax-approval-reference"
                      value={profile.quotation_tax_configuration?.approval_reference || ""}
                      onChange={(e) => setProfile({ ...profile, quotation_tax_configuration: { ...(profile.quotation_tax_configuration || {}), approval_reference: e.target.value } })}
                      className="w-full rounded-lg border border-orac-border-strong bg-orac-surface px-4 py-2.5 text-sm text-orac-text-primary focus:border-orac-blue focus:outline-none focus:ring-2 focus:ring-orac-blue/20"
                      placeholder="Accountant sign-off or policy reference"
                    />
                  </div>
                  <label className="flex items-start gap-3 text-sm text-orac-text-primary">
                    <input
                      type="checkbox"
                      checked={Boolean(profile.quotation_tax_configuration?.approved)}
                      onChange={(e) => setProfile({ ...profile, quotation_tax_configuration: { ...(profile.quotation_tax_configuration || {}), approved: e.target.checked } })}
                      className="mt-0.5 h-4 w-4 rounded border-orac-border-strong text-orac-blue focus:ring-orac-blue"
                    />
                    <span>I confirm this is an accountant-approved production quotation tax configuration.</span>
                  </label>
                </section>
                <div className="pt-4 border-t border-orac-border-default mt-6">
                  <button type="submit" disabled={saveBusy} className="w-full rounded-lg bg-gray-900 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-gray-800 disabled:opacity-50">
                    {saveBusy ? "Saving Changes..." : "Save Profile Settings"}
                  </button>
                  {saveSuccess && (
                    <div className="mt-3 text-center text-sm font-medium text-emerald-600 bg-emerald-50 py-2 rounded-lg dark:text-emerald-300 dark:bg-emerald-950/30">
                      Company profile updated successfully.
                    </div>
                  )}
                </div>
              </div>
            </form>
          </div>
        )}

        {activeTab === "access-requests" && canManageUsers && (
          <div className="pt-4 animate-in fade-in">
            <AdminAccessRequestsPage focusId={focusedRequestId} />
          </div>
        )}

        {activeTab === "analytics" && (canManageUsers || canManageProfile) && (
          <div className="pt-4 animate-in fade-in">
            <AdminAnalyticsPage />
          </div>
        )}

        {activeTab === "entities" && canManageEntities && (
          <div className="pt-4 animate-in fade-in">
            <AdminEntitiesTab user={user} />
          </div>
        )}
      </div>

      <Modal title={userModal.data ? "Edit User" : "Create New User"} isOpen={userModal.open} onClose={() => setUserModal({ open: false, data: null })}>
        <form onSubmit={handleUserSave} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-700">Full Name</label>
            <input name="name" defaultValue={userModal.data?.name || ""} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-700">Email Address</label>
            <input name="email" type="email" defaultValue={userModal.data?.email || ""} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-700">{userModal.data ? "New Password (optional)" : "Temporary Password"}</label>
            <input name="password" type="password" minLength="10" required={!userModal.data} autoComplete="new-password" placeholder={userModal.data ? "Leave blank to keep the existing password" : "At least 10 characters"} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20" />
            <p className="mt-1 text-xs text-gray-500">Share a temporary password securely; the user can change it through the reset flow.</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-700">System Role</label>
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
            <label className="mb-1 block text-sm font-semibold text-gray-700">Client ID (For Client Viewers)</label>
            <input name="client_id" defaultValue={userModal.data?.client_id || ""} placeholder="e.g. c_zimplats" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20" />
            <p className="mt-1 text-xs text-gray-500">Only required if role is Client Viewer.</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-700">Trade / Specialty</label>
            <select name="trade" defaultValue={userModal.data?.trade || ""} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20 bg-white">
              <option value="">Not assigned</option>
              {TECHNICIAN_TRADES.map((trade) => <option key={trade} value={trade}>{trade}</option>)}
            </select>
            <p className="mt-1 text-xs text-gray-500">Assign only to Technician accounts. This groups operational timesheets without changing access rights.</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-700">Account Status</label>
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

      <Modal title={clientModal.data ? "Edit Client" : "Register Client"} isOpen={clientModal.open} onClose={() => setClientModal({ open: false, data: null })}>
        <form onSubmit={handleClientSave} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-700">Client Name</label>
            <input name="name" defaultValue={clientModal.data?.name || ""} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-700">Client Type</label>
            <select name="client_type" defaultValue={clientModal.data?.client_type || "permanent"} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20 bg-white">
              <option value="permanent">Permanent Account</option>
              <option value="walk_in">Walk-In / Once-off</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-700">Contact Person</label>
            <input name="contact_person" defaultValue={clientModal.data?.contact_person || ""} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-700">Contact Email</label>
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
