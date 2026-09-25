import React, { useEffect, useState } from "react";
import { collections, documents } from "../api/client.js";
import DataTable from "../components/DataTable.jsx";
import PageHeaderBanner from "../components/PageHeaderBanner.jsx";
import { ErrorBanner } from "../components/PageStates.jsx";
import { ICONS } from "../components/icons.jsx";

const access = {
  quotes: ["Admin", "Management", "Sales", "Finance", "Operations", "Client Viewer"],
  purchase_orders: ["Admin", "Management", "Finance", "Operations", "Client Viewer"],
  dispatch_cards: ["Admin", "Management", "Finance", "Operations", "Supervisor", "Technician"],
  field_worksheets: ["Admin", "Management", "Operations", "Supervisor", "Technician", "Client Viewer"],
  invoices: ["Admin", "Management", "Finance", "Client Viewer"]
};

const labels = { quotes: "Quotes", purchase_orders: "Purchase Orders", dispatch_cards: "Job Cards", field_worksheets: "Timesheets", invoices: "Invoices" };

export default function DocumentsPage({ user }) {
  const available = Object.keys(access).filter((name) => access[name].includes(user.role));
  const [records, setRecords] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all(available.map(async (name) => [name, await collections.list(name)]))
      .then((items) => { if (active) setRecords(Object.fromEntries(items)); })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user.role]);

  async function download(type, id) {
    setDownloading(`${type}:${id}`); setError("");
    try { await documents.download(type, id); } catch (err) { setError(err.message); } finally { setDownloading(""); }
  }

  return <div data-evidence="documents-ready" className="mx-auto max-w-7xl space-y-6">
    <PageHeaderBanner eyebrow="Controlled records" title="Documents" subtitle="Download authorised PDF records across the quote-to-invoice workflow." iconPath={ICONS.document} />
    {error && <ErrorBanner message={error} />}
    {loading ? <div data-evidence="documents-loading" className="py-16 text-center text-sm text-slate-500">Loading authorised documents...</div> : available.map((type) => <DocumentTable key={type} type={type} rows={records[type] || []} downloading={downloading} onDownload={download} />)}
  </div>;
}

function DocumentTable({ type, rows, downloading, onDownload }) {
  const titleField = type === "quotes" ? "quote_number" : type === "purchase_orders" ? "po_reference" : type === "dispatch_cards" ? "dispatch_number" : type === "invoices" ? "invoice_number" : "id";
  return <section className="border-y border-slate-200 bg-white px-5 py-5"><DataTable title={labels[type]} columns={["Record", "Status", "Document"]} rows={rows} emptyText={`No authorised ${labels[type].toLowerCase()} found.`} renderRow={(row) => <tr key={row.id} className="hover:bg-slate-50"><td className="px-5 py-3 text-sm font-medium text-orac-slate">{row[titleField] || row.id}</td><td className="px-5 py-3 text-sm text-slate-600">{row.status || "-"}</td><td className="px-5 py-3"><button type="button" disabled={downloading === `${type}:${row.id}`} onClick={() => onDownload(type, row.id)} className="rounded-md border border-orac-blue px-3 py-1.5 text-sm font-semibold text-orac-blue hover:bg-sky-50 disabled:opacity-50">{downloading === `${type}:${row.id}` ? "Preparing..." : "Download PDF"}</button></td></tr>} /></section>;
}
