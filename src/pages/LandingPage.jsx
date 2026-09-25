import React, { useState } from "react";
import { Link } from "react-router-dom";
import { leads } from "../api/client.js";
import { Icon, ICONS } from "../components/icons.jsx";
import ThemeToggle from "../components/ThemeToggle.jsx";

const stages = [
  { code: "Q-1042", label: "Quote", state: "Approved", tone: "bg-sky-100 text-sky-800" },
  { code: "PO-88213", label: "Purchase order", state: "Verified", tone: "bg-emerald-100 text-emerald-800" },
  { code: "JC-514", label: "Dispatch", state: "In progress", tone: "bg-amber-100 text-amber-800" },
  { code: "WS-1102", label: "Worksheet", state: "Approved", tone: "bg-emerald-100 text-emerald-800" },
  { code: "INV-5012", label: "Invoice", state: "Issued", tone: "bg-sky-100 text-sky-800" }
];

const checkpoints = [
  ["PO control", "A normal dispatch requires a verified purchase order. Urgent work remains flagged until the commercial record is complete."],
  ["Field evidence", "A supervisor-approved Timesheet is required before invoice processing can continue."],
  ["Client isolation", "Client records are server-scoped so a client only sees work belonging to its organisation."]
];

export default function LandingPage() {
  const [form, setForm] = useState({ company_name: "", contact_name: "", email: "", phone: "", mine_site: "", service_need: "", urgency: "standard" });
  const [status, setStatus] = useState({ type: "", message: "" });
  const [busy, setBusy] = useState(false);

  async function submitLead(event) {
    event.preventDefault();
    setBusy(true);
    setStatus({ type: "", message: "" });
    try {
      await leads.create(form);
      setStatus({ type: "success", message: "Your service request has been received. Our team will contact you shortly." });
      setForm({ company_name: "", contact_name: "", email: "", phone: "", mine_site: "", service_need: "", urgency: "standard" });
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  }

  const update = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  return <div className="min-h-screen bg-slate-50 text-slate-900">
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex min-h-20 max-w-7xl items-center justify-between gap-4 px-6 lg:px-8">
        <a href="#top" className="flex items-center gap-3" aria-label="Orac-IOS home">
          <img src="/images/orac-systems-logo.png" alt="Orac Systems" className="h-11 w-11 rounded-full bg-white object-contain" />
          <span><span className="block text-base font-bold text-slate-800">ORAC-IOS</span><span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Operations portal</span></span>
        </a>
        <div className="flex items-center gap-3 sm:gap-5">
          <a className="hidden text-sm font-medium text-slate-600 hover:text-slate-950 sm:inline" href="https://oracsystems.co.zw" target="_blank" rel="noreferrer">Orac Systems</a>
          <ThemeToggle />
          <Link className="rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700" to="/login">Sign in</Link>
        </div>
      </div>
    </header>

    <main id="top">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-16 lg:grid-cols-[1.05fr_.95fr] lg:px-8 lg:py-24">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-wide text-sky-700">Orac Systems operational portal</p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight text-slate-950 sm:text-5xl">Control service work from quote to invoice.</h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">Orac-IOS records the approvals, field evidence, and commercial checks behind each mining-service job. It is the working system, not a second company brochure.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/login" className="rounded-md bg-orac-navy px-5 py-3 text-sm font-semibold text-white transition hover:bg-orac-ink">Sign in to the portal</Link>
              <a href="#request" className="rounded-md border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition hover:border-slate-500">Request service</a>
            </div>
            <p className="mt-5 text-sm text-slate-500">Looking for company services, projects, or contacts? <a className="font-semibold text-sky-700 hover:underline" href="https://oracsystems.co.zw" target="_blank" rel="noreferrer">Visit Orac Systems</a>.</p>
          </div>
          <div className="border border-slate-200 bg-slate-50 p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4"><div><p className="text-sm font-semibold text-slate-900">Job control record</p><p className="mt-1 text-sm text-slate-500">One connected operational trail</p></div><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">CONTROLLED</span></div>
            <ol className="mt-4 space-y-0">{stages.map((stage, index) => <li key={stage.label} className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 border-b border-slate-200 py-4 last:border-b-0"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">{index + 1}</span><span><span className="block font-mono text-xs font-semibold text-slate-500">{stage.code}</span><span className="mt-1 block text-sm font-semibold text-slate-800">{stage.label}</span></span><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${stage.tone}`}>{stage.state}</span></li>)}</ol>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-7xl px-6 py-14 lg:px-8"><div className="max-w-2xl"><p className="text-sm font-bold uppercase tracking-wide text-sky-700">Built-in controls</p><h2 className="mt-3 text-3xl font-semibold text-slate-950">Every handover has evidence behind it.</h2></div><div className="mt-9 grid gap-6 md:grid-cols-3">{checkpoints.map(([title, text], index) => <article key={title} className="border-t-4 border-slate-900 bg-white p-6 shadow-sm"><p className="text-sm font-bold text-sky-700">0{index + 1}</p><h3 className="mt-5 text-lg font-semibold text-slate-900">{title}</h3><p className="mt-3 text-sm leading-6 text-slate-600">{text}</p></article>)}</div></div>
      </section>

      <section id="request" className="bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-16 lg:grid-cols-[.8fr_1.2fr] lg:px-8"><div><p className="text-sm font-bold uppercase tracking-wide text-sky-700">Service request</p><h2 className="mt-3 text-3xl font-semibold text-slate-950">Start with the work that needs doing.</h2><p className="mt-4 max-w-md leading-7 text-slate-600">Submit a site request and the sales team can create the controlled commercial record in Orac-IOS.</p></div><form onSubmit={submitLead} className="border border-slate-200 bg-slate-50 p-6 shadow-sm"><div className="grid gap-5 sm:grid-cols-2"><Field label="Company name" value={form.company_name} onChange={update("company_name")} required /><Field label="Contact name" value={form.contact_name} onChange={update("contact_name")} required /><Field label="Email" type="email" value={form.email} onChange={update("email")} required /><Field label="Phone" type="tel" value={form.phone} onChange={update("phone")} /><Field className="sm:col-span-2" label="Mine site or plant" value={form.mine_site} onChange={update("mine_site")} /><label className="text-sm font-semibold text-slate-800 sm:col-span-2">Service need<textarea required rows="4" value={form.service_need} onChange={update("service_need")} className="mt-2 w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" /></label><label className="text-sm font-semibold text-slate-800">Urgency<select value={form.urgency} onChange={update("urgency")} className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"><option value="standard">Standard</option><option value="planned_shutdown">Planned shutdown</option><option value="urgent_downtime">Urgent downtime</option></select></label></div>{status.message && <p className={`mt-5 border px-4 py-3 text-sm ${status.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>{status.message}</p>}<button disabled={busy} className="mt-6 rounded-md bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60">{busy ? "Submitting..." : "Submit service request"}</button></form></div>
      </section>
    </main>
    <footer className="border-t border-slate-200 bg-slate-950 text-slate-300"><div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-7 text-sm sm:flex-row sm:items-center sm:justify-between lg:px-8"><p>Orac-IOS · Orac Industrial Operations System</p><Link className="font-semibold text-white hover:text-sky-300" to="/login">Portal sign in</Link></div></footer>
  </div>;
}

function Field({ label, type = "text", value, onChange, required = false, className = "" }) {
  return <label className={`text-sm font-semibold text-slate-800 ${className}`}>{label}<input required={required} type={type} value={value} onChange={onChange} className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" /></label>;
}
