import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { auth, onSessionExpired, uatState } from "./api/client.js";
import { canAccessRoute } from "./accessPolicy.js";
import LoginPage from "./pages/LoginPage.jsx";
import LandingPage from "./pages/LandingPage.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import RequestAccess from "./pages/RequestAccess.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import WorksheetsPage from "./pages/WorksheetsPage.jsx";
import InventoryPage from "./pages/InventoryPage.jsx";
import ReportsPage from "./pages/ReportsPage.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import ClientPortalPage from "./pages/ClientPortalPage.jsx";
import ServiceRequestTriagePage from "./pages/ServiceRequestTriagePage.jsx";
import QuotationsPage from "./pages/QuotationsPage.jsx";
import FinanceCommercialPage from "./pages/FinanceCommercialPage.jsx";
import InternalRequestsPage from "./pages/InternalRequestsPage.jsx";
import KioskModePage from "./pages/KioskModePage.jsx";
import ContractsPage from "./pages/ContractsPage.jsx";
import PortalLayout from "./layouts/PortalLayout.jsx";
import AccessDeniedPage from "./pages/AccessDeniedPage.jsx";
import OperationalDataPage from "./pages/OperationalDataPage.jsx";
import DocumentsPage from "./pages/DocumentsPage.jsx";
import DailyTimesheetPage from "./pages/DailyTimesheetPage.jsx";
import ContractorLogPage from "./pages/ContractorLogPage.jsx";
import DailyTimesheetPrintPage from "./pages/DailyTimesheetPrintPage.jsx";
import ContractorLogPrintPage from "./pages/ContractorLogPrintPage.jsx";

function GuardedRoute({ user, path, children }) {
  return canAccessRoute(user.role, path) ? children : <AccessDeniedPage />;
}

export default function App() {
  const [user, setUser] = useState(auth.getCachedUser());
  const [checking, setChecking] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    auth.restoreSession().then((restored) => {
      setUser(restored);
      setChecking(false);
    });
  }, []);

  useEffect(() => {
    return onSessionExpired(() => {
      setUser(null);
      setChecking(false);
      setSessionExpired(true);
    });
  }, []);

  useEffect(() => {
    // Test-only, UAT-closure capture: after the real session restore check
    // has settled, replay the app's own real session-expiry pathway (see
    // client.js uatState.simulateSessionExpired). A no-op unless the build
    // was produced with VITE_UAT_STATE_MODE=true and the page was opened
    // with ?uatState=session-expired.
    if (!checking && uatState.isEnabled() && uatState.mode() === "session-expired") {
      uatState.simulateSessionExpired();
    }
  }, [checking]);

  if (checking) {
    return <div className="p-8 text-orac-slate">Loading Orac-IOS...</div>;
  }

  if (!user) {
    // NEW — Phase 6: forgot/reset password and request-access must be
    // reachable while logged out. Previously "*" caught every path and
    // always rendered LoginPage, which would have swallowed these too.
    return (
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage onLogin={(nextUser) => { setSessionExpired(false); setUser(nextUser); }} sessionExpired={sessionExpired} />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/request-access" element={<RequestAccess />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/daily-timesheets/:id/print" element={<DailyTimesheetPrintPage />} />
      <Route path="/contractor-logs/:id/print" element={<ContractorLogPrintPage />} />
      <Route path="/*" element={
        <PortalLayout user={user} onLogout={() => { auth.logout(); setUser(null); }}>
          <Routes>
        <Route path="/" element={<DashboardPage user={user} />} />
        <Route path="/portal" element={<GuardedRoute user={user} path="/portal"><ClientPortalPage /></GuardedRoute>} />
        <Route path="/service-requests" element={<GuardedRoute user={user} path="/service-requests"><ServiceRequestTriagePage /></GuardedRoute>} />
        <Route path="/quotations" element={<GuardedRoute user={user} path="/quotations"><QuotationsPage user={user} /></GuardedRoute>} />
        <Route path="/finance" element={<GuardedRoute user={user} path="/finance"><FinanceCommercialPage /></GuardedRoute>} />
        <Route path="/internal-requests" element={<GuardedRoute user={user} path="/internal-requests"><InternalRequestsPage user={user} /></GuardedRoute>} />
        <Route path="/worksheets" element={<GuardedRoute user={user} path="/worksheets"><WorksheetsPage user={user} /></GuardedRoute>} />
        <Route path="/daily-timesheets" element={<GuardedRoute user={user} path="/daily-timesheets"><DailyTimesheetPage user={user} /></GuardedRoute>} />
        <Route path="/contractor-logs" element={<GuardedRoute user={user} path="/contractor-logs"><ContractorLogPage user={user} /></GuardedRoute>} />
        <Route path="/kiosk" element={<GuardedRoute user={user} path="/kiosk"><KioskModePage user={user} /></GuardedRoute>} />
        <Route path="/contracts" element={<GuardedRoute user={user} path="/contracts"><ContractsPage user={user} /></GuardedRoute>} />
        <Route path="/inventory" element={<GuardedRoute user={user} path="/inventory"><InventoryPage user={user} /></GuardedRoute>} />
        <Route path="/reports" element={<GuardedRoute user={user} path="/reports"><ReportsPage user={user} /></GuardedRoute>} />
        <Route path="/operational-data" element={<GuardedRoute user={user} path="/operational-data"><OperationalDataPage user={user} /></GuardedRoute>} />
        <Route path="/documents" element={<GuardedRoute user={user} path="/documents"><DocumentsPage user={user} /></GuardedRoute>} />
        <Route path="/admin" element={<GuardedRoute user={user} path="/admin"><AdminPage user={user} /></GuardedRoute>} />
        <Route path="*" element={<AccessDeniedPage />} />
          </Routes>
        </PortalLayout>
      } />
    </Routes>
  );
}
