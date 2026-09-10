import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { auth } from "./api/client.js";
import LoginPage from "./pages/LoginPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import WorksheetsPage from "./pages/WorksheetsPage.jsx";
import InventoryPage from "./pages/InventoryPage.jsx";
import ReportsPage from "./pages/ReportsPage.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import ClientPortalPage from "./pages/ClientPortalPage.jsx";
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

  if (checking) {
    return <div className="p-8 text-orac-slate">Loading Orac-IOS...</div>;
  }

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage onLogin={setUser} />} />
      </Routes>
    );
  }

  return (
    <PortalLayout user={user} onLogout={() => { auth.logout(); setUser(null); }}>
      <Routes>
        <Route path="/" element={<DashboardPage user={user} />} />
        {user.role === "Client Viewer" ? (
          <Route path="/portal" element={<ClientPortalPage />} />
        ) : (
          <>
            <Route path="/worksheets" element={<WorksheetsPage user={user} />} />
            {(user.role === "Admin" || user.role === "Management" || user.role === "Operations") && (
              <Route path="/inventory" element={<InventoryPage />} />
            )}
            {(user.role === "Admin" || user.role === "Management" || user.role === "Finance") && (
              <Route path="/reports" element={<ReportsPage />} />
            )}
            {user.role === "Admin" && (
              <Route path="/admin" element={<AdminPage user={user} />} />
            )}
          </>
        )}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </PortalLayout>
  );
}