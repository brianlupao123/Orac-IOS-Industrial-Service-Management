// <define:import.meta.env>
var define_import_meta_env_default = { PROD: false };

// .orac-ssr-dt-2PvjeS/statusTable.jsx
import React3 from "react";
import { renderToStaticMarkup } from "react-dom/server";

// src/components/DataTable.jsx
import React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
var NUMERIC_HEADER_REGEX = /\b(amount|total|value|cost|price|hours|qty|quantity|rate|balance)\b/i;
var ACTION_HEADER_REGEX = /\b(action|actions|manage|controls|operations)\b/i;
var EMPTY_CELL_STRINGS = /* @__PURE__ */ new Set(["", "\u2014", "-", "--", "n/a", "na", "null", "undefined"]);
function isCellEmpty(node) {
  if (node === null || node === void 0) return true;
  if (typeof node === "number") return false;
  if (typeof node === "boolean") return false;
  if (typeof node === "string") {
    return EMPTY_CELL_STRINGS.has(node.trim().toLowerCase());
  }
  if (Array.isArray(node)) {
    if (node.length === 0) return true;
    return node.every(isCellEmpty);
  }
  if (React.isValidElement(node)) {
    const type = node.type;
    if (typeof type === "function" || typeof type === "object") {
      return false;
    }
    if (typeof type === "string") {
      const tag = type.toLowerCase();
      if (["button", "svg", "path", "a", "input", "select", "img", "form"].includes(tag)) {
        return false;
      }
    }
    if (node.props?.onClick || node.props?.["aria-label"] || node.props?.title) {
      return false;
    }
    if ("children" in node.props) {
      return isCellEmpty(node.props.children);
    }
    return false;
  }
  return false;
}
function DataTable({
  title,
  count,
  columns = [],
  rows = [],
  renderRow,
  emptyText = "No data",
  emptyStateClassName = "px-5 py-12 flex flex-col items-center justify-center text-center",
  action,
  toolbar,
  renderActions,
  actionLabel = "Action",
  hideEmptyColumns = false
  // Opt-in only to avoid hiding critical custom components or controls
}) {
  const rawRows = rows.map((row, i) => renderRow ? renderRow(row, i) : null);
  const hiddenColumns = /* @__PURE__ */ new Set();
  if (hideEmptyColumns && rawRows.length > 0 && columns.length > 1) {
    let hasColSpan = false;
    for (const r of rawRows) {
      if (React.isValidElement(r)) {
        const cells = React.Children.toArray(r.props.children);
        for (const cell of cells) {
          if (React.isValidElement(cell) && Number(cell.props?.colSpan) > 1) {
            hasColSpan = true;
            break;
          }
        }
      }
      if (hasColSpan) break;
    }
    if (!hasColSpan) {
      for (let c = 1; c < columns.length; c++) {
        const header = columns[c] || "";
        if (header.trim() === "" || ACTION_HEADER_REGEX.test(header)) {
          continue;
        }
        let allEmpty = true;
        for (const r of rawRows) {
          if (React.isValidElement(r)) {
            const cells = React.Children.toArray(r.props.children);
            const cell = cells[c];
            if (cell && !isCellEmpty(cell.props?.children)) {
              allEmpty = false;
              break;
            }
          }
        }
        if (allEmpty) hiddenColumns.add(c);
      }
    }
  }
  const visibleHeaders = columns.map((col, idx) => ({ col, idx, isNumeric: NUMERIC_HEADER_REGEX.test(col) })).filter(({ idx }) => !hiddenColumns.has(idx));
  return /* @__PURE__ */ jsxs("div", { className: "overflow-hidden rounded-lg border border-gray-100 bg-white shadow-sm", style: { fontSize: "var(--orac-table-font-size, 14px)" }, children: [
    (title || action) && /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3 border-b border-gray-50 bg-gray-50/30 px-5 py-4", children: [
      title && /* @__PURE__ */ jsxs("h3", { className: "flex items-center gap-2 text-base font-semibold text-gray-900", children: [
        title,
        count !== void 0 && /* @__PURE__ */ jsx("span", { className: "rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600", children: count })
      ] }),
      action && /* @__PURE__ */ jsx("div", { children: action })
    ] }),
    toolbar && /* @__PURE__ */ jsx("div", { className: "flex flex-wrap items-center gap-3 border-b border-gray-50 bg-white px-5 py-3", children: toolbar }),
    rows.length === 0 ? /* @__PURE__ */ jsxs("div", { "data-evidence": "table-empty-state", className: emptyStateClassName, children: [
      /* @__PURE__ */ jsx("div", { className: "h-10 w-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 mb-3", children: /* @__PURE__ */ jsx("svg", { className: "w-5 h-5", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 1.5, d: "M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" }) }) }),
      /* @__PURE__ */ jsx("p", { className: "text-sm text-gray-500 font-medium", children: emptyText })
    ] }) : /* @__PURE__ */ jsx("div", { className: "overflow-x-auto", children: /* @__PURE__ */ jsxs("table", { className: "w-full text-sm", children: [
      /* @__PURE__ */ jsx("thead", { className: "bg-gray-50/50", children: /* @__PURE__ */ jsxs("tr", { className: "border-b border-gray-100 text-left text-sm font-semibold text-gray-600", children: [
        visibleHeaders.map(({ col, idx, isNumeric }, i) => /* @__PURE__ */ jsx("th", { scope: "col", className: `px-5 py-3.5 whitespace-nowrap ${isNumeric ? "text-right" : ""}`, children: col }, i)),
        renderActions && /* @__PURE__ */ jsx("th", { scope: "col", className: "px-5 py-3.5 whitespace-nowrap", children: actionLabel })
      ] }) }),
      /* @__PURE__ */ jsx("tbody", { className: "bg-white [&>tr:not(:first-child)]:border-t [&>tr:not(:first-child)]:border-orac-border-default [&>tr:nth-child(even)]:bg-orac-surface-muted", children: rawRows.map((r, rowIdx) => {
        if (!React.isValidElement(r)) return r;
        const originalCells = React.Children.toArray(r.props.children);
        const hasColSpan = originalCells.some(
          (c) => React.isValidElement(c) && Number(c.props?.colSpan) > 1
        );
        if (hasColSpan) {
          return r;
        }
        let visibleIdx = 0;
        const visibleCells = [];
        for (let c = 0; c < originalCells.length; c++) {
          if (hiddenColumns.has(c)) continue;
          const cell = originalCells[c];
          if (!React.isValidElement(cell)) {
            visibleCells.push(cell);
            visibleIdx++;
            continue;
          }
          const headerInfo = visibleHeaders[visibleIdx];
          const isNumeric = headerInfo?.isNumeric;
          const originalClassName = cell.props?.className || "";
          const hasExplicitAlign = /\btext-(left|right|center|justify)\b/.test(originalClassName);
          const alignmentClass = isNumeric && !hasExplicitAlign ? " text-right" : "";
          const tabularClass = isNumeric && !originalClassName.includes("tabular-nums") ? " [font-variant-numeric:tabular-nums]" : "";
          const combinedClass = `${originalClassName}${alignmentClass}${tabularClass}`.trim();
          visibleCells.push(
            React.cloneElement(cell, {
              key: cell.key || `cell-${rowIdx}-${visibleIdx}`,
              "data-label": cell.props?.["data-label"] || headerInfo?.col || "",
              className: combinedClass
            })
          );
          visibleIdx++;
        }
        return React.cloneElement(r, {
          key: r.key || `row-${rowIdx}`,
          children: renderActions ? [...visibleCells, /* @__PURE__ */ jsx("td", { "data-label": actionLabel, className: "px-5 py-3.5", children: renderActions(rows[rowIdx], rowIdx) }, "row-action")] : visibleCells
        });
      }) })
    ] }) })
  ] });
}

