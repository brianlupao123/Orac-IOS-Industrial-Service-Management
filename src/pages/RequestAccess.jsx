import React, { useState } from "react";
import { Link } from "react-router-dom";
import { accessRequests } from "../api/client.js";
import SearchableSelect from "../components/SearchableSelect.jsx";

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
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 text-center"><img src="/images/orac-systems-logo.png" alt="Orac Systems" className="mx-auto h-20 w-20 rounded-full bg-white object-contain shadow-sm" /><p className="mt-3 text-sm font-semibold text-orac-navy">ORAC-IOS</p><p className="text-xs text-gray-500">Orac Systems operations portal</p></div>
      <div className="bg-white rounded-lg border border-gray-300 shadow-sm p-6">
        <h1 className="text-lg font-semibold text-orac-slate mb-1">Request access</h1>

        {submitted ? (
          <div>
            <p className="text-sm text-gray-600 mt-2">
              Your request has been sent to an administrator for review. You'll receive a link to
              set your own password once it's approved.
            </p>
            <Link to="/login" className="text-sm text-blue-700 hover:underline mt-4 inline-block">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <p className="text-sm text-gray-500 mb-4">
              Accounts on this portal are approved by an administrator, who assigns the actual
              role — the role you select below is a request, not a guarantee.
            </p>

            <label htmlFor="request-name" className="text-sm font-medium text-gray-700 block mb-1">Full name</label>
            <input
              id="request-name"
              name="name"
              autoComplete="name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm mb-3"
              required
            />

            <label htmlFor="request-email" className="text-sm font-medium text-gray-700 block mb-1">Email address</label>
            <input
              id="request-email"
              name="email"
              autoComplete="email"
              inputMode="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm mb-3"
              required
            />

            <p id="request-role-label" className="text-xs font-medium text-gray-600 block mb-1">Requested role</p>
            <div className="mb-3">
              <SearchableSelect
                id="request-role"
                ariaLabel="Requested role"
                options={ROLE_OPTIONS}
                value={form.requested_role}
                onChange={(v) => setForm((f) => ({ ...f, requested_role: v }))}
                placeholder="Select a role..."
              />
            </div>

            <label htmlFor="request-reason" className="text-sm font-medium text-gray-700 block mb-1">
              Reason (optional)
            </label>
            <textarea
              id="request-reason"
              name="reason"
              value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              rows={3}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm mb-3"
              placeholder="e.g. Joining the field service team, need dispatch access"
            />

            {error && (
              <p className="text-sm text-red-600 mb-3 rounded bg-red-50 border border-red-200 px-2 py-1.5">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded bg-orac-navy text-white font-semibold py-2.5 text-sm disabled:opacity-50"
            >
              {busy ? "Submitting..." : "Submit request"}
            </button>

            <Link to="/login" className="block text-center text-xs text-gray-500 hover:underline mt-4">
              Back to sign in
            </Link>
          </form>
        )}
      </div>
      <footer className="mt-6 border-t border-gray-200 pt-4 text-center text-xs text-gray-500"><p>Orac-IOS · Orac Industrial Operations System</p><p className="mt-1">&copy; {new Date().getFullYear()} Handon Enterprises (Pvt) Ltd, trading as Orac Systems.</p><a className="mt-2 inline-block font-semibold text-orac-navy hover:underline" href="https://oracsystems.co.zw" target="_blank" rel="noreferrer">Company site</a></footer>
      </div>
    </div>
  );
}
