import { canAccessRoute, visibleNavigationGroups } from "./accessPolicy.js";

// Sidebar and Mobile Drawer navigation model.
//
// accessPolicy.js stays the single source of truth for who may open a route.
// This module decides how the sidebar and hamburger drawer present what a role
// is authorized to open: it cleanly organizes menus into logical operational
// categories per role, attaches sub-filters to Timesheets, and adds entries
// for pages like Contracts and Kiosk. Every entry is strictly verified with
// canAccessRoute, so nothing here can widen access to any route.

export const TIMESHEET_STATUS_FILTERS = Object.freeze([
  { key: "all", label: "All Timesheets" },
  { key: "Draft", label: "Draft" },
  { key: "Submitted", label: "Awaiting client" },
  { key: "Client_Acknowledged", label: "Awaiting Supervisor" },
  { key: "Supervisor_Approved", label: "Approved" },
  { key: "Returned_For_Correction", label: "Returned" }
]);

// Pages that exist and are role-gated but were not reachable from the default menu.
const EXTRA_ITEMS = Object.freeze([
  { groupId: "commercial", path: "/contracts", label: "Contracts" },
  { groupId: "field-work", path: "/kiosk", label: "Kiosk mode" }
]);

const PRESENTATION_ORDER = Object.freeze([
  {
    id: "workspace",
    label: "Workspace",
    paths: ["/", "/operational-data", "/documents", "/imports", "/admin"]
  },
  {
    id: "commercial",
    label: "Commercial",
    paths: ["/quotations", "/contracts", "/finance", "/invoice-readiness", "/internal-requests", "/service-requests", "/portal"]
  },
  {
    id: "field-work",
    label: "Field Work",
    paths: ["/job-cards", "/worksheets", "/monthly-worksheets", "/kiosk"]
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

function withChildren(item) {
  if (item.path !== "/worksheets") return item;
  return {
    ...item,
    children: TIMESHEET_STATUS_FILTERS.map(({ key, label }) => ({
      key,
      label,
      path: item.path,
      search: key === "all" ? "" : `?status=${key}`
    }))
  };
}

export function sidebarGroups(role) {
  // Collect all policy-allowed items from visibleNavigationGroups(role)
  const policyGroups = visibleNavigationGroups(role);
  const itemMap = new Map();

  for (const group of policyGroups) {
    for (const item of group.items) {
      itemMap.set(item.path, item);
    }
  }

  // Include role-gated extra items if allowed
  for (const extra of EXTRA_ITEMS) {
    if (canAccessRoute(role, extra.path) && !itemMap.has(extra.path)) {
      itemMap.set(extra.path, { path: extra.path, label: extra.label });
    }
  }

  // Assemble into organized presentation groups per role
  const groups = [];
  for (const groupDef of PRESENTATION_ORDER) {
    const items = [];
    for (const path of groupDef.paths) {
      if (itemMap.has(path)) {
        items.push(withChildren(itemMap.get(path)));
      }
    }
    if (items.length > 0) {
      groups.push({
        id: groupDef.id,
        label: groupDef.label,
        items
      });
    }
  }

  return groups;
}
