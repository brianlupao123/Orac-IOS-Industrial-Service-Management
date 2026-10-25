import { useEffect, useRef } from "react";

// Read-only deep links, for example /quotations?quote=<id> opened from a Reports row.
// Nothing here fetches, writes or changes permissions. It only looks for a record that the
// page has ALREADY rendered from the server's own role-filtered list. An unknown id, an id the
// current filter hides, or an id this role may not see simply finds nothing and does nothing.

const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function readDeepLinkId(search, param) {
  try {
    const value = new URLSearchParams(search || "").get(param);
    return typeof value === "string" && SAFE_ID.test(value) ? value : "";
  } catch {
    return "";
  }
}

// Compares attribute values directly instead of building a selector from user input.
export function findRecordElement(root, id) {
  if (!id || !root || typeof root.querySelectorAll !== "function") return null;
  for (const element of root.querySelectorAll("[data-record-id]")) {
    if (element.getAttribute("data-record-id") === id) return element;
  }
  return null;
}

export function recordHref(path, param, id) {
  // Detail routes use the stable record id as a path segment. Other existing
  // pages continue to receive their checked query-string deep link.
  if (param === "id") return `${path}/${encodeURIComponent(id)}`;
  return `${path}?${encodeURIComponent(param)}=${encodeURIComponent(id)}`;
}

// Call once near the top of a list page. `ready` is false while the list is loading; `deps` are the
// arrays the page renders from, so the lookup runs again when they arrive. It acts once per id.
export function useDeepLinkFocus(param, ready, deps) {
  const done = useRef("");
  useEffect(() => {
    if (!ready || typeof window === "undefined" || typeof document === "undefined") return;
    const id = readDeepLinkId(window.location.search, param);
    if (!id || done.current === id) return;
    const element = findRecordElement(document, id);
    if (!element) return;
    done.current = id;
    element.scrollIntoView?.({ block: "center" });
    element.focus?.({ preventScroll: true });
  }, [ready, param, ...deps]);
}
