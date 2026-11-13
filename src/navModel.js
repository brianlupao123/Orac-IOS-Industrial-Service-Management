import { canAccessRoute, visibleNavigationGroups } from "./accessPolicy.js";

// Sidebar navigation model.
//
// accessPolicy.js stays the single source of truth for who may open a route.
// This module only decides how the sidebar presents what a role may already
// open: it adds menu entries for pages that exist but had no menu link, and
// attaches sub-filters to Timesheets. Every entry is still checked with
// canAccessRoute, so nothing here can widen access to a route.

export const TIMESHEET_STATUS_FILTERS = Object.freeze([
  { key: "all", label: "All Timesheets" },
  { key: "Draft", label: "Draft" },
  { key: "Submitted", label: "Awaiting client" },
  { key: "Client_Acknowledged", label: "Awaiting Supervisor" },
  { key: "Supervisor_Approved", label: "Approved" },
  { key: "Returned_For_Correction", label: "Returned" }
]);

// Pages that exist and are role-gated but were not reachable from the menu.
const EXTRA_ITEMS = Object.freeze([
  { groupId: "commercial", path: "/contracts", label: "Contracts" },
  { groupId: "field-work", path: "/kiosk", label: "Kiosk mode" }
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
  const groups = visibleNavigationGroups(role).map((group) => ({
    ...group,
    items: group.items.map(withChildren)
  }));

  for (const extra of EXTRA_ITEMS) {
    if (!canAccessRoute(role, extra.path)) continue;
    const group = groups.find((g) => g.id === extra.groupId);
    if (group && !group.items.some((item) => item.path === extra.path)) {
      group.items.push({ path: extra.path, label: extra.label });
    }
  }
  return groups;
}
