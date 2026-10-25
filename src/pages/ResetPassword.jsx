import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { auth } from "../api/client.js";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  // Setup links carry the token in the URL fragment (#...), which browsers never
  // send to a web server, so it stays out of host access logs. Query-string links
  // from older builds still work.
  const [link] = useState(() => {
    const fromHash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    return {
      email: fromHash.get("email") || params.get("email") || "",
      token: fromHash.get("token") || params.get("token") || ""
    };
  });
  const { email, token } = link;

  // Once read, remove the token from the address bar and history entry.
  useEffect(() => {
    if (window.location.hash || window.location.search) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (newPassword.length < 10) {
      setError("Password must be at least 10 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!email || !token) {
      setError("This reset link is missing required information. Request a new one.");
      return;
    }

    setBusy(true);
    try {
      await auth.resetPassword(email, token, newPassword);
      setDone(true);
      setTimeout(() => navigate("/login"), 1800);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <h1 className="text-lg font-semibold text-orac-slate mb-1">Set a new password</h1>

        {!email || !token ? (
          <p className="text-sm text-red-600 mt-3">
            This link is missing required information.{" "}
            <Link to="/forgot-password" className="underline">Request a new one</Link>.
          </p>
        ) : done ? (
          <p className="text-sm text-green-700 mt-3">Password updated. Redirecting to sign in...</p>
        ) : (
          <form onSubmit={handleSubmit}>
            <p className="text-sm text-gray-500 mb-4">Resetting password for {email}</p>

            <label htmlFor="reset-new-password" className="text-sm font-medium text-gray-700 block mb-1">New password</label>
            <input
              id="reset-new-password"
              name="new-password"
              autoComplete="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm mb-3"
              minLength={10}
              required
            />

            <label htmlFor="reset-confirm-password" className="text-sm font-medium text-gray-700 block mb-1">Confirm password</label>
            <input
              id="reset-confirm-password"
              name="confirm-password"
              autoComplete="new-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm mb-3"
              minLength={10}
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
              {busy ? "Updating..." : "Update password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
