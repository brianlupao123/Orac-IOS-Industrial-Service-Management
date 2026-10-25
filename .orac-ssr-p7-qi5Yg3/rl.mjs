// <define:import.meta.env>
var define_import_meta_env_default = { PROD: false };

// .orac-ssr-p7-qi5Yg3/rl.jsx
import React2 from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";

// src/components/RecordLink.jsx
import React from "react";
import { Link } from "react-router-dom";

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

// src/v5CommercialFlags.js
var env2 = (name) => typeof import.meta !== "undefined" && define_import_meta_env_default && define_import_meta_env_default[name] !== void 0 ? define_import_meta_env_default[name] : typeof process !== "undefined" ? process.env?.[name] : void 0;
var v5CommercialEnabled = () => env2("VITE_ORAC_V5_COMMERCIAL_WORKFLOW") === "enabled";

// src/accessPolicy.js
var ROLES = Object.freeze({
  ADMIN: "Admin",
  MANAGEMENT: "Management",
  SALES: "Sales",
  FINANCE: "Finance",
  OPERATIONS: "Operations",
  SUPERVISOR: "Supervisor",
  TECHNICIAN: "Technician",
  CLIENT_VIEWER: "Client Viewer"
});
var operationalRoles = [ROLES.ADMIN, ROLES.MANAGEMENT, ROLES.OPERATIONS, ROLES.SUPERVISOR];
var F = tsFlags();
var withSalesFinance = (roles) => F.workflowUi ? [...roles, ROLES.SALES, ROLES.FINANCE] : roles;
var withV5SalesFinance = (roles) => v5CommercialEnabled() ? [.../* @__PURE__ */ new Set([...roles, ROLES.SALES, ROLES.FINANCE])] : roles;
var withoutOpsSupervisor = (roles) => F.opsRestrict ? roles.filter((r2) => ![ROLES.OPERATIONS, ROLES.SUPERVISOR].includes(r2)) : roles;
var ROUTE_ACCESS = Object.freeze({
  "/portal": [ROLES.CLIENT_VIEWER],
  "/service-requests": [ROLES.SALES, ROLES.OPERATIONS],
  // Mirrors the backend's createQuote/sendQuote/cancelQuote permission set
  // (permissions.js) exactly: Admin and Sales only. Operations/Management can
  // approve a sent quote but do not create, edit, send or cancel one, so they
  // are deliberately not granted this route.
  "/quotations": [ROLES.ADMIN, ROLES.SALES],
  // Mirrors the backend's invoice / approveAmendment permission set (Admin,
  // Finance). verifyPo also allows Operations server-side, but Operations'
  // own workspace is outside this route; no API access is widened or narrowed.
  "/finance": [ROLES.ADMIN, ROLES.FINANCE],
  // Admin can receive and respond to team requests but cannot create them.
  // Client Viewer has no internal-request access. The server still decides
  // every action, including request creation and lifecycle transitions.
  "/internal-requests": [ROLES.ADMIN, ROLES.MANAGEMENT, ROLES.SALES, ROLES.FINANCE, ROLES.OPERATIONS, ROLES.SUPERVISOR, ROLES.TECHNICIAN],
  "/worksheets": withV5SalesFinance(withSalesFinance([...operationalRoles, ROLES.TECHNICIAN])),
  "/daily-timesheets": [...operationalRoles, ROLES.TECHNICIAN],
  "/contractor-logs": [ROLES.ADMIN, ROLES.MANAGEMENT, ROLES.OPERATIONS, ROLES.SUPERVISOR],
  // Worksheet = the automatically generated monthly register. It shows colleagues' hours, so
  // Technician and Client Viewer are excluded; the server enforces every action.
  "/monthly-worksheets": withoutOpsSupervisor(withSalesFinance([ROLES.ADMIN, ROLES.MANAGEMENT, ROLES.OPERATIONS, ROLES.SUPERVISOR])),
  // Timesheet workflow packet: Sales paper capture, Finance variance control, Admin authority/policy.
  ...F.workflowUi ? { "/timesheet-workflow": [ROLES.ADMIN, ROLES.SALES, ROLES.FINANCE] } : {},
  // Read-only history of the older forms, in the one Timesheet shape.
  "/legacy-history": [ROLES.ADMIN, ROLES.MANAGEMENT, ROLES.OPERATIONS, ROLES.SUPERVISOR],
  "/inventory": [ROLES.ADMIN, ROLES.MANAGEMENT, ROLES.OPERATIONS],
  "/reports": [...operationalRoles, ROLES.SALES, ROLES.FINANCE],
  // Read-only operational record. The server further scopes Supervisor and
  // Technician access to dispatches they are assigned to.
  "/job-cards": [...operationalRoles, ROLES.TECHNICIAN],
  // A commercial, read-only explanation of the server's invoice gate. It is
  // intentionally not navigation: it opens from Invoice Ready records.
  "/invoice-readiness": [ROLES.ADMIN, ROLES.MANAGEMENT, ROLES.FINANCE],
  "/operational-data": [...operationalRoles, ROLES.TECHNICIAN, ROLES.SALES, ROLES.FINANCE],
  "/documents": [...operationalRoles, ROLES.TECHNICIAN, ROLES.SALES, ROLES.FINANCE, ROLES.CLIENT_VIEWER],
  "/admin": [ROLES.ADMIN, ROLES.MANAGEMENT, ROLES.OPERATIONS],
  "/kiosk": F.kioskHidden ? [ROLES.ADMIN] : operationalRoles,
  // Mirrors the backend viewContracts policy. Supervisor is excluded because
  // contracts have no supervisor-assignment relation to scope against, and a
  // Client Viewer only ever receives its own client's records from the API.
  "/contracts": [ROLES.ADMIN, ROLES.MANAGEMENT, ROLES.OPERATIONS, ROLES.CLIENT_VIEWER]
});
var NAV_ITEMS = Object.freeze([
  { path: "/", label: "Dashboard" },
  { path: "/portal", label: "Client Portal" },
  { path: "/service-requests", label: "Service Requests" },
  { path: "/quotations", label: "Quotations" },
  { path: "/finance", label: "PO & Invoicing" },
  { path: "/internal-requests", label: "Internal Requests" },
  { path: "/worksheets", label: "Timesheets" },
  { path: "/monthly-worksheets", label: "Worksheets" },
  ...F.workflowUi ? [{ path: "/timesheet-workflow", label: "Timesheet Workflow" }] : [],
  { path: "/inventory", label: "Inventory" },
  { path: "/reports", label: "Reports" },
  { path: "/operational-data", label: "Operational Data" },
  { path: "/documents", label: "Documents" },
  { path: "/admin", label: "Administration" }
]);
var NAV_GROUPS = Object.freeze([
  {
    id: "workspace",
    label: "Workspace",
    paths: ["/", "/operational-data", "/documents", "/admin"]
  },
  {
    id: "commercial",
    label: "Commercial",
    paths: ["/portal", "/service-requests", "/quotations", "/finance", "/internal-requests"]
  },
  {
    id: "field-work",
    label: "Field Work",
    paths: F.workflowUi ? ["/worksheets", "/monthly-worksheets", "/timesheet-workflow"] : ["/worksheets", "/monthly-worksheets"]
  },
  {
    id: "inventory",
    label: "Inventory",
    paths: ["/inventory"]
  },
  {
    id: "reports",
    label: "Reports",
    paths: ["/reports"]
  }
]);
function canAccessRoute(role, path) {
  const allowedRoles = ROUTE_ACCESS[path];
  return path === "/" || Boolean(allowedRoles?.includes(role));
}

