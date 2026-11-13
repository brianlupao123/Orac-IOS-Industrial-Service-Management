import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { summary, collections, quotes as quotesApi } from "../api/client.js";
import IconStatCard from "../components/IconStatCard.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import DataTable from "../components/DataTable.jsx";
import PageHeaderBanner from "../components/PageHeaderBanner.jsx";
import { ErrorBanner, PageLoadingSkeleton } from "../components/PageStates.jsx";
import { ICONS } from "../components/icons.jsx";
import AIAssistantPanel from "../components/AIAssistantPanel.jsx";
import SectionTitle from "../components/ui/SectionTitle.jsx";
import Button from "../components/ui/Button.jsx";
import QuickActionsBar from "../components/QuickActionsBar.jsx";
import { canAccessRoute } from "../accessPolicy.js";
import { formatMoney } from "../lib/format.js";

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

const QUOTE_DASHBOARD_ROLES = ["Admin", "Management", "Sales", "Finance", "Operations", "Client Viewer"];
const OPERATIONAL_DASHBOARD_ROLES = ["Admin", "Management", "Operations", "Supervisor", "Technician"];
const FIELD_DASHBOARD_ROLES = ["Supervisor", "Technician"];

export default function DashboardPage({ user }) {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [quotes, setQuotes] = useState([]);
  const [dispatches, setDispatches] = useState([]);
  const [siteNames, setSiteNames] = useState({});
  const [equipmentSiteMap, setEquipmentSiteMap] = useState({});
  const [technicianNames, setTechnicianNames] = useState({});
  const [worksheets, setWorksheets] = useState([]);
  const [pendingAccessCount, setPendingAccessCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dispatchingId, setDispatchingId] = useState(null);
  const [dispatchNotice, setDispatchNotice] = useState("");
  const [dispatchError, setDispatchError] = useState("");

  async function handleDispatch(quoteId) {
    setDispatchingId(quoteId);
    setDispatchNotice("");
    setDispatchError("");
    try {
      await quotesApi.transition(quoteId, "Field_Dispatch");
      setDispatchNotice(`Quotation dispatched to field successfully.`);
      const [newQuotes, newDispatches] = await Promise.all([
        collections.list("quotes"),
        collections.list("dispatch_cards")
      ]);
      setQuotes(newQuotes);
      setDispatches(newDispatches);
    } catch (err) {
      setDispatchError(err.message || "Failed to dispatch quotation to field.");
    } finally {
      setDispatchingId(null);
    }
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    const canLoadQuotes = QUOTE_DASHBOARD_ROLES.includes(user.role);
    const canLoadOperationalData = OPERATIONAL_DASHBOARD_ROLES.includes(user.role);
    const loads = [summary.get(), canLoadQuotes ? collections.list("quotes") : Promise.resolve([])];

    if (canLoadOperationalData) {
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
    // Dispatch cards carry equipment_tag_id and sometimes site_id; hydrate both mine_sites
    // and equipment_tags so the Site column reliably resolves real names.
    loads.push(canLoadOperationalData ? collections.list("mine_sites").catch(() => null) : Promise.resolve(null));
    loads.push(canLoadOperationalData ? collections.list("equipment_tags").catch(() => null) : Promise.resolve(null));
    loads.push(canLoadOperationalData ? collections.list("users").catch(() => null) : Promise.resolve(null));

    Promise.all(loads)
      .then(([s, q, d, w, ar, sites, equipmentTags, allUsers]) => {
        if (cancelled) return;
        const siteLookup = {};
        if (Array.isArray(sites)) {
          for (const site of sites) siteLookup[site.id] = site.name;
          setSiteNames(siteLookup);
        }
        if (Array.isArray(equipmentTags)) {
          const eqMap = {};
          for (const eq of equipmentTags) {
            eqMap[eq.id] = eq.mine_site_name || eq.plant_name || (eq.mine_site_id && siteLookup[eq.mine_site_id]) || eq.equipment_name;
          }
          setEquipmentSiteMap(eqMap);
        }
        if (Array.isArray(allUsers)) {
          setTechnicianNames(Object.fromEntries(allUsers.map((u) => [u.id, u.name || u.email])));
        }
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
    return <PageLoadingSkeleton label="Loading dashboard" />;
  }

  const greeting = ROLE_GREETING[user.role] || "Dashboard";

  const canReports = canAccessRoute(user.role, "/reports");
  const canWorksheets = canAccessRoute(user.role, "/worksheets");
  const canAdministration = canAccessRoute(user.role, "/admin");
  const canManageAccessRequests = user.role === "Admin";
  const canClientPortal = canAccessRoute(user.role, "/portal");
  const commercialDestination = canClientPortal ? "/portal" : canReports ? "/reports" : undefined;
  const isFieldDashboard = FIELD_DASHBOARD_ROLES.includes(user.role);

  // Build role-specific KPI cards
  const roleCards = [];

  // Admin / Management: Pending Access Requests
  if ((user.role === "Admin" || user.role === "Management") && pendingAccessCount !== null) {
    roleCards.push(
      <IconStatCard
        key="access_requests"
        statusFirst
        label="Pending Access Requests"
        value={pendingAccessCount}
        iconPath={ICONS.users}
        tone={pendingAccessCount > 0 ? "amber" : "neutral"}
        subtitle="Requires authorization"
        onClick={canManageAccessRequests ? () => navigate("/admin") : undefined}
      />
    );
  }

  // Finance: Blocked Amendments
  if (user.role === "Finance" || user.role === "Admin") {
    roleCards.push(
      <IconStatCard
        key="blocked_amendments"
        statusFirst
        label="Blocked Amendments"
        value={stats?.blocked_amendments ?? 0}
        iconPath={ICONS.warning}
        tone={(stats?.blocked_amendments || 0) > 0 ? "red" : "green"}
        subtitle="POs requiring amendment"
        evidenceTarget="evidence-kpi-blocked-amendments"
        onClick={commercialDestination ? () => navigate(commercialDestination) : undefined}
      />
    );
  }

  // Supervisor: Timesheets pending review
  if (user.role === "Supervisor" || user.role === "Admin" || user.role === "Operations") {
    // Supervisor review only opens after the client has acknowledged, so this counts
    // Client_Acknowledged. "Submitted" is still waiting on the client, not on a Supervisor.
    const pendingReviewCount = worksheets.filter((w) => w.status === "Client_Acknowledged").length;
    roleCards.push(
      <IconStatCard
        key="worksheets_review"
        statusFirst
        label="Timesheets Pending Review"
        value={pendingReviewCount}
        iconPath={ICONS.clock}
        tone={pendingReviewCount > 0 ? "amber" : "neutral"}
        subtitle="Client-acknowledged, awaiting Supervisor sign-off"
        evidenceTarget="evidence-kpi-worksheets-review"
        onClick={() => navigate("/worksheets")}
      />
    );
  }

  if (user.role === "Operations") {
    roleCards.push(
      <IconStatCard
        key="field_worksheets"
        label="Timesheets"
        value={stats?.worksheets ?? 0}
        iconPath={ICONS.clipboard}
        tone={(stats?.worksheets || 0) > 0 ? "blue" : "neutral"}
        subtitle="Work recorded in your operational scope"
        evidenceTarget="evidence-kpi-worksheets"
        onClick={() => navigate("/worksheets")}
      />,
      <IconStatCard
        key="returned_for_correction"
        statusFirst
        label="Returned for Correction"
        value={stats?.returned_for_correction ?? 0}
        iconPath={ICONS.warning}
        tone={(stats?.returned_for_correction || 0) > 0 ? "amber" : "neutral"}
        subtitle="Work awaiting technician resubmission"
        evidenceTarget="evidence-kpi-returned-for-correction"
        onClick={() => navigate("/worksheets")}
      />
    );
  }

  if (user.role === "Supervisor") {
    roleCards.push(
      <IconStatCard
        key="assigned_dispatches"
        label="Assigned Dispatches"
        value={stats?.dispatches ?? 0}
        iconPath={ICONS.truck}
        tone={(stats?.dispatches || 0) > 0 ? "blue" : "neutral"}
        subtitle="Jobs in your review scope"
        evidenceTarget="evidence-kpi-dispatches"
        onClick={() => navigate("/worksheets")}
      />,
      <IconStatCard
        key="returned_worksheets"
        statusFirst
        label="Returned for Correction"
        value={stats?.returned_for_correction ?? 0}
        iconPath={ICONS.warning}
        tone={(stats?.returned_for_correction || 0) > 0 ? "amber" : "neutral"}
        subtitle="Awaiting technician resubmission"
        evidenceTarget="evidence-kpi-returned-for-correction"
        onClick={() => navigate("/worksheets")}
      />
    );
  }

  // Technician: My Active Dispatches
  if (user.role === "Technician") {
    roleCards.push(
      <IconStatCard
        key="my_active_dispatches"
        label="My Active Dispatches"
        value={stats?.dispatches ?? 0}
        iconPath={ICONS.truck}
        tone={(stats?.dispatches || 0) > 0 ? "blue" : "neutral"}
        subtitle="Assigned active jobs"
        evidenceTarget="evidence-kpi-dispatches"
        onClick={() => navigate("/worksheets")}
      />,
      <IconStatCard
        key="my_worksheets"
        label="My Timesheets"
        value={stats?.worksheets ?? 0}
        iconPath={ICONS.clipboard}
        tone={(stats?.worksheets || 0) > 0 ? "blue" : "neutral"}
        subtitle="Draft, submitted, and returned work"
        evidenceTarget="evidence-kpi-worksheets"
        onClick={() => navigate("/worksheets")}
      />,
      <IconStatCard
        key="submitted_worksheets"
        statusFirst
        label="Awaiting Review"
        value={stats?.pending_review ?? 0}
        iconPath={ICONS.clock}
        tone={(stats?.pending_review || 0) > 0 ? "amber" : "neutral"}
        subtitle="Waiting for client acknowledgement or Supervisor review"
        evidenceTarget="evidence-kpi-worksheets-review"
        onClick={() => navigate("/worksheets")}
      />
    );
  }

  const hasQuotesTable = !isFieldDashboard;
  const hasDispatchesTable = OPERATIONAL_DASHBOARD_ROLES.includes(user.role);

  return (
    <div data-evidence="dashboard-ready" className="space-y-5 animate-in fade-in duration-300">
      <PageHeaderBanner
        eyebrow={user.role}
        title={greeting}
        subtitle={`Welcome back, ${user.name || user.email}`}
        iconPath={ICONS.dashboard}
        aside={new Date().toLocaleDateString("en-ZA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
      />

      {/* Quick Actions — Role-specific 1-click shortcuts (Africa University Acacia style) */}
      <QuickActionsBar user={user} />

      {/* Urgent / actionable work comes first, ahead of general totals, so the
          most important next step is visible without scrolling past low-priority
          counts. Order follows: role title -> priorities -> overview -> secondary. */}
      {roleCards.length > 0 && (
        <div id="evidence-section-role-priorities" data-evidence-target="evidence-section-role-priorities" className="space-y-3">
          <SectionTitle>Priorities and action items</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {roleCards}
          </div>
        </div>
      )}

      {!isFieldDashboard && (
        <div className="space-y-3">
          <SectionTitle>Overview</SectionTitle>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <IconStatCard
              label={user.role === "Client Viewer" ? "My Organization" : "Total Clients"}
              labelFirst
              value={stats?.clients}
              iconPath={ICONS.building}
              tone="neutral"
              evidenceTarget="evidence-kpi-clients"
              onClick={canAdministration ? () => navigate("/admin") : commercialDestination ? () => navigate(commercialDestination) : undefined}
            />
            <IconStatCard
              label="Total Quotes"
              labelFirst
              value={stats?.quotes}
              iconPath={ICONS.clipboard}
              tone="neutral"
              evidenceTarget="evidence-kpi-quotes"
              onClick={commercialDestination ? () => navigate(commercialDestination) : undefined}
            />
            <IconStatCard
              label="Dispatches"
              labelFirst
              value={stats?.dispatches}
              iconPath={ICONS.truck}
              tone="neutral"
              evidenceTarget="evidence-kpi-dispatches"
              onClick={() => navigate(canWorksheets ? "/worksheets" : commercialDestination || "/")}
            />
            <IconStatCard
              label="Invoices"
              labelFirst
              value={stats?.invoices}
              iconPath={ICONS.money}
              tone="neutral"
              evidenceTarget="evidence-kpi-invoices"
              onClick={commercialDestination ? () => navigate(commercialDestination) : undefined}
            />
          </div>
        </div>
      )}

      {/* Pipeline status breakdown — slim inline strip per UX review F11 */}
      {!isFieldDashboard && stats?.status_counts && Object.keys(stats.status_counts).length > 0 && (
        <div className="rounded-xl border border-orac-border-default bg-orac-surface px-5 py-3 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-ux-label font-semibold text-orac-text-primary">Pipeline status:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 flex-1">
            {Object.entries(stats.status_counts).map(([status, count]) => (
              <div
                key={status}
                id={`evidence-pipeline-${String(status).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`}
                data-evidence-target={`evidence-pipeline-${String(status).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`}
                onClick={canReports ? () => navigate("/reports") : undefined}
                className={`inline-flex items-center gap-2 rounded-full border border-orac-border-default bg-orac-surface-muted px-3 py-1 text-ux-caption transition-colors ${
                  canReports ? "hover:bg-orac-surface hover:border-orac-border-strong cursor-pointer" : ""
                }`}
              >
                <StatusBadge status={status} />
                <span className="font-bold text-orac-text-primary tabular-nums">{count}</span>
              </div>
            ))}
          </div>
          {canReports && (
            <Button
              variant="link"
              onClick={() => navigate("/reports")}
              className="inline-flex min-h-[44px] items-center text-xs font-semibold text-orac-blue hover:underline shrink-0"
            >
              View report &rarr;
            </Button>
          )}
        </div>
      )}

      {["Admin", "Operations"].includes(user.role) && quotes.some((q) => q.status === "PO_Verified") && (
        <div data-evidence="operations-dispatch-queue" className="rounded-xl border border-orac-info-border bg-orac-surface p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <SectionTitle>Verified Quotations Ready for Field Dispatch</SectionTitle>
              <p className="mt-1 text-ux-caption text-orac-text-muted">PO verification complete. Authorized for Operations dispatch to create a Dispatch Card.</p>
            </div>
            <span className="rounded-full bg-orac-info-bg px-2.5 py-1 text-ux-caption font-semibold text-orac-info-text border border-orac-info-border">
              {quotes.filter((q) => q.status === "PO_Verified").length} ready
            </span>
          </div>
          {dispatchNotice && <p className="text-ux-caption text-orac-success-text bg-orac-success-bg border border-orac-success-border rounded-lg p-2.5">{dispatchNotice}</p>}
          {dispatchError && <p className="text-ux-caption text-orac-danger-text bg-orac-danger-bg border border-orac-danger-border rounded-lg p-2.5">{dispatchError}</p>}
          <div className="divide-y divide-orac-border-default">
            {quotes.filter((q) => q.status === "PO_Verified").map((q) => (
              <div key={q.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-3 gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-ux-body text-orac-text-primary">{q.quotation_number || q.quote_number || q.id}</span>
                  <StatusBadge status={q.status} />
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={dispatchingId === q.id}
                  onClick={() => handleDispatch(q.id)}
                  className="shrink-0"
                >
                  {dispatchingId === q.id ? "Dispatching..." : "Dispatch to field"}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity tables — full width when only one table exists for the role */}
      <div className={`grid gap-5 ${hasQuotesTable && hasDispatchesTable ? "lg:grid-cols-2" : "grid-cols-1"}`}>
        {/* Recent quotes */}
        {hasQuotesTable && (
          <DataTable
            title="Recent quotes"
            columns={["Number", "Status", "Total"]}
            rows={quotes.slice(0, 8)}
            emptyText="No quotes yet"
            renderRow={(q) => (
              <tr key={q.id} className="transition-colors hover:bg-orac-row-hover">
                <td className="px-6 py-4 font-medium text-orac-text-primary">{q.quotation_number || q.quote_number || q.id}</td>
                <td className="px-6 py-4"><StatusBadge status={q.status} /></td>
                <td className="px-6 py-4 tabular-nums text-right">{formatMoney(q.total_amount)}</td>
              </tr>
            )}
          />
        )}

        {/* Recent dispatches (not for Client Viewer) */}
        {hasDispatchesTable && (
          <DataTable
            title="Recent dispatches"
            columns={["ID", "Status", "Site"]}
            rows={dispatches.slice(0, 8)}
            emptyText="No dispatches yet"
            renderRow={(d) => (
              <tr key={d.id} className="transition-colors hover:bg-orac-row-hover">
                <td className="px-6 py-4 font-medium text-orac-text-primary">{d.dispatch_number || d.id}</td>
                <td className="px-6 py-4"><StatusBadge status={d.status} /></td>
                <td className="px-6 py-4 text-orac-text-muted">{d.site_name || d.mine_site || siteNames[d.site_id] || equipmentSiteMap[d.equipment_tag_id] || "—"}</td>
              </tr>
            )}
          />
        )}
      </div>

      {/* Timesheets (for operational roles) */}
      {user.role !== "Client Viewer" && user.role !== "Finance" && worksheets.length > 0 && (
        <div id="evidence-section-worksheets" data-evidence-target="evidence-section-worksheets">
          <DataTable
            title="Timesheets"
            columns={["Activity", "Hours", "Status", "Technician"]}
            rows={worksheets.slice(0, 6)}
            emptyText="No timesheets"
            renderRow={(ws) => (
              <tr key={ws.id} className="transition-colors hover:bg-orac-row-hover">
                <td className="px-6 py-4 font-medium text-orac-text-primary">{ws.activity || "—"}</td>
                <td className="px-6 py-4 tabular-nums text-right">{ws.hours ?? "—"}</td>
                <td className="px-6 py-4"><StatusBadge status={ws.status} /></td>
                <td className="px-6 py-4 text-orac-text-muted">{ws.worker_name || ws.technician_name || technicianNames[ws.technician_id] || "—"}</td>
              </tr>
            )}
          />
        </div>
      )}

      {/* Fixed-position widget: placed last in the tree for natural tab order.
          Rendering here has no visual effect since it is fixed to the viewport. */}
      <AIAssistantPanel user={user} />
    </div>
  );
}