// src/components/StatusBadge.jsx
import React2 from "react";

// src/timesheetWorkflowFlags.js
var env = (name) => typeof import.meta !== "undefined" && define_import_meta_env_default && define_import_meta_env_default[name] !== void 0 ? define_import_meta_env_default[name] : typeof process !== "undefined" ? process.env?.[name] : void 0;
var on = (name) => env(name) === "enabled";
var tsFlags = () => ({
  workflowUi: on("VITE_TIMESHEET_WORKFLOW_UI"),
  clientReturn: on("VITE_TIMESHEET_CLIENT_RETURN"),
  authority: on("VITE_TIMESHEET_AUTHORITY"),
  batchConfirm: on("VITE_TIMESHEET_BATCH_CONFIRM"),
  opsRestrict: on("VITE_TIMESHEET_OPS_RESTRICT"),
  kioskHidden: on("VITE_TIMESHEET_KIOSK_HIDDEN")
});
var BUSINESS = {
  Submitted: "Awaiting Client Confirmation",
  Client_Acknowledged: "Client Confirmed",
  Captured_From_Signed_Paper: "Captured from Signed Paper",
  Supervisor_Approved: "Approved (historical)"
};
var statusLabel = (status) => tsFlags().authority && BUSINESS[status] || String(status || "Unknown").replace(/_/g, " ");

