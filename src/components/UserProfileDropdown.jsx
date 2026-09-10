import React, { useEffect, useRef, useState } from "react";

/**
 * User profile dropdown with avatar, role badge, and sign-out.
 * Adapted from 1-feedback-system UserProfileDropdown.jsx.
 * Includes click-outside dismiss and initials fallback.
 */
export default function UserProfileDropdown({ user, onSignOut }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, []);

  const initials = (user.name || user.email || "U")
    .split(/[\s@]+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-orac-slate text-sm font-bold text-white shadow-sm transition-transform hover:scale-105"
        title={user.name || user.email}
      >
        {initials}
        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-400" />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-lg border border-gray-100 bg-white shadow-xl">
          {/* Identity */}
          <div className="border-b border-gray-100 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orac-blue/20 text-sm font-bold text-orac-slate">
                {initials}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-orac-slate">{user.name || user.email}</div>
                <div className="truncate text-xs text-gray-500">{user.email}</div>
              </div>
            </div>
            <div className="mt-2 inline-block rounded bg-orac-blue/15 px-2 py-0.5 text-xs font-medium text-orac-slate">
              {user.role}
            </div>
          </div>
          {/* Sign out */}
          <button
            onClick={() => { setOpen(false); onSignOut(); }}
            className="w-full px-4 py-2.5 text-left text-sm text-red-600 transition-colors hover:bg-red-50"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
