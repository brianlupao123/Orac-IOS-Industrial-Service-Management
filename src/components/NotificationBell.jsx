import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { notifications as notificationsApi, auth } from "../api/client.js";
import { resolveNotificationTarget, unreadCount, bellLabel } from "../notificationRouting.js";

const POLL_MS = 60000;
const PANEL_ID = "notification-panel";

/**
 * Notification bell: disclosure button + list of notifications.
 * Clicking a notification marks it read (for this user only) and opens the
 * exact record's workspace, or the right list with an honest message when the
 * record is gone or out of scope. Follows the WAI-ARIA disclosure pattern:
 * Enter/Space toggles, Tab moves through the items, Escape closes and returns
 * focus to the bell.
 */
export default function NotificationBell() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const wrapperRef = useRef(null);
  const buttonRef = useRef(null);
  const user = auth.getCachedUser?.() || null;

  const unread = unreadCount(items);

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setStatus((current) => (current === "ready" ? current : "loading"));
    try {
      const data = await notificationsApi.list();
      setItems(Array.isArray(data) ? data : []);
      setStatus("ready");
    } catch {
      // Keep any list we already have; only show the error state when there is nothing to show.
      setStatus((current) => (current === "ready" ? current : "error"));
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(() => { if (!document.hidden) load({ quiet: true }); }, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setOpen(false);
    }
    function onKeyDown(event) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(""), 9000);
    return () => clearTimeout(timer);
  }, [notice]);

  async function openNotification(item) {
    const target = resolveNotificationTarget(user, item);
    setActionError("");
    setOpen(false);
    // Optimistic read state; rolled back if the server refuses.
    if (item.read !== true) {
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
      notificationsApi.markRead(item.id).catch(() => {
        setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: false } : n)));
        setActionError("Could not mark that notification as read. It will stay unread.");
      });
    }
    setNotice(target.note || "");
    navigate(target.to);
  }

  async function markAllRead() {
    const before = items;
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await notificationsApi.markAllRead();
    } catch {
      setItems(before);
      setActionError("Could not mark notifications as read. Please try again.");
    }
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => { const next = !open; setOpen(next); if (next) load({ quiet: true }); }}
        aria-expanded={open}
        aria-controls={PANEL_ID}
        aria-label={bellLabel(unread)}
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-orac-slate transition-colors hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orac-blue"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span aria-hidden="true" className="absolute right-0 top-0 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Polite announcement after a click that could not open the exact record. */}
      <div role="status" aria-live="polite" className={notice ? "fixed inset-x-2 top-16 z-50 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80" : "sr-only"}>
        {notice && (
          <div className="flex items-start justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 shadow-lg dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice("")} className="shrink-0 rounded px-1 text-xs font-semibold underline">Dismiss</button>
          </div>
        )}
      </div>

      {open && (
        <div
          id={PANEL_ID}
          className="fixed inset-x-2 top-16 z-50 overflow-hidden rounded-lg border border-gray-100 bg-white shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96"
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-orac-slate">Notifications</h2>
            {unread > 0 && (
              <button type="button" onClick={markAllRead} className="min-h-[24px] text-xs font-semibold text-orac-blue underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-orac-blue">
                Mark all read
              </button>
            )}
          </div>

          {actionError && <p role="alert" className="border-b border-red-100 bg-red-50 px-4 py-2 text-xs text-red-800 dark:bg-red-950/30 dark:text-red-300">{actionError}</p>}

          <div className="max-h-[60vh] overflow-y-auto sm:max-h-80">
            {status === "loading" && <p className="px-4 py-6 text-center text-sm text-gray-500">Loading notifications&hellip;</p>}
            {status === "error" && (
              <div className="px-4 py-6 text-center">
                <p className="text-sm text-gray-700">Notifications could not be loaded.</p>
                <button type="button" onClick={() => load()} className="mt-3 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-semibold text-orac-slate hover:bg-gray-50">Try again</button>
              </div>
            )}
            {status === "ready" && items.length === 0 && <p className="px-4 py-6 text-center text-sm text-gray-500">You have no notifications.</p>}
            {status === "ready" && items.length > 0 && (
              <ul>
                {items.slice(0, 50).map((n) => (
                  <li key={n.id} className="border-b border-gray-50 last:border-b-0">
                    <button
                      type="button"
                      onClick={() => openNotification(n)}
                      className={`w-full px-4 py-3 text-left transition-colors hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-orac-blue ${n.read ? "" : "bg-sky-50/50"}`}
                    >
                      <span className="flex items-start gap-2">
                        {!n.read && <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-orac-blue" />}
                        <span className="min-w-0">
                          <span className={`block text-sm text-orac-slate ${n.read ? "" : "font-semibold"}`}>
                            {!n.read && <span className="sr-only">Unread. </span>}
                            {n.title || "Notification"}
                          </span>
                          <span className="block text-sm text-gray-600">{n.message}</span>
                          <span className="mt-0.5 block text-xs text-gray-500">{n.created_at ? new Date(n.created_at).toLocaleString() : ""}</span>
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
