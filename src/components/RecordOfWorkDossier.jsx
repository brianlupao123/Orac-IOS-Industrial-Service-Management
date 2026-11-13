import React, { useEffect, useState } from "react";
import Modal from "./Modal.jsx";
import Button from "./ui/Button.jsx";
import Badge from "./ui/Badge.jsx";
import Input from "./ui/Input.jsx";
import Select from "./ui/Select.jsx";
import StatusBadge from "./StatusBadge.jsx";
import { collections } from "../api/client.js";
import { formatMoney } from "../lib/format.js";

export default function RecordOfWorkDossier({ isOpen, onClose, initialClient = null, initialSite = null }) {
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState([]);
  const [mineSites, setMineSites] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [dateFrom, setDateFrom] = useState("2026-10-01");
  const [dateTo, setDateTo] = useState("2026-10-31");

  // Operational collections
  const [quotes, setQuotes] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [dispatches, setDispatches] = useState([]);
  const [worksheets, setWorksheets] = useState([]);
  const [monthlyWorksheets, setMonthlyWorksheets] = useState([]);
  const [invoices, setInvoices] = useState([]);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);

    Promise.all([
      collections.list("clients").catch(() => []),
      collections.list("mine_sites").catch(() => []),
      collections.list("quotes").catch(() => []),
      collections.list("contracts").catch(() => []),
      collections.list("dispatch_cards").catch(() => []),
      collections.list("field_worksheets").catch(() => []),
      collections.list("monthly_worksheets").catch(() => []),
      collections.list("invoices").catch(() => [])
    ])
      .then(([cls, sites, q, c, d, w, mw, inv]) => {
        setClients(cls || []);
        setMineSites(sites || []);
        setQuotes(q || []);
        setContracts(c || []);
        setDispatches(d || []);
        setWorksheets(w || []);
        setMonthlyWorksheets(mw || []);
        setInvoices(inv || []);

        if (initialClient?.id) {
          setSelectedClientId(initialClient.id);
        } else if (cls && cls.length > 0) {
          setSelectedClientId(cls[0].id);
        }

        if (initialSite?.id) {
          setSelectedSiteId(initialSite.id);
        }
      })
      .finally(() => setLoading(false));
  }, [isOpen, initialClient, initialSite]);

  if (!isOpen) return null;

  const activeClient = clients.find((c) => c.id === selectedClientId) || clients[0] || null;
  const filteredSites = mineSites.filter((s) => !selectedClientId || s.client_id === selectedClientId);
  const activeSite = mineSites.find((s) => s.id === selectedSiteId) || null;

  // Filter records by client and date duration
  const clientQuotes = quotes.filter((q) => {
    const matchesClient = !selectedClientId || q.client_id === selectedClientId;
    const matchesSite = !selectedSiteId || q.mine_site_id === selectedSiteId;
    return matchesClient && matchesSite;
  });

  const clientContracts = contracts.filter((c) => {
    const matchesClient = !selectedClientId || c.client_id === selectedClientId;
    return matchesClient;
  });

  const clientWorksheets = worksheets.filter((w) => {
    const matchesClient = !selectedClientId || w.client_id === selectedClientId || (w.client_name && activeClient && w.client_name.toLowerCase().includes(activeClient.name.toLowerCase()));
    const matchesSite = !selectedSiteId || w.mine_site_id === selectedSiteId || (w.mine_site_name && activeSite && w.mine_site_name.toLowerCase().includes(activeSite.name.toLowerCase()));
    const shiftDate = w.shift_date || w.date || "";
    const inDateRange = (!dateFrom || shiftDate >= dateFrom) && (!dateTo || shiftDate <= dateTo);
    return matchesClient && matchesSite && inDateRange;
  });

  const clientMonthlyWorksheets = monthlyWorksheets.filter((mw) => {
    const matchesClient = !selectedClientId || mw.client_id === selectedClientId;
    const matchesSite = !selectedSiteId || mw.mine_site_id === selectedSiteId;
    return matchesClient && matchesSite;
  });

  const clientInvoices = invoices.filter((inv) => {
    const matchesClient = !selectedClientId || inv.client_id === selectedClientId;
    return matchesClient;
  });

  // Calculate metrics
  const totalNormalHours = clientWorksheets.reduce((sum, w) => sum + Number(w.normal_hours || 0), 0);
  const totalOt15Hours = clientWorksheets.reduce((sum, w) => sum + Number(w.ot_15_hours || w.overtime_15_hours || 0), 0);
  const totalOt20Hours = clientWorksheets.reduce((sum, w) => sum + Number(w.ot_20_hours || w.overtime_20_hours || 0), 0);
  const totalManHours = totalNormalHours + totalOt15Hours + totalOt20Hours;

  // Compute deployed workers
  const workerMap = new Map();
  for (const w of clientWorksheets) {
    const name = w.technician_name || w.worker_name || "Unassigned";
    const trade = w.trade || "Technician";
    const normal = Number(w.normal_hours || 0);
    const ot15 = Number(w.ot_15_hours || w.overtime_15_hours || 0);
    const ot20 = Number(w.ot_20_hours || w.overtime_20_hours || 0);
    const prev = workerMap.get(name) || { name, trade, shifts: 0, normal: 0, ot15: 0, ot20: 0 };
    workerMap.set(name, {
      name,
      trade,
      shifts: prev.shifts + 1,
      normal: prev.normal + normal,
      ot15: prev.ot15 + ot15,
      ot20: prev.ot20 + ot20,
      total: prev.normal + normal + prev.ot15 + ot15 + prev.ot20 + ot20
    });
  }
  const deployedWorkers = Array.from(workerMap.values());

  function handlePrint() {
    window.print();
  }

  function setPreset(preset) {
    if (preset === "oct_2026") {
      setDateFrom("2026-10-01");
      setDateTo("2026-10-31");
    } else if (preset === "all") {
      setDateFrom("");
      setDateTo("");
    }
  }

  return (
    <Modal title="Record of Work — 360° Operational Dossier" isOpen={isOpen} onClose={onClose} maxWidth="max-w-6xl">
      <div className="space-y-6">
        {/* Search & Scope Controls — Hidden on Print */}
        <div className="print:hidden rounded-xl border border-orac-border-default bg-orac-canvas p-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-ux-caption font-semibold text-orac-text-primary">Select Client</label>
              <Select
                value={selectedClientId}
                onChange={(e) => {
                  setSelectedClientId(e.target.value);
                  setSelectedSiteId("");
                }}
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-ux-caption font-semibold text-orac-text-primary">Mine Site / Project</label>
              <Select
                value={selectedSiteId}
                onChange={(e) => setSelectedSiteId(e.target.value)}
              >
                <option value="">All Mine Sites & Projects</option>
                {filteredSites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.location ? `(${s.location})` : ""}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-ux-caption font-semibold text-orac-text-primary">Date From</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-ux-caption font-semibold text-orac-text-primary">Date To</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-orac-border-default/60">
            <div className="flex items-center gap-2">
              <span className="text-ux-caption text-orac-text-muted">Duration Presets:</span>
              <Button variant="secondary" onClick={() => setPreset("oct_2026")}>October 2026</Button>
              <Button variant="secondary" onClick={() => setPreset("all")}>All Available</Button>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={handlePrint}>🖨️ Print Official Dossier</Button>
              <Button variant="primary" onClick={onClose}>Close</Button>
            </div>
          </div>
        </div>

        {/* Printable Official Dossier Container */}
        <div className="rounded-xl border border-orac-border-default bg-orac-surface p-6 shadow-xs space-y-6">
          {/* Header Banner */}
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-orac-border-default pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-ux-title font-bold text-orac-text-primary">
                  {activeClient ? activeClient.name : "Client Record"}
                </span>
                <Badge tone="info">
                  {activeSite ? activeSite.name : "All Assigned Sites"}
                </Badge>
              </div>
              <p className="mt-1 text-ux-body text-orac-text-secondary">
                Integrated Record of Work — Commercial Scope, Field Execution, Worksheets & Billing
              </p>
              <div className="mt-2 text-ux-caption text-orac-text-muted">
                Audit Period: <span className="font-semibold text-orac-text-primary">{dateFrom || "Earliest"}</span> to <span className="font-semibold text-orac-text-primary">{dateTo || "Latest"}</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-ux-caption font-bold tracking-wider text-orac-accent uppercase">HANDON ENTERPRISES P/L t/a</span>
              <div className="text-ux-section font-black text-orac-text-primary">ORAC SYSTEMS</div>
              <span className="text-ux-caption text-orac-text-muted">Operational Dossier · Verified Audit</span>
            </div>
          </div>

          {/* KPI Snapshot Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg border border-orac-border-default bg-orac-canvas p-3.5">
              <span className="text-ux-caption font-semibold text-orac-text-muted">Certified Shifts</span>
              <div className="text-ux-title font-bold text-orac-text-primary mt-1">{clientWorksheets.length}</div>
            </div>
            <div className="rounded-lg border border-orac-border-default bg-orac-canvas p-3.5">
              <span className="text-ux-caption font-semibold text-orac-text-muted">Total Man-Hours</span>
              <div className="text-ux-title font-bold text-orac-accent mt-1">{totalManHours.toFixed(1)}h</div>
              <span className="text-ux-caption text-orac-text-muted mt-0.5 block">{totalNormalHours.toFixed(0)}h Norm | {(totalOt15Hours + totalOt20Hours).toFixed(0)}h OT</span>
            </div>
            <div className="rounded-lg border border-orac-border-default bg-orac-canvas p-3.5">
              <span className="text-ux-caption font-semibold text-orac-text-muted">Deployed Technicians</span>
              <div className="text-ux-title font-bold text-orac-text-primary mt-1">{deployedWorkers.length}</div>
            </div>
            <div className="rounded-lg border border-orac-border-default bg-orac-canvas p-3.5">
              <span className="text-ux-caption font-semibold text-orac-text-muted">Commercial Quotations</span>
              <div className="text-ux-title font-bold text-orac-text-primary mt-1">{clientQuotes.length}</div>
            </div>
          </div>

          {/* Section 1: Commercial Scope (Quotes & POs) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-orac-border-default/60 pb-2">
              <span className="text-ux-label font-bold text-orac-text-primary">1. Commercial Scope (Quotations & Client POs)</span>
              <Badge tone="neutral">{clientQuotes.length} quotes</Badge>
            </div>
            {clientQuotes.length === 0 ? (
              <p className="text-ux-caption text-orac-text-muted italic py-2">No commercial quotes registered for this scope.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-orac-border-default">
                <table className="w-full text-left text-ux-caption border-collapse">
                  <thead>
                    <tr className="bg-orac-canvas border-b border-orac-border-default text-orac-text-primary">
                      <th className="px-3 py-2 font-semibold">Quote Reference</th>
                      <th className="px-3 py-2 font-semibold">Scope / Description</th>
                      <th className="px-3 py-2 font-semibold">Client PO #</th>
                      <th className="px-3 py-2 font-semibold">Status</th>
                      <th className="px-3 py-2 font-semibold text-right">Value (USD)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-orac-border-default bg-orac-surface">
                    {clientQuotes.map((q) => (
                      <tr key={q.id}>
                        <td className="px-3 py-2 font-semibold text-orac-accent">{q.quote_number || q.id}</td>
                        <td className="px-3 py-2 text-orac-text-primary">{q.title || q.scope_of_work || "Site Works"}</td>
                        <td className="px-3 py-2 font-mono text-orac-text-secondary">{q.po_number || q.client_po || "—"}</td>
                        <td className="px-3 py-2"><StatusBadge status={q.status || "Draft"} /></td>
                        <td className="px-3 py-2 text-right font-mono font-semibold text-orac-text-primary">{formatMoney(q.total_amount || q.grand_total || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section 2: Field Manpower & Certified Timesheets */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-orac-border-default/60 pb-2">
              <span className="text-ux-label font-bold text-orac-text-primary">2. Field Execution & Deployed Manpower ({deployedWorkers.length} Personnel)</span>
              <span className="text-ux-caption text-orac-text-muted">{clientWorksheets.length} logged shifts</span>
            </div>
            {deployedWorkers.length === 0 ? (
              <p className="text-ux-caption text-orac-text-muted italic py-2">No field timesheets recorded for this duration.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-orac-border-default">
                <table className="w-full text-left text-ux-caption border-collapse">
                  <thead>
                    <tr className="bg-orac-canvas border-b border-orac-border-default text-orac-text-primary">
                      <th className="px-3 py-2 font-semibold">Personnel Name</th>
                      <th className="px-3 py-2 font-semibold">Trade</th>
                      <th className="px-3 py-2 font-semibold text-center">Shifts Logged</th>
                      <th className="px-3 py-2 font-semibold text-right">Normal (h)</th>
                      <th className="px-3 py-2 font-semibold text-right">OT 1.5 (h)</th>
                      <th className="px-3 py-2 font-semibold text-right">OT 2.0 (h)</th>
                      <th className="px-3 py-2 font-semibold text-right">Total Hours</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-orac-border-default bg-orac-surface">
                    {deployedWorkers.map((w) => (
                      <tr key={w.name}>
                        <td className="px-3 py-2 font-semibold text-orac-text-primary">{w.name}</td>
                        <td className="px-3 py-2"><Badge tone="neutral">{w.trade}</Badge></td>
                        <td className="px-3 py-2 text-center text-orac-text-secondary">{w.shifts}</td>
                        <td className="px-3 py-2 text-right font-mono text-orac-text-primary">{w.normal.toFixed(1)}</td>
                        <td className="px-3 py-2 text-right font-mono text-orac-text-secondary">{w.ot15.toFixed(1)}</td>
                        <td className="px-3 py-2 text-right font-mono text-orac-text-secondary">{w.ot20.toFixed(1)}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-orac-accent">{w.total.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-orac-canvas font-semibold border-t border-orac-border-strong text-orac-text-primary">
                      <td colSpan={3} className="px-3 py-2 text-right">Certified Total:</td>
                      <td className="px-3 py-2 text-right font-mono">{totalNormalHours.toFixed(1)}</td>
                      <td className="px-3 py-2 text-right font-mono">{totalOt15Hours.toFixed(1)}</td>
                      <td className="px-3 py-2 text-right font-mono">{totalOt20Hours.toFixed(1)}</td>
                      <td className="px-3 py-2 text-right font-mono text-orac-accent font-bold">{totalManHours.toFixed(1)}h</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Section 3: Monthly Worksheets & Billing Status */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-orac-border-default/60 pb-2">
              <span className="text-ux-label font-bold text-orac-text-primary">3. Monthly Worksheets & Client Invoicing</span>
              <Badge tone="success">Finance Audit Ready</Badge>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-orac-border-default p-3 space-y-2 bg-orac-canvas">
                <span className="text-ux-caption font-bold text-orac-text-primary">Certified Registers</span>
                {clientMonthlyWorksheets.length === 0 ? (
                  <p className="text-ux-caption text-orac-text-muted italic">No consolidated monthly registers finalized.</p>
                ) : (
                  clientMonthlyWorksheets.map((mw) => (
                    <div key={mw.id} className="flex items-center justify-between text-ux-caption py-1 border-b border-orac-border-default/50 last:border-none">
                      <span className="font-semibold text-orac-text-primary">{mw.month_period || mw.period || "Period"}</span>
                      <StatusBadge status={mw.status || "Certified"} />
                    </div>
                  ))
                )}
              </div>
              <div className="rounded-lg border border-orac-border-default p-3 space-y-2 bg-orac-canvas">
                <span className="text-ux-caption font-bold text-orac-text-primary">Billing & Invoices</span>
                {clientInvoices.length === 0 ? (
                  <p className="text-ux-caption text-orac-text-muted italic">No commercial invoices generated for this selection.</p>
                ) : (
                  clientInvoices.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between text-ux-caption py-1 border-b border-orac-border-default/50 last:border-none">
                      <span className="font-semibold text-orac-text-primary">{inv.invoice_number || inv.id}</span>
                      <span className="font-mono text-orac-text-primary">{formatMoney(inv.total_amount || 0)}</span>
                      <StatusBadge status={inv.status || "Issued"} />
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Sign-off / Verification Footer */}
          <div className="pt-6 border-t border-orac-border-default grid grid-cols-2 sm:grid-cols-3 gap-6 text-ux-caption text-orac-text-muted">
            <div>
              <span className="block font-semibold text-orac-text-primary">Prepared By:</span>
              <div className="h-10 border-b border-dashed border-orac-border-strong mt-1"></div>
              <span className="mt-1 block">ORAC Site Supervisor / Admin</span>
            </div>
            <div>
              <span className="block font-semibold text-orac-text-primary">Client Verification:</span>
              <div className="h-10 border-b border-dashed border-orac-border-strong mt-1"></div>
              <span className="mt-1 block">Client Resident Engineer</span>
            </div>
            <div className="hidden sm:block">
              <span className="block font-semibold text-orac-text-primary">Finance Authorization:</span>
              <div className="h-10 border-b border-dashed border-orac-border-strong mt-1"></div>
              <span className="mt-1 block">Commercial Accounts Head</span>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
