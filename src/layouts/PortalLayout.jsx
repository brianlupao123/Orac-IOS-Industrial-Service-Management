import React, { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import UserProfileDropdown from "../components/UserProfileDropdown.jsx";
import NotificationBell from "../components/NotificationBell.jsx";
import ThemeToggle from "../components/ThemeToggle.jsx";
import { visibleNavigationGroups } from "../accessPolicy.js";

/**
 * Production portal layout shell.
 * Adapted from 1-feedback-system AUDashboardFrame + DashboardHeader patterns.
 * Features: branded header bar, role-gated navigation, notification bell, user dropdown.
 */

function WorkspaceNavMenu({ group, pathname }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const hasActiveItem = group.items.some((item) => item.path === pathname);

  useEffect(() => {
    const closeWhenFocusLeaves = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setIsOpen(false);
    };

    document.addEventListener("mousedown", closeWhenFocusLeaves);
    return () => document.removeEventListener("mousedown", closeWhenFocusLeaves);
  }, []);

  const closeOnEscape = (event) => {
    if (event.key === "Escape") {
      setIsOpen(false);
      menuRef.current?.querySelector("button")?.focus();
    }
  };

  if (group.items.length === 1) {
    const [item] = group.items;
    return (
      <NavLink
        to={item.path}
        end={item.path === "/"}
        className={({ isActive }) =>
          `whitespace-nowrap rounded-md px-3.5 py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orac-blue/40 ${
            isActive ? "bg-orac-navy text-white shadow-sm" : "text-gray-600 hover:bg-white hover:text-orac-slate hover:shadow-sm"
          }`
        }
      >
        {item.label}
      </NavLink>
    );
  }

  return (
    <div ref={menuRef} className="relative" onKeyDown={closeOnEscape}>
      <button
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-controls={`primary-nav-${group.id}`}
        onClick={() => setIsOpen((open) => !open)}
        className={`inline-flex items-center gap-2 whitespace-nowrap rounded-md px-3.5 py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orac-blue/40 ${
          hasActiveItem ? "bg-orac-navy text-white shadow-sm" : "text-gray-600 hover:bg-white hover:text-orac-slate hover:shadow-sm"
        }`}
      >
        {group.label}
        <span aria-hidden="true" className="text-xs">v</span>
      </button>
      {isOpen && (
        <div
          id={`primary-nav-${group.id}`}
          role="menu"
          aria-label={`${group.label} navigation`}
          className="absolute left-0 top-full z-30 mt-1 min-w-56 border border-gray-200 bg-white p-1 shadow-lg"
        >
          {group.items.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              role="menuitem"
              onClick={() => setIsOpen(false)}
              className={({ isActive }) =>
                `block rounded-md px-3 py-2 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-orac-blue/40 ${
                  isActive ? "bg-orac-info-bg text-orac-text-primary" : "text-orac-text-secondary hover:bg-orac-surface-muted hover:text-orac-text-primary"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PortalLayout({ user, onLogout, children }) {
  const location = useLocation();
  const navGroups = visibleNavigationGroups(user.role);

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Keyboard/screen-reader users can jump straight past the repeated
          header and navigation into the page content. */}
      <a
        href="#main-content"
        className="sr-only rounded-md bg-orac-navy px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50"
      >
        Skip to content
      </a>
      {/* Top header bar — sticky so navigation stays reachable while scanning long pages */}
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          {/* Brand */}
          <div className="flex min-w-0 items-center gap-3">
            {/* Inline SVG — 6-toothed gear logo mark */}
            <svg viewBox="0 0 48 48" className="h-10 w-10 shrink-0" aria-hidden="true">
              <circle cx="24" cy="24" r="20" fill="#00488C"/>
              <circle cx="24" cy="24" r="10" fill="none" stroke="#2FA2E3" strokeWidth="3"/>
              {/* 6 gear teeth */}
              {[0, 60, 120, 180, 240, 300].map((angle) => (
                <rect key={angle} x="22" y="2" width="4" height="8" rx="1.5" fill="#2FA2E3"
                  transform={`rotate(${angle} 24 24)`}/>
              ))}
              {/* Inner wave accent */}
              <path d="M18 26 Q21 20 24 26 Q27 32 30 26" fill="none" stroke="#2FA2E3" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <div className="min-w-0">
              <div className="truncate text-base font-bold text-orac-slate">ORAC SYSTEMS</div>
              <div className="truncate text-xs font-semibold text-orac-cyan">Operational Portal</div>
              <div className="hidden truncate text-xs text-gray-500 sm:block">A Product of Handon Enterprises (Pvt) Ltd</div>
            </div>
          </div>

          {/* Right: status + notifications + profile */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {/* Live status indicator */}
            <div className="hidden items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 md:flex">
              <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              <span className="text-xs font-bold text-emerald-700">Online</span>
            </div>
            <ThemeToggle />
            <NotificationBell />
            <button
              type="button"
              onClick={onLogout}
              className="hidden items-center rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-orac-slate transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700 lg:inline-flex"
            >
              Sign out
            </button>
            <UserProfileDropdown user={user} onSignOut={onLogout} />
          </div>
        </div>

        {/* Navigation stays route-policy-derived but exposes compact work areas. */}
        <nav aria-label="Primary" className="flex flex-wrap items-center gap-1 overflow-visible border-t border-gray-100 bg-gray-50/70 px-4 py-2 sm:px-6">
          {navGroups.map((group) => <WorkspaceNavMenu key={group.id} group={group} pathname={location.pathname} />)}
        </nav>
      </header>

      {/* Main content */}
      <main id="main-content" className="flex-1 p-4 sm:p-6">{children}</main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white px-4 py-5 text-sm text-gray-500 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><span>Orac-IOS · Orac Industrial Operations System</span><span><a className="font-semibold text-orac-blue hover:underline" href="https://oracsystems.co.zw" target="_blank" rel="noreferrer">Company site</a> · <button type="button" onClick={onLogout} className="font-semibold text-orac-blue hover:underline">Sign out</button></span></div>
        <p className="mx-auto mt-2 max-w-7xl">&copy; {new Date().getFullYear()} Handon Enterprises (Pvt) Ltd, trading as Orac Systems.</p>
      </footer>
    </div>
  );
}
