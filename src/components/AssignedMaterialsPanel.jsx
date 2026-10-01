import React, { useEffect, useState } from "react";
import { dispatch as dispatchApi } from "../api/client.js";
import { materialStockLabel, materialStockTone } from "../fieldStatusModel.js";

const TONE = {
  green: "text-emerald-700 dark:text-emerald-300",
  amber: "text-amber-800 dark:text-amber-300",
  red: "text-red-700 dark:text-red-300",
  slate: "text-orac-secondary"
};

// Plain-language stock status for materials already used on ONE assigned job. It
// reads the assigned-job endpoint, never the stock catalog, so a field role sees
// only the items on their own job.
export function MaterialRows({ items }) {
  if (!items.length) return <p className="text-sm text-orac-secondary">No materials have been recorded on this job yet.</p>;
  return (
    <ul className="divide-y divide-orac-border">
      {items.map((item) => (
        <li key={item.catalog_item_id} className="flex flex-col gap-1 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span className="font-medium text-orac-slate">{item.item_name} <span className="font-normal text-orac-secondary">({item.item_code})</span></span>
          <span className="text-orac-secondary">Used on this job: {item.used_on_this_dispatch} {item.unit_of_measure}</span>
          <span className={`font-semibold ${TONE[materialStockTone(item)]}`}>{materialStockLabel(item)}</span>
        </li>
      ))}
    </ul>
  );
}

export default function AssignedMaterialsPanel({ dispatches }) {
  const [jobId, setJobId] = useState("");
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!jobId) { setItems([]); setError(""); return; }
    let cancelled = false;
    setLoading(true);
    setError("");
    dispatchApi.materialStatus(jobId)
      .then((rows) => { if (!cancelled) setItems(rows || []); })
      .catch((err) => { if (!cancelled) { setItems([]); setError(err.message); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [jobId]);

  return (
    <section aria-labelledby="materials-heading" className="rounded-xl border border-orac-border bg-white p-5 shadow-sm dark:bg-transparent">
      <h2 id="materials-heading" className="text-base font-semibold text-orac-heading">Materials on an assigned job</h2>
      <p className="mb-3 text-sm text-orac-secondary">Pick a job to see whether the materials used on it are in stock, low or out of stock.</p>
      <label htmlFor="materials-job" className="mb-1 block text-sm font-medium text-orac-slate">Job</label>
      <select id="materials-job" value={jobId} onChange={(e) => setJobId(e.target.value)} className="mb-3 min-h-[44px] w-full rounded-md border border-orac-border bg-white p-2 text-sm dark:bg-transparent sm:max-w-md">
        <option value="">Select a job...</option>
        {dispatches.map((d) => <option key={d.id} value={d.id}>{d.dispatch_number || d.id}</option>)}
      </select>
      {error && <p role="alert" className="text-sm text-red-700">Could not load materials: {error}</p>}
      {loading ? <p className="text-sm text-orac-secondary">Loading...</p> : jobId && !error && <MaterialRows items={items} />}
    </section>
  );
}
