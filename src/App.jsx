import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { auth, onSessionExpired } from "./api/client.js";
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
import KioskModePage from "./pages/KioskModePage.jsx";
import ContractsPage from "./pages/ContractsPage.jsx";
import PortalLayout from "./layouts/PortalLayout.jsx";

export default function App() {
  const [user, setUser] = useState(auth.getCachedUser());
  const [checking, setChecking] = useState(true);

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
    });
  }, []);

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
        <Route path="/login" element={<LoginPage onLogin={setUser} />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/request-access" element={<RequestAccess />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  return (
    <PortalLayout user={user} onLogout={() => { auth.logout(); setUser(null); }}>
      <Routes>
        <Route path="/" element={<DashboardPage user={user} />} />
        {canAccessRoute(user.role, "/portal") ? (
          <Route path="/portal" element={<ClientPortalPage />} />
        ) : (
          <>
            {canAccessRoute(user.role, "/worksheets") && <Route path="/worksheets" element={<WorksheetsPage user={user} />} />}
            {canAccessRoute(user.role, "/kiosk") && (
              <>
              <Route path="/kiosk" element={<KioskModePage user={user} />} />
              <Route path="/contracts" element={<ContractsPage user={user} />} />
              </>
            )}
            {canAccessRoute(user.role, "/inventory") && (
              <Route path="/inventory" element={<InventoryPage user={user} />} />
            )}
            {canAccessRoute(user.role, "/reports") && (
              <Route path="/reports" element={<ReportsPage user={user} />} />
            )}
            {canAccessRoute(user.role, "/admin") && (
              <Route path="/admin" element={<AdminPage user={user} />} />
            )}
          </>
        )}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </PortalLayout>
  );
}
