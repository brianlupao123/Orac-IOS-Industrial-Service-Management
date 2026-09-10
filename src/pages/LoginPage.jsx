import React, { useState } from "react";
import { auth } from "../api/client.js";

/**
 * Production login page with branded design.
 */
export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const user = await auth.login(email);
      onLogin(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-sky-50/30 to-gray-100">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-orac-blue text-xl font-bold text-white shadow-lg shadow-sky-200/50">
            O
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-orac-slate">ORAC-IOS</h1>
          <p className="mt-1 text-xs uppercase tracking-widest text-gray-400">Integrated Operations System</p>
        </div>

        {/* Login form */}
        <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 bg-white p-6 shadow-lg shadow-gray-200/50">
          <h2 className="mb-1 text-lg font-semibold text-orac-slate">Sign in</h2>
          <p className="mb-5 text-sm text-gray-400">Enter your email to access the portal</p>

          <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-gray-500">
            Email address
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-orac-slate placeholder:text-gray-300 focus:border-orac-blue focus:outline-none focus:ring-2 focus:ring-orac-blue/20"
            required
            autoFocus
          />

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-orac-blue py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md hover:brightness-105 disabled:opacity-50"
          >
            {busy ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Signing in...
              </span>
            ) : (
              "Sign in"
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-gray-400">
          Orac-IOS &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}