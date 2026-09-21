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
import AccessDeniedPage from "./pages/AccessDeniedPage.jsx";

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
    <PortalLayout user={user} onLogout={() => { auth.logout(); setUser(null); }}>
      <Routes>
        <Route path="/" element={<DashboardPage user={user} />} />
        <Route path="/portal" element={<GuardedRoute user={user} path="/portal"><ClientPortalPage /></GuardedRoute>} />
        <Route path="/worksheets" element={<GuardedRoute user={user} path="/worksheets"><WorksheetsPage user={user} /></GuardedRoute>} />
        <Route path="/kiosk" element={<GuardedRoute user={user} path="/kiosk"><KioskModePage user={user} /></GuardedRoute>} />
        <Route path="/contracts" element={<GuardedRoute user={user} path="/contracts"><ContractsPage user={user} /></GuardedRoute>} />
        <Route path="/inventory" element={<GuardedRoute user={user} path="/inventory"><InventoryPage user={user} /></GuardedRoute>} />
        <Route path="/reports" element={<GuardedRoute user={user} path="/reports"><ReportsPage user={user} /></GuardedRoute>} />
        <Route path="/admin" element={<GuardedRoute user={user} path="/admin"><AdminPage user={user} /></GuardedRoute>} />
        <Route path="*" element={<AccessDeniedPage />} />
      </Routes>
    </PortalLayout>
  );
}
