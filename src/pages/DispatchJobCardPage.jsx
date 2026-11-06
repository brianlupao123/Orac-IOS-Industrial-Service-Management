import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { assistant, dispatch, documents } from "../api/client.js";
import { canAccessRoute } from "../accessPolicy.js";
import PageHeaderBanner from "../components/PageHeaderBanner.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { ErrorBanner, PageEmptyState } from "../components/PageStates.jsx";
import RecordAnalysisModal from "../components/RecordAnalysisModal.jsx";
import { ICONS } from "../components/icons.jsx";
import { recordAnalysisVisible } from "../recordAnalysisFlags.js";
import LegacyInvoiceDraftPanel from "../components/LegacyInvoiceDraftPanel.jsx";

const timesheetLabels = [
  ["draft", "Draft"],
  ["awaiting_client", "Awaiting client"],
  ["awaiting_supervisor", "Awaiting supervisor"],
  ["approved", "Approved"],
  ["returned", "Returned"]
];

function EvidenceMetric({ label, value }) {
  return <div className="border-l border-slate-200 pl-3 first:border-l-0 first:pl-0"><dt className="text-xs font-medium text-slate-500">{label}</dt><dd className="mt-1 text-lg font-semibold tabular-nums text-orac-slate">{value ?? 0}</dd></div>;
}

