import React, { useState } from "react";
import { Link } from "react-router-dom";
import { leads } from "../api/client.js";
import ThemeToggle from "../components/ThemeToggle.jsx";
import BrandMark from "../components/ui/BrandMark.jsx";
import Button from "../components/ui/Button.jsx";
import Field from "../components/ui/Field.jsx";
import Input from "../components/ui/Input.jsx";
import Select from "../components/ui/Select.jsx";
import Textarea from "../components/ui/Textarea.jsx";

const journey = [
  ["01", "Service request", "Client", "Clients log the site work, equipment tag and urgency straight into the operations queue."],
  ["02", "Quote and approval", "Sales and Management", "Fixed-scope quotes in USD with the approved tax rule applied, then a second person signs off."],
  ["03", "Dispatch and timesheets", "Operations and Field", "Technicians get a job card, record real hours (even offline on site) and the client signs them."],
  ["04", "Invoice and settlement", "Finance", "Billing readiness matches approved timesheets to the verified purchase order before an invoice can be issued."]
];

// What each role actually opens, taken from the portal's route policy.
const roles = [
  { id: "client", name: "Client", lead: "See your work without phoning for updates.", points: ["Submit service requests with site, equipment and urgency", "Review and accept quotations", "Check the job card scope and sign off field worksheets", "Download documents and view your contracts"] },
  { id: "sales", name: "Sales", lead: "From enquiry to approved quote in one place.", points: ["Triage incoming service requests", "Draft and send quotations", "Capture signed paper timesheets", "Follow job cards and invoice readiness"] },
  { id: "operations", name: "Operations", lead: "Dispatch the right crew with the paperwork attached.", points: ["Dispatch verified quotes as job cards", "Run kiosk mode for crew sign-in at the gate", "Track inventory and reorder alerts", "Review contractor logs and contracts"] },
  { id: "supervisor", name: "Supervisor", lead: "Approve hours with evidence in front of you.", points: ["Review timesheets waiting on you", "Return a timesheet for correction with a reason", "Check daily timesheets and contractor logs", "Open the job cards you are assigned to"] },
  { id: "technician", name: "Technician", lead: "Record the shift once, even with no signal.", points: ["Enter daily timesheets from a phone", "Entries save on the device and send when back online", "See returned work and resubmit", "Raise internal requests to the office"] },
  { id: "finance", name: "Finance", lead: "Bill only what is approved and verified.", points: ["Verify purchase orders against quotes", "Invoice readiness with the reasons it is blocked", "Variance control on timesheet hours", "Download Sage Pastel review files with audit hashes"] },
  { id: "management", name: "Management", lead: "A live view of the pipeline and the people.", points: ["Dashboard of quotes, dispatches and invoices", "Approve sent quotations", "Reports across PO compliance, dispatch and variance", "Contracts, inventory and bulk data import"] },
  { id: "admin", name: "Admin", lead: "Control who can do what, and prove it.", points: ["Approve access requests and manage users", "Set the company tax authority for quotations", "Configure entities, clients and catalogue", "Audit trail for sensitive actions"] }
];

const controls = [
  ["PO and commercial control", "A normal dispatch needs a verified client purchase order. Urgent work stays flagged until the commercial record is complete."],
  ["Supervised field evidence", "Timesheets need supervisor sign-off and a client-signed worksheet before invoicing can continue."],
  ["Two-person invoice issue", "The person who prepares an invoice cannot be the one who approves issuing it."],
  ["Client isolation", "Client records are scoped on the server, so a client only ever sees work for its own organisation."],
  ["Audited exports", "Accounting exports are review files. Each download is hashed and logged so the file can be proven later."],
  ["Works on site", "Timesheets entered without signal are kept on the device and sent when the connection returns."]
];

const portals = [
  ["For clients", "Client portal", "Submit requests, review quotations, verify job card scope and approve field worksheets.", "Client sign in"],
  ["For field and operations", "Staff operations", "Dispatch jobs, record and approve timesheets, track inventory and equipment.", "Staff sign in"],
  ["For management and finance", "Administration and finance", "Billing readiness, tax settings, Pastel review exports and access control.", "Admin sign in"]
];

const blank = { company_name: "", contact_name: "", email: "", phone: "", mine_site: "", service_need: "", urgency: "standard" };

