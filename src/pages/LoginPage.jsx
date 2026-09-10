import React, { useState } from "react";
import { auth } from "../api/client.js";

const DEMO_USERS = [
  { role: "Admin", email: "admin@orac.co.zw" },
  { role: "Management", email: "management@orac.co.zw" },
  { role: "Sales", email: "sales@orac.co.zw" },
  { role: "Finance", email: "finance@orac.co.zw" },
  { role: "Operations", email: "ops@orac.co.zw" },
  { role: "Supervisor", email: "supervisor@orac.co.zw" },
  { role: "Technician", email: "tech@orac.co.zw" },
  { role: "Client", email: "client@orac.co.zw" },
];

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e, directEmail = null) {
    if (e) e.preventDefault();
    const targetEmail = directEmail || email;
    if (!targetEmail) return;
    
    setError("");
    setBusy(true);
    try {
      const user = await auth.login(targetEmail);
      onLogin(user);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  function handleDemoClick(demoEmail) {
    setEmail(demoEmail);
    handleSubmit(null, demoEmail);
  }

  return (
    <div className="flex min-h-screen bg-gray-50 text-orac-slate font-sans selection:bg-orac-blue/20">
      {/* Left Pane - Branding & Graphic */}
      <div className="hidden lg:flex lg:w-5/12 bg-[#0B0F19] flex-col justify-between p-12 relative overflow-hidden">
        {/* Subtle gradient orb in background */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] rounded-full bg-orac-blue/10 blur-[120px]"></div>
          <div className="absolute bottom-[10%] -right-[20%] w-[60%] h-[60%] rounded-full bg-indigo-500/10 blur-[100px]"></div>
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 text-white mb-16">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-orac-blue text-sm font-bold shadow-lg shadow-orac-blue/20">
              O
            </div>
            <span className="text-xl font-bold tracking-tight">ORAC-IOS</span>
          </div>
          
          <h2 className="text-4xl font-light text-white leading-tight mb-6">
            Intelligent operations,<br />
            <span className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-orac-blue to-indigo-400">unified in one platform.</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-md leading-relaxed">
            Manage field worksheets, track inventory, and generate compliance reports seamlessly.
          </p>
        </div>

        <div className="relative z-10 text-xs text-gray-500 uppercase tracking-widest">
          Version 2.0 &bull; Production Build
        </div>
      </div>

      {/* Right Pane - Login Form */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-24 xl:px-32 relative bg-white">
        <div className="w-full max-w-[420px] mx-auto">
          {/* Mobile Header (Hidden on Desktop) */}
          <div className="flex lg:hidden items-center gap-3 mb-10">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orac-blue text-white text-lg font-bold shadow-lg shadow-orac-blue/20">
              O
            </div>
            <span className="text-2xl font-bold tracking-tight text-orac-slate">ORAC-IOS</span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 mb-2">Sign in to your account</h1>
            <p className="text-sm text-gray-500">Enter your email address to access the portal.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-orac-blue focus:outline-none focus:ring-4 focus:ring-orac-blue/10 transition-all"
                required
                autoFocus
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
              <a href="#" className="font-medium text-orac-blue hover:text-orac-blue/80 transition-colors" onClick={(e) => { e.preventDefault(); alert("Demo Mode: Password reset is disabled. Please use the quick-login panel."); }}>
                Forgot password?
              </a>
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
          </form>

          {/* Demo Users Panel */}
          <div className="mt-10 pt-8 border-t border-gray-100">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Demo Users (1-Click Login)
            </h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {DEMO_USERS.map((u) => (
                <button
                  key={u.role}
                  onClick={() => handleDemoClick(u.email)}
                  disabled={busy}
                  className="flex flex-col items-start p-3 rounded-lg border border-gray-200 bg-gray-50/50 hover:bg-gray-100 hover:border-gray-300 transition-all text-left group"
                >
                  <span className="text-xs font-semibold text-gray-900 group-hover:text-orac-blue transition-colors">
                    {u.role}
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-4 text-[11px] text-gray-400 leading-relaxed">
              Clicking a role above will instantly log you in to evaluate their specific dashboard and permissions. Real passwords are not required in this demo environment.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}