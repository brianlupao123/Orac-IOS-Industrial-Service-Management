import React, { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import UserProfileDropdown from "../components/UserProfileDropdown.jsx";
import NotificationBell from "../components/NotificationBell.jsx";
import ThemeToggle, { applyStoredTheme } from "../components/ThemeToggle.jsx";
import OfflineOutboxBar from "../components/OfflineOutboxBar.jsx";
import { visibleNavigationGroups } from "../accessPolicy.js";
import BrandMark from "../components/ui/BrandMark.jsx";

/**
 * Production portal layout shell.
 * Features: 72px branded header bar matching ORAC_Portal_mockup_FINAL.html,
 * nav icons, role-gated navigation, offline indicator, accessible mobile
 * navigation drawer, notification bell, user profile dropdown.
 */

const NAV_ICONS = {
  workspace: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z", // grid
  commercial: "M6 3h8l4 4v14H6z M14 3v4h4", // file
  "field-work": "M9 4h6v3H9z M7 5H5v16h14V5h-2 M9 14l2 2 4-4", // clip
  inventory: "M3 8l9-5 9 5v8l-9 5-9-5z M3 8l9 5 9-5 M12 13v8", // box
  reports: "M5 20V10M12 20V4M19 20v-7" // bar
};

function WorkspaceNavMenu({ group, pathname, showIcon = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const hasActiveItem = group.items.some((item) => item.path === pathname);
  const iconPath = NAV_ICONS[group.id];

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

  const handleTriggerKeyDown = (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setTimeout(() => {
        menuRef.current?.querySelector('[role="menuitem"]')?.focus();
      }, 0);
    }
  };

  const handleMenuItemKeyDown = (event, idx, total) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      const items = menuRef.current?.querySelectorAll('[role="menuitem"]');
      items?.[(idx + 1) % total]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      const items = menuRef.current?.querySelectorAll('[role="menuitem"]');
      items?.[(idx - 1 + total) % total]?.focus();
    } else if (event.key === "Escape") {
      event.preventDefault();
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
          `orac-nav-item inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orac-blue/40 ${
            isActive ? "bg-orac-navy text-white shadow-xs" : "text-gray-600 hover:bg-white hover:text-orac-slate hover:shadow-xs"
          }`
        }
      >
        {showIcon && iconPath && (
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
          </svg>
        )}
        <span>{item.label}</span>
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
        onKeyDown={handleTriggerKeyDown}
        className={`orac-nav-item inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orac-blue/40 ${
          hasActiveItem ? "bg-orac-navy text-white shadow-xs" : "text-gray-600 hover:bg-white hover:text-orac-slate hover:shadow-xs"
        }`}
      >
        {showIcon && iconPath && (
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
          </svg>
        )}
        <span>{group.label}</span>
        <svg className={`h-4 w-4 shrink-0 transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      {isOpen && (
        <div
          id={`primary-nav-${group.id}`}
          role="menu"
          aria-label={`${group.label} navigation`}
          className="absolute left-0 top-full z-30 mt-1 min-w-56 rounded-lg border border-gray-200 bg-white p-1.5 shadow-lg dark:bg-slate-900 dark:border-slate-800"
        >
          {group.items.map((item, idx) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              role="menuitem"
              tabIndex={0}
              onClick={() => setIsOpen(false)}
              onKeyDown={(e) => handleMenuItemKeyDown(e, idx, group.items.length)}
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
    <div className="orac-app-shell flex min-h-screen flex-col bg-orac-page">
      {/* Keyboard/screen-reader users can jump straight past the repeated
          header and navigation into the page content. */}
      <a
        href="#main-content"
        className="sr-only rounded-md bg-orac-navy px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50"
      >
        Skip to content
      </a>

      {/* Top header bar — single 72px app bar with brand | nav | account zones */}
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white shadow-xs dark:bg-slate-900 dark:border-slate-800">
        <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-2 px-4 sm:px-6 lg:px-7" style={{ height: "72px" }}>
          {/* Zone 1: Brand & mobile hamburger */}
          <div className="flex min-w-0 items-center gap-3">
            {/* Mobile menu trigger button */}
            <button
              type="button"
              className="flex min-[900px]:hidden items-center justify-center h-11 w-11 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-orac-slate focus:outline-none focus-visible:ring-2 focus-visible:ring-orac-blue/40"
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
            <BrandMark size={40} />
            <div className="orac-header-divider orac-brand-copy min-w-0 pl-3 hidden sm:block">
              <div className="truncate text-base font-bold text-orac-slate">ORAC SYSTEMS</div>
              <div className="truncate text-xs font-semibold text-orac-accent">Operational Portal</div>
            </div>
          </div>

          {/* Zone 2: Desktop Navigation — stays route-policy-derived */}
          <nav aria-label="Primary" className="orac-primary-nav hidden min-[900px]:flex min-w-0 flex-1 items-center justify-evenly gap-2 px-3 py-1 mx-3">
            {navGroups.map((group) => <WorkspaceNavMenu key={group.id} group={group} pathname={location.pathname} />)}
          </nav>

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

      {/* Mobile navigation drawer — accessible, full labels, no clipping */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 min-[900px]:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/20 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          {/* Slide-out drawer */}
          <aside
            ref={mobileMenuRef}
            id="mobile-nav-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            className="fixed inset-y-0 left-0 z-50 flex w-full max-w-xs flex-col border-r border-gray-200 bg-white p-4 shadow-xl dark:bg-slate-900 dark:border-slate-800"
          >
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <BrandMark size={40} />
                <span className="text-base font-bold text-orac-slate dark:text-white">ORAC SYSTEMS</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-md border border-gray-200 text-slate-500 hover:bg-gray-100 dark:border-slate-700"
                aria-label="Close navigation menu"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <nav aria-label="Mobile primary" className="mt-4 flex-1 overflow-y-auto space-y-4">
              {navGroups.map((group) => (
                <div key={group.id} className="space-y-1">
                  <div className="flex items-center gap-2 px-3 text-xs font-semibold text-slate-500">
                    {NAV_ICONS[group.id] && (
                      <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d={NAV_ICONS[group.id]} />
                      </svg>
                    )}
                    <span>{group.label}</span>
                  </div>
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const isActive = item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path);
                      return (
                        <NavLink
                          key={item.path}
                          to={item.path}
                          end={item.path === "/"}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`flex min-h-[44px] items-center rounded-md px-3 text-sm font-semibold transition-colors ${
                            isActive
                              ? "bg-orac-navy text-white shadow-xs"
                              : "text-slate-700 hover:bg-gray-100 hover:text-orac-slate dark:text-slate-300 dark:hover:bg-slate-800"
                          }`}
                        >
                          {item.label}
                        </NavLink>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>

            <div className="border-t border-gray-100 pt-3 flex items-center justify-between gap-2 dark:border-slate-800">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orac-navy font-bold text-white leading-none" aria-hidden="true">
                  {(user?.name || user?.email || "U").slice(0, 2).toUpperCase()}
                </div>
                <div className="text-xs text-slate-500 truncate font-medium">
                  <div className="truncate text-orac-slate font-semibold dark:text-white">{user?.name || user?.email}</div>
                  {user?.role && <div className="truncate opacity-75">{user.role}</div>}
                </div>
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="shrink-0 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-slate-700"
              >
                Sign out
              </button>
            </div>
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
  );
}
