import React, { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import UserProfileDropdown from "../components/UserProfileDropdown.jsx";
import NotificationBell from "../components/NotificationBell.jsx";
import ThemeToggle, { applyStoredTheme } from "../components/ThemeToggle.jsx";
import OfflineOutboxBar from "../components/OfflineOutboxBar.jsx";
import { sidebarGroups } from "../navModel.js";
import BrandMark from "../components/ui/BrandMark.jsx";
import SidebarPanel, { NAV_ICONS } from "../components/layout/SidebarPanel.jsx";

/**
 * Production portal layout shell.
 * Features: 72px branded header bar matching ORAC_Portal_mockup_FINAL.html,
 * nav icons, role-gated navigation, offline indicator, accessible mobile
 * navigation drawer, notification bell, user profile dropdown.
 */

export default function PortalLayout({ user, onLogout, children }) {
  const location = useLocation();
  const navGroups = sidebarGroups(user.role);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef(null);

  // Apply stored theme on mount
  useEffect(() => {
    applyStoredTheme();
  }, []);

  // Offline status tracking
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== "undefined" && typeof navigator.onLine === "boolean"
      ? navigator.onLine
      : true
  );

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // Close mobile menu on page navigation
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Accessible mobile menu: Escape key handler and focus trap
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    const firstFocusable = mobileMenuRef.current?.querySelector("a, button");
    firstFocusable?.focus();
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen]);

  return (
    <div className="orac-app-shell min-h-screen bg-orac-page min-[1100px]:flex">
      {/* Keyboard/screen-reader users can jump straight past the repeated
          header and navigation into the page content. */}
      <a
        href="#main-content"
        className="sr-only rounded-md bg-orac-navy px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50"
      >
        Skip to content
      </a>

      {/* Persistent 264px sidebar from 1100px up (the pages need that content width). Below that the drawer is used, plus bottom tabs under 900px. */}
      <aside aria-label="Sidebar" className="orac-sidebar sticky top-0 hidden h-screen w-[264px] shrink-0 min-[1100px]:block">
        <SidebarPanel user={user} navGroups={navGroups} onLogout={onLogout} />
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
      {/* Top bar: 72px. Brand and hamburger only below 1100px; the sidebar carries them above. */}
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white shadow-xs dark:bg-slate-900 dark:border-slate-800">
        <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-2 px-4 sm:px-6 lg:px-7" style={{ height: "72px" }}>
          {/* Zone 1: Brand & mobile hamburger */}
          <div className="flex min-w-0 items-center gap-3">
            {/* Navigation menu trigger button */}
            <button
              type="button"
              className="flex min-[1100px]:hidden items-center justify-center h-11 w-11 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-orac-slate focus:outline-none focus-visible:ring-2 focus-visible:ring-orac-blue/40"
              onClick={() => setMobileMenuOpen((open) => !open)}
              aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-nav-menu"
            >
              {mobileMenuOpen ? (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
              )}
            </button>

            {/* Unified BrandMark */}
            <div className="flex min-w-0 items-center gap-3 min-[1100px]:hidden">
            <BrandMark size={40} />
            <div className="orac-header-divider orac-brand-copy min-w-0 pl-3 hidden sm:block">
              <div className="truncate text-base font-bold text-orac-slate">ORAC SYSTEMS</div>
              <div className="truncate text-xs font-semibold text-orac-accent">Operational Portal</div>
            </div>
            </div>
          </div>

          {/* Zone 3: Status + notifications + profile */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {/* Online indicator — hidden on md and below to save space, visible only on large screens */}
            {isOnline && (
              <div className="hidden items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 lg:flex">
                <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                <span className="text-xs font-bold text-emerald-700">Online</span>
              </div>
            )}
            <ThemeToggle />
            <NotificationBell />
            <button
              type="button"
              onClick={onLogout}
              className="orac-header-signout hidden items-center rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-orac-slate transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700 xl:inline-flex"
            >
              Sign out
            </button>
            <UserProfileDropdown user={user} onSignOut={onLogout} />
          </div>
        </div>
      </header>

      {!isOnline && (
        <div role="status" aria-live="polite" className="orac-offline-notice px-4 py-2 text-sm font-medium sm:px-6">
          <div className="mx-auto flex max-w-[1440px] items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full bg-amber-700 animate-pulse" aria-hidden="true" />
            You’re offline. Entries are saved on this device as you work.
          </div>
        </div>
      )}

      {/* Timesheets saved on this device: status line + the background sender (stays mounted on every page). */}
      <OfflineOutboxBar user={user} />

      {/* Mobile navigation drawer (below 900px), same grouped navigation as the sidebar */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 min-[1100px]:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/20 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          {/* 264px slide-out sidebar */}
          <aside
            ref={mobileMenuRef}
            id="mobile-nav-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            className="orac-sidebar fixed inset-y-0 left-0 z-50 w-[264px] max-w-[85vw] shadow-xl"
          >
            <SidebarPanel user={user} navGroups={navGroups} onLogout={onLogout} onNavigate={() => setMobileMenuOpen(false)} onClose={() => setMobileMenuOpen(false)} />
          </aside>
        </div>
      )}

      {/* Below 900px, primary destinations remain visible as labelled tabs.
          The menu button exposes every remaining role-permitted destination. */}
      <nav aria-label="Mobile primary" className="orac-mobile-tabs min-[900px]:hidden">
        {navGroups.slice(0, 4).map((group) => {
          const item = group.items[0];
          const isActive = item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path);
          return (
            <NavLink
              key={group.id}
              to={item.path}
              end={item.path === "/"}
              className={`orac-mobile-tab ${isActive ? "orac-mobile-tab-active" : ""}`}
              aria-current={isActive ? "page" : undefined}
            >
              {NAV_ICONS[group.id] && (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d={NAV_ICONS[group.id]} />
                </svg>
              )}
              <span>{group.label}</span>
            </NavLink>
          );
        })}
        <button type="button" className="orac-mobile-tab" onClick={() => setMobileMenuOpen(true)} aria-controls="mobile-nav-menu">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M5 12h.01M12 12h.01M19 12h.01" strokeLinecap="round" /></svg>
          <span>More</span>
        </button>
      </nav>

      {/* Main content — pb-28 gives clearance so floating ORAC Guide never covers content */}
      <main id="main-content" className="mx-auto w-full max-w-[1440px] flex-1 p-4 sm:p-6 pb-28 sm:pb-24">{children}</main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white px-4 py-5 text-sm text-gray-500 sm:px-6 dark:bg-slate-900 dark:border-slate-800">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span>Orac-IOS · Orac Industrial Operations System</span>
          <span>
            <a className="font-semibold text-orac-blue hover:underline hover:text-orac-text-primary inline-flex min-h-[44px] items-center" href="https://oracsystems.co.zw" target="_blank" rel="noreferrer">Company site</a>
            {" · "}
            <button type="button" onClick={onLogout} className="font-semibold text-orac-blue hover:underline hover:text-orac-text-primary inline-flex min-h-[44px] items-center">Sign out</button>
          </span>
        </div>
        <p className="mx-auto mt-2 max-w-[1440px]">&copy; {new Date().getFullYear()} Handon Enterprises (Pvt) Ltd, trading as Orac Systems.</p>
      </footer>
      </div>
    </div>
  );
}
