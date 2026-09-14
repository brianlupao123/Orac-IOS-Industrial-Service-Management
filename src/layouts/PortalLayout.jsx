import React from "react";
import { NavLink } from "react-router-dom";
import UserProfileDropdown from "../components/UserProfileDropdown.jsx";
import NotificationBell from "../components/NotificationBell.jsx";
import ThemeToggle from "../components/ThemeToggle.jsx";

/**
 * Production portal layout shell.
 * Adapted from 1-feedback-system AUDashboardFrame + DashboardHeader patterns.
 * Features: branded header bar, role-gated navigation, notification bell, user dropdown.
 */

const NAV_ITEMS = [
  { path: "/", label: "Dashboard", roles: null },
  { path: "/portal", label: "Client Portal", roles: ["Client Viewer"] },
  { path: "/worksheets", label: "Worksheets", roles: ["Admin", "Operations", "Supervisor", "Technician", "Management"] },
  { path: "/inventory", label: "Inventory", roles: ["Admin", "Management", "Operations"] },
  { path: "/reports", label: "Reports", roles: ["Admin", "Management", "Finance"] },
  { path: "/admin", label: "Admin", roles: ["Admin"] },
];

function isVisible(item, role) {
  if (!item.roles) return true;
  return item.roles.includes(role);
}

export default function PortalLayout({ user, onLogout, children }) {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Top header bar */}
      <header className="border-b border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between px-6 py-3">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <img src="/images/orac-systems-logo.png" alt="Orac Systems" className="h-10 w-10 rounded-full bg-white object-contain" />
            <div>
              <div className="text-sm font-bold tracking-wide text-orac-slate">ORAC-IOS</div>
              <div className="text-[10px] uppercase tracking-widest text-gray-500">Orac Systems operations portal</div>
            </div>
          </div>

          {/* Right: status + notifications + profile */}
          <div className="flex items-center gap-3">
            {/* Live status indicator */}
            <div className="hidden items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 sm:flex">
              <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Online</span>
            </div>
            <ThemeToggle />
            <NotificationBell />
            <button
              type="button"
              onClick={onLogout}
              className="hidden items-center rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-orac-slate transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700 sm:inline-flex"
            >
              Sign out
            </button>
            <UserProfileDropdown user={user} onSignOut={onLogout} />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex gap-1 overflow-x-auto border-t border-gray-100 px-6 py-0">
          {NAV_ITEMS.filter((item) => isVisible(item, user.role)).map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) =>
                `relative whitespace-nowrap px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "text-orac-blue after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-full after:bg-orac-blue"
                    : "text-gray-500 hover:text-orac-slate"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      {/* Main content */}
      <main className="flex-1 p-6">{children}</main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white px-6 py-5 text-xs text-gray-500">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><span>Orac-IOS · Orac Systems Integrated Operations &amp; Service Portal</span><span><a className="font-semibold text-orac-navy hover:underline" href="https://oracsystems.co.zw" target="_blank" rel="noreferrer">Company site</a> · <button type="button" onClick={onLogout} className="font-semibold text-orac-navy hover:underline">Sign out</button></span></div>
        <p className="mx-auto mt-2 max-w-7xl">&copy; {new Date().getFullYear()} Handon Enterprises (Pvt) Ltd, trading as Orac Systems.</p>
      </footer>
    </div>
  );
}
