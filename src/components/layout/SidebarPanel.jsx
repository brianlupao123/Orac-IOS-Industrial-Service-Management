import React, { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import BrandMark from "../ui/BrandMark.jsx";
import Button from "../ui/Button.jsx";

export const NAV_ICONS = {
  workspace: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  commercial: "M6 3h8l4 4v14H6z M14 3v4h4",
  "field-work": "M9 4h6v3H9z M7 5H5v16h14V5h-2 M9 14l2 2 4-4",
  inventory: "M3 8l9-5 9 5v8l-9 5-9-5z M3 8l9 5 9-5 M12 13v8",
  reports: "M5 20V10M12 20V4M19 20v-7"
};

const ITEM_ICONS = {
  "/": NAV_ICONS.workspace,
  "/worksheets": "M12 7v5l3 2 M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  "/kiosk": "M4 5h16v11H4z M9 20h6 M12 16v4",
  "/inventory": NAV_ICONS.inventory,
  "/reports": NAV_ICONS.reports,
  "/contracts": "M7 3h8l4 4v14H7z M15 3v4h4 M10 13h6 M10 17h6",
  "/quotations": NAV_ICONS.commercial,
  "/finance": "M3 7h18v10H3z M12 12m-2.5 0a2.5 2.5 0 105 0 2.5 2.5 0 10-5 0",
  "/documents": "M6 3h8l4 4v14H6z M14 3v4h4 M9 13h6 M9 17h6",
  "/admin": "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  "/operational-data": "M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3z M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6 M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6",
  "/job-cards": "M4 7h16v13H4z M9 7V4h6v3 M4 13h16",
  "/invoice-readiness": "M9 12l2 2 4-4 M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z",
  "/imports": "M12 3v12 M7 10l5 5 5-5 M4 21h16",
  "/internal-requests": "M4 5h16v11H8l-4 4z",
  "/service-requests": "M4 4h16v16H4z M8 9h8 M8 13h5",
  "/portal": "M3 11l9-8 9 8 M5 10v10h14V10",
  "/monthly-worksheets": "M5 4h14v17H5z M9 2v4 M15 2v4 M5 10h14"
};
const DEFAULT_ICON = "M12 12m-2 0a2 2 0 104 0 2 2 0 10-4 0";

function Icon({ d, className = "h-5 w-5" }) {
  return (
    <svg className={`${className} shrink-0`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

function Chevron({ open }) {
  return (
    <svg className={`h-4 w-4 shrink-0 transition-transform duration-150 ${open ? "rotate-90" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

const isPathActive = (item, pathname) => (item.path === "/" ? pathname === "/" : pathname.startsWith(item.path));

function ItemWithChildren({ item, pathname, search, onNavigate }) {
  const active = isPathActive(item, pathname);
  const [open, setOpen] = useState(active);
  useEffect(() => { if (active) setOpen(true); }, [active]);
  const current = new URLSearchParams(search).get("status") || "all";
  const panelId = `sidebar-sub-${item.path.replace(/\W/g, "") || "root"}`;

  return (
    <div>
      <Button
 variant="bare"
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className={`orac-sidebar-item ${active ? "orac-sidebar-item-active" : ""}`}
      >
        <Icon d={ITEM_ICONS[item.path] || DEFAULT_ICON} />
        <span className="flex-1 text-left">{item.label}</span>
        <Chevron open={open} />
      </Button>
      {open && (
        <ul id={panelId} className="orac-sidebar-sub">
          {item.children.map((child) => {
            const childActive = active && current === child.key;
            return (
              <li key={child.key}>
                <Link
                  to={{ pathname: child.path, search: child.search }}
                  onClick={onNavigate}
                  aria-current={childActive ? "page" : undefined}
                  className={`orac-sidebar-subitem ${childActive ? "orac-sidebar-subitem-active" : ""}`}
                >
                  {child.label}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function SidebarItem({ item, pathname, search, onNavigate }) {
  if (item.children?.length) return <ItemWithChildren item={item} pathname={pathname} search={search} onNavigate={onNavigate} />;
  return (
    <NavLink
      to={item.path}
      end={item.path === "/"}
      onClick={onNavigate}
      className={({ isActive }) => `orac-sidebar-item ${isActive ? "orac-sidebar-item-active" : ""}`}
    >
      <Icon d={ITEM_ICONS[item.path] || DEFAULT_ICON} />
      <span className="flex-1 text-left">{item.label}</span>
    </NavLink>
  );
}

function SidebarGroup({ group, pathname, search, onNavigate }) {
  const hasActive = group.items.some((item) => isPathActive(item, pathname));
  const [open, setOpen] = useState(true);
  useEffect(() => { if (hasActive) setOpen(true); }, [hasActive]);
  const listId = `sidebar-group-${group.id}`;
  const single = group.items.length === 1;

  return (
    <div className="orac-sidebar-group">
      {single ? null : (
        <Button
 variant="bare"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((v) => !v)}
          className="orac-sidebar-group-label"
        >
          <span>{group.label}</span>
          <Chevron open={open} />
        </Button>
      )}
      {(single || open) && (
        <div id={listId} className="space-y-0.5">
          {group.items.map((item) => (
            <SidebarItem key={item.path} item={item} pathname={pathname} search={search} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Brand, role-gated grouped navigation and the signed-in user card.
 * Used by the persistent desktop sidebar and by the mobile drawer.
 */
export default function SidebarPanel({ user, navGroups, onLogout, onNavigate, onClose }) {
  const { pathname, search } = useLocation();
  const initials = (user?.name || user?.email || "U").slice(0, 2).toUpperCase();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="orac-sidebar-brand">
        <BrandMark size={44} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-ux-sub font-extrabold tracking-wide">ORAC SYSTEMS</div>
          <div className="truncate text-ux-secondary orac-sidebar-muted">Operational Portal</div>
        </div>
        {onClose && (
          <Button variant="bare" onClick={onClose} aria-label="Close navigation menu" className="orac-sidebar-close">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </Button>
        )}
      </div>

      <nav aria-label="Primary" className="orac-sidebar-nav">
        {navGroups.map((group) => (
          <SidebarGroup key={group.id} group={group} pathname={pathname} search={search} onNavigate={onNavigate} />
        ))}
      </nav>

      <div className="orac-sidebar-user">
        <div className="orac-sidebar-avatar" aria-hidden="true">{initials}</div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-ux-secondary font-semibold">{user?.name || user?.email}</div>
          {user?.role && <div className="truncate text-ux-secondary orac-sidebar-muted">{user.role}</div>}
        </div>
        <Button variant="bare" onClick={onLogout} className="orac-sidebar-signout">Sign out</Button>
      </div>
    </div>
  );
}
