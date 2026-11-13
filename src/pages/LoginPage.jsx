import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { auth } from "../api/client.js";
import { totpEnrollmentUiEnabled } from "../totpFlags.js";
import SessionExpiredBanner from "../components/SessionExpiredBanner.jsx";
import AuthShell from "../components/ui/AuthShell.jsx";
import Button from "../components/ui/Button.jsx";
import Field from "../components/ui/Field.jsx";
import Input from "../components/ui/Input.jsx";

export default function LoginPage({ onLogin, sessionExpired = false }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [challenge, setChallenge] = useState(null);
  const [factorValue, setFactorValue] = useState("");
  const [recoveryMode, setRecoveryMode] = useState(false);

  async function handleSubmit(e, directEmail = null, directPassword = null) {
    if (e) e.preventDefault();
    const targetEmail = directEmail || email;
    const targetPassword = directPassword || password;
    if (!targetEmail) return;

    setError("");
    setBusy(true);
    try {
      const user = await auth.login(targetEmail, targetPassword);
      if (user?.status === "verification_required") {
        setChallenge(user);
        setPassword("");
        setBusy(false);
        return;
      }
      onLogin(user);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  async function handleFactorSubmit(e) {
    e.preventDefault();
    const value = factorValue.trim();
    if (!challenge?.challenge_id || (!recoveryMode && !/^\d{6}$/.test(value)) || (recoveryMode && !value)) return;
    setError("");
    setBusy(true);
    try {
      const user = await auth.verifyLoginCode(email, challenge.challenge_id, value, recoveryMode);
      onLogin(user);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message);
      setFactorValue("");
      setBusy(false);
    }
  }

  function startOver() {
    setChallenge(null);
    setFactorValue("");
    setRecoveryMode(false);
    setError("");
  }

  return (
    <AuthShell tag="Industrial Service Management" maxWidth="max-w-[420px]">
            <div className="mb-8">
              <h1 className="text-2xl font-bold tracking-tight text-orac-text-primary sm:text-3xl">
                {challenge ? "Verify your sign-in" : "Sign in to your account"}
              </h1>
              <p className="mt-2 text-ux-secondary text-orac-text-secondary sm:text-base">
                {challenge
                  ? "Enter the 6-digit code from your authenticator app or use a recovery code."
                  : "Enter your credentials to access your operational workspace."}
              </p>
            </div>

            {sessionExpired && (
              <div data-evidence="session-expired-state" className="mb-6">
                <SessionExpiredBanner />
              </div>
            )}

            {challenge ? (
              <form onSubmit={handleFactorSubmit} className="space-y-5">
                <p className="rounded-lg bg-orac-surface-muted px-3.5 py-2 text-ux-secondary font-medium text-orac-text-secondary">
                  Signing in as: <strong className="text-orac-text-primary">{email}</strong>
                </p>

                <Field id="login-factor" label={recoveryMode ? "Emergency Recovery Code" : "6-Digit Authenticator Code"}>
                  <Input
                    id="login-factor"
                    name={recoveryMode ? "recovery_code" : "one-time-code"}
                    type="text"
                    inputMode={recoveryMode ? "text" : "numeric"}
                    autoComplete={recoveryMode ? "off" : "one-time-code"}
                    pattern={recoveryMode ? undefined : "[0-9]{6}"}
                    maxLength={recoveryMode ? 64 : 6}
                    value={factorValue}
                    onChange={(e) => setFactorValue(e.target.value)}
                    placeholder={recoveryMode ? "Enter 16-character recovery code" : "000000"}
                    required
                    autoFocus
                    disabled={busy}
                  />
                </Field>

                {error && (
                  <div role="alert" className="rounded-lg border border-orac-danger-border bg-orac-danger-bg px-4 py-3 text-ux-secondary text-orac-danger-text">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={busy}
                  variant="primary"
                  className="w-full py-3 flex justify-center text-base font-semibold"
                >
                  {busy ? "Verifying…" : "Verify Code"}
                </Button>

                <div className="flex flex-col gap-2 pt-2">
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => {
                      setRecoveryMode(!recoveryMode);
                      setFactorValue("");
                      setError("");
                    }}
                    className="text-ux-secondary font-medium"
                  >
                    {recoveryMode ? "Use authenticator code instead" : "Use a recovery code instead"}
                  </Button>

                  <Button
                    type="button"
                    variant="link"
                    onClick={startOver}
                    className="text-ux-caption text-orac-text-muted"
                  >
                    Start sign-in again
                  </Button>
                </div>

                <p className="border-t border-orac-border pt-4 text-center text-ux-caption text-orac-text-muted">
                  Lost access to both code and recovery keys? Contact your system administrator.
                </p>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="login-email" className="mb-2 block text-ux-label font-semibold text-orac-text-primary">
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
                    className="w-full min-h-[44px] rounded-lg border border-orac-border-strong bg-orac-canvas px-3.5 py-3 text-base text-orac-text-primary placeholder:text-orac-text-muted focus:border-orac-accent focus:outline-none focus:ring-4 focus:ring-orac-focus-ring/10 transition-all"
                    required
                    autoFocus
                    disabled={busy}
                  />
                </div>

                <div>
                  <label htmlFor="login-password" className="mb-2 block text-ux-label font-semibold text-orac-text-primary">
                    Password
                  </label>
                  <input
                    id="login-password"
                    name="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full min-h-[44px] rounded-lg border border-orac-border-strong bg-orac-canvas px-3.5 py-3 text-base text-orac-text-primary placeholder:text-orac-text-muted focus:border-orac-accent focus:outline-none focus:ring-4 focus:ring-orac-focus-ring/10 transition-all"
                    required
                    autoComplete="current-password"
                    disabled={busy}
                  />
                </div>

                {error && (
                  <div role="alert" className="rounded-lg border border-orac-danger-border bg-orac-danger-bg px-4 py-3 text-ux-secondary text-orac-danger-text">
                    {error}
                  </div>
                )}

                <div className="flex items-center justify-between text-ux-secondary">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" className="rounded border-orac-border-strong text-orac-accent focus:ring-orac-accent/20" />
                    <span className="text-orac-text-secondary">Remember me</span>
                  </label>
                  <Link to="/forgot-password" className="font-semibold text-orac-accent hover:underline transition-colors">
                    Forgot password?
                  </Link>
                </div>

                <Button
                  type="submit"
                  disabled={busy}
                  variant="primary"
                  className="w-full py-3 flex justify-center text-base font-semibold"
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
                </Button>

                <div className="border-t border-orac-border pt-4 text-center space-y-1 text-ux-secondary text-orac-text-muted">
                  <p>
                    Need an account?{" "}
                    <Link to="/request-access" className="font-semibold text-orac-accent hover:underline">
                      Request access
                    </Link>
                  </p>
                  {totpEnrollmentUiEnabled() && (
                    <p>
                      Have a setup ticket?{" "}
                      <Link to="/enroll" className="font-semibold text-orac-accent hover:underline">
                        Set up authenticator
                      </Link>
                    </p>
                  )}
                </div>
              </form>
            )}

            <p className="mt-8 text-center text-ux-caption text-orac-text-muted">
              Orac-IOS &copy; {new Date().getFullYear()} &bull; Orac Systems
            </p>
    </AuthShell>
  );
}
