import React, { useEffect, useState } from "react";
import { collections, documents } from "../api/client.js";

const INPUT = "min-h-[44px] w-full rounded-md border border-orac-border bg-white p-2 text-sm dark:bg-transparent";

// Admin/Operations only (server enforces downloadTimesheetPeriodPack). Builds the
// client period pack PDF for one client, optionally narrowed to a site, technician
// or task, with Supervisor-approved kiosk time as a separate, labelled section.
export default function PeriodPackPanel({ worksheets }) {
  const [clients, setClients] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [dispatches, setDispatches] = useState([]);
  const [sites, setSites] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ client_id: "", from: today.slice(0, 8) + "01", to: today, site: "", technician_id: "", dispatch_id: "", include_kiosk: false });

  useEffect(() => {
    Promise.all([
      collections.list("clients"), collections.list("quotes"), collections.list("dispatch_cards"),
      collections.list("mine_sites").catch(() => [])
    ]).then(([c, q, d, s]) => { setClients(c || []); setQuotes(q || []); setDispatches(d || []); setSites(s || []); })
      .catch((err) => setLoadError(err.message));
  }, []);

  const clientOf = (dispatchRow) => quotes.find((q) => q.id === dispatchRow.quotation_id)?.client_id;
  const clientDispatches = dispatches.filter((d) => form.client_id && clientOf(d) === form.client_id);
  const technicians = [...new Map((worksheets || []).filter((w) => w.technician_id).map((w) => [w.technician_id, w.technician_name || w.technician_id])).entries()];

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value, ...(key === "client_id" ? { dispatch_id: "" } : {}) }));

  async function download(e) {
    e.preventDefault();
    setMessage("");
    if (!form.client_id) { setMessage("Choose a client first. A pack always covers one client only."); return; }
    setBusy(true);
    try { await documents.periodPackPdf(form); setMessage("Period pack downloaded."); }
    catch (err) { setMessage(err.message); }
    finally { setBusy(false); }
  }

  return (
    <section aria-labelledby="period-pack-heading" className="rounded-xl border border-orac-border bg-white p-5 shadow-sm dark:bg-transparent">
      <h2 id="period-pack-heading" className="text-base font-semibold text-orac-heading">Client period pack (PDF)</h2>
      <p className="mb-3 text-sm text-orac-secondary">
        Includes only this client's client-acknowledged or Supervisor-approved Timesheets, grouped by technician and day.
        The PDF is built from the source records each time and is never stored.
      </p>
      {loadError && <p role="alert" className="mb-2 text-sm text-red-700">Could not load the lists: {loadError}</p>}
      <form onSubmit={download} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div><label htmlFor="pp-client" className="mb-1 block text-sm font-medium text-orac-slate">Client</label>
          <select id="pp-client" value={form.client_id} onChange={set("client_id")} className={INPUT}><option value="">Select client...</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div><label htmlFor="pp-from" className="mb-1 block text-sm font-medium text-orac-slate">From</label><input id="pp-from" type="date" value={form.from} onChange={set("from")} className={INPUT} required /></div>
        <div><label htmlFor="pp-to" className="mb-1 block text-sm font-medium text-orac-slate">To</label><input id="pp-to" type="date" value={form.to} onChange={set("to")} className={INPUT} required /></div>
        <div><label htmlFor="pp-site" className="mb-1 block text-sm font-medium text-orac-slate">Site (optional)</label>
          <select id="pp-site" value={form.site} onChange={set("site")} className={INPUT}><option value="">All sites</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        <div><label htmlFor="pp-tech" className="mb-1 block text-sm font-medium text-orac-slate">Technician (optional)</label>
          <select id="pp-tech" value={form.technician_id} onChange={set("technician_id")} className={INPUT}><option value="">All technicians</option>{technicians.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></div>
        <div><label htmlFor="pp-task" className="mb-1 block text-sm font-medium text-orac-slate">Task / dispatch (optional)</label>
          <select id="pp-task" value={form.dispatch_id} onChange={set("dispatch_id")} className={INPUT} disabled={!form.client_id}><option value="">All tasks</option>{clientDispatches.map((d) => <option key={d.id} value={d.id}>{d.dispatch_number || d.id}</option>)}</select></div>
        <label className="flex min-h-[44px] items-center gap-2 text-sm text-orac-slate sm:col-span-2 lg:col-span-3">
          <input type="checkbox" checked={form.include_kiosk} onChange={set("include_kiosk")} className="h-5 w-5" />
          Also list Supervisor-approved kiosk time (shown separately, marked as not client-acknowledged)
        </label>
        <div className="sm:col-span-2 lg:col-span-3">
          <button type="submit" disabled={busy} className="min-h-[44px] rounded-lg bg-orac-navy px-5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Preparing..." : "Download period pack PDF"}</button>
          {message && <p role="status" className="mt-2 text-sm text-orac-secondary">{message}</p>}
        </div>
      </form>
    </section>
  );
}
