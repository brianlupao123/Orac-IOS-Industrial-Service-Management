import React, { useState, useEffect } from "react";
import { collections } from "../api/client.js";
import { Icon, ICONS } from "../components/icons.jsx";
import PageHeaderBanner from "../components/PageHeaderBanner.jsx";

export default function ContractsPage({ user }) {
  const [contracts, setContracts] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [cData, sData, clData] = await Promise.all([
          collections.list("contracts").catch(() => ({ data: [] })),
          collections.list("maintenance_schedules").catch(() => ({ data: [] })),
          collections.list("clients").catch(() => ({ data: [] }))
        ]);
        
        setContracts(cData.data || []);
        setSchedules(sData.data || []);
        setClients(clData.data || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const getClientName = (id) => {
    const client = clients.find(c => c.id === id);
    return client ? client.name : "Unknown Client";
  };

  if (loading) return <div className="p-8 text-center text-orac-secondary">Loading Contracts...</div>;
  if (error) return (
    <div className="p-8 text-center">
      <p className="text-red-600 mb-4">{error}</p>
      <button onClick={() => window.location.reload()} className="px-4 py-2 bg-orac-navy text-white rounded">Retry</button>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeaderBanner 
        title="Contracts & Maintenance" 
        subtitle="Manage recurring SLAs and scheduled preventative maintenance."
        
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contracts List */}
        <div className="bg-white rounded-xl shadow-sm border border-orac-border overflow-hidden">
          <div className="p-4 border-b border-orac-border bg-orac-surface flex justify-between items-center">
            <h2 className="text-lg font-bold text-orac-heading flex items-center">
              <Icon path={ICONS.document} className="h-5 w-5 mr-2 text-orac-navy" />
              Active Contracts
            </h2>
            <button className="text-sm bg-orac-navy text-white px-3 py-1.5 rounded hover:bg-orac-navy/90">
              New Contract
            </button>
          </div>
          <div className="divide-y divide-orac-border">
            {contracts.length === 0 ? (
              <p className="p-6 text-center text-orac-secondary text-sm">No active contracts found.</p>
            ) : contracts.map(c => (
              <div key={c.id} className="p-4 hover:bg-orac-surface/50">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-orac-navy">{c.contract_number}</h3>
                  <span className={`px-2 py-1 text-xs rounded-full font-medium ${c.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                    {c.status || "Active"}
                  </span>
                </div>
                <p className="text-sm text-orac-slate mb-1">Client: {getClientName(c.client_id)}</p>
                <p className="text-xs text-orac-muted">Value: {c.total_value ? `$${c.total_value.toLocaleString()}` : 'N/A'}</p>
                <div className="mt-3 flex gap-4 text-xs text-orac-slate">
                  <span>Start: {c.start_date}</span>
                  <span>End: {c.end_date}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Maintenance Schedules */}
        <div className="bg-white rounded-xl shadow-sm border border-orac-border overflow-hidden">
          <div className="p-4 border-b border-orac-border bg-orac-surface flex justify-between items-center">
            <h2 className="text-lg font-bold text-orac-heading flex items-center">
              <Icon path={ICONS.clock} className="h-5 w-5 mr-2 text-orac-cyan" />
              Preventative Maintenance
            </h2>
            <button className="text-sm bg-orac-navy text-white px-3 py-1.5 rounded hover:bg-orac-navy/90">
              Add Schedule
            </button>
          </div>
          <div className="divide-y divide-orac-border">
            {schedules.length === 0 ? (
              <p className="p-6 text-center text-orac-secondary text-sm">No maintenance schedules found.</p>
            ) : schedules.map(s => (
              <div key={s.id} className="p-4 hover:bg-orac-surface/50">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-orac-slate">Asset: {s.asset_id || "Unassigned"}</h3>
                  <span className="px-2 py-1 text-xs rounded-full font-medium bg-amber-100 text-amber-800">
                    {s.frequency || "Monthly"}
                  </span>
                </div>
                <p className="text-sm text-orac-navy font-medium mb-1">Contract: {s.contract_id}</p>
                <div className="mt-3 flex justify-between items-center text-xs">
                  <span className="text-orac-muted">Last Service: {s.last_service_date || "Never"}</span>
                  <span className="text-orac-cyan font-medium">Next Due: {s.next_due_date}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
