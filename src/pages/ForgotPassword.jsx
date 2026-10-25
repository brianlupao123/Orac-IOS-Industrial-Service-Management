import React, { useState } from "react";
import { Link } from "react-router-dom";
import { auth } from "../api/client.js";

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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <h1 className="text-lg font-semibold text-orac-slate mb-1">Reset your password</h1>

        {submitted ? (
          <div>
            <p className="text-sm text-gray-600 mt-2">
              If that email has an account, a reset link has been issued. Email delivery isn't
              fully automated for this pilot yet — if you don't hear back shortly, contact an
              administrator directly and they can retrieve the link for you.
            </p>
            <Link to="/login" className="text-sm text-blue-700 hover:underline mt-4 inline-block">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <p className="text-sm text-gray-500 mb-4">Enter the email address on your account.</p>
            <label htmlFor="forgot-email" className="text-sm font-medium text-gray-700 block mb-1">Email address</label>
            <input
              id="forgot-email"
              name="email"
              autoComplete="username"
              inputMode="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm mb-3"
              required
            />
            {error && (
              <p className="text-sm text-red-600 mb-3 rounded bg-red-50 border border-red-200 px-2 py-1.5">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded bg-orac-blue text-orac-slate font-semibold py-2.5 text-sm disabled:opacity-50"
            >
              {busy ? "Sending..." : "Send reset link"}
            </button>
            <Link to="/login" className="block text-center text-xs text-gray-500 hover:underline mt-4">
              Back to sign in
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
