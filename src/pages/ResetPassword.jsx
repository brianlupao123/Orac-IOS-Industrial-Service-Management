import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { auth } from "../api/client.js";
import AuthShell from "../components/ui/AuthShell.jsx";
import Button from "../components/ui/Button.jsx";
import Field from "../components/ui/Field.jsx";
import Input from "../components/ui/Input.jsx";

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
    <AuthShell tag="Set a new password" maxWidth="max-w-[420px]">
      {!email || !token ? (
        <p role="alert" className="rounded-lg border border-orac-danger-border bg-orac-danger-bg px-4 py-3 text-ux-body text-orac-danger-text">
          This link is missing required information.{" "}
          <Link to="/forgot-password" className="font-semibold underline">Request a new one</Link>.
        </p>
      ) : done ? (
        <p role="status" className="rounded-lg border border-orac-success-border bg-orac-success-bg px-4 py-3 text-ux-body text-orac-success-text">Password updated. Redirecting to sign in...</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <p className="text-ux-secondary text-orac-text-secondary">Resetting password for <strong className="text-orac-text-primary">{email}</strong></p>
          <Field id="reset-new-password" label="New password" hint="At least 10 characters.">
            <Input id="reset-new-password" name="new-password" autoComplete="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={10} required />
          </Field>
          <Field id="reset-confirm-password" label="Confirm password">
            <Input id="reset-confirm-password" name="confirm-password" autoComplete="new-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={10} required />
          </Field>
          {error && <p role="alert" className="rounded-lg border border-orac-danger-border bg-orac-danger-bg px-4 py-3 text-ux-secondary text-orac-danger-text">{error}</p>}
          <Button type="submit" variant="primary" loading={busy} className="w-full">{busy ? "Updating..." : "Update password"}</Button>
        </form>
      )}
    </AuthShell>
  );
}
