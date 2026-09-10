import React, { useEffect, useRef, useState } from "react";
import { notifications as notificationsApi } from "../api/client.js";

/**
 * Notification bell icon with dropdown list and unread count badge.
 * Polls on mount and provides mark-read/mark-all-read actions.
 */
export default function NotificationBell() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const unread = items.filter((n) => !n.read_at).length;

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, []);

  async function load() {
    try {
      const data = await notificationsApi.list();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      /* silent — notifications are non-critical */
    }
  }

  async function markRead(id) {
    try {
      await notificationsApi.markRead(id);
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
    } catch { /* silent */ }
  }

  async function markAllRead() {
    try {
      await notificationsApi.markAllRead();
      setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
    } catch { /* silent */ }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen(!open); if (!open) load(); }}
        className="relative rounded-full p-1.5 text-orac-slate transition-colors hover:bg-gray-100"
        title="Notifications"
      >
        {/* Bell SVG icon */}
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-lg border border-gray-100 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
            <span className="text-sm font-semibold text-orac-slate">Notifications</span>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-orac-blue hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-400">No notifications</div>
            ) : (
              items.slice(0, 20).map((n) => (
                <button
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  className={`w-full border-b border-gray-50 px-4 py-2.5 text-left transition-colors hover:bg-gray-50 ${
                    !n.read_at ? "bg-sky-50/50" : ""
                  }`}
                >
                  <div className="text-sm text-orac-slate">{n.message || n.title || "Notification"}</div>
                  <div className="mt-0.5 text-xs text-gray-400">
                    {n.created_at ? new Date(n.created_at).toLocaleString() : ""}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
