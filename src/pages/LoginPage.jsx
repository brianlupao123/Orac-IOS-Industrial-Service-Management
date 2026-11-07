import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { auth } from "../api/client.js";
import SessionExpiredBanner from "../components/SessionExpiredBanner.jsx";

export default function LoginPage({ onLogin, sessionExpired = false }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e, directEmail = null, directPassword = null) {
    if (e) e.preventDefault();
    const targetEmail = directEmail || email;
    const targetPassword = directPassword || password;
    if (!targetEmail) return;

    setError("");
    setBusy(true);
    try {
      const user = await auth.login(targetEmail, targetPassword);
      onLogin(user);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 text-orac-slate font-sans selection:bg-orac-blue/20">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-6 py-12 sm:px-12">
        <div className="w-full max-w-[420px] mx-auto">
          <div className="mb-10 flex items-center gap-3">
            <img src="/images/orac-systems-logo.png" alt="Orac Systems" className="h-12 w-12 rounded-full bg-white object-contain shadow-sm" />
            <div>
              <div className="text-xl font-bold tracking-tight text-orac-slate">ORAC-IOS</div>
              <div className="text-xs font-semibold uppercase tracking-wider text-orac-text-muted">Industrial Service Management</div>
            </div>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 mb-2">Sign in to your account</h1>
            <p className="text-sm text-gray-500">Enter your credentials to access the portal.</p>
          </div>

          {sessionExpired && <div data-evidence="session-expired-state" className="mb-6"><SessionExpiredBanner /></div>}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="login-email" className="mb-2 block text-sm font-semibold text-gray-700">
                Email address
              </label>
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="username"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-900 placeholder:text-orac-border-strong focus:border-orac-blue focus:outline-none focus:ring-4 focus:ring-orac-blue/10 transition-all"
                required
                autoFocus
                disabled={busy}
              />
            </div>

            <div>
              <label htmlFor="login-password" className="mb-2 block text-sm font-semibold text-gray-700">
                Password
              </label>
              <input
                id="login-password"
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-900 placeholder:text-orac-border-strong focus:border-orac-blue focus:outline-none focus:ring-4 focus:ring-orac-blue/10 transition-all"
                required
                autoComplete="current-password"
                disabled={busy}
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50/80 border border-red-100 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded border-gray-300 text-orac-blue focus:ring-orac-blue/20" />
                <span className="text-gray-600">Remember me</span>
              </label>
              <Link to="/forgot-password" className="font-medium text-orac-blue hover:text-orac-blue/80 transition-colors">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-gray-900 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center"
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
            <p className="text-center text-xs text-gray-500 mt-5">
              Need an account?{" "}
              <Link to="/request-access" className="text-orac-blue hover:underline font-medium">
                Request access
              </Link>
            </p>
          </form>

          <p className="mt-6 text-center text-xs text-orac-text-muted">
            Orac-IOS &copy; {new Date().getFullYear()} &bull; Orac Systems
          </p>
        </div>
      </div>
    </div>
  );
}
