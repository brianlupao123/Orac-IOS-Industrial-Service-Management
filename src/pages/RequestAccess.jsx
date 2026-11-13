import React, { useState } from "react";
import { Link } from "react-router-dom";
import { accessRequests } from "../api/client.js";
import SearchableSelect from "../components/SearchableSelect.jsx";
import AuthShell from "../components/ui/AuthShell.jsx";

// Matches REQUESTABLE_ROLES in accessRequestsController.js exactly.
// "Admin" is intentionally not offered here — see that file's comment for why.
const ROLE_OPTIONS = [
  { value: "Management", label: "Management" },
  { value: "Sales", label: "Sales" },
  { value: "Finance", label: "Finance" },
  { value: "Operations", label: "Operations" },
  { value: "Technician", label: "Technician" },
  { value: "Supervisor", label: "Supervisor" },
  { value: "Client Viewer", label: "Client Viewer", hint: "For client-side users viewing their own quotes/invoices" }
];

export default function RequestAccess() {
  const [form, setForm] = useState({ name: "", email: "", requested_role: "", reason: "" });
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.name || !form.email || !form.requested_role) {
      setError("Name, email, and requested role are all required.");
      return;
    }
    setBusy(true);
    try {
      await accessRequests.submit(form);
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell tag="Access Provisioning" maxWidth="max-w-[460px]">
            <div className="mb-6">
              <h1 className="text-2xl font-bold tracking-tight text-orac-text-primary sm:text-3xl">
                Request access
              </h1>
              <p className="mt-2 text-sm text-orac-text-secondary">
                Accounts are approved by an administrator, who assigns verified permissions. The selected role is a request subject to internal governance.
              </p>
            </div>

            {submitted ? (
              <div className="rounded-xl border border-orac-success-border bg-orac-success-bg p-6 text-orac-text-primary shadow-xs">
                <div className="flex items-center gap-2 font-bold text-orac-success-text">
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Request Successfully Submitted
                </div>
                <p className="mt-3 text-sm text-orac-text-secondary leading-relaxed">
                  Your request has been sent to an administrator for review. You will receive an invitation to set your password once your role has been provisioned.
                </p>
                <Link
                  to="/login"
                  className="mt-6 inline-flex items-center font-semibold text-orac-accent hover:underline"
                >
                  ← Back to sign in
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="request-name" className="mb-1.5 block text-sm font-semibold text-orac-text-primary">
                    Full name
                  </label>
                  <input
                    id="request-name"
                    name="name"
                    autoComplete="name"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. John Moyo"
                    className="w-full min-h-[44px] rounded-lg border border-orac-border-strong bg-orac-canvas px-3.5 py-2.5 text-base text-orac-text-primary placeholder:text-orac-text-muted focus:border-orac-accent focus:outline-none focus:ring-4 focus:ring-orac-focus-ring/10 transition-all"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="request-email" className="mb-1.5 block text-sm font-semibold text-orac-text-primary">
                    Email address
                  </label>
                  <input
                    id="request-email"
                    name="email"
                    autoComplete="email"
                    inputMode="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="john.moyo@oracsystems.com"
                    className="w-full min-h-[44px] rounded-lg border border-orac-border-strong bg-orac-canvas px-3.5 py-2.5 text-base text-orac-text-primary placeholder:text-orac-text-muted focus:border-orac-accent focus:outline-none focus:ring-4 focus:ring-orac-focus-ring/10 transition-all"
                    required
                  />
                </div>

                <div>
                  <p id="request-role-label" className="mb-1.5 block text-sm font-semibold text-orac-text-primary">
                    Requested role
                  </p>
                  <SearchableSelect
                    id="request-role"
                    ariaLabel="Requested role"
                    options={ROLE_OPTIONS}
                    value={form.requested_role}
                    onChange={(v) => setForm((f) => ({ ...f, requested_role: v }))}
                    placeholder="Select a role..."
                  />
                </div>

                <div>
                  <label htmlFor="request-reason" className="mb-1.5 block text-sm font-semibold text-orac-text-primary">
                    Reason (optional)
                  </label>
                  <textarea
                    id="request-reason"
                    name="reason"
                    value={form.reason}
                    onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                    rows={3}
                    placeholder="e.g. Joining the field service team, need dispatch access"
                    className="w-full rounded-lg border border-orac-border-strong bg-orac-canvas px-3.5 py-2.5 text-base text-orac-text-primary placeholder:text-orac-text-muted focus:border-orac-accent focus:outline-none focus:ring-4 focus:ring-orac-focus-ring/10 transition-all"
                  />
                </div>

                {error && (
                  <div role="alert" className="rounded-lg border border-orac-danger-border bg-orac-danger-bg px-4 py-3 text-sm text-orac-danger-text">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full min-h-[44px] rounded-lg bg-orac-accent hover:bg-orac-accent-strong text-white font-semibold py-3 text-base shadow-xs disabled:opacity-50 transition-all cursor-pointer"
                >
                  {busy ? "Submitting..." : "Submit request"}
                </button>

                <div className="pt-2 text-center">
                  <Link to="/login" className="text-sm font-semibold text-orac-accent hover:underline">
                    ← Back to sign in
                  </Link>
                </div>
              </form>
            )}

            <footer className="mt-8 border-t border-orac-border pt-4 text-center text-xs text-orac-text-muted">
              <p>Orac-IOS · Orac Industrial Operations System</p>
              <p className="mt-1">&copy; {new Date().getFullYear()} Handon Enterprises (Pvt) Ltd, trading as Orac Systems.</p>
              <a className="mt-2 inline-block font-semibold text-orac-accent hover:underline" href="https://oracsystems.co.zw" target="_blank" rel="noreferrer">
                Company site
              </a>
            </footer>
    </AuthShell>
  );
}
