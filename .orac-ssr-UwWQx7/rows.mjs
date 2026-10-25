// <define:import.meta.env>
var define_import_meta_env_default = { PROD: false, VITE_API_BASE_URL: "http://api.test" };

// .orac-ssr-UwWQx7/rows.jsx
import React2 from "react";
import { renderToStaticMarkup } from "react-dom/server";

// src/components/KioskReviewPanel.jsx
import React, { useEffect, useState } from "react";

// src/api/client.js
var BASE = (define_import_meta_env_default.VITE_API_BASE_URL || "/api").replace(/\/$/, "");
function getToken() {
  return localStorage.getItem("orac_token") || "";
}
function setSession(user, token) {
  localStorage.setItem("orac_token", token);
  localStorage.setItem("orac_user", JSON.stringify(user));
}
function clearSession() {
  localStorage.removeItem("orac_token");
  localStorage.removeItem("orac_user");
}
function getCachedUser() {
  const raw = localStorage.getItem("orac_user");
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    clearSession();
    return null;
  }
}
var sessionExpiredListeners = /* @__PURE__ */ new Set();
function notifySessionExpired() {
  clearSession();
  for (const listener of sessionExpiredListeners) {
    try {
      listener();
    } catch {
    }
  }
}
var UAT_STATE_MODE_ENABLED = define_import_meta_env_default.VITE_UAT_STATE_MODE === "true";
var UAT_EMPTY_ARRAY_PATH_PREFIXES = ["/notifications", "/inventory/stock_items", "/inventory/suppliers", "/access_requests"];
function isKnownArrayReadPath(path) {
  return UAT_EMPTY_ARRAY_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
}
function uatStateFromUrl() {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("uatState");
}
async function request(path, options = {}) {
  if (UAT_STATE_MODE_ENABLED) {
    const mode = uatStateFromUrl();
    if (mode === "error") {
      throw new Error("Simulated UAT error state (test-only; no backend contact was made).");
    }
    if (mode === "empty" && (!options.method || options.method === "GET") && isKnownArrayReadPath(path)) {
      return [];
    }
  }
  if (define_import_meta_env_default.PROD && !define_import_meta_env_default.VITE_API_BASE_URL) {
    throw new Error("The service is not connected yet. Please try again later.");
  }
  const headers = { "Content-Type": "application/json", ...options.headers || {} };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(`${BASE}${path}`, { ...options, headers });
  } catch (cause) {
    const error = new Error("Could not reach the server. Check your connection and try again.");
    error.network = true;
    error.cause = cause;
    throw error;
  }
  const contentType = res.headers?.get?.("content-type") || "";
  const canReadText = typeof res.text === "function";
  const rawBody = canReadText ? await res.text() : "";
  let body;
  try {
    body = canReadText ? rawBody ? JSON.parse(rawBody) : null : await res.json();
  } catch {
    body = null;
  }
  const isJsonContent = !contentType || contentType.toLowerCase().includes("application/json");
  if (!isJsonContent || !body) {
    const responseKind = rawBody.trimStart().startsWith("<") ? "HTML" : "non-JSON data";
    throw new Error(`The service returned ${responseKind} instead of API data. Check the service connection and try again.`);
  }
  if (!res.ok || body.success !== true) {
    const message = body.message || `Request failed (${res.status})`;
    if (res.status === 401) {
      notifySessionExpired();
      const error2 = new Error(message);
      error2.sessionExpired = true;
      error2.status = res.status;
      throw error2;
    }
    const error = new Error(message);
    error.status = res.status;
    if (body.code) error.code = body.code;
    throw error;
  }
  return body.data;
}
var auth = {
  async login(email, password) {
    const data = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
    setSession(data.user, data.token);
    return data.user;
  },
  async restoreSession() {
    if (!getToken()) return null;
    try {
      const user = await request("/auth/me");
      setSession(user, getToken());
      return user;
    } catch {
      clearSession();
      return null;
    }
  },
  logout() {
    clearSession();
    try {
      const doomed = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key && key.startsWith("orac-draft:v1:")) doomed.push(key);
      }
      doomed.forEach((key) => localStorage.removeItem(key));
    } catch {
    }
  },
  getCachedUser,
  getToken
};
var quotes = {
  create(payload) {
    return request("/quotes", { method: "POST", body: JSON.stringify(payload) });
  },
  update(id, payload) {
    return request(`/quotes/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) });
  },
  cancel(id) {
    return request(`/quotes/${encodeURIComponent(id)}/cancel`, { method: "POST", body: JSON.stringify({}) });
  },
  transition(id, targetState, extra = {}) {
    return request(`/quotes/${id}/transition`, {
      method: "POST",
      body: JSON.stringify({ target_state: targetState, ...extra })
    });
  },
  verifyPo(id, po_reference, po_amount, extra = {}) {
    return request(`/quotes/${id}/po`, {
      method: "POST",
      body: JSON.stringify({ po_reference, po_amount, ...extra })
    });
  },
  createRevision(id, payload) {
    return request(`/quotes/${encodeURIComponent(id)}/revisions`, { method: "POST", body: JSON.stringify(payload) });
  },
  recordAmendedPoEvidence(id, payload) {
    return request(`/quotes/${encodeURIComponent(id)}/amended-po-evidence`, { method: "POST", body: JSON.stringify(payload) });
  }
};
quotes.submitClientPo = (id, po_reference, po_amount, extra = {}) => {
  return request(`/quotes/${id}/client-po`, {
    method: "POST",
    body: JSON.stringify({ po_reference, po_amount, ...extra })
  });
};
auth.requestPasswordReset = (email) => {
  return request("/auth/request-password-reset", { method: "POST", body: JSON.stringify({ email }) });
};
auth.resetPassword = (email, token, new_password) => {
  return request("/auth/reset-password", { method: "POST", body: JSON.stringify({ email, token, new_password }) });
};

// src/fieldStatusModel.js
var WORKSHEET_STATUS_LABEL = Object.freeze({
  Draft: "Draft",
  Submitted: "Awaiting client acknowledgement",
  Client_Acknowledged: "Client acknowledged, awaiting Supervisor review",
  Returned_For_Correction: "Returned for correction",
  Supervisor_Approved: "Supervisor approved"
});
var WORKSHEET_TONE = Object.freeze({
  Draft: "slate",
  Submitted: "sky",
  Client_Acknowledged: "amber",
  Returned_For_Correction: "red",
  Supervisor_Approved: "green"
});
var KIOSK_REVIEW_LABEL = Object.freeze({
  pending_review: "Pending Supervisor review",
  approved: "Approved by Supervisor",
  rejected: "Rejected by Supervisor"
});
function kioskReviewLabel(status) {
  return KIOSK_REVIEW_LABEL[status] || KIOSK_REVIEW_LABEL.pending_review;
}
function kioskReviewTone(status) {
  return status === "approved" ? "green" : status === "rejected" ? "red" : "amber";
}
function kioskCountsText(status) {
  return status === "approved" ? "These hours count as approved." : "These hours do not count as approved hours yet. They are not in billing, variance or exports.";
}
function kioskNextAction(role, row) {
  if (row?.review_status === "approved") return "Approved. The hours now count.";
  if (row?.review_status === "rejected") return "Rejected. Submit a corrected kiosk entry if the time was real.";
  if (row?.review_blocked_reason) {
    return ["Admin", "Operations"].includes(role) ? "No Supervisor is assigned to this dispatch. Assign one so this can be reviewed." : "Waiting for a Supervisor to be assigned to this dispatch.";
  }
  if (role === "Supervisor") return row?.can_review ? "Approve it, or reject it with a reason." : "You cannot review this entry (it is your own time, or you recorded it).";
  return "Waiting for the assigned Supervisor to review it.";
}

// src/components/KioskReviewPanel.jsx
import { jsx, jsxs } from "react/jsx-runtime";
var TONE = {
  green: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  red: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300"
};
function KioskReviewRow({ row, role, children }) {
  const b = row.hours_breakdown;
  return /* @__PURE__ */ jsxs("li", { className: "rounded-lg border border-orac-border bg-white p-4 text-sm dark:bg-transparent", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between", children: [
      /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
        /* @__PURE__ */ jsxs("p", { className: "font-semibold text-orac-slate", children: [
          row.technician_name || row.technician_id,
          " \xB7 ",
          row.dispatch_number || row.dispatch_card_id
        ] }),
        /* @__PURE__ */ jsxs("p", { className: "text-orac-secondary", children: [
          row.work_date,
          " \xB7 ",
          row.hours_logged,
          " h",
          row.shift ? ` \xB7 ${row.shift}` : "",
          b ? ` \xB7 reported normal ${b.normal}, OT 1.5\xD7 ${b.ot_1_5}, OT 2.0\xD7 ${b.ot_2_0}` : ""
        ] }),
        row.notes && /* @__PURE__ */ jsx("p", { className: "text-orac-secondary", children: row.notes }),
        /* @__PURE__ */ jsxs("p", { className: "text-xs text-orac-secondary", children: [
          "Recorded by ",
          row.recorded_by_name || "unknown",
          row.submitted_at ? ` \xB7 ${new Date(row.submitted_at).toLocaleString()}` : ""
        ] })
      ] }),
      /* @__PURE__ */ jsx("span", { className: `inline-flex w-fit shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${TONE[kioskReviewTone(row.review_status)]}`, children: kioskReviewLabel(row.review_status) })
    ] }),
    /* @__PURE__ */ jsx("p", { className: "mt-2 text-xs text-orac-secondary", children: kioskCountsText(row.review_status) }),
    row.review_blocked_reason && /* @__PURE__ */ jsx("p", { role: "alert", className: "mt-2 rounded-md bg-amber-50 p-2 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200", children: row.review_blocked_reason }),
    row.review_status === "rejected" && row.review_comment && /* @__PURE__ */ jsxs("p", { className: "mt-2 text-red-700 dark:text-red-300", children: [
      "Rejected: ",
      row.review_comment
    ] }),
    /* @__PURE__ */ jsxs("p", { className: "mt-2 text-orac-slate", children: [
      /* @__PURE__ */ jsx("span", { className: "font-semibold", children: "Next: " }),
      kioskNextAction(role, row)
    ] }),
    children
  ] });
}

// .orac-ssr-UwWQx7/rows.jsx
import { jsx as jsx2 } from "react/jsx-runtime";
function render(row, role) {
  return renderToStaticMarkup(/* @__PURE__ */ jsx2("ul", { children: /* @__PURE__ */ jsx2(KioskReviewRow, { row, role }) }));
}
export {
  render as default
};