export default function LandingPage() {
  const [form, setForm] = useState(blank);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [busy, setBusy] = useState(false);
  const [roleId, setRoleId] = useState("client");
  const role = roles.find((r) => r.id === roleId);

  async function submitLead(event) {
    event.preventDefault();
    setBusy(true);
    setStatus({ type: "", message: "" });
    try {
      await leads.create(form);
      setStatus({ type: "success", message: "Your service request has been received. Our team will contact you shortly." });
      setForm(blank);
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  }

  const update = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  return (
    <div className="min-h-screen bg-orac-page text-orac-text-primary">
      <a href="#main" className="sr-only rounded-md bg-orac-accent-strong px-4 py-2 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50">Skip to content</a>
      <header className="sticky top-0 z-30 border-b border-orac-border-default bg-orac-surface">
        <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <a href="#top" className="flex items-center gap-3" aria-label="Orac Systems operational portal home">
            <BrandMark size={44} />
            <span className="leading-tight"><span className="block text-ux-sub font-extrabold tracking-wide">ORAC SYSTEMS</span><span className="block text-ux-secondary text-orac-text-secondary">Operational Portal</span></span>
          </a>
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <Link to="/request-access" className="orac-land-link-outline hidden sm:inline-flex">Request access</Link>
            <Link to="/login" className="orac-land-link-solid">Sign in</Link>
          </div>
        </div>
      </header>

      <main id="main">
        <section id="top" className="orac-land-hero">
          <div className="orac-land-hero-overlay" aria-hidden="true" />
          <div className="relative z-10 mx-auto max-w-[1440px] px-4 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-28">
            <p className="orac-land-eyebrow">Industrial service operations</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl">Every job, from request to invoice, in one place.</h1>
            <p className="mt-6 max-w-2xl text-ux-section leading-relaxed orac-land-hero-copy">Orac-IOS governs client approvals, technician dispatch, real field hours and billing readiness for mining and industrial engineering work, so nobody is chasing paper to know where a job stands.</p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link to="/login" className="orac-land-btn-light">Sign in to the portal</Link>
              <Link to="/request-access" className="orac-land-btn-ghost">Request access</Link>
              <a href="#request" className="orac-land-btn-text">Submit service work &darr;</a>
            </div>
            <dl className="mt-14 grid max-w-4xl grid-cols-2 gap-6 border-t border-white/20 pt-8 sm:grid-cols-4">
              {[["8", "role workspaces"], ["1", "record from quote to invoice"], ["USD", "billing with approved tax rules"], ["SHA-256", "hashed accounting exports"]].map(([value, label]) => (
                <div key={label}><dt className="text-3xl font-extrabold">{value}</dt><dd className="mt-1 text-ux-secondary orac-land-hero-copy">{label}</dd></div>
              ))}
            </dl>
          </div>
        </section>

        <section className="border-b border-orac-border-default">
          <div className="mx-auto max-w-[1440px] px-4 py-16 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div><p className="orac-land-kicker">Operational sequence</p><h2 className="mt-2 text-3xl font-extrabold">How a job moves</h2></div>
              <p className="max-w-md text-ux-body text-orac-text-secondary">A job only moves to the next stage when the right person has signed off the one before it.</p>
            </div>
            <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {journey.map(([n, title, who, text]) => (
                <li key={n} className="orac-land-card">
                  <div className="flex items-center justify-between"><span className="font-mono text-ux-section font-bold text-orac-accent">{n}</span><span className="orac-land-chip">{who}</span></div>
                  <h3 className="mt-4 text-ux-section font-bold">{title}</h3>
                  <p className="mt-2 text-ux-body text-orac-text-secondary">{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="roles" className="border-b border-orac-border-default bg-orac-surface-subtle">
          <div className="mx-auto max-w-[1440px] px-4 py-16 sm:px-6 lg:px-8">
            <p className="orac-land-kicker">Built for every role</p>
            <h2 className="mt-2 text-3xl font-extrabold">Everyone sees the work that is theirs</h2>
            <p className="mt-3 max-w-2xl text-ux-body text-orac-text-secondary">Each person signs in to a workspace limited to their role. Pick a role to see what it opens.</p>
            <div role="tablist" aria-label="Portal roles" className="mt-8 flex flex-wrap gap-2">
              {roles.map((r) => (
                <Button key={r.id} variant="bare" role="tab" id={`role-tab-${r.id}`} aria-selected={roleId === r.id} aria-controls="role-panel" onClick={() => setRoleId(r.id)} className={`orac-land-tab ${roleId === r.id ? "orac-land-tab-active" : ""}`}>{r.name}</Button>
              ))}
            </div>
            <div id="role-panel" role="tabpanel" aria-labelledby={`role-tab-${role.id}`} className="orac-land-card mt-5 grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_1.4fr]">
              <div><h3 className="text-2xl font-extrabold">{role.name}</h3><p className="mt-3 text-ux-section text-orac-text-secondary">{role.lead}</p></div>
              <ul className="space-y-3">
                {role.points.map((p) => (
                  <li key={p} className="flex gap-3 text-ux-body"><svg className="mt-1 h-5 w-5 shrink-0 text-orac-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg><span>{p}</span></li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="orac-land-band">
          <div className="orac-land-hero-overlay" aria-hidden="true" />
          <div className="relative z-10 mx-auto max-w-[1440px] px-4 py-20 sm:px-6 lg:px-8">
            <h2 className="max-w-3xl text-3xl font-extrabold leading-tight sm:text-4xl">Made for plant shutdowns and field crews, not just the office.</h2>
            <p className="mt-4 max-w-2xl text-ux-section orac-land-hero-copy">Hours are captured where the work happens, approved by the people who saw it, and billed from the approved record.</p>
          </div>
        </section>

        <section id="portals" className="border-b border-orac-border-default">
          <div className="mx-auto max-w-[1440px] px-4 py-16 sm:px-6 lg:px-8">
            <div className="text-center"><p className="orac-land-kicker">Role architecture</p><h2 className="mt-2 text-3xl font-extrabold">Choose your portal</h2><p className="mx-auto mt-3 max-w-xl text-ux-body text-orac-text-secondary">Access follows your assigned role. All sign-ins go through the same secure login.</p></div>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {portals.map(([tag, title, text, cta]) => (
                <article key={title} className="orac-land-card flex flex-col p-7">
                  <span className="orac-land-chip self-start">{tag}</span>
                  <h3 className="mt-5 text-2xl font-extrabold">{title}</h3>
                  <p className="mt-3 flex-1 text-ux-body text-orac-text-secondary">{text}</p>
                  <Link to="/login" className="orac-land-link-soft mt-7">{cta} &rarr;</Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-orac-border-default bg-orac-surface-subtle">
          <div className="mx-auto max-w-[1440px] px-4 py-16 sm:px-6 lg:px-8">
            <p className="orac-land-kicker">System integrity</p>
            <h2 className="mt-2 text-3xl font-extrabold">Built-in governance controls</h2>
            <p className="mt-3 max-w-2xl text-ux-body text-orac-text-secondary">Every handover needs audited proof before billing or commercial status can progress.</p>
            <div className="mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {controls.map(([title, text], i) => (
                <article key={title} className="orac-land-card"><p className="font-mono text-ux-section font-bold text-orac-accent">0{i + 1}</p><h3 className="mt-3 text-ux-section font-bold">{title}</h3><p className="mt-2 text-ux-body text-orac-text-secondary">{text}</p></article>
              ))}
            </div>
          </div>
        </section>

        <section id="request">
          <div className="mx-auto grid max-w-[1440px] gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[.8fr_1.2fr] lg:px-8">
            <div>
              <p className="orac-land-kicker">Public work intake</p>
              <h2 className="mt-2 text-3xl font-extrabold">Register a site service request</h2>
              <p className="mt-4 max-w-md text-ux-body text-orac-text-secondary">Report an urgent breakdown, routine plant maintenance or a planned shutdown. Requests go straight into our operations queue.</p>
              <div className="orac-land-card mt-8 max-w-md">
                <p className="font-bold">What happens next</p>
                <ul className="mt-3 list-disc space-y-1.5 pl-5 text-ux-body text-orac-text-secondary"><li>We evaluate the site and send a quotation in USD.</li><li>You issue a purchase order before technicians are dispatched.</li><li>You sign the daily worksheets, so billing is transparent.</li></ul>
              </div>
            </div>
            <form onSubmit={submitLead} className="orac-land-card p-6 sm:p-8">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field id="lead-company" label="Company name" required><Input id="lead-company" required value={form.company_name} onChange={update("company_name")} placeholder="e.g. Zimplats Mining" /></Field>
                <Field id="lead-contact" label="Contact person" required><Input id="lead-contact" required value={form.contact_name} onChange={update("contact_name")} placeholder="e.g. Tendai Moyo" /></Field>
                <Field id="lead-email" label="Email address" required><Input id="lead-email" type="email" required value={form.email} onChange={update("email")} placeholder="name@company.co.zw" /></Field>
                <Field id="lead-phone" label="Phone / WhatsApp"><Input id="lead-phone" type="tel" value={form.phone} onChange={update("phone")} placeholder="+263 ..." /></Field>
                <Field id="lead-site" label="Mine site or plant location" className="sm:col-span-2"><Input id="lead-site" value={form.mine_site} onChange={update("mine_site")} placeholder="e.g. Ngezi Concentrator, Plant Area B" /></Field>
                <Field id="lead-need" label="Scope of service required" required className="sm:col-span-2"><Textarea id="lead-need" required rows={4} value={form.service_need} onChange={update("service_need")} placeholder="Describe the equipment tag, fault or work needed." /></Field>
                <Field id="lead-urgency" label="Operational urgency" className="sm:col-span-2"><Select id="lead-urgency" value={form.urgency} onChange={update("urgency")}><option value="standard">Standard maintenance (normal priority)</option><option value="planned_shutdown">Planned shutdown</option><option value="urgent_downtime">Urgent downtime</option></Select></Field>
              </div>
              {status.message && <p role="status" className={`mt-5 rounded-lg border px-4 py-3 text-ux-body ${status.type === "success" ? "border-orac-success-border bg-orac-success-bg text-orac-success-text" : "border-orac-danger-border bg-orac-danger-bg text-orac-danger-text"}`}>{status.message}</p>}
              <Button type="submit" variant="primary" loading={busy} className="mt-6 w-full">{busy ? "Submitting..." : "Submit site service request"}</Button>
            </form>
          </div>
        </section>
      </main>

      <footer className="border-t border-orac-border-default bg-orac-surface">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-4 py-7 text-ux-body text-orac-text-secondary sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>Orac-IOS &middot; Orac Industrial Operations System &middot; Zimbabwe and regional SADC</p>
          <p className="flex gap-5"><Link className="font-semibold text-orac-accent hover:underline" to="/request-access">Request access</Link><Link className="font-semibold text-orac-accent hover:underline" to="/login">Portal sign in</Link></p>
        </div>
      </footer>
    </div>
  );
}
