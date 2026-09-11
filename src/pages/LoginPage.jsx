import React, { useState } from "react";
import { Link } from "react-router-dom";
import { auth } from "../api/client.js";

const DEMO_USERS = [
  { role: "Admin", email: "admin@orac.co.zw", name: "Admin User" },
  { role: "Management", email: "management@orac.co.zw", name: "Management User" },
  { role: "Sales", email: "sales@orac.co.zw", name: "Sales User" },
  { role: "Finance", email: "finance@orac.co.zw", name: "Finance User" },
  { role: "Operations", email: "ops@orac.co.zw", name: "Operations User" },
  { role: "Supervisor", email: "supervisor@orac.co.zw", name: "Supervisor User" },
  { role: "Technician", email: "tech@orac.co.zw", name: "Technician User" },
  { role: "Client", email: "client@orac.co.zw", name: "Client Viewer" },
];

const ROLE_ICONS = {
  Admin: "⚙️",
  Management: "📊",
  Sales: "💼",
  Finance: "💰",
  Operations: "🔧",
  Supervisor: "👷",
  Technician: "🛠️",
  Client: "👤",
};

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showAccounts, setShowAccounts] = useState(false);

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
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  function handleQuickLogin(user) {
    setEmail(user.email);
    setPassword("Test@123");
    handleSubmit(null, user.email, "Test@123");
  }

  return (
    <div className="flex min-h-screen bg-gray-50 text-orac-slate font-sans selection:bg-orac-blue/20">
      {/* Left Pane - Branding & Graphic */}
      <div className="hidden lg:flex lg:w-5/12 bg-[#0B0F19] flex-col justify-between p-12 relative overflow-hidden">
        {/* Subtle gradient orbs */}
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
          {/* Mobile Header */}
          <div className="flex lg:hidden items-center gap-3 mb-10">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orac-blue text-white text-lg font-bold shadow-lg shadow-orac-blue/20">
              O
            </div>
            <span className="text-2xl font-bold tracking-tight text-orac-slate">ORAC-IOS</span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 mb-2">Sign in to your account</h1>
            <p className="text-sm text-gray-500">Enter your credentials to access the portal.</p>
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

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-orac-blue focus:outline-none focus:ring-4 focus:ring-orac-blue/10 transition-all"
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

          {/* Quick Access Accounts — clean, collapsible */}
          <div className="mt-8 pt-6 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setShowAccounts(!showAccounts)}
              className="w-full flex items-center justify-between text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600 transition-colors"
            >
              <span>Quick Access</span>
              <svg className={`w-4 h-4 transition-transform ${showAccounts ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showAccounts && (
              <div className="mt-4 grid grid-cols-2 gap-2">
                {DEMO_USERS.map((u) => (
                  <button
                    key={u.role}
                    onClick={() => handleQuickLogin(u)}
                    disabled={busy}
                    className="flex items-center gap-2.5 p-3 rounded-lg border border-gray-200 bg-gray-50/50 hover:bg-orac-blue/5 hover:border-orac-blue/30 transition-all text-left group"
                  >
                    <span className="text-base">{ROLE_ICONS[u.role] || "👤"}</span>
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-gray-900 group-hover:text-orac-blue transition-colors block">
                        {u.role}
                      </span>
                      <span className="text-[10px] text-gray-400 truncate block">{u.email}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <p className="mt-6 text-center text-xs text-gray-400">
            Orac-IOS &copy; {new Date().getFullYear()} &bull; Orac Systems
          </p>
        </div>
      </div>
    </div>
  );
}