import { canAccessRoute } from "./accessPolicy.js";

// The backend resolves each notification's destination for the CURRENT viewer
// (typed { kind, id } -> role-authorised route). This module is the second,
// independent check on the client: whatever arrives, the browser only ever
// navigates to an internal, same-app path that this role's route table allows.
// Anything else falls back to the dashboard with an honest message. UI checks
// are a convenience; the server still authorises every request the target page makes.

const FALLBACK = Object.freeze({
  to: "/",
  exact: false,
  resolved: false,
  note: "This notification has no linked record. Showing your dashboard."
});

export function resolveNotificationTarget(user, notification) {
  const destination = notification && typeof notification === "object" ? notification.destination : null;
  const route = destination && typeof destination.route === "string" ? destination.route : "";
  if (!user || !route) return { ...FALLBACK };

  // Internal absolute path only: no scheme, no protocol-relative //host, no backslashes.
  if (!route.startsWith("/") || route.startsWith("//") || route.includes("\\")) return { ...FALLBACK };
  let parsed;
  try {
    parsed = new URL(route, "http://orac.invalid");
  } catch {
    return { ...FALLBACK };
  }
  if (parsed.origin !== "http://orac.invalid") return { ...FALLBACK };

  if (!canAccessRoute(user.role, parsed.pathname)) {
    return { ...FALLBACK, note: "This item is not available in your workspace. Showing your dashboard." };
  }

  return {
    to: `${parsed.pathname}${parsed.search}`,
    exact: Boolean(destination.exact),
    resolved: Boolean(destination.resolved),
    note: typeof destination.note === "string" ? destination.note : ""
  };
}

export function unreadCount(items) {
  return Array.isArray(items) ? items.filter((item) => item && item.read !== true).length : 0;
}

export function bellLabel(count) {
  return count > 0 ? `Notifications, ${count} unread` : "Notifications, none unread";
}
