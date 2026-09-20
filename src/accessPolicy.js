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
  "/worksheets": [...operationalRoles, ROLES.TECHNICIAN],
  "/inventory": [ROLES.ADMIN, ROLES.MANAGEMENT, ROLES.OPERATIONS],
  "/reports": [...operationalRoles, ROLES.SALES, ROLES.FINANCE],
  "/admin": [ROLES.ADMIN, ROLES.MANAGEMENT, ROLES.OPERATIONS],
  "/kiosk": operationalRoles,
  "/contracts": operationalRoles
});

export const NAV_ITEMS = Object.freeze([
  { path: "/", label: "Dashboard" },
  { path: "/portal", label: "Client Portal" },
  { path: "/worksheets", label: "Worksheets" },
  { path: "/inventory", label: "Inventory" },
  { path: "/reports", label: "Reports" },
  { path: "/admin", label: "Administration" }
]);

export function canAccessRoute(role, path) {
  const allowedRoles = ROUTE_ACCESS[path];
  return path === "/" || Boolean(allowedRoles?.includes(role));
}

export function visibleNavigation(role) {
  return NAV_ITEMS.filter((item) => canAccessRoute(role, item.path));
}
