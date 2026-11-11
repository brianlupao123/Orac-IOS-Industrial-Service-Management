import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { collections, admin, totp } from "../api/client.js";
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
import Button from "../components/ui/Button.jsx";
import Badge from "../components/ui/Badge.jsx";
import Select from "../components/ui/Select.jsx";

function SearchField({ label, value, onChange, placeholder }) {
  return (
    <label className="relative block w-full max-w-sm">
      <span className="sr-only">{label}</span>
      <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-orac-text-muted" aria-hidden="true">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" strokeLinecap="round" /></svg>
      </span>
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full min-h-[44px] rounded-lg border border-orac-border-strong bg-orac-canvas pl-9 pr-3.5 py-2 text-ux-body text-orac-text-primary placeholder:text-orac-text-muted focus:border-orac-accent focus:outline-none focus:ring-2 focus:ring-orac-focus-ring/30"
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
  const [ticketModal, setTicketModal] = useState({ open: false, user: null, ticket: null, error: "", busy: false, verificationMethod: "in_person" });

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

  const hasTotpColumn = useMemo(
    () => filteredUsers.some((u) => typeof u.totp_enrolled === "boolean"),
    [filteredUsers]
  );
  const userColumns = useMemo(
    () => ["Name", "Email", "Role", ...(hasTotpColumn ? ["Authenticator"] : []), "Status", "Actions"],
    [hasTotpColumn]
  );

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
    // Payroll identifiers: blank means "not on file", never an empty string.
    for (const key of ["national_id", "employee_code"]) payload[key] = String(payload[key] || "").trim() || null;

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
    return <div className="p-8 text-center text-ux-body text-orac-text-muted">You do not have administrative access.</div>;
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
              <Button onClick={() => setUserModal({ open: true, data: null })} variant="primary">
                + Add new user
              </Button>
            </div>
            {loading ? (
              <PageLoadingSkeleton label="Loading users" />
            ) : (
              <DataTable
                title="System Users"
                columns={userColumns}
                rows={filteredUsers}
                emptyText="No users found."
                renderRow={(u) => (
                  <tr key={u.id} className="transition-colors hover:bg-orac-row-hover group">
                    <td className="px-6 py-4">
                      <a
                        onClick={() => setUserModal({ open: true, data: u })}
                        className="cursor-pointer text-ux-body font-semibold text-orac-text-primary hover:underline hover:text-orac-accent"
                      >
                        {u.name || "—"}
                      </a>
                    </td>
                    <td className="px-6 py-4 text-ux-body text-orac-text-secondary">{u.email}</td>
                    <td className="px-6 py-4">
                      <Badge tone="neutral">{u.role}</Badge>
                    </td>
                    {hasTotpColumn && (
                      <td className="px-6 py-4">
                        {typeof u.totp_enrolled === "boolean" ? (
                          <Badge tone={u.totp_enrolled ? "success" : "neutral"}>
                            {u.totp_enrolled ? "Enrolled" : "Not set up"}
                          </Badge>
                        ) : null}
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <StatusBadge status={u.is_active ? "Active" : "Inactive"} />
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <Button
                          variant="link"
                          onClick={() => setUserModal({ open: true, data: u })}
                          className="font-bold text-orac-accent"
                        >
                          Edit
                        </Button>
                        {canManageUsers && (
                          <Button
                            variant="secondary"
                            onClick={() => setTicketModal({ open: true, user: u, ticket: null, error: "", busy: false, verificationMethod: "in_person" })}
                            className="text-ux-caption font-semibold"
                          >
                            Issue ticket
                          </Button>
                        )}
                        <Button
                          variant="link"
                          onClick={async () => {
                            if (!confirm((u.is_active ? "Deactivate " : "Reactivate ") + u.email)) return;
                            try {
                              u.is_active ? await admin.deactivateEntity("users", u.id) : await admin.reactivateEntity("users", u.id);
                              load();
                            } catch (e) {
                              alert(e.message);
                            }
                          }}
                          className={`font-bold ${u.is_active ? "text-orac-danger-text hover:text-red-700" : "text-orac-success-text hover:text-emerald-700"}`}
                        >
                          {u.is_active ? "Disable" : "Enable"}
                        </Button>
                      </div>
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
              <p className="text-ux-caption text-orac-text-muted">
                Top of the client-owned hierarchy: Client → Mine Site → Plant → Plant Section → Equipment Tag.
                Manage mine sites, plants, plant sections and equipment tags under Entity Management.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <SearchField label="Search clients" value={clientQuery} onChange={setClientQuery} placeholder="Search clients" />
                <Button onClick={() => setClientModal({ open: true, data: null })} variant="primary">
                  + Register Client
                </Button>
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
                    <tr key={c.id} className="transition-colors hover:bg-orac-row-hover group">
                      <td className="px-6 py-4">
                        <a
                          onClick={() => setClientModal({ open: true, data: c })}
                          className="cursor-pointer text-ux-body font-semibold text-orac-text-primary hover:underline hover:text-orac-accent"
                        >
                          {c.name}
                        </a>
                      </td>
                      <td className="px-6 py-4">
                        <Badge tone="info">
                          {c.client_type === "walk_in" ? "Walk-In" : "Permanent"}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-ux-body text-orac-text-secondary">{c.contact_person || "—"}</td>
                      <td className="px-6 py-4 text-ux-body text-orac-text-secondary">{c.email || "—"}</td>
                      <td className="px-6 py-4">
                        <StatusBadge status={isActive ? "Active" : "Inactive"} />
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <Button
                            variant="link"
                            onClick={() => setClientModal({ open: true, data: c })}
                            className="font-bold text-orac-accent"
                          >
                            Edit
                          </Button>
                          <Button
                            variant="link"
                            onClick={async () => {
                              if (!confirm((isActive ? "Deactivate " : "Reactivate ") + (c.name || c.email))) return;
                              try {
                                isActive ? await admin.deactivateEntity("clients", c.id) : await admin.reactivateEntity("clients", c.id);
                                load();
                              } catch (e) {
                                alert(e.message);
                              }
                            }}
                            className={`font-bold ${isActive ? "text-orac-danger-text hover:text-red-700" : "text-orac-success-text hover:text-emerald-700"}`}
                          >
                            {isActive?"Disable":"Enable"}
                          </Button>
                        </div>
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
                  <h2 className="text-ux-section font-semibold text-orac-text-primary">Company Identity</h2>
                  <Badge tone="info">ORAC-owned internal configuration</Badge>
                </div>
                <p className="mt-1 text-ux-body text-orac-text-secondary">Update your trading name, legal entity, and contact details used on generated documents. This is ORAC's own record, not a client's — it is not part of the Client → Mine Site → Plant → Plant Section → Equipment Tag hierarchy.</p>
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
                    <label className="mb-1 block text-ux-label font-semibold text-orac-text-primary">{field.label}</label>
                    <input
                      type={field.type || "text"}
                      value={profile[field.key] || ""}
                      onChange={(e) => setProfile({ ...profile, [field.key]: e.target.value })}
                      className="w-full min-h-[44px] rounded-lg border border-orac-border-strong bg-orac-canvas px-3.5 py-2 text-ux-body text-orac-text-primary focus:border-orac-accent focus:outline-none focus:ring-2 focus:ring-orac-focus-ring/30 transition-all"
                    />
                    {field.help && <p className="mt-1 text-ux-caption text-orac-text-muted">{field.help}</p>}
                  </div>
                ))}
                <section className="space-y-4 rounded-xl border border-orac-warning-border bg-orac-warning-surface p-4" aria-labelledby="quotation-tax-heading">
                  <div>
                    <h3 id="quotation-tax-heading" className="text-ux-label font-semibold text-orac-text-primary">Controlled quotation tax</h3>
                    <p className="mt-1 text-ux-secondary text-orac-text-secondary">Only an approved configuration is used when production tax controls are enabled. Sales-entered tax values are ignored by the server. Record the accountant approval reference before marking this configuration approved.</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="quotation-tax-status" className="mb-1 block text-ux-label font-semibold text-orac-text-primary">Tax treatment</label>
                      <select
                        id="quotation-tax-status"
                        value={profile.quotation_tax_configuration?.tax_status || "taxable"}
                        onChange={(e) => setProfile({ ...profile, quotation_tax_configuration: { ...(profile.quotation_tax_configuration || {}), tax_status: e.target.value } })}
                        className="w-full min-h-[44px] rounded-lg border border-orac-border-strong bg-orac-canvas px-3.5 py-2 text-ux-body text-orac-text-primary focus:border-orac-accent focus:outline-none focus:ring-2 focus:ring-orac-focus-ring/30"
                      >
                        <option value="taxable">Taxable</option>
                        <option value="zero-rated">Zero-rated</option>
                        <option value="exempt">Exempt</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="quotation-tax-rate" className="mb-1 block text-ux-label font-semibold text-orac-text-primary">Applied tax rate (%)</label>
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
                        className="w-full min-h-[44px] rounded-lg border border-orac-border-strong bg-orac-canvas px-3.5 py-2 text-ux-body text-orac-text-primary focus:border-orac-accent focus:outline-none focus:ring-2 focus:ring-orac-focus-ring/30"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="quotation-tax-approval-reference" className="mb-1 block text-ux-label font-semibold text-orac-text-primary">Accountant approval reference</label>
                    <input
                      id="quotation-tax-approval-reference"
                      value={profile.quotation_tax_configuration?.approval_reference || ""}
                      onChange={(e) => setProfile({ ...profile, quotation_tax_configuration: { ...(profile.quotation_tax_configuration || {}), approval_reference: e.target.value } })}
                      className="w-full min-h-[44px] rounded-lg border border-orac-border-strong bg-orac-canvas px-3.5 py-2 text-ux-body text-orac-text-primary focus:border-orac-accent focus:outline-none focus:ring-2 focus:ring-orac-focus-ring/30"
                      placeholder="Accountant sign-off or policy reference"
                    />
                  </div>
                  <label className="flex items-start gap-3 text-ux-body text-orac-text-primary">
                    <input
                      type="checkbox"
                      checked={Boolean(profile.quotation_tax_configuration?.approved)}
                      onChange={(e) => setProfile({ ...profile, quotation_tax_configuration: { ...(profile.quotation_tax_configuration || {}), approved: e.target.checked } })}
                      className="mt-0.5 h-4 w-4 rounded border-orac-border-strong text-orac-accent focus:ring-orac-accent"
                    />
                    <span>I confirm this is an accountant-approved production quotation tax configuration.</span>
                  </label>
                </section>
                <div className="pt-4 border-t border-orac-border-default mt-6">
                  <Button type="submit" variant="primary" disabled={saveBusy} className="w-full">
                    {saveBusy ? "Saving Changes..." : "Save Profile Settings"}
                  </Button>
                  {saveSuccess && (
                    <div className="mt-3 text-center text-ux-body font-medium text-orac-success-text bg-orac-success-bg border border-orac-success-border py-2 rounded-lg">
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
            <label className="mb-1 block text-ux-label font-semibold text-orac-text-primary">Full Name</label>
            <input name="name" defaultValue={userModal.data?.name || ""} required className="w-full min-h-[44px] rounded-lg border border-orac-border-strong bg-orac-canvas px-3.5 py-2 text-ux-body text-orac-text-primary focus:border-orac-accent focus:ring-2 focus:ring-orac-focus-ring/30" />
          </div>
          <div>
            <label className="mb-1 block text-ux-label font-semibold text-orac-text-primary">Email Address</label>
            <input name="email" type="email" defaultValue={userModal.data?.email || ""} required className="w-full min-h-[44px] rounded-lg border border-orac-border-strong bg-orac-canvas px-3.5 py-2 text-ux-body text-orac-text-primary focus:border-orac-accent focus:ring-2 focus:ring-orac-focus-ring/30" />
          </div>
          <div>
            <label className="mb-1 block text-ux-label font-semibold text-orac-text-primary">{userModal.data ? "New Password (optional)" : "Temporary Password"}</label>
            <input name="password" type="password" minLength="10" required={!userModal.data} autoComplete="new-password" placeholder={userModal.data ? "Leave blank to keep the existing password" : "At least 10 characters"} className="w-full min-h-[44px] rounded-lg border border-orac-border-strong bg-orac-canvas px-3.5 py-2 text-ux-body text-orac-text-primary focus:border-orac-accent focus:ring-2 focus:ring-orac-focus-ring/30" />
            <p className="mt-1 text-ux-caption text-orac-text-muted">Share a temporary password securely; the user can change it through the reset flow.</p>
          </div>
          <div>
            <label className="mb-1 block text-ux-label font-semibold text-orac-text-primary">System Role</label>
            <select name="role" defaultValue={userModal.data?.role || "Technician"} className="w-full min-h-[44px] rounded-lg border border-orac-border-strong bg-orac-canvas px-3.5 py-2 text-ux-body text-orac-text-primary focus:border-orac-accent focus:ring-2 focus:ring-orac-focus-ring/30">
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
            <label className="mb-1 block text-ux-label font-semibold text-orac-text-primary">Client ID (For Client Viewers)</label>
            <input name="client_id" defaultValue={userModal.data?.client_id || ""} placeholder="e.g. c_zimplats" className="w-full min-h-[44px] rounded-lg border border-orac-border-strong bg-orac-canvas px-3.5 py-2 text-ux-body text-orac-text-primary focus:border-orac-accent focus:ring-2 focus:ring-orac-focus-ring/30" />
            <p className="mt-1 text-ux-caption text-orac-text-muted">Only required if role is Client Viewer.</p>
          </div>
          <div>
            <label className="mb-1 block text-ux-label font-semibold text-orac-text-primary">Trade / Specialty</label>
            <select name="trade" defaultValue={userModal.data?.trade || ""} className="w-full min-h-[44px] rounded-lg border border-orac-border-strong bg-orac-canvas px-3.5 py-2 text-ux-body text-orac-text-primary focus:border-orac-accent focus:ring-2 focus:ring-orac-focus-ring/30">
              <option value="">Not assigned</option>
              {TECHNICIAN_TRADES.map((trade) => <option key={trade} value={trade}>{trade}</option>)}
            </select>
            <p className="mt-1 text-ux-caption text-orac-text-muted">Assign only to Technician accounts. This groups operational timesheets without changing access rights.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-ux-label font-semibold text-orac-text-primary">National ID Number</label>
              <input name="national_id" maxLength={32} defaultValue={userModal.data?.national_id || ""} placeholder="Technician accounts only" className="w-full min-h-[44px] rounded-lg border border-orac-border-strong bg-orac-canvas px-3.5 py-2 text-ux-body text-orac-text-primary focus:border-orac-accent focus:ring-2 focus:ring-orac-focus-ring/30" />
            </div>
            <div>
              <label className="mb-1 block text-ux-label font-semibold text-orac-text-primary">Payroll Employee Code</label>
              <input name="employee_code" maxLength={32} defaultValue={userModal.data?.employee_code || ""} placeholder="Pastel employee code" className="w-full min-h-[44px] rounded-lg border border-orac-border-strong bg-orac-canvas px-3.5 py-2 text-ux-body text-orac-text-primary focus:border-orac-accent focus:ring-2 focus:ring-orac-focus-ring/30" />
            </div>
            <p className="text-ux-caption text-orac-text-muted sm:col-span-2">Used for the Finance payroll report and review export. An employee code is required to export; national ID fallback is disabled.</p>
          </div>
          <div>
            <label className="mb-1 block text-ux-label font-semibold text-orac-text-primary">Account Status</label>
            <select name="is_active" defaultValue={userModal.data ? String(userModal.data.is_active) : "true"} className="w-full min-h-[44px] rounded-lg border border-orac-border-strong bg-orac-canvas px-3.5 py-2 text-ux-body text-orac-text-primary focus:border-orac-accent focus:ring-2 focus:ring-orac-focus-ring/30">
              <option value="true">Active</option>
              <option value="false">Inactive / Suspended</option>
            </select>
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setUserModal({ open: false, data: null })}>Cancel</Button>
            <Button type="submit" variant="primary">Save User</Button>
          </div>
        </form>
      </Modal>

      <Modal title={clientModal.data ? "Edit Client" : "Register Client"} isOpen={clientModal.open} onClose={() => setClientModal({ open: false, data: null })}>
        <form onSubmit={handleClientSave} className="space-y-4">
          <div>
            <label className="mb-1 block text-ux-label font-semibold text-orac-text-primary">Client Name</label>
            <input name="name" defaultValue={clientModal.data?.name || ""} required className="w-full min-h-[44px] rounded-lg border border-orac-border-strong bg-orac-canvas px-3.5 py-2 text-ux-body text-orac-text-primary focus:border-orac-accent focus:ring-2 focus:ring-orac-focus-ring/30" />
          </div>
          <div>
            <label className="mb-1 block text-ux-label font-semibold text-orac-text-primary">Client Type</label>
            <select name="client_type" defaultValue={clientModal.data?.client_type || "permanent"} className="w-full min-h-[44px] rounded-lg border border-orac-border-strong bg-orac-canvas px-3.5 py-2 text-ux-body text-orac-text-primary focus:border-orac-accent focus:ring-2 focus:ring-orac-focus-ring/30">
              <option value="permanent">Permanent Account</option>
              <option value="walk_in">Walk-In / Once-off</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-ux-label font-semibold text-orac-text-primary">Contact Person</label>
            <input name="contact_person" defaultValue={clientModal.data?.contact_person || ""} className="w-full min-h-[44px] rounded-lg border border-orac-border-strong bg-orac-canvas px-3.5 py-2 text-ux-body text-orac-text-primary focus:border-orac-accent focus:ring-2 focus:ring-orac-focus-ring/30" />
          </div>
          <div>
            <label className="mb-1 block text-ux-label font-semibold text-orac-text-primary">Contact Email</label>
            <input name="email" type="email" defaultValue={clientModal.data?.email || ""} className="w-full min-h-[44px] rounded-lg border border-orac-border-strong bg-orac-canvas px-3.5 py-2 text-ux-body text-orac-text-primary focus:border-orac-accent focus:ring-2 focus:ring-orac-focus-ring/30" />
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setClientModal({ open: false, data: null })}>Cancel</Button>
            <Button type="submit" variant="primary">Save Client</Button>
          </div>
        </form>
      </Modal>

      {/* Issue Enrollment Ticket Modal (V5 Mock) */}
      <Modal
        title={ticketModal.ticket ? "Enrollment Ticket Issued" : "Issue Enrollment Ticket"}
        isOpen={ticketModal.open}
        onClose={() => setTicketModal({ open: false, user: null, ticket: null, error: "", busy: false, verificationMethod: "in_person" })}
      >
        {ticketModal.ticket ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-orac-success-border bg-orac-success-bg p-4 text-orac-success-text">
              <div className="font-semibold text-ux-body">Single-Use Ticket Active</div>
              <p className="mt-1 text-ux-secondary">
                Deliver this ticket to <strong className="text-orac-text-primary">{ticketModal.user?.name || ticketModal.user?.email}</strong>. It expires in 30 minutes.
              </p>
            </div>

            <div className="rounded-lg border border-orac-border bg-orac-surface-muted p-4 text-center">
              <div className="text-ux-caption font-semibold text-orac-text-muted mb-1">
                One-Time Ticket
              </div>
              <div className="text-xl font-mono font-bold text-orac-text-primary select-all">
                {ticketModal.ticket}
              </div>
            </div>

            <p className="text-ux-caption text-orac-text-muted">
              The user enters this ticket along with their password at <strong>/enroll</strong> to link their authenticator app.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                onClick={() => {
                  navigator.clipboard?.writeText(ticketModal.ticket);
                }}
              >
                Copy ticket
              </Button>
              <Button
                variant="primary"
                onClick={() => setTicketModal({ open: false, user: null, ticket: null, error: "", busy: false, verificationMethod: "in_person" })}
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setTicketModal((m) => ({ ...m, busy: true, error: "" }));
              try {
                const res = await totp.issueTicket(ticketModal.user.id);
                setTicketModal((m) => ({
                  ...m,
                  busy: false,
                  ticket: res?.ticket || res?.data?.ticket || ""
                }));
              } catch (err) {
                setTicketModal((m) => ({
                  ...m,
                  busy: false,
                  error: err.message || "Failed to issue ticket."
                }));
              }
            }}
            className="space-y-4"
          >
            <div className="rounded-lg border border-orac-info-border bg-orac-info-bg p-3.5 text-ux-secondary text-orac-info-text">
              You cannot issue a ticket for an account you created or whose password you set. Another Admin must do it.
            </div>

            <div>
              <p className="text-ux-body font-semibold text-orac-text-primary">
                Recipient: <strong className="text-orac-accent">{ticketModal.user?.name || ticketModal.user?.email}</strong> ({ticketModal.user?.role})
              </p>
            </div>

            <div className="space-y-1">
              <label htmlFor="verify-method" className="block text-ux-label font-semibold text-orac-text-primary">
                How did you check who this is?
              </label>
              <p className="text-ux-caption text-orac-text-muted">
                Checklist for your records - not stored by the system
              </p>
              <Select
                id="verify-method"
                value={ticketModal.verificationMethod}
                onChange={(e) => setTicketModal((m) => ({ ...m, verificationMethod: e.target.value }))}
              >
                <option value="in_person">In person at the office / on site</option>
                <option value="voice_call">Voice call to their verified phone number</option>
                <option value="video_call">Video call with government ID presented</option>
              </Select>
            </div>

            {ticketModal.error && (
              <div role="alert" className="rounded-lg border border-orac-danger-border bg-orac-danger-bg p-3 text-ux-secondary text-orac-danger-text">
                {ticketModal.error}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-3 border-t border-orac-border">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setTicketModal({ open: false, user: null, ticket: null, error: "", busy: false, verificationMethod: "in_person" })}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={ticketModal.busy}
              >
                {ticketModal.busy ? "Issuing…" : "Issue ticket"}
              </Button>
            </div>
          </form>
        )}
      </Modal>

    </div>
  );
}
