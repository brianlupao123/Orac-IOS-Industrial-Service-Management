import React, { useEffect, useState } from "react";
import { worksheets } from "../api/client.js";
import { StatusPill, formatWhen } from "./WorksheetEvidence.jsx";
import { canAcknowledgeWorksheet } from "../fieldStatusModel.js";

// Client Viewer only. The client representative acknowledges ORAC's Timesheets for
// their own client. This is authenticated: the server records the signed-in account,
// the typed name and declared role, an explicit confirmation and the time. There is
// no drawn signature here and none is treated as acknowledgement. It is separate from
// ORAC's internal Supervisor approval, which the client cannot give.
export default function ClientAcknowledgementPanel() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [forms, setForms] = useState({});

  async function load() {
    setLoading(true);
    setError("");
    try { setRows((await worksheets.listOwnClient()) || []); }
    catch (err) { setRows([]); setError(err.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const form = (id) => forms[id] || { signer_name: "", signer_role: "", confirmed: false };
  const patch = (id, change) => setForms((prev) => ({ ...prev, [id]: { ...form(id), ...change } }));

  async function acknowledge(row) {
    const f = form(row.id);
    setError("");
    setNotice("");
    if (!f.signer_name.trim() || !f.signer_role.trim()) { setError("Enter your full name and your role."); return; }
    if (!f.confirmed) { setError("Tick the confirmation box to acknowledge this work."); return; }
    try {
      await worksheets.clientAcknowledge(row.id, { signer_name: f.signer_name.trim(), signer_role: f.signer_role.trim() });
      setNotice("Acknowledged. ORAC's Supervisor will now review it internally.");
      setForms((prev) => ({ ...prev, [row.id]: undefined }));
      await load();
    } catch (err) { setError(err.message); }
  }

  const waiting = rows.filter((row) => canAcknowledgeWorksheet("Client Viewer", row));
  const done = rows.filter((row) => !canAcknowledgeWorksheet("Client Viewer", row) && !row.superseded_by);

  return (
    <section aria-labelledby="client-ack-heading" className="rounded-xl border border-orac-border bg-white p-5 shadow-sm dark:bg-transparent">
      <h2 id="client-ack-heading" className="text-base font-semibold text-orac-heading">Work awaiting your acknowledgement</h2>
      <p className="mb-3 text-sm text-orac-secondary">
        Acknowledging confirms the work was done on your site. It is recorded against your sign-in.
        It does not approve ORAC's internal review, which ORAC's Supervisor does separately.
      </p>
      {error && <p role="alert" className="mb-2 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="mb-2 text-sm text-emerald-700">{notice}</p>}
      {loading ? <p className="text-sm text-orac-secondary">Loading...</p> : waiting.length === 0 ? (
        <p className="text-sm text-orac-secondary">Nothing is waiting for your acknowledgement.</p>
      ) : (
        <ul className="space-y-3">
          {waiting.map((row) => {
            const f = form(row.id);
            return (
              <li key={row.id} className="rounded-lg border border-orac-border p-4 text-sm">
                <p className="font-semibold text-orac-slate">{row.dispatch_number || row.dispatch_card_id} · {row.work_date} · {row.hours} h</p>
                <p className="text-orac-secondary">Technician: {row.technician_name || "Not recorded"}{row.mine_site_name ? ` · ${row.mine_site_name}` : ""}</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor={`ack-name-${row.id}`} className="mb-1 block text-xs font-medium text-orac-slate">Your full name</label>
                    <input id={`ack-name-${row.id}`} value={f.signer_name} onChange={(e) => patch(row.id, { signer_name: e.target.value })} className="min-h-[44px] w-full rounded-md border border-orac-border bg-white p-2 dark:bg-transparent" autoComplete="name" />
                  </div>
                  <div>
                    <label htmlFor={`ack-role-${row.id}`} className="mb-1 block text-xs font-medium text-orac-slate">Your role</label>
                    <input id={`ack-role-${row.id}`} value={f.signer_role} onChange={(e) => patch(row.id, { signer_role: e.target.value })} className="min-h-[44px] w-full rounded-md border border-orac-border bg-white p-2 dark:bg-transparent" placeholder="e.g. Site Manager" />
                  </div>
                </div>
                <label className="mt-3 flex min-h-[44px] items-start gap-2 text-orac-slate">
                  <input type="checkbox" checked={f.confirmed} onChange={(e) => patch(row.id, { confirmed: e.target.checked })} className="mt-1 h-5 w-5" />
                  <span>I confirm the work and hours above were carried out on our site.</span>
                </label>
                <button type="button" onClick={() => acknowledge(row)} className="mt-2 min-h-[44px] rounded-lg bg-orac-blue px-5 text-sm font-semibold text-white">Acknowledge this work</button>
              </li>
            );
          })}
        </ul>
      )}
      {done.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 text-sm font-semibold text-orac-secondary">Already acknowledged or approved</h3>
          <ul className="space-y-2">
            {done.map((row) => (
              <li key={row.id} className="flex flex-col gap-1 rounded-lg border border-orac-border p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span>{row.dispatch_number || row.dispatch_card_id} · {row.work_date} · {row.hours} h</span>
                <span className="text-xs text-orac-secondary">{row.client_acknowledgement ? `Acknowledged by ${row.client_acknowledgement.signer_name}, ${formatWhen(row.client_acknowledgement.acknowledged_at)}` : ""}</span>
                <StatusPill status={row.status} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
