import React, { useEffect, useState } from "react";
import { summary, reports } from "../api/client.js";
import { ErrorBanner } from "../components/PageStates.jsx";
import StatCard from "../components/StatCard.jsx";

// Deliberately uses zero external chart dependencies (no recharts/chart.js
// assumed) since this repo's package.json wasn't available to confirm
// what's installed. Bars are plain divs sized by percentage — works
// anywhere Tailwind (or even just these inline styles) renders.
function Bar({ label, value, max }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="mb-2.5">
      <div className="mb-1 flex justify-between text-sm text-gray-600">
        <span>{label.replace(/_/g, " ")}</span>
        <span className="font-semibold tabular-nums text-gray-900">{value}</span>
      </div>
      <div className="h-2 rounded bg-gray-100">
        <div
          className="h-2 rounded bg-orac-blue"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const [stats, setStats] = useState(null);
  const [pipeline, setPipeline] = useState(null);
  const [poCompliance, setPoCompliance] = useState(null);
  const [worksheetReport, setWorksheetReport] = useState(null);
  const [variance, setVariance] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      summary.get(),
      reports.get("pipeline"),
      reports.get("po-compliance"),
      reports.get("worksheets"),
      reports.get("variance")
    ])
      .then(([s, p, poc, w, v]) => {
        setStats(s);
        setPipeline(p);
        setPoCompliance(poc);
        setWorksheetReport(w);
        setVariance(v);
      })
      .catch((err) => setError(err.message));
  }, []);

  if (error) {
    return (
      <ErrorBanner message={`Could not load analytics: ${error}. Some of these reports are limited to specific roles — you may not have access to every panel below.`} />
    );
  }

  if (!stats) return <p className="text-sm text-gray-500">Loading analytics…</p>;

  const pipelineCounts = pipeline?.counts || {};
  const maxPipeline = Math.max(1, ...Object.values(pipelineCounts));
  const totalVariance = (variance || []).reduce((sum, v) => sum + (v.variance || 0), 0);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-orac-blue">Analytics</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Clients" value={stats.clients} />
        <StatCard label="Quotes" value={stats.quotes} />
        <StatCard label="Dispatches" value={stats.dispatches} />
        <StatCard label="Invoices" value={stats.invoices} />
        <StatCard label="Pending PO" value={stats.pending_po} />
        <StatCard label="Amendments blocked" value={stats.blocked_amendments} />
        <StatCard label="Timesheets awaiting review" value={worksheetReport?.pending_review?.length ?? 0} />
        <StatCard label="Total PO variance" value={totalVariance} />
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="mb-3 text-base font-semibold text-orac-blue">Quote pipeline by status</h2>
        {Object.keys(pipelineCounts).length === 0 && (
          <p className="text-sm text-gray-500">No quotes yet.</p>
        )}
        {Object.entries(pipelineCounts).map(([status, count]) => (
          <Bar key={status} label={status} value={count} max={maxPipeline} />
        ))}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="mb-3 text-base font-semibold text-orac-blue">PO compliance</h2>
        <div className="grid grid-cols-1 gap-5 text-sm sm:grid-cols-3">
          <div>
            <p className="mb-1.5 font-medium text-gray-600">
              Approved, awaiting PO ({poCompliance?.approved_awaiting_po?.length || 0})
            </p>
            <ul className="space-y-0.5 text-orac-blue">
              {(poCompliance?.approved_awaiting_po || []).slice(0, 5).map((q) => (
                <li key={q.id}>{q.quote_number}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-1.5 font-medium text-gray-600">
              Requires amendment ({poCompliance?.requires_amendment?.length || 0})
            </p>
            <ul className="space-y-0.5 text-orac-blue">
              {(poCompliance?.requires_amendment || []).slice(0, 5).map((po) => (
                <li key={po.id}>{po.po_reference} (logged {po.logged_value} vs {po.po_amount})</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-1.5 font-medium text-gray-600">
              Urgent, pending verification ({poCompliance?.urgent_pending_verification?.length || 0})
            </p>
            <ul className="space-y-0.5 text-orac-blue">
              {(poCompliance?.urgent_pending_verification || []).slice(0, 5).map((po) => (
                <li key={po.id}>{po.id}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="mb-3 text-base font-semibold text-orac-blue">Worksheet backlog</h2>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-semibold text-orac-blue">
              {worksheetReport?.pending_review?.length ?? 0}
            </div>
            <div className="mt-1 text-sm text-gray-600">Pending review</div>
          </div>
          <div>
            <div className="text-2xl font-semibold text-orac-blue">
              {worksheetReport?.returned_for_correction?.length ?? 0}
            </div>
            <div className="mt-1 text-sm text-gray-600">Returned for correction</div>
          </div>
          <div>
            <div className="text-2xl font-semibold text-orac-blue">
              {worksheetReport?.approved_count ?? 0}
            </div>
            <div className="mt-1 text-sm text-gray-600">Approved</div>
          </div>
        </div>
      </section>
    </div>
  );
}
