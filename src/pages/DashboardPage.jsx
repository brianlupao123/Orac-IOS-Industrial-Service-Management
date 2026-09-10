import React, { useEffect, useState } from "react";
import { summary, collections } from "../api/client.js";
import StatCard from "../components/StatCard.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import DataTable from "../components/DataTable.jsx";

/**
 * Role-aware operational dashboard.
 * Adapted from feedback-ecosystem RoleDashboard.jsx + DashboardComp.jsx patterns.
 * Shows KPI stat cards + recent activity tables tailored to the user's role.
 */

const ROLE_GREETING = {
  Admin:          "Admin Console",
  Management:     "Management Overview",
  Sales:          "Sales Pipeline",
  Operations:     "Operations Center",
  Technician:     "My Assignments",
  Supervisor:     "Supervisor Review",
  Finance:        "Finance & Invoicing",
  "Client Viewer":"Client Dashboard",
};

export default function DashboardPage({ user }) {
  const [stats, setStats] = useState(null);
  const [quotes, setQuotes] = useState([]);
  const [dispatches, setDispatches] = useState([]);
  const [worksheets, setWorksheets] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const loads = [summary.get(), collections.list("quotes")];
    // Load dispatches and worksheets if role needs them
    if (user.role !== "Client Viewer") {
      loads.push(collections.list("dispatch_cards"));
      loads.push(collections.list("field_worksheets"));
    }

    Promise.all(loads)
      .then(([s, q, d, w]) => {
        setStats(s);
        setQuotes(q);
        if (d) setDispatches(d);
        if (w) setWorksheets(w);
      })
      .catch((err) => setError(err.message));
  }, [user.role]);

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  const greeting = ROLE_GREETING[user.role] || "Dashboard";

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-orac-blue">{user.role}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-orac-slate">{greeting}</h1>
            <p className="mt-1 text-sm text-gray-500">
              Welcome back, {user.name || user.email}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-400">{new Date().toLocaleDateString("en-ZA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
          </div>
        </div>
      </div>

      {/* KPI stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Clients" value={stats?.clients} icon="🏢" tone="slate" />
        <StatCard
          label="Active Quotes"
          value={stats?.quotes}
          icon="📋"
          tone={stats?.quotes > 0 ? "blue" : "slate"}
        />
        <StatCard
          label="Dispatches"
          value={stats?.dispatches}
          icon="🚛"
          tone={stats?.dispatches > 0 ? "amber" : "slate"}
        />
        <StatCard
          label="Invoices"
          value={stats?.invoices}
          icon="💰"
          tone={stats?.invoices > 0 ? "green" : "slate"}
        />
      </div>

      {/* Activity tables */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent quotes */}
        <DataTable
          title="Recent Quotes"
          columns={["Number", "Status", "Total"]}
          rows={quotes.slice(0, 8)}
          emptyText="No quotes yet"
          renderRow={(q) => (
            <tr key={q.id} className="transition-colors hover:bg-gray-50">
              <td className="px-4 py-2.5 font-medium text-orac-slate">{q.quotation_number || q.quote_number || q.id}</td>
              <td className="px-4 py-2.5"><StatusBadge status={q.status} /></td>
              <td className="px-4 py-2.5 tabular-nums">{q.total_amount != null ? `R ${Number(q.total_amount).toLocaleString()}` : "—"}</td>
            </tr>
          )}
        />

        {/* Recent dispatches (not for Client Viewer) */}
        {user.role !== "Client Viewer" && (
          <DataTable
            title="Recent Dispatches"
            columns={["ID", "Status", "Site"]}
            rows={dispatches.slice(0, 8)}
            emptyText="No dispatches yet"
            renderRow={(d) => (
              <tr key={d.id} className="transition-colors hover:bg-gray-50">
                <td className="px-4 py-2.5 font-medium text-orac-slate">{d.dispatch_number || d.id}</td>
                <td className="px-4 py-2.5"><StatusBadge status={d.status} /></td>
                <td className="px-4 py-2.5 text-gray-500">{d.site_name || d.mine_site || "—"}</td>
              </tr>
            )}
          />
        )}
      </div>

      {/* Worksheets (for operations roles) */}
      {user.role !== "Client Viewer" && user.role !== "Finance" && worksheets.length > 0 && (
        <DataTable
          title="Field Worksheets"
          columns={["Activity", "Hours", "Status", "Technician"]}
          rows={worksheets.slice(0, 6)}
          emptyText="No worksheets"
          renderRow={(ws) => (
            <tr key={ws.id} className="transition-colors hover:bg-gray-50">
              <td className="px-4 py-2.5 font-medium text-orac-slate">{ws.activity || "—"}</td>
              <td className="px-4 py-2.5 tabular-nums">{ws.hours ?? "—"}</td>
              <td className="px-4 py-2.5"><StatusBadge status={ws.status} /></td>
              <td className="px-4 py-2.5 text-gray-500">{ws.technician_name || "—"}</td>
            </tr>
          )}
        />
      )}
    </div>
  );
}