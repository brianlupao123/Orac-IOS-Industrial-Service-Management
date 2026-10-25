// .orac-ssr-v4-3ItyEp/card.jsx
import React3 from "react";
import { renderToStaticMarkup } from "react-dom/server";

// src/components/IconStatCard.jsx
import React2 from "react";

// src/components/icons.jsx
import React from "react";
import { jsx } from "react/jsx-runtime";
var ICONS = {
  building: "M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M2 21h20M8 7h2m-2 4h2m-2 4h2m4-8h2m-2 4h2m-2 4h2",
  clipboard: "M9 5h6m-5-2h4a2 2 0 0 1 2 2v1H8V5a2 2 0 0 1 2-2Zm-4 3h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2Z",
  truck: "M3 6h11v10H3V6Zm11 4h4l3 3v3h-7v-6Zm-7 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  money: "M12 3v18M16 7.5c0-1.4-1.8-2.5-4-2.5S8 6.1 8 7.5 9.8 10 12 10s4 1.1 4 2.5-1.8 2.5-4 2.5-4-1.1-4-2.5",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m17-8a4 4 0 0 0-3-6.9M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  warning: "M12 3 2 21h20L12 3Zm0 6v4m0 4h.01",
  clock: "M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  inventory: "M4 7h16v13H4V7Zm3-3h10v3H7V4Zm1 7h8m-8 4h5",
  report: "M5 3h10l4 4v14H5V3Zm10 0v5h5M9 12h6m-6 4h6",
  check: "m5 12 4 4L19 6",
  document: "M6 3h8l4 4v14H6V3Zm8 0v5h5M9 12h6m-6 4h6",
  dashboard: "M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z",
  flag: "M5 21V4m0 0h10l-1 4 1 4H5",
  sun: "M12 3v2m0 14v2m9-9h-2M5 12H3m15.36-6.36-1.42 1.42M7.05 16.95l-1.42 1.42m12.73 0-1.42-1.42M7.05 7.05 5.64 5.64M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  moon: "M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z",
  search: "m21 21-4.3-4.3M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z"
};
function Icon({ path, className = "h-5 w-5" }) {
  return /* @__PURE__ */ jsx("svg", { className, fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: "1.8", "aria-hidden": "true", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: path }) });
}

// src/components/IconStatCard.jsx
import { jsx as jsx2, jsxs } from "react/jsx-runtime";
var TONES = {
  neutral: {
    card: "border-gray-200 bg-white hover:border-orac-blue",
    chip: "bg-sky-100 text-orac-blue",
    text: "text-slate-900",
    label: "text-slate-500"
  },
  blue: {
    card: "border-sky-300 bg-sky-50 hover:border-sky-500",
    chip: "bg-sky-100 text-sky-800",
    text: "text-sky-950",
    label: "text-sky-700"
  },
  amber: {
    card: "border-amber-300 border-l-4 border-amber-500 bg-amber-50 hover:border-amber-500",
    chip: "bg-amber-100 text-amber-800",
    text: "text-amber-950",
    label: "text-amber-800"
  },
  green: {
    card: "border-emerald-300 bg-emerald-50 hover:border-emerald-500",
    chip: "bg-emerald-100 text-emerald-800",
    text: "text-emerald-950",
    label: "text-emerald-700"
  },
  red: {
    card: "border-red-300 border-l-4 border-red-400 bg-red-50 hover:border-red-400",
    chip: "bg-red-100 text-red-800",
    text: "text-red-950",
    label: "text-red-800"
  }
};
function IconStatCard({ label, value, iconPath, tone = "neutral", subtitle, onClick, evidenceTarget, statusFirst = false }) {
  const numericValue = Number(value);
  const resolvedTone = value === 0 || value === "0" || numericValue === 0 ? "neutral" : tone || "neutral";
  const styling = TONES[resolvedTone] || TONES.neutral;
  const Component = onClick ? "button" : "div";
  return /* @__PURE__ */ jsx2(
    Component,
    {
      ...onClick ? { type: "button", onClick } : {},
      id: evidenceTarget || void 0,
      "data-evidence-target": evidenceTarget || void 0,
      className: `w-full rounded-lg border p-3.5 sm:p-4 text-left shadow-xs transition-colors duration-150 ${styling.card} ${onClick ? "cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-orac-blue/60" : ""}`,
      children: statusFirst ? /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-3.5", children: [
        /* @__PURE__ */ jsx2("span", { className: `flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${styling.chip}`, children: /* @__PURE__ */ jsx2(Icon, { path: iconPath, className: "h-5 w-5" }) }),
        /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1", children: [
          /* @__PURE__ */ jsx2("p", { className: `text-sm font-semibold leading-snug ${styling.text}`, children: label }),
          subtitle && /* @__PURE__ */ jsx2("p", { className: `mt-0.5 text-xs leading-snug ${styling.label}`, children: subtitle })
        ] }),
        /* @__PURE__ */ jsxs("span", { "data-evidence": "status-count", className: `shrink-0 rounded-full px-2.5 py-1 text-sm font-semibold tabular-nums ${styling.chip}`, children: [
          value,
          /* @__PURE__ */ jsx2("span", { className: "sr-only", children: numericValue === 1 ? " record" : " records" })
        ] })
      ] }) : /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3.5", children: [
        /* @__PURE__ */ jsx2("span", { className: `flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${styling.chip}`, children: /* @__PURE__ */ jsx2(Icon, { path: iconPath, className: "h-5 w-5" }) }),
        /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1", children: [
          /* @__PURE__ */ jsx2("p", { className: `text-xs font-semibold leading-tight ${styling.label}`, children: label }),
          /* @__PURE__ */ jsx2("p", { className: `mt-0.5 text-2xl font-bold tabular-nums sm:text-3xl ${styling.text}`, children: value }),
          subtitle && /* @__PURE__ */ jsx2("p", { className: `mt-0.5 text-xs truncate ${styling.label}`, children: subtitle })
        ] })
      ] })
    }
  );
}

// .orac-ssr-v4-3ItyEp/card.jsx
import { jsx as jsx3 } from "react/jsx-runtime";
var base = { label: "Blocked Amendments", value: 3, iconPath: ICONS.warning, tone: "red", subtitle: "POs requiring amendment", evidenceTarget: "evidence-kpi-blocked-amendments", onClick: () => {
} };
var first = renderToStaticMarkup(/* @__PURE__ */ jsx3(IconStatCard, { ...base, statusFirst: true }));
var plain = renderToStaticMarkup(/* @__PURE__ */ jsx3(IconStatCard, { ...base }));
var zero = renderToStaticMarkup(/* @__PURE__ */ jsx3(IconStatCard, { ...base, value: 0, statusFirst: true }));
export {
  first,
  plain,
  zero
};
