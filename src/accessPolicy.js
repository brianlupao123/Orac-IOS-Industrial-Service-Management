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

const operationalRoles = [ROLES.ADMIN, ROLES.MANAGEMENT, ROLES.OPERATIONS, ROLES.SUPERVISOR];

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
  "/worksheets": [...operationalRoles, ROLES.TECHNICIAN],
  "/inventory": [ROLES.ADMIN, ROLES.MANAGEMENT, ROLES.OPERATIONS],
  "/reports": [...operationalRoles, ROLES.SALES, ROLES.FINANCE],
  "/operational-data": [...operationalRoles, ROLES.TECHNICIAN, ROLES.SALES, ROLES.FINANCE],
  "/documents": [...operationalRoles, ROLES.TECHNICIAN, ROLES.SALES, ROLES.FINANCE, ROLES.CLIENT_VIEWER],
  "/admin": [ROLES.ADMIN, ROLES.MANAGEMENT, ROLES.OPERATIONS],
  "/kiosk": operationalRoles,
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
  { path: "/inventory", label: "Inventory" },
  { path: "/reports", label: "Reports" },
  { path: "/operational-data", label: "Operational Data" },
  { path: "/documents", label: "Documents" },
  { path: "/admin", label: "Administration" }
]);

export function canAccessRoute(role, path) {
  const allowedRoles = ROUTE_ACCESS[path];
  return path === "/" || Boolean(allowedRoles?.includes(role));
}

export function visibleNavigation(role) {
  return NAV_ITEMS.filter((item) => canAccessRoute(role, item.path));
}
