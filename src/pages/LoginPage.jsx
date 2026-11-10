import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { auth } from "../api/client.js";
import SessionExpiredBanner from "../components/SessionExpiredBanner.jsx";
import BrandMark from "../components/ui/BrandMark.jsx";
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
    <div className="min-h-screen bg-orac-canvas text-orac-text-primary font-sans selection:bg-orac-accent/20">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-6 py-12 sm:px-12">
        <div className="w-full max-w-[420px] mx-auto">
          <div className="mb-10 flex items-center gap-3">
            <BrandMark size={48} />
            <div>
              <div className="text-ux-title font-bold tracking-tight text-orac-text-primary">ORAC-IOS</div>
              <div className="text-ux-caption font-semibold uppercase tracking-wider text-orac-accent">Industrial Service Management</div>
            </div>
          </div>

          <div className="mb-8">
            <h1 className="text-ux-title font-bold tracking-tight text-orac-text-primary mb-2">{challenge ? "Verify your sign-in" : "Sign in to your account"}</h1>
            <p className="text-ux-body text-orac-text-secondary">{challenge ? "Enter the code from your authenticator app or use a recovery code." : "Enter your credentials to access the portal."}</p>
          </div>

          {sessionExpired && <div data-evidence="session-expired-state" className="mb-6"><SessionExpiredBanner /></div>}

          {challenge ? <form onSubmit={handleFactorSubmit} className="space-y-5">
            <p className="text-ux-body text-orac-text-secondary">{email}</p>
            <Field id="login-factor" label={recoveryMode ? "Recovery code" : "Authenticator code"}>
              <Input id="login-factor" name={recoveryMode ? "recovery_code" : "one-time-code"}
                type="text" inputMode={recoveryMode ? "text" : "numeric"}
                autoComplete={recoveryMode ? "off" : "one-time-code"}
                pattern={recoveryMode ? undefined : "[0-9]{6}"} maxLength={recoveryMode ? 64 : 6}
                value={factorValue} onChange={(e) => setFactorValue(e.target.value)}
                required autoFocus disabled={busy} />
            </Field>
            {error && <div role="alert" className="rounded-lg bg-orac-danger-surface border border-orac-danger-border px-4 py-3 text-ux-body text-orac-danger-text">{error}</div>}
            <Button type="submit" disabled={busy} variant="primary" className="w-full py-3 flex justify-center">{busy ? "Verifying…" : "Verify"}</Button>
            <Button variant="link" onClick={() => { setRecoveryMode(!recoveryMode); setFactorValue(""); setError(""); }}>{recoveryMode ? "Use authenticator code" : "Use a recovery code instead"}</Button>
            <Button variant="link" onClick={startOver}>Start sign-in again</Button>
            <p className="text-ux-caption text-orac-text-muted">Lost access to both? Contact your administrator.</p>
          </form> : <form onSubmit={handleSubmit} className="space-y-5">
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
                className="w-full min-h-[44px] rounded-lg border border-orac-border-strong bg-orac-canvas px-3.5 py-3 text-ux-body text-orac-text-primary placeholder:text-orac-text-muted focus:border-orac-accent focus:outline-none focus:ring-4 focus:ring-orac-focus-ring/10 transition-all"
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
                className="w-full min-h-[44px] rounded-lg border border-orac-border-strong bg-orac-canvas px-3.5 py-3 text-ux-body text-orac-text-primary placeholder:text-orac-text-muted focus:border-orac-accent focus:outline-none focus:ring-4 focus:ring-orac-focus-ring/10 transition-all"
                required
                autoComplete="current-password"
                disabled={busy}
              />
            </div>

            {error && (
              <div className="rounded-lg bg-orac-danger-surface border border-orac-danger-border px-4 py-3 text-ux-body text-orac-danger-text">
                {error}
              </div>
            )}

            <div className="flex items-center justify-between text-ux-body">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded border-orac-border-strong text-orac-accent focus:ring-orac-accent/20" />
                <span className="text-orac-text-secondary">Remember me</span>
              </label>
              <Link to="/forgot-password" className="font-medium text-orac-accent hover:text-orac-accent/80 transition-colors">
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              disabled={busy}
              variant="primary"
              className="w-full py-3 flex justify-center"
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
            <p className="text-center text-ux-caption text-orac-text-muted mt-5">
              Need an account?{" "}
              <Link to="/request-access" className="text-orac-accent hover:underline font-medium">
                Request access
              </Link>
            </p>
          </form>}

          <p className="mt-6 text-center text-ux-caption text-orac-text-muted">
            Orac-IOS &copy; {new Date().getFullYear()} &bull; Orac Systems
          </p>
        </div>
      </div>
    </div>
  );
}
