import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { summary, collections } from "../api/client.js";
import IconStatCard from "../components/IconStatCard.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import DataTable from "../components/DataTable.jsx";
import PageHeaderBanner from "../components/PageHeaderBanner.jsx";
import { ErrorBanner } from "../components/PageStates.jsx";
import { ICONS } from "../components/icons.jsx";

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
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [quotes, setQuotes] = useState([]);
  const [dispatches, setDispatches] = useState([]);
  const [worksheets, setWorksheets] = useState([]);
  const [pendingAccessCount, setPendingAccessCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    const loads = [summary.get(), collections.list("quotes")];
    // Load dispatches and worksheets if role needs them
    if (user.role !== "Client Viewer") {
      loads.push(collections.list("dispatch_cards"));
      loads.push(collections.list("field_worksheets"));
    } else {
      loads.push(Promise.resolve([]));
      loads.push(Promise.resolve([]));
    }

    // Load access requests for Admin / Management if permitted
    const shouldFetchAccess = user.role === "Admin" || user.role === "Management";
    const accessPromise = shouldFetchAccess
      ? collections.list("access_requests").catch(() => null)
      : Promise.resolve(null);
    loads.push(accessPromise);

    Promise.all(loads)
      .then(([s, q, d, w, ar]) => {
        if (cancelled) return;
        setStats(s);
        setQuotes(q || []);
        if (d) setDispatches(d);
        if (w) setWorksheets(w);
        if (ar && Array.isArray(ar)) {
          setPendingAccessCount(ar.filter((r) => r.status === "Pending").length);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user.role]);

  if (error) {
    return (
      <ErrorBanner message={error} />
    );
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        {/* Skeleton header */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="h-3 w-20 rounded bg-gray-200 mb-3" />
          <div className="h-7 w-48 rounded bg-gray-200 mb-2" />
          <div className="h-4 w-64 rounded bg-gray-100" />
        </div>

        {/* Skeleton KPI cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-xl border border-gray-100 bg-white p-5 shadow-sm flex flex-col justify-between">
              <div className="h-3 w-24 rounded bg-gray-200" />
              <div className="h-8 w-16 rounded bg-gray-200" />
            </div>
          ))}
        </div>

        {/* Skeleton Role KPI row */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 rounded-xl border border-gray-100 bg-white p-5 shadow-sm flex flex-col justify-between">
              <div className="h-3 w-28 rounded bg-gray-200" />
              <div className="h-7 w-12 rounded bg-gray-200" />
            </div>
          ))}
        </div>

        {/* Skeleton Pipeline */}
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="h-4 w-44 rounded bg-gray-200 mb-4" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-16 rounded-lg bg-gray-50 border border-gray-100" />
            ))}
          </div>
        </div>

        {/* Skeleton Tables */}
        <div className="grid gap-6 lg:grid-cols-2">
          {[1, 2].map((i) => (
            <div key={i} className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm space-y-4">
              <div className="h-4 w-32 rounded bg-gray-200" />
              <div className="space-y-3">
                {[1, 2, 3, 4].map((j) => (
                  <div key={j} className="h-9 rounded-lg bg-gray-50 border border-gray-100" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const greeting = ROLE_GREETING[user.role] || "Dashboard";

  const canReports = ["Admin", "Management", "Finance"].includes(user.role);
  const canWorksheets = ["Admin", "Operations", "Supervisor", "Technician", "Management"].includes(user.role);
  const canAdmin = user.role === "Admin";

  // Build role-specific KPI cards
  const roleCards = [];

  // Admin / Management: Pending Access Requests
  if ((user.role === "Admin" || user.role === "Management") && pendingAccessCount !== null) {
    roleCards.push(
      <IconStatCard
        key="access_requests"
        label="Pending Access Requests"
        value={pendingAccessCount}
        iconPath={ICONS.users}
        tone={pendingAccessCount > 0 ? "amber" : "neutral"}
        subtitle="Requires authorization"
        onClick={canAdmin ? () => navigate("/admin") : undefined}
      />
    );
  }

  // Finance: Blocked Amendments
  if (user.role === "Finance" || user.role === "Admin") {
    roleCards.push(
      <IconStatCard
        key="blocked_amendments"
        label="Blocked Amendments"
        value={stats?.blocked_amendments ?? 0}
        iconPath={ICONS.warning}
        tone={(stats?.blocked_amendments || 0) > 0 ? "red" : "green"}
        subtitle="POs requiring amendment"
        onClick={() => navigate("/reports")}
      />
    );
  }

  // Supervisor: Worksheets Pending Review
  if (user.role === "Supervisor" || user.role === "Admin" || user.role === "Operations") {
    const pendingReviewCount = worksheets.filter((w) => w.status === "Submitted").length;
    roleCards.push(
      <IconStatCard
        key="worksheets_review"
        label="Worksheets Pending Review"
        value={pendingReviewCount}
        iconPath={ICONS.clock}
        tone={pendingReviewCount > 0 ? "amber" : "neutral"}
        subtitle="Awaiting supervisor sign-off"
        onClick={() => navigate("/worksheets")}
      />
    );
  }

  // Technician: My Active Dispatches
  if (user.role === "Technician") {
    const myActive = dispatches.filter((d) =>
      (d.assigned_technician_id === user.id || d.technician_id === user.id || d.assigned_to === user.id) &&
      d.status !== "Completed" && d.status !== "Cancelled"
    );
    roleCards.push(
      <IconStatCard
        key="my_active_dispatches"
        label="My Active Dispatches"
        value={myActive.length}
        iconPath={ICONS.truck}
        tone={myActive.length > 0 ? "blue" : "neutral"}
        subtitle="Assigned active jobs"
        onClick={() => navigate("/worksheets")}
      />
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeaderBanner eyebrow={user.role} title={greeting} subtitle={`Welcome back, ${user.name || user.email}`} iconPath={ICONS.dashboard} aside={new Date().toLocaleDateString("en-ZA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} />

      {/* KPI stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <IconStatCard
          label="Total Clients"
          value={stats?.clients}
          iconPath={ICONS.building}
          tone="neutral"
          onClick={canAdmin ? () => navigate("/admin") : (canReports ? () => navigate("/reports") : undefined)}
        />
        <IconStatCard
          label="Active Quotes"
          value={stats?.quotes}
          iconPath={ICONS.clipboard}
          tone={stats?.quotes > 0 ? "blue" : "neutral"}
          onClick={() => navigate("/reports")}
        />
        <IconStatCard
          label="Dispatches"
          value={stats?.dispatches}
          iconPath={ICONS.truck}
          tone={stats?.dispatches > 0 ? "amber" : "neutral"}
          onClick={() => navigate(canWorksheets ? "/worksheets" : "/reports")}
        />
        <IconStatCard
          label="Invoices"
          value={stats?.invoices}
          iconPath={ICONS.money}
          tone={stats?.invoices > 0 ? "green" : "neutral"}
          onClick={() => navigate("/reports")}
        />
      </div>

      {/* Role-specific KPI row */}
      {roleCards.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Role Priorities & Action Items
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {roleCards}
          </div>
        </div>
      )}

      {/* Pipeline Status Breakdown */}
      {stats?.status_counts && Object.keys(stats.status_counts).length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-4">
            <div>
              <h2 className="text-sm font-bold tracking-tight text-orac-slate">Pipeline Status Breakdown</h2>
              <p className="text-xs text-gray-400">Current quotation distribution across workflow stages</p>
            </div>
            {canReports && (
              <button
                onClick={() => navigate("/reports")}
                className="text-xs font-semibold text-orac-blue hover:underline self-start sm:self-auto"
              >
                View Pipeline Report &rarr;
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {Object.entries(stats.status_counts).map(([status, count]) => (
              <div
                key={status}
                onClick={canReports ? () => navigate("/reports") : undefined}
                className={`flex flex-col justify-between rounded-lg border border-gray-100 bg-gray-50/70 p-3 transition-all ${
                  canReports ? "hover:bg-white hover:border-gray-300 hover:shadow-sm cursor-pointer" : ""
                }`}
              >
                <div className="mb-2">
                  <StatusBadge status={status} />
                </div>
                <div className="text-2xl font-bold text-gray-900 tabular-nums">
                  {count}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
