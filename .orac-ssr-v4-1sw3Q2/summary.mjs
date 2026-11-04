// .orac-ssr-v4-1sw3Q2/summary.jsx
import React2 from "react";
import { renderToStaticMarkup } from "react-dom/server";

// src/components/StatusSummary.jsx
import React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
var TONE_VAR = {
  neutral: "var(--orac-border-strong)",
  info: "var(--orac-info-border)",
  success: "var(--orac-success-border)",
  warning: "var(--orac-warning-border)",
  danger: "var(--orac-danger-border)"
};
function StatusSummary({ items, label = "Status summary", className = "" }) {
  if (!Array.isArray(items) || items.length === 0) return null;
  const columns = items.length >= 3 ? "sm:grid-cols-2 lg:grid-cols-3" : items.length === 2 ? "sm:grid-cols-2" : "";
  return /* @__PURE__ */ jsx("section", { "aria-label": label, "data-evidence": "status-summary", className, children: /* @__PURE__ */ jsx("ul", { className: `grid gap-3 ${columns}`, children: items.map((item) => /* @__PURE__ */ jsxs(
    "li",
    {
      "data-evidence": "status-summary-item",
      className: "flex min-w-0 items-start justify-between gap-3 rounded-lg border border-orac-border-default bg-orac-surface px-4 py-3 shadow-sm",
      style: { borderLeftWidth: "4px", borderLeftColor: TONE_VAR[item.tone] || TONE_VAR.neutral },
      children: [
        /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
          /* @__PURE__ */ jsx("p", { className: "text-base font-semibold text-orac-text-primary", children: item.label }),
          item.meaning && /* @__PURE__ */ jsx("p", { className: "mt-0.5 text-sm text-orac-text-secondary", children: item.meaning })
        ] }),
        /* @__PURE__ */ jsxs("p", { className: "shrink-0 rounded-full bg-orac-surface-muted px-3 py-1 text-sm font-semibold tabular-nums text-orac-text-primary", children: [
          item.count === void 0 || item.count === null ? "-" : item.count,
          /* @__PURE__ */ jsx("span", { className: "sr-only", children: typeof item.count === "number" ? item.count === 1 ? " record" : " records" : "" })
        ] })
      ]
    },
    item.key || item.label
  )) }) });
}

// .orac-ssr-v4-1sw3Q2/summary.jsx
import { jsx as jsx2 } from "react/jsx-runtime";
var html = renderToStaticMarkup(
  /* @__PURE__ */ jsx2(StatusSummary, { label: "Quotes by stage", items: [
    { key: "a", label: "Approved Pending PO", meaning: "Client approved. Waiting for a purchase order.", count: 5, tone: "warning" },
    { key: "s", label: "Sent", meaning: "Sent to the client.", count: 1, tone: "info" },
    { key: "d", label: "Draft", count: 0 }
  ] })
);
var empty = renderToStaticMarkup(/* @__PURE__ */ jsx2(StatusSummary, { items: [] }));
export {
  empty,
  html
};