// src/components/StatusBadge.jsx
import { jsx as jsx2 } from "react/jsx-runtime";
var STATUS_MAP = {
  // Quotes
  Draft: "bg-gray-100 text-gray-700",
  Submitted: "bg-sky-100 text-sky-800",
  Under_Review: "bg-amber-100 text-amber-800",
  Approved: "bg-emerald-100 text-emerald-800",
  Approved_Pending_PO: "bg-amber-100 text-amber-800",
  Rejected: "bg-red-100 text-red-800",
  Cancelled: "bg-gray-200 text-gray-600",
  // Worksheets
  Pending: "bg-amber-100 text-amber-800",
  Supervisor_Approved: "bg-emerald-100 text-emerald-800",
  Returned_For_Correction: "bg-red-100 text-red-800",
  Client_Acknowledged: "bg-emerald-100 text-emerald-800",
  Captured_From_Signed_Paper: "bg-emerald-100 text-emerald-800",
  Completed: "bg-emerald-100 text-emerald-800",
  Returned: "bg-orange-100 text-orange-800",
  // Dispatches & Tasks
  Scheduled: "bg-sky-100 text-sky-800",
  In_Progress: "bg-indigo-100 text-indigo-800",
  Not_Started: "bg-slate-100 text-slate-700",
  Pending_Approval: "bg-amber-100 text-amber-800",
  // Invoices
  Issued: "bg-sky-100 text-sky-800",
  Paid: "bg-emerald-100 text-emerald-800",
  Overdue: "bg-red-100 text-red-800",
  // General
  Active: "bg-emerald-100 text-emerald-800",
  Inactive: "bg-gray-200 text-gray-600"
};
var LABEL_OVERRIDES = {
  Approved_Pending_PO: "Awaiting PO",
  Pending_Approval: "Pending Approval",
  In_Progress: "In Progress",
  Not_Started: "Not Started",
  Under_Review: "Under Review",
  Supervisor_Approved: "Supervisor Approved",
  Returned_For_Correction: "Returned For Correction",
  Client_Acknowledged: "Client Acknowledged",
  Captured_From_Signed_Paper: "Captured From Paper"
};
function resolveLabel(status) {
  const primary = statusLabel(status);
  const raw = status || "";
  const isFallback = primary === raw || primary === raw.replace(/\s+/g, "_") || primary === raw.replace(/_/g, " ");
  if (isFallback) {
    const normalized = raw.trim().replace(/\s+/g, "_");
    if (LABEL_OVERRIDES[normalized]) return LABEL_OVERRIDES[normalized];
    return normalized.replace(/_/g, " ").replace(/\b[a-z]/g, (c) => c.toUpperCase());
  }
  return primary;
}
function StatusBadge({ status }) {
  const normalized = (status || "").replace(/\s+/g, "_");
  const classes = STATUS_MAP[normalized] || STATUS_MAP[status] || "bg-gray-100 text-gray-700";
  const display = resolveLabel(status);
  return /* @__PURE__ */ jsx2(
    "span",
    {
      className: `inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${classes}`,
      style: { fontVariantNumeric: "var(--orac-table-font-variant, tabular-nums)" },
      children: display
    }
  );
}

// .orac-ssr-dt-2PvjeS/statusTable.jsx
import { jsx as jsx3, jsxs as jsxs2 } from "react/jsx-runtime";
function render() {
  const columns = ["ID", "Status", "Notes"];
  const rows = [
    { id: "101", status: "Approved_Pending_PO", notes: "First row" },
    { id: "102", status: "In_Progress", notes: "Second row" }
  ];
  return renderToStaticMarkup(
    /* @__PURE__ */ jsx3(
      DataTable,
      {
        title: "Status Test",
        columns,
        rows,
        hideEmptyColumns: true,
        renderRow: (r) => /* @__PURE__ */ jsxs2("tr", { children: [
          /* @__PURE__ */ jsx3("td", { children: r.id }),
          /* @__PURE__ */ jsx3("td", { children: /* @__PURE__ */ jsx3(StatusBadge, { status: r.status }) }),
          /* @__PURE__ */ jsx3("td", { children: r.notes })
        ] }, r.id)
      }
    )
  );
}
export {
  render as default
};
