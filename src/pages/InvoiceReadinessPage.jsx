import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { dispatch } from "../api/client.js";
import PageHeaderBanner from "../components/PageHeaderBanner.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { ErrorBanner, PageEmptyState } from "../components/PageStates.jsx";
import { ICONS } from "../components/icons.jsx";
import { formatMoney, formatNumber } from "../lib/format.js";

function Metric({ label, value }) {
  return <div className="border-l border-slate-200 pl-3 first:border-l-0 first:pl-0"><dt className="text-xs font-medium text-slate-500">{label}</dt><dd className="mt-1 text-lg font-semibold tabular-nums text-orac-slate dark:text-white">{value}</dd></div>;
}

function amount(value) {
  return Number.isFinite(Number(value)) ? formatMoney(value) : "Not recorded";
}

export default function InvoiceReadinessPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    dispatch.invoiceReadiness(id)
      .then((result) => { if (!cancelled) setData(result); })
      .catch((err) => { if (!cancelled) setError(err.message || "Invoice readiness could not be loaded."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  if (loading) return <div data-evidence="invoice-readiness-loading" className="py-16 text-center text-sm text-slate-500">Loading invoice readiness...</div>;
  if (error && !data) return <div className="space-y-4"><ErrorBanner message={error} /><Link className="text-sm font-semibold text-orac-blue hover:underline" to="/reports">Back to reports</Link></div>;
  if (!data?.dispatch) return <PageEmptyState iconPath={ICONS.money} title="Invoice readiness unavailable" subtitle="No authorised invoice-readiness record was returned for this dispatch." />;

  const { dispatch: job, workflow = {}, evidence = {}, commercial = {}, readiness = {} } = data;
  const blocker = readiness.blocker;
  const calculation = commercial.calculated_invoice;
  const v5 = workflow.quotation?.v5_commercial_workflow;

  return <main data-evidence="invoice-readiness-page" className="min-w-0 space-y-5">
    <PageHeaderBanner
      eyebrow="Controlled commercial review"
      title={job.dispatch_number || job.id}
      subtitle="Read-only evidence and approval checks. This page never creates an invoice."
      iconPath={ICONS.money}
      aside={<StatusBadge status={readiness.ready_for_invoice_review ? "Ready for review" : "Blocked"} />}
      meta={[`Currency: ${commercial.currency || "USD"}`, job.status || "Dispatch status not recorded"]}
    />
    {error && <ErrorBanner message={error} />}

    <section aria-labelledby="invoice-readiness-status" className="border-y border-slate-200 bg-white px-5 py-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 id="invoice-readiness-status" className="text-base font-semibold text-orac-slate dark:text-white">Readiness decision</h2>
      {blocker ? <div data-evidence="invoice-readiness-blocker" className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"><p className="font-semibold">{blocker.code}</p><p className="mt-1">{blocker.message}</p></div> : <p data-evidence="invoice-readiness-ready" className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">The current server checks allow this dispatch into the Invoice Ready report. Invoice creation remains a separate controlled action.</p>}
    </section>

    <section aria-labelledby="invoice-readiness-evidence" className="border-y border-slate-200 bg-white px-5 py-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 id="invoice-readiness-evidence" className="text-base font-semibold text-orac-slate dark:text-white">Evidence reviewed by the server</h2>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Metric label="Timesheets" value={`${evidence.worksheets?.approved ?? 0} approved of ${evidence.worksheets?.total ?? 0}`} />
        <Metric label="Billable entries" value={formatNumber(evidence.billable_time?.entry_count ?? 0)} />
        <Metric label="Billable hours" value={formatNumber(evidence.billable_time?.hours ?? 0)} />
        <Metric label="Material records" value={formatNumber(evidence.material_usage_count ?? 0)} />
        <Metric label="Kiosk review pending" value={formatNumber(evidence.kiosk_review_pending_count ?? 0)} />
      </dl>
    </section>

    <section aria-labelledby="invoice-readiness-commercial" className="border-y border-slate-200 bg-white px-5 py-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 id="invoice-readiness-commercial" className="text-base font-semibold text-orac-slate dark:text-white">Commercial authority</h2>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Quotation" value={workflow.quotation?.quote_number || "Not linked"} />
        <Metric label="PO" value={workflow.purchase_order?.po_reference || "Not linked"} />
        <Metric label="Verified PO amount" value={amount(commercial.po_amount)} />
        <Metric label="Remaining PO amount" value={amount(commercial.remaining_po_amount)} />
      </dl>
      {v5 ? <p data-evidence="v5-invoice-calculation-blocked" className="mt-5 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-orac-text-muted">V5 calculation remains unavailable. This page does not estimate or expose a V5 invoice amount.</p> : <dl className="mt-5 grid gap-4 border-t border-slate-200 pt-5 sm:grid-cols-3 dark:border-slate-800"><Metric label="Calculated labour" value={amount(calculation?.labor_amount)} /><Metric label="Calculated materials" value={amount(calculation?.material_amount)} /><Metric label="Calculated total" value={amount(calculation?.total_amount)} /></dl>}
      <p className="mt-5 text-xs text-slate-500">PO amendment required: {workflow.purchase_order?.requires_amendment ? "Yes" : "No"}. Existing invoice amount against this PO: {amount(commercial.previously_invoiced_amount)}.</p>
    </section>

    <Link className="inline-flex min-h-10 items-center text-sm font-semibold text-orac-blue hover:underline" to="/reports">Back to reports</Link>
  </main>;
}
