import React, { useState } from "react";
import { Link } from "react-router-dom";
import { auth } from "../api/client.js";
import AuthShell from "../components/ui/AuthShell.jsx";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await auth.requestPasswordReset(email);
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell tag="Password Recovery" maxWidth="max-w-[420px]">
            <div className="mb-8">
              <h1 className="text-2xl font-bold tracking-tight text-orac-text-primary sm:text-3xl">
                Reset your password
              </h1>
              <p className="mt-2 text-sm text-orac-text-secondary sm:text-base">
                Enter the email address registered on your account to request a secure password reset link.
              </p>
            </div>

            {submitted ? (
              <div className="rounded-xl border border-orac-info-border bg-orac-info-bg p-6 text-orac-text-primary shadow-xs">
                <div className="flex items-center gap-2 font-bold text-orac-info-text">
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  Reset Link Requested
                </div>
                <p className="mt-3 text-sm text-orac-text-secondary leading-relaxed">
                  If that email belongs to an active account, a reset link has been dispatched. For the pilot environment, if you do not receive it promptly, please contact an administrator to retrieve your link.
                </p>
                <Link
                  to="/login"
                  className="mt-6 inline-flex items-center font-semibold text-orac-accent hover:underline"
                >
                  ← Back to sign in
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="forgot-email" className="mb-2 block text-sm font-semibold text-orac-text-primary">
                    Email address
                  </label>
                  <input
                    id="forgot-email"
                    name="email"
                    autoComplete="username"
                    inputMode="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full min-h-[44px] rounded-lg border border-orac-border-strong bg-orac-canvas px-3.5 py-3 text-base text-orac-text-primary placeholder:text-orac-text-muted focus:border-orac-accent focus:outline-none focus:ring-4 focus:ring-orac-focus-ring/10 transition-all"
                    required
                    autoFocus
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
                  {busy ? "Sending link..." : "Send reset link"}
                </button>

                <div className="pt-2 text-center">
                  <Link to="/login" className="text-ux-secondary font-semibold text-orac-accent hover:underline">
                    ← Back to sign in
                  </Link>
                </div>
              </form>
            )}

            <p className="mt-8 text-center text-ux-caption text-orac-text-muted">
              Orac-IOS &copy; {new Date().getFullYear()} &bull; Orac Systems
            </p>
    </AuthShell>
  );
}
