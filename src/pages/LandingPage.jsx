import React, { useState } from "react";
import { Link } from "react-router-dom";
import { leads } from "../api/client.js";
import { Icon, ICONS } from "../components/icons.jsx";

const services = [
  { title: "Ceramic Wear Protection", text: "Alumina ceramic lining for transfer chutes, cyclones, hoppers and high-abrasion process zones.", icon: ICONS.warning },
  { title: "Rubber Lining", text: "Durable rubber lining for tanks, launders, pumps and mineral-processing equipment.", icon: ICONS.inventory },
  { title: "Conveyor Reliability", text: "Idler supply, conveyor inspection, planned maintenance and rapid field interventions.", icon: ICONS.truck }
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

  return <div className="min-h-screen bg-white text-orac-slate">
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-8">
        <a href="#top" className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-orac-blue text-white"><Icon path={ICONS.inventory} /></span><span><span className="block text-lg font-semibold">Orac Systems</span><span className="block text-xs font-semibold uppercase text-gray-500">Industrial service management</span></span></a>
        <nav className="hidden items-center gap-7 text-sm font-semibold text-gray-700 md:flex"><a className="hover:text-orac-blue" href="#services">Services</a><a className="hover:text-orac-blue" href="#industries">Industries</a><a className="hover:text-orac-blue" href="#contact">Contact</a><Link className="rounded-lg bg-orac-slate px-4 py-2.5 text-white transition hover:bg-slate-700" to="/login">Portal sign in</Link></nav>
      </div>
    </header>

    <main id="top">
      <section className="relative min-h-[680px] overflow-hidden bg-orac-slate">
        <img src="/images/orac-mining-service.png" alt="Industrial mineral processing equipment and conveyor maintenance environment" className="absolute inset-0 h-full w-full object-cover object-center" />
        <div className="absolute inset-0 bg-slate-950/70" />
        <div className="relative mx-auto flex min-h-[680px] max-w-7xl items-end px-6 pb-20 pt-32 lg:px-8"><div className="max-w-3xl text-white"><p className="text-sm font-semibold uppercase text-orac-blue">Mining maintenance and wear protection</p><h1 className="mt-5 text-5xl font-semibold leading-tight sm:text-6xl">Reliable field service for critical plant infrastructure.</h1><p className="mt-6 max-w-2xl text-lg leading-8 text-slate-200">Orac Systems helps mining operations protect equipment, control service work, and maintain the traceability required from quote to invoice.</p><div className="mt-9 flex flex-wrap gap-3"><a href="#contact" className="rounded-lg bg-orac-blue px-5 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-105">Request an intervention</a><Link to="/login" className="rounded-lg border border-white/50 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10">Open Orac-IOS</Link></div></div></div>
      </section>

      <section id="services" className="mx-auto max-w-7xl px-6 py-20 lg:px-8"><div className="max-w-2xl"><p className="text-sm font-semibold uppercase text-orac-blue">Service lines</p><h2 className="mt-3 text-3xl font-semibold">Built for abrasive, high-consequence operations.</h2><p className="mt-4 text-base leading-7 text-gray-600">From shutdown planning to urgent site response, the work is grounded in the plant, the equipment tag, and the approved commercial scope.</p></div><div className="mt-10 grid gap-5 lg:grid-cols-3">{services.map((service) => <article key={service.title} className="border border-slate-200 p-6 transition hover:-translate-y-1 hover:border-sky-300 hover:shadow-md"><span className="flex h-11 w-11 items-center justify-center rounded-lg bg-sky-50 text-orac-blue"><Icon path={service.icon} /></span><h3 className="mt-5 text-xl font-semibold">{service.title}</h3><p className="mt-3 leading-7 text-gray-600">{service.text}</p></article>)}</div></section>

      <section id="industries" className="border-y border-slate-200 bg-slate-50"><div className="mx-auto grid max-w-7xl gap-10 px-6 py-20 lg:grid-cols-[1.1fr_.9fr] lg:px-8"><div><p className="text-sm font-semibold uppercase text-orac-blue">Industrial context</p><h2 className="mt-3 text-3xl font-semibold">Every intervention stays connected to the plant.</h2><p className="mt-5 max-w-xl leading-7 text-gray-600">Orac-IOS links quotes, purchase orders, dispatch cards, worksheets and invoices to clients, mine sites, plant sections and equipment tags. That gives supervisors a credible operational record instead of disconnected spreadsheets.</p></div><dl className="grid grid-cols-2 gap-4"><div className="border border-slate-200 bg-white p-5"><dt className="text-sm text-gray-500">Commercial control</dt><dd className="mt-2 text-lg font-semibold">PO verified</dd></div><div className="border border-slate-200 bg-white p-5"><dt className="text-sm text-gray-500">Field delivery</dt><dd className="mt-2 text-lg font-semibold">Worksheet signed</dd></div><div className="border border-slate-200 bg-white p-5"><dt className="text-sm text-gray-500">Plant context</dt><dd className="mt-2 text-lg font-semibold">Tag mapped</dd></div><div className="border border-slate-200 bg-white p-5"><dt className="text-sm text-gray-500">Finance readiness</dt><dd className="mt-2 text-lg font-semibold">Invoice controlled</dd></div></dl></div></section>

      <section id="contact" className="mx-auto max-w-7xl px-6 py-20 lg:px-8"><div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr]"><div><p className="text-sm font-semibold uppercase text-orac-blue">Site intervention</p><h2 className="mt-3 text-3xl font-semibold">Tell us what the plant needs.</h2><p className="mt-4 leading-7 text-gray-600">Send an enquiry for planned maintenance, shutdown support, wear protection, conveyor work or an urgent operational issue.</p><div className="mt-8 space-y-4 text-sm text-gray-700"><p className="flex gap-3"><span className="text-orac-blue"><Icon path={ICONS.building} /></span>Mining, concentrator and smelter environments</p><p className="flex gap-3"><span className="text-orac-blue"><Icon path={ICONS.clipboard} /></span>Commercially controlled quote-to-invoice workflow</p><p className="flex gap-3"><span className="text-orac-blue"><Icon path={ICONS.truck} /></span>Planned and urgent field service response</p></div></div><form onSubmit={submitLead} className="border border-slate-200 bg-white p-6 shadow-sm"><div className="grid gap-5 sm:grid-cols-2"><label className="text-sm font-semibold">Company<input required value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} className="mt-2 w-full border border-slate-300 px-3 py-2.5 outline-none focus:border-orac-blue focus:ring-2 focus:ring-sky-100" /></label><label className="text-sm font-semibold">Contact name<input required value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} className="mt-2 w-full border border-slate-300 px-3 py-2.5 outline-none focus:border-orac-blue focus:ring-2 focus:ring-sky-100" /></label><label className="text-sm font-semibold">Email<input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-2 w-full border border-slate-300 px-3 py-2.5 outline-none focus:border-orac-blue focus:ring-2 focus:ring-sky-100" /></label><label className="text-sm font-semibold">Phone<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-2 w-full border border-slate-300 px-3 py-2.5 outline-none focus:border-orac-blue focus:ring-2 focus:ring-sky-100" /></label><label className="text-sm font-semibold sm:col-span-2">Mine site or plant<input value={form.mine_site} onChange={(e) => setForm({ ...form, mine_site: e.target.value })} className="mt-2 w-full border border-slate-300 px-3 py-2.5 outline-none focus:border-orac-blue focus:ring-2 focus:ring-sky-100" /></label><label className="text-sm font-semibold sm:col-span-2">Service need<textarea required rows="4" value={form.service_need} onChange={(e) => setForm({ ...form, service_need: e.target.value })} className="mt-2 w-full resize-y border border-slate-300 px-3 py-2.5 outline-none focus:border-orac-blue focus:ring-2 focus:ring-sky-100" /></label><label className="text-sm font-semibold">Urgency<select value={form.urgency} onChange={(e) => setForm({ ...form, urgency: e.target.value })} className="mt-2 w-full border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-orac-blue focus:ring-2 focus:ring-sky-100"><option value="standard">Standard</option><option value="planned_shutdown">Planned shutdown</option><option value="urgent_downtime">Urgent downtime</option></select></label></div>{status.message && <p className={`mt-5 border px-4 py-3 text-sm ${status.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>{status.message}</p>}<button disabled={busy} className="mt-6 rounded-lg bg-orac-slate px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60">{busy ? "Submitting..." : "Submit service request"}</button></form></div></section>
    </main>
    <footer className="bg-orac-slate py-8 text-slate-300"><div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 text-sm sm:flex-row sm:items-center sm:justify-between lg:px-8"><p>Orac Systems Integrated Operations &amp; Service Portal</p><Link className="font-semibold text-white hover:text-orac-blue" to="/login">Portal sign in</Link></div></footer>
  </div>;
}
