export const ROLES = Object.freeze({
  ADMIN: "Admin",
  MANAGEMENT: "Management",
  SALES: "Sales",
  FINANCE: "Finance",
  OPERATIONS: "Operations",
  SUPERVISOR: "Supervisor",
  TECHNICIAN: "Technician",
  CLIENT_VIEWER: "Client Viewer"
});

import { tsFlags } from "./timesheetWorkflowFlags.js";

const operationalRoles = [ROLES.ADMIN, ROLES.MANAGEMENT, ROLES.OPERATIONS, ROLES.SUPERVISOR];

const F = tsFlags();
const withSalesFinance = (roles) => (F.workflowUi ? [...roles, ROLES.SALES, ROLES.FINANCE] : roles);
const withoutOpsSupervisor = (roles) => (F.opsRestrict ? roles.filter((r) => ![ROLES.OPERATIONS, ROLES.SUPERVISOR].includes(r)) : roles);

export const ROUTE_ACCESS = Object.freeze({
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
  "/worksheets": withSalesFinance([...operationalRoles, ROLES.TECHNICIAN]),
  "/daily-timesheets": [...operationalRoles, ROLES.TECHNICIAN],
  "/contractor-logs": [ROLES.ADMIN, ROLES.MANAGEMENT, ROLES.OPERATIONS, ROLES.SUPERVISOR],
  // Worksheet = the automatically generated monthly register. It shows colleagues' hours, so
  // Technician and Client Viewer are excluded; the server enforces every action.
  "/monthly-worksheets": withoutOpsSupervisor(withSalesFinance([ROLES.ADMIN, ROLES.MANAGEMENT, ROLES.OPERATIONS, ROLES.SUPERVISOR])),
  // Timesheet workflow packet: Sales paper capture, Finance variance control, Admin authority/policy.
  ...(F.workflowUi ? { "/timesheet-workflow": [ROLES.ADMIN, ROLES.SALES, ROLES.FINANCE] } : {}),
  // Read-only history of the older forms, in the one Timesheet shape.
  "/legacy-history": [ROLES.ADMIN, ROLES.MANAGEMENT, ROLES.OPERATIONS, ROLES.SUPERVISOR],
  "/inventory": [ROLES.ADMIN, ROLES.MANAGEMENT, ROLES.OPERATIONS],
  "/reports": [...operationalRoles, ROLES.SALES, ROLES.FINANCE],
  "/operational-data": [...operationalRoles, ROLES.TECHNICIAN, ROLES.SALES, ROLES.FINANCE],
  "/documents": [...operationalRoles, ROLES.TECHNICIAN, ROLES.SALES, ROLES.FINANCE, ROLES.CLIENT_VIEWER],
  "/admin": [ROLES.ADMIN, ROLES.MANAGEMENT, ROLES.OPERATIONS],
  "/kiosk": F.kioskHidden ? [ROLES.ADMIN] : operationalRoles,
  // Mirrors the backend viewContracts policy. Supervisor is excluded because
  // contracts have no supervisor-assignment relation to scope against, and a
  // Client Viewer only ever receives its own client's records from the API.
  "/contracts": [ROLES.ADMIN, ROLES.MANAGEMENT, ROLES.OPERATIONS, ROLES.CLIENT_VIEWER]
});

export const NAV_ITEMS = Object.freeze([
  { path: "/", label: "Dashboard" },
  { path: "/portal", label: "Client Portal" },
  { path: "/service-requests", label: "Service Requests" },
  { path: "/quotations", label: "Quotations" },
  { path: "/finance", label: "PO & Invoicing" },
  { path: "/internal-requests", label: "Internal Requests" },
  { path: "/worksheets", label: "Timesheets" },
  { path: "/monthly-worksheets", label: "Worksheets" },
  ...(F.workflowUi ? [{ path: "/timesheet-workflow", label: "Timesheet Workflow" }] : []),
  { path: "/inventory", label: "Inventory" },
  { path: "/reports", label: "Reports" },
  { path: "/operational-data", label: "Operational Data" },
  { path: "/documents", label: "Documents" },
  { path: "/admin", label: "Administration" }
]);

// Navigation is grouped for scanning only. ROUTE_ACCESS remains the source of
// truth for permission decisions, so moving an item between groups cannot
// widen access to any route.
export const NAV_GROUPS = Object.freeze([
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

export function canAccessRoute(role, path) {
  const allowedRoles = ROUTE_ACCESS[path];
  return path === "/" || Boolean(allowedRoles?.includes(role));
}

export function visibleNavigation(role) {
  return NAV_ITEMS.filter((item) => canAccessRoute(role, item.path));
}

export function visibleNavigationGroups(role) {
  const itemsByPath = new Map(visibleNavigation(role).map((item) => [item.path, item]));

  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.paths.map((path) => itemsByPath.get(path)).filter(Boolean)
  })).filter((group) => group.items.length > 0);
}