export default function DispatchJobCardPage({ user }) {
  const { id } = useParams();
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [analysisError, setAnalysisError] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const analysisVisible = recordAnalysisVisible();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    dispatch.jobCard(id)
      .then((result) => { if (!cancelled) setCard(result); })
      .catch((err) => { if (!cancelled) setError(err.message || "The Job Card could not be loaded."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  async function downloadPdf() {
    if (!id || downloading) return;
    setDownloading(true);
    setError("");
    try { await documents.download("dispatch_cards", id); }
    catch (err) { setError(err.message || "The Job Card PDF could not be downloaded."); }
    finally { setDownloading(false); }
  }

  async function analyzeDispatch() {
    if (!id || analyzing) return;
    setAnalyzing(true);
    setAnalysisError("");
    try {
      setAnalysis(await assistant.recordAnalysis("dispatch", id));
    } catch (err) {
      setAnalysisError(err.message || "The dispatch evidence analysis could not be loaded.");
    } finally {
      setAnalyzing(false);
    }
  }

  if (loading) return <div data-evidence="job-card-loading" className="py-16 text-center text-sm text-slate-500">Loading Job Card...</div>;
  if (error && !card) return <div className="space-y-4"><ErrorBanner message={error} /><Link className="text-sm font-semibold text-orac-blue hover:underline" to="/reports">Back to reports</Link></div>;
  if (!card?.identity) return <PageEmptyState iconPath={ICONS.truck} title="Job Card unavailable" subtitle="No authorised Job Card was returned for this dispatch." />;

  const { identity, workflow = {}, assignment = {}, evidence_summary: evidence = {}, exceptions = {}, capabilities = {} } = card;
  const canQuote = canAccessRoute(user.role, "/quotations") && workflow.quotation?.id;
  const canFinance = canAccessRoute(user.role, "/finance") && workflow.purchase_order?.id;
  const sheetCounts = evidence.timesheets || {};
  const invoiceBlock = exceptions.invoice_readiness;

  return <main data-evidence="dispatch-job-card" className="min-w-0 space-y-5">
    <PageHeaderBanner
      eyebrow="Controlled operational record"
      title={identity.dispatch_number || identity.id}
      subtitle={`${identity.client?.name || "Client not recorded"} ${identity.scheduled_start ? `| Scheduled ${identity.scheduled_start}` : ""}`}
      iconPath={ICONS.truck}
      aside={<StatusBadge status={identity.status} />}
      action={{ label: downloading ? "Preparing..." : "Download PDF", onClick: downloadPdf }}
      meta={[identity.site_id ? `Site: ${identity.site_id}` : "Site not recorded", "Read-only evidence summary"]}
    />
    {error && <ErrorBanner message={error} />}
    {analysisError && <ErrorBanner message={analysisError} />}

    <section aria-labelledby="job-card-workflow" className="border-y border-slate-200 bg-white px-5 py-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 id="job-card-workflow" className="text-base font-semibold text-orac-slate dark:text-white">Workflow record</h2>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <div><dt className="text-xs font-medium text-slate-500">Quotation</dt><dd className="mt-1 text-sm font-semibold text-orac-slate dark:text-slate-100">{workflow.quotation?.quote_number || workflow.quotation?.id || "Not linked"}{canQuote && <Link className="ml-2 text-orac-blue hover:underline" to={`/quotations?quote=${encodeURIComponent(workflow.quotation.id)}`}>Open</Link>}</dd></div>
        <div><dt className="text-xs font-medium text-slate-500">Purchase order</dt><dd className="mt-1 text-sm font-semibold text-orac-slate dark:text-slate-100">{workflow.purchase_order?.po_reference || workflow.purchase_order?.id || "Not linked"}{canFinance && <Link className="ml-2 text-orac-blue hover:underline" to={`/finance?po=${encodeURIComponent(workflow.purchase_order.id)}`}>Open</Link>}</dd></div>
        <div><dt className="text-xs font-medium text-slate-500">Quotation status</dt><dd className="mt-1 text-sm text-slate-700 dark:text-orac-text-muted">{workflow.quotation?.status || "Not available"}</dd></div>
        <div><dt className="text-xs font-medium text-slate-500">PO status</dt><dd className="mt-1 text-sm text-slate-700 dark:text-orac-text-muted">{workflow.purchase_order?.status || "Not available"}</dd></div>
      </dl>
    </section>

    <section aria-labelledby="job-card-evidence" className="border-y border-slate-200 bg-white px-5 py-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 id="job-card-evidence" className="text-base font-semibold text-orac-slate dark:text-white">Evidence summary</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <EvidenceMetric label="Timesheets" value={evidence.timesheets?.total} />
        {timesheetLabels.map(([key, label]) => <EvidenceMetric key={key} label={label} value={sheetCounts[key]} />)}
      </div>
      <div className="mt-5 grid gap-4 border-t border-slate-200 pt-5 sm:grid-cols-3 dark:border-slate-800">
        <EvidenceMetric label="Material usage records" value={evidence.material_usage?.count} />
        <EvidenceMetric label="Tracked material records" value={evidence.material_usage?.tracked_item_count} />
        <EvidenceMetric label="Low stock signals" value={evidence.material_usage?.low_stock_count} />
      </div>
      {assignment.assigned_supervisor && <p className="mt-5 text-sm text-slate-600 dark:text-orac-text-muted">Supervisor: <span className="font-semibold text-orac-slate dark:text-white">{assignment.assigned_supervisor.name || assignment.assigned_supervisor.id}</span></p>}
      {Array.isArray(assignment.roster) && assignment.roster.length > 0 && <p className="mt-2 text-sm text-slate-600 dark:text-orac-text-muted">Assigned team: {assignment.roster.map((person) => person.name || person.id).join(", ")}</p>}
    </section>

    <section aria-labelledby="job-card-exceptions" className="border-y border-slate-200 bg-white px-5 py-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 id="job-card-exceptions" className="text-base font-semibold text-orac-slate dark:text-white">Controls and exceptions</h2>
      <div className="mt-4 space-y-3 text-sm">
        {exceptions.started_before_po && <p data-evidence="job-card-started-before-po" className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">Legacy exception: this dispatch started before purchase-order verification. It does not authorise new work without a verified PO.</p>}
        {invoiceBlock && <p data-evidence="job-card-invoice-readiness" className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">Pricing review: {invoiceBlock.message || invoiceBlock.code}. No invoice is created from this page.</p>}
        {!exceptions.started_before_po && !invoiceBlock && <p className="text-slate-600">No current exception was returned for this Job Card.</p>}
      </div>
      <p className="mt-4 text-xs text-slate-500">Record trail: {evidence.audit?.available ? `${evidence.audit.event_count || 0} authorised events available` : "not available to this role"}. Actions remain governed by server permissions.</p>
      <div className="mt-4 flex flex-wrap gap-3">
        {capabilities.can_create_timesheet && <Link to="/worksheets" className="inline-flex min-h-10 items-center text-sm font-semibold text-orac-blue hover:underline">Open Timesheets</Link>}
        {analysisVisible && <button type="button" disabled={analyzing} onClick={analyzeDispatch} className="min-h-10 rounded-md border border-gray-300 px-3 text-sm font-semibold text-orac-slate hover:bg-gray-50 disabled:opacity-50">{analyzing ? "Analyzing..." : "Analyze evidence"}</button>}
      </div>
    </section>
    <RecordAnalysisModal title="Dispatch evidence analysis" analysis={analysis} onClose={() => setAnalysis(null)} />
  </main>;
}