// src/lib/deepLink.js
import { useEffect, useRef } from "react";
function recordHref(path, param, id) {
  if (param === "id") return `${path}/${encodeURIComponent(id)}`;
  return `${path}?${encodeURIComponent(param)}=${encodeURIComponent(id)}`;
}

// src/components/RecordLink.jsx
import { jsx } from "react/jsx-runtime";
function RecordLink({ user, path, param, id, what, name }) {
  if (!id || !user || !canAccessRoute(user.role, path)) return null;
  return /* @__PURE__ */ jsx(
    Link,
    {
      to: recordHref(path, param, String(id)),
      "data-evidence": "report-record-link",
      "aria-label": `Open ${what} ${name || id}`,
      className: "inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-orac-border-strong px-3 text-sm font-semibold text-orac-accent hover:bg-orac-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-orac-blue/40",
      children: "Open"
    }
  );
}

// .orac-ssr-p7-qi5Yg3/rl.jsx
import { jsx as jsx2 } from "react/jsx-runtime";
var r = (role, props) => renderToStaticMarkup(/* @__PURE__ */ jsx2(MemoryRouter, { children: /* @__PURE__ */ jsx2(RecordLink, { user: { role }, ...props }) }));
var admin = r("Admin", { path: "/quotations", param: "quote", id: "q-1", what: "quote", name: "Q-1001" });
var finance = r("Finance", { path: "/quotations", param: "quote", id: "q-1", what: "quote", name: "Q-1001" });
var financePo = r("Finance", { path: "/finance", param: "po", id: "po-9", what: "purchase order", name: "PO-77" });
var jobCard = r("Management", { path: "/job-cards", param: "id", id: "job-1", what: "job card", name: "JOB-1" });
var invoiceReadiness = r("Finance", { path: "/invoice-readiness", param: "id", id: "job-1", what: "invoice readiness", name: "JOB-1" });
var tech = r("Technician", { path: "/finance", param: "po", id: "po-9", what: "purchase order", name: "PO-77" });
var noId = r("Admin", { path: "/quotations", param: "quote", id: "", what: "quote", name: "x" });
export {
  admin,
  finance,
  financePo,
  invoiceReadiness,
  jobCard,
  noId,
  tech
};
