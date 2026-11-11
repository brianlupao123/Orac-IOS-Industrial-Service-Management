import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import BrandMark from "../components/ui/BrandMark.jsx";
import BrandPanel from "../components/ui/BrandPanel.jsx";
import Button from "../components/ui/Button.jsx";
import Field from "../components/ui/Field.jsx";
import Input from "../components/ui/Input.jsx";
import { auth } from "../api/client.js";

export default function EnrollmentPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [ticket, setTicket] = useState("");
  const [enrollmentId, setEnrollmentId] = useState("");
  const [otpauthUri, setOtpauthUri] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  // Step 1: Start enrollment with ticket + password
  const handleStart = async (e) => {
    e.preventDefault();
    if (!email || !password || !ticket) {
      setError("Please fill in your email, password, and enrollment ticket.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const data = await auth.startTotpEnrollment(email.trim(), password, ticket.trim());
      setEnrollmentId(data.enrollment_id || "");
      setOtpauthUri(data.otpauth_uri || "");
      // Extract secret if present in uri or returned directly
      const uriMatch = (data.otpauth_uri || "").match(/secret=([A-Z2-7]+)/i);
      setSecretKey(data.secret || (uriMatch ? uriMatch[1] : ""));
      setStep(2);
    } catch (err) {
      if (err.status === 404 || (err.message && (err.message.includes("404") || err.message.toLowerCase().includes("not found")))) {
        setError("Authenticator setup is not open yet. Contact your administrator.");
      } else {
        setError(err.message || "Failed to start enrollment. Check your ticket and password.");
      }
    } finally {
      setBusy(false);
    }
  };

  // Step 2: Confirm code from authenticator
  const handleConfirm = async (e) => {
    e.preventDefault();
    if (!code || code.length < 6) {
      setError("Please enter the 6-digit code from your authenticator app.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const data = await auth.confirmTotpEnrollment(email.trim(), enrollmentId, code.trim());
      setRecoveryCodes(data.recovery_codes || []);
      setStep(3);
    } catch (err) {
      if (err.status === 404 || (err.message && (err.message.includes("404") || err.message.toLowerCase().includes("not found")))) {
        setError("Authenticator setup is not open yet. Contact your administrator.");
      } else {
        setError(err.message || "Invalid verification code. Please check your authenticator and try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  // Step 3: Copy or download recovery codes
  const handleCopyCodes = () => {
    navigator.clipboard?.writeText(recoveryCodes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadCodes = () => {
    const text = `ORAC Systems - Two-Factor Authentication Recovery Codes\nUser: ${email}\nGenerated: ${new Date().toISOString()}\n\nEach code can only be used ONCE to sign in if you lose access to your authenticator app.\n\n${recoveryCodes.map((c, i) => `${i + 1}. ${c}`).join("\n")}\n\nKeep these codes in a secure, confidential location.\n`;
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orac-recovery-codes-${email.replace(/[^a-zA-Z0-9]/g, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-orac-page text-orac-text-primary">
      <div className="grid min-h-screen lg:grid-cols-2">
        {/* Left Side: Brand Panel */}
        <BrandPanel
          title="Protect your account with an authenticator app."
          subtitle="Your administrator gives you a one-time ticket. You prove who you are with your password, then link your app."
          workflow={["Ticket", "Authenticator", "Recovery codes"]}
        />

        {/* Right Side: Step Card */}
        <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16">
          <div className="mx-auto w-full max-w-[440px]">
            {/* Header with BrandMark */}
            <div className="mb-6 flex items-center gap-3">
              <BrandMark size={44} />
              <div>
                <div className="text-xl font-bold text-orac-text-primary">ORAC-IOS</div>
                <div className="text-ux-caption font-semibold text-orac-accent">
                  Two-Factor Authentication Setup
                </div>
              </div>
            </div>

            {/* Stepper Header */}
            <div className="mb-6 flex items-center justify-between border-b border-orac-border pb-4">
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-ux-caption font-bold ${
                    step === 1 ? "bg-orac-accent text-white" : "bg-orac-surface-muted text-orac-text-muted"
                  }`}
                >
                  1
                </span>
                <span className={`text-ux-secondary font-medium ${step === 1 ? "text-orac-text-primary font-bold" : "text-orac-text-muted"}`}>
                  Ticket
                </span>
              </div>
              <span className="text-orac-border-strong">→</span>
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-ux-caption font-bold ${
                    step === 2 ? "bg-orac-accent text-white" : "bg-orac-surface-muted text-orac-text-muted"
                  }`}
                >
                  2
                </span>
                <span className={`text-ux-secondary font-medium ${step === 2 ? "text-orac-text-primary font-bold" : "text-orac-text-muted"}`}>
                  Authenticator
                </span>
              </div>
              <span className="text-orac-border-strong">→</span>
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-ux-caption font-bold ${
                    step === 3 ? "bg-orac-accent text-white" : "bg-orac-surface-muted text-orac-text-muted"
                  }`}
                >
                  3
                </span>
                <span className={`text-ux-secondary font-medium ${step === 3 ? "text-orac-text-primary font-bold" : "text-orac-text-muted"}`}>
                  Recovery
                </span>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div role="alert" className="mb-6 rounded-lg border border-orac-danger-border bg-orac-danger-bg px-4 py-3 text-ux-secondary text-orac-danger-text">
                {error}
              </div>
            )}

            {/* STEP 1: Ticket + Password */}
            {step === 1 && (
              <div>
                <div className="mb-6">
                  <h1 className="text-2xl font-bold text-orac-text-primary">
                    Set up your authenticator
                  </h1>
                  <p className="mt-2 text-ux-secondary text-orac-text-secondary">
                    Enter the details your administrator gave you. The ticket works once and expires 30 minutes after issuance.
                  </p>
                </div>

                <form onSubmit={handleStart} className="space-y-4">
                  <Field id="enroll-email" label="Email address">
                    <Input
                      id="enroll-email"
                      name="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      autoComplete="username"
                      required
                      disabled={busy}
                    />
                  </Field>

                  <Field id="enroll-password" label="Password">
                    <Input
                      id="enroll-password"
                      name="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your account password"
                      autoComplete="current-password"
                      required
                      disabled={busy}
                    />
                  </Field>

                  <Field id="enroll-ticket" label="Enrollment ticket">
                    <Input
                      id="enroll-ticket"
                      name="ticket"
                      type="text"
                      value={ticket}
                      onChange={(e) => setTicket(e.target.value)}
                      placeholder="e.g. K7Q2-M9XD-4TFA-8WRB-J3HN-5CUE"
                      autoComplete="off"
                      spellCheck="false"
                      required
                      disabled={busy}
                    />
                    <p className="mt-1 text-ux-caption text-orac-text-muted">
                      Given to you in person or read out on a call. Never sent by insecure email.
                    </p>
                  </Field>

                  <div className="pt-2">
                    <Button
                      type="submit"
                      disabled={busy}
                      variant="primary"
                      className="w-full py-3 flex justify-center text-base font-semibold"
                    >
                      {busy ? "Verifying ticket…" : "Continue to app linking"}
                    </Button>
                  </div>

                  <p className="border-t border-orac-border pt-4 text-center text-ux-secondary text-orac-text-muted">
                    No ticket? Ask your system administrator.{" "}
                    <Link to="/login" className="font-semibold text-orac-accent hover:underline">
                      Back to sign in
                    </Link>
                  </p>
                </form>
              </div>
            )}

            {/* STEP 2: Authenticator App Linking */}
            {step === 2 && (
              <div>
                <div className="mb-6">
                  <h1 className="text-2xl font-bold text-orac-text-primary">
                    Link your authenticator app
                  </h1>
                  <p className="mt-2 text-ux-secondary text-orac-text-secondary">
                    Open your authenticator app (Google Authenticator, Microsoft Authenticator, etc.), choose add account, and enter the key.
                  </p>
                </div>

                <form onSubmit={handleConfirm} className="space-y-4">
                  {/* Secret Key Display */}
                  <div className="rounded-lg border border-orac-border bg-orac-surface-muted p-4">
                    <div className="text-ux-caption font-semibold text-orac-text-muted">
                      Manual Configuration Key
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <code className="text-ux-label font-mono font-bold text-orac-text-primary break-all">
                        {secretKey || "ORAC-SECRET-KEY-ABC123"}
                      </code>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          navigator.clipboard?.writeText(secretKey);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                        className="shrink-0 text-ux-caption"
                      >
                        {copied ? "Copied" : "Copy"}
                      </Button>
                    </div>
                    {otpauthUri && (
                      <div className="mt-2 text-ux-caption text-orac-text-muted break-all">
                        Account: <strong className="text-orac-text-primary">{email}</strong> (ORAC Systems)
                      </div>
                    )}
                  </div>

                  <Field id="enroll-code" label="6-Digit Verification Code">
                    <Input
                      id="enroll-code"
                      name="code"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="000000"
                      autoComplete="one-time-code"
                      required
                      autoFocus
                      disabled={busy}
                    />
                    <p className="mt-1 text-ux-caption text-orac-text-muted">
                      Enter the current 6 digits generated by your authenticator app to verify the link.
                    </p>
                  </Field>

                  <div className="pt-2">
                    <Button
                      type="submit"
                      disabled={busy}
                      variant="primary"
                      className="w-full py-3 flex justify-center text-base font-semibold"
                    >
                      {busy ? "Confirming code…" : "Verify and save"}
                    </Button>
                  </div>

                  <div className="text-center pt-2">
                    <Button
                      type="button"
                      variant="link"
                      onClick={() => setStep(1)}
                      className="text-ux-secondary text-orac-text-muted"
                    >
                      ← Back to ticket step
                    </Button>
                  </div>
                </form>
              </div>
            )}

            {/* STEP 3: Recovery Codes Grid */}
            {step === 3 && (
              <div>
                <div className="mb-6">
                  <h1 className="text-2xl font-bold text-orac-text-primary">
                    Save your recovery codes
                  </h1>
                  <p className="mt-2 text-ux-secondary text-orac-text-secondary">
                    Keep these single-use codes somewhere safe. If you ever lose access to your authenticator device, each code can sign you in once.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="rounded-lg border border-orac-border bg-orac-surface p-4 shadow-xs">
                    <div className="grid grid-cols-2 gap-2 text-center font-mono text-ux-secondary font-semibold text-orac-text-primary">
                      {recoveryCodes.map((rc, idx) => (
                        <div key={idx} className="rounded-md bg-orac-surface-muted px-2.5 py-1.5 border border-orac-border">
                          {rc}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleCopyCodes}
                      className="flex-1 py-2.5 text-ux-secondary font-semibold"
                    >
                      {copied ? "Copied to clipboard" : "Copy codes"}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleDownloadCodes}
                      className="flex-1 py-2.5 text-ux-secondary font-semibold"
                    >
                      Download (.txt)
                    </Button>
                  </div>

                  <div className="pt-4 border-t border-orac-border">
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => navigate("/login")}
                      className="w-full py-3 flex justify-center text-base font-semibold"
                    >
                      Done, return to sign in
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <p className="mt-8 text-center text-ux-caption text-orac-text-muted">
              Orac-IOS &copy; {new Date().getFullYear()} &bull; Orac Systems
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
