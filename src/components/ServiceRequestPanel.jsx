import React, { useCallback, useEffect, useState } from "react";
import { serviceRequests } from "../api/client.js";
import DataTable from "./DataTable.jsx";
import { ICONS } from "./icons.jsx";
import { ErrorBanner, PageEmptyState } from "./PageStates.jsx";
import {
  EMPTY_SERVICE_REQUEST_FORM, SERVICE_REQUEST_LIMITS, SERVICE_REQUEST_URGENCY_OPTIONS,
  buildServiceRequestPayload, clientStatusLabel, statusTone, urgencyLabel, validateServiceRequestForm
} from "../serviceRequestModel.js";

// Client Viewer request form + the caller's own requests. The server derives the
// client and creator from the session and returns only this client's requests.
export default function ServiceRequestPanel() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState({ ...EMPTY_SERVICE_REQUEST_FORM });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      setItems(await serviceRequests.mine());
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setNotice("");
    const problem = validateServiceRequestForm(form);
    if (problem) { setFormError(problem); return; }
    setFormError("");
    setSubmitting(true);
    try {
      await serviceRequests.create(buildServiceRequestPayload(form));
      setForm({ ...EMPTY_SERVICE_REQUEST_FORM });
      setNotice("Your service request was submitted. Our team will review it and update the status here.");
      await load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const fieldClass = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-orac-blue focus:outline-none focus:ring-2 focus:ring-orac-blue/20";
  const labelClass = "mb-1 block text-xs font-medium uppercase tracking-wider text-gray-600";

  return (
    <section aria-labelledby="service-requests-heading" className="grid gap-6 lg:grid-cols-3">
      <form onSubmit={submit} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm lg:col-span-1">
        <h2 id="service-requests-heading" className="mb-4 text-sm font-semibold text-orac-slate">Request a service</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="sr-title" className={labelClass}>Title</label>
            <input id="sr-title" type="text" value={form.title} onChange={update("title")} maxLength={SERVICE_REQUEST_LIMITS.title} placeholder="e.g. Conveyor idler inspection" className={fieldClass} required />
          </div>
          <div>
            <label htmlFor="sr-need" className={labelClass}>What do you need?</label>
            <textarea id="sr-need" rows={4} value={form.service_need} onChange={update("service_need")} maxLength={SERVICE_REQUEST_LIMITS.serviceNeed} placeholder="Describe the work, the equipment and any site constraints." className={fieldClass} required />
          </div>
          <div>
            <label htmlFor="sr-urgency" className={labelClass}>Urgency</label>
            <select id="sr-urgency" value={form.urgency} onChange={update("urgency")} className={fieldClass}>
              {SERVICE_REQUEST_URGENCY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="sr-date" className={labelClass}>Requested date (optional)</label>
            <input id="sr-date" type="date" value={form.requested_date} onChange={update("requested_date")} className={fieldClass} />
          </div>
          {formError && <ErrorBanner message={formError} />}
          {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
          <button type="submit" disabled={submitting} className="w-full rounded-lg bg-orac-blue py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:brightness-105 disabled:opacity-50">
            {submitting ? "Submitting..." : "Submit request"}
          </button>
        </div>
      </form>

      <div className="lg:col-span-2">
        {loading ? (
          <div className="py-12 text-center text-orac-text-muted">Loading your service requests...</div>
        ) : loadError ? (
          <div className="space-y-3">
            <ErrorBanner message={loadError} />
            <button type="button" onClick={load} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-orac-slate hover:bg-gray-50">Try again</button>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
            <PageEmptyState iconPath={ICONS.clipboard} title="No service requests yet" subtitle="Requests you submit will appear here with their current status." />
          </div>
        ) : (
          <DataTable
            title="Your Service Requests"
            columns={["Request", "Urgency", "Requested", "Status", "Submitted"]}
            rows={items}
            emptyText="No service requests yet."
            renderRow={(item) => (
              <tr key={item.id} className="transition-colors hover:bg-gray-50">
                <td className="px-4 py-2.5 font-medium text-orac-slate">{item.title}</td>
                <td className="px-4 py-2.5 text-gray-600">{urgencyLabel(item.urgency)}</td>
                <td className="px-4 py-2.5 text-gray-500">{item.requested_date || "—"}</td>
                <td className="px-4 py-2.5"><span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusTone(item.status)}`}>{clientStatusLabel(item.status)}</span></td>
                <td className="px-4 py-2.5 text-gray-500">{item.created_at ? new Date(item.created_at).toLocaleDateString() : "—"}</td>
              </tr>
            )}
          />
        )}
      </div>
    </section>
  );
}
