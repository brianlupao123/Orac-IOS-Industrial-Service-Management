import React, { useState } from "react";
import { Link } from "react-router-dom";
import { leads } from "../api/client.js";
import ThemeToggle from "../components/ThemeToggle.jsx";
import BrandMark from "../components/ui/BrandMark.jsx";
import Button from "../components/ui/Button.jsx";
import Input from "../components/ui/Input.jsx";
import Select from "../components/ui/Select.jsx";
import Textarea from "../components/ui/Textarea.jsx";

const WORKFLOW_STAGES = [
  {
    step: "01",
    title: "Service request",
    role: "Client",
    desc: "Clients log required site work, equipment tags, and operational urgency directly into the queue."
  },
  {
    step: "02",
    title: "Quote & approval",
    role: "Sales & Management",
    desc: "Fixed-scope quotes prepared in USD with validated ZIMRA tax rules and two-person commercial authorization."
  },
  {
    step: "03",
    title: "Dispatch & timesheets",
    role: "Operations & Field",
    desc: "Technicians receive verified job cards, log real trade hours, and record client-signed field evidence."
  },
  {
    step: "04",
    title: "Invoice & settlement",
    role: "Finance & Accounts",
    desc: "Automated billing readiness reports match approved worksheets to purchase orders before Sage Pastel export."
  }
];

const PORTAL_ENTRIES = [
  {
    title: "Client Portal",
    badge: "Client Representatives",
    desc: "Submit new service requests, review quotation documents, verify job card scopes, and approve field worksheets.",
    linkText: "Client Access",
    to: "/login"
  },
  {
    title: "Staff Operations",
    badge: "Field & Operations",
    desc: "Manage technician dispatch, execute field worksheets, record kiosk timesheets, and track equipment tags.",
    linkText: "Staff Sign In",
    to: "/login"
  },
  {
    title: "Administration & Finance",
    badge: "Management & Governance",
    desc: "Authoritative billing readiness, VAT company profiles, Sage Pastel review exports, and 2FA credential control.",
    linkText: "Admin Portal",
    to: "/login"
  }
];

const BUILT_IN_CONTROLS = [
  {
    number: "01",
    title: "PO & Commercial Control",
    desc: "Normal dispatch strictly requires a verified client purchase order. Urgent shutdown work remains flagged until commercial terms are authorized."
  },
  {
    number: "02",
    title: "Supervised Field Evidence",
    desc: "Technician timesheets require supervisor sign-off and signed worksheets before invoice processing can continue."
  },
  {
    number: "03",
    title: "Audited Ledger Isolation",
    desc: "Client records are strictly scoped by organisation. Accounting exports generate immutable SHA-256 hashes for external audit."
  }
];

export default function LandingPage() {
  const [form, setForm] = useState({
    company_name: "",
    contact_name: "",
    email: "",
    phone: "",
    mine_site: "",
    service_need: "",
    urgency: "standard"
  });
  const [status, setStatus] = useState({ type: "", message: "" });
  const [busy, setBusy] = useState(false);

  async function submitLead(event) {
    event.preventDefault();
    setBusy(true);
    setStatus({ type: "", message: "" });
    try {
      await leads.create(form);
      setStatus({
        type: "success",
        message: "Your service request has been registered in the operational queue. An operations manager will review and contact you."
      });
      setForm({
        company_name: "",
        contact_name: "",
        email: "",
        phone: "",
        mine_site: "",
        service_need: "",
        urgency: "standard"
      });
    } catch (error) {
      setStatus({ type: "error", message: error.message || "Failed to submit request." });
    } finally {
      setBusy(false);
    }
  }

  const update = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  return (
    <div className="min-h-screen bg-orac-canvas text-orac-text-primary antialiased">
      {/* 1. Universal Top Header */}
      <header className="sticky top-0 z-40 border-b border-orac-border bg-orac-surface/95 backdrop-blur-md">
        <div className="mx-auto flex min-h-[72px] max-w-[1440px] items-center justify-between gap-4 px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orac-focus-ring" aria-label="ORAC Systems Home">
            <BrandMark size={42} />
            <div>
              <span className="block text-ux-body font-bold text-orac-text-primary">ORAC SYSTEMS</span>
              <span className="block text-ux-caption font-semibold uppercase tracking-wider text-orac-text-muted">Operational Portal</span>
            </div>
          </Link>

          <div className="flex items-center gap-3 sm:gap-4">
            <ThemeToggle />
            <Link
              to="/request-access"
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-orac-border-strong bg-transparent px-4 py-2.5 text-ux-body font-semibold text-orac-text-primary transition-colors hover:border-orac-accent hover:bg-orac-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orac-focus-ring"
            >
              Request access
            </Link>
            <Link
              to="/login"
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-orac-accent px-5 py-2.5 text-ux-body font-bold text-white shadow-xs transition-colors hover:bg-orac-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orac-focus-ring"
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content">
        {/* 2. Hero Section: Navy Gradient with Vector Contours */}
        <section className="relative overflow-hidden orac-brand-panel-bg text-white">
          {/* Background Vector Contour Lines */}
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full opacity-20"
            viewBox="0 0 1440 600"
            preserveAspectRatio="xMidYMid slice"
            aria-hidden="true"
          >
            <g fill="none" className="orac-brand-panel-contour" strokeWidth="1.2">
              <path d="M-50 500C250 420 400 560 700 480S1100 360 1500 420" />
              <path d="M-50 440C250 360 400 500 700 420S1100 300 1500 360" />
              <path d="M-50 380C250 300 400 440 700 360S1100 240 1500 300" />
              <path d="M-50 320C250 240 400 380 700 300S1100 180 1500 240" />
              <path d="M-50 260C250 180 400 320 700 240S1100 120 1500 180" />
            </g>
          </svg>

          <div className="relative z-10 mx-auto max-w-[1440px] px-6 py-20 lg:px-8 lg:py-28">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-ux-caption font-semibold uppercase tracking-wider text-white backdrop-blur-xs">
                Industrial Service Operations
              </div>
              <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl leading-[1.12]">
                Every job, from request to invoice, in one place.
              </h1>
              <p className="mt-6 text-ux-body text-white/90 sm:text-xl sm:leading-relaxed max-w-2xl">
                Orac-IOS governs client authorizations, technician dispatch, trade hours evidence, and verified billing readiness for industrial mining engineering services.
              </p>

              <div className="mt-10 flex flex-wrap items-center gap-4">
                <Link
                  to="/login"
                  className="inline-flex min-h-[48px] items-center justify-center rounded-lg bg-white px-6 py-3 text-ux-body font-bold text-orac-brand-b shadow-md transition-all hover:bg-slate-100 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  Sign in to your portal
                </Link>
                <Link
                  to="/request-access"
                  className="inline-flex min-h-[48px] items-center justify-center rounded-lg border border-white/40 bg-white/10 px-6 py-3 text-ux-body font-semibold text-white backdrop-blur-xs transition-colors hover:border-white hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  Request access
                </Link>
                <a
                  href="#request"
                  className="inline-flex min-h-[48px] items-center justify-center px-4 py-3 text-ux-body font-medium text-white/80 underline-offset-4 hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-white"
                >
                  Submit service work ↓
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* 3. "How a job moves" Operational Sequence Card */}
        <section className="border-b border-orac-border bg-orac-surface py-16 lg:py-20">
          <div className="mx-auto max-w-[1440px] px-6 lg:px-8">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <span className="text-ux-caption font-bold uppercase tracking-wider text-orac-accent">Operational Sequence</span>
                <h2 className="mt-1 text-3xl font-extrabold tracking-tight text-orac-text-primary">How a job moves</h2>
              </div>
              <p className="max-w-md text-ux-secondary text-orac-text-muted">
                Each stage transitions only when authenticated role evidence has been registered and verified by the system.
              </p>
            </div>

            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {WORKFLOW_STAGES.map((s) => (
                <div
                  key={s.step}
                  className="relative flex flex-col justify-between rounded-xl border border-orac-border bg-orac-canvas p-6 shadow-xs transition-all hover:border-orac-accent/50 hover:shadow-sm"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-2xl font-black text-orac-accent">{s.step}</span>
                      <span className="rounded-full bg-orac-surface-muted px-2.5 py-1 text-ux-caption font-bold text-orac-text-secondary">
                        {s.role}
                      </span>
                    </div>
                    <h3 className="mt-4 text-ux-body font-bold text-orac-text-primary">{s.title}</h3>
                    <p className="mt-2 text-ux-secondary text-orac-text-muted leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 4. "Choose your portal" Role Entry Row */}
        <section className="border-b border-orac-border bg-orac-canvas py-16 lg:py-20">
          <div className="mx-auto max-w-[1440px] px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto">
              <span className="text-ux-caption font-bold uppercase tracking-wider text-orac-accent">Role Architecture</span>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-orac-text-primary">Choose your portal</h2>
              <p className="mt-3 text-ux-secondary text-orac-text-muted">
                Access is governed by your assigned corporate role. All sign-in entries authenticate through our unified security barrier.
              </p>
            </div>

            <div className="mt-12 grid gap-8 md:grid-cols-3">
              {PORTAL_ENTRIES.map((p) => (
                <div
                  key={p.title}
                  className="flex flex-col justify-between rounded-2xl border border-orac-border-strong bg-orac-surface p-8 shadow-xs transition-all hover:border-orac-accent hover:shadow-md"
                >
                  <div>
                    <span className="inline-block rounded-md bg-orac-surface-muted px-3 py-1 text-ux-caption font-semibold text-orac-text-secondary">
                      {p.badge}
                    </span>
                    <h3 className="mt-4 text-2xl font-bold text-orac-text-primary">{p.title}</h3>
                    <p className="mt-3 text-ux-body text-orac-text-muted leading-relaxed">{p.desc}</p>
                  </div>
                  <div className="mt-8 pt-6 border-t border-orac-border">
                    <Link
                      to={p.to}
                      className="inline-flex w-full min-h-[44px] items-center justify-center rounded-lg bg-orac-surface-muted px-4 py-2.5 text-ux-body font-bold text-orac-text-primary transition-colors hover:bg-orac-accent hover:text-white focus-visible:outline-2 focus-visible:outline-orac-focus-ring"
                    >
                      {p.linkText} →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 5. Built-in Controls (Preserved & Re-styled with Tokens) */}
        <section className="border-b border-orac-border bg-orac-surface py-16 lg:py-20">
          <div className="mx-auto max-w-[1440px] px-6 lg:px-8">
            <div className="max-w-2xl">
              <span className="text-ux-caption font-bold uppercase tracking-wider text-orac-accent">System Integrity</span>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-orac-text-primary">Built-in governance controls</h2>
              <p className="mt-2 text-ux-secondary text-orac-text-muted">
                Every operational handover requires audited proof before billing or commercial status can progress.
              </p>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {BUILT_IN_CONTROLS.map((c) => (
                <article
                  key={c.number}
                  className="rounded-xl border border-orac-border bg-orac-canvas p-6 shadow-xs"
                >
                  <span className="font-mono text-xl font-bold text-orac-accent">{c.number}</span>
                  <h3 className="mt-3 text-ux-body font-bold text-orac-text-primary">{c.title}</h3>
                  <p className="mt-2 text-ux-secondary text-orac-text-muted leading-relaxed">{c.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 6. Public Service Request Form (Preserved Functional Intake) */}
        <section id="request" className="bg-orac-canvas py-16 lg:py-24">
          <div className="mx-auto grid max-w-[1440px] gap-12 px-6 lg:grid-cols-[1fr_1.3fr] lg:px-8">
            <div>
              <span className="text-ux-caption font-bold uppercase tracking-wider text-orac-accent">Public Work Intake</span>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-orac-text-primary">Register a site service request</h2>
              <p className="mt-4 text-ux-body text-orac-text-muted leading-relaxed">
                Submit an urgent breakdown, routine plant maintenance, or planned shutdown requirement. Requests enter our operations queue for dispatch validation.
              </p>

              <div className="mt-8 rounded-xl border border-orac-border bg-orac-surface p-6">
                <h4 className="text-ux-body font-bold text-orac-text-primary">Commercial Process:</h4>
                <ul className="mt-3 space-y-2 text-ux-secondary text-orac-text-muted">
                  <li className="flex items-start gap-2">
                    <span className="text-orac-accent font-bold" aria-hidden="true">•</span>
                    <span>Commercial quotation generated in USD upon site evaluation.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-orac-accent font-bold" aria-hidden="true">•</span>
                    <span>Official client purchase order required prior to technician field dispatch.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-orac-accent font-bold" aria-hidden="true">•</span>
                    <span>Client sign-off on daily worksheets guarantees billing transparency.</span>
                  </li>
                </ul>
              </div>
            </div>

            <form
              onSubmit={submitLead}
              className="rounded-2xl border border-orac-border bg-orac-surface p-8 shadow-sm space-y-5"
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="lead-company-name" className="mb-1 block text-ux-label font-semibold text-orac-text-primary">Company name *</label>
                  <Input
                    id="lead-company-name"
                    required
                    value={form.company_name}
                    onChange={update("company_name")}
                    placeholder="e.g. Zimplats Mining"
                  />
                </div>
                <div>
                  <label htmlFor="lead-contact-name" className="mb-1 block text-ux-label font-semibold text-orac-text-primary">Contact person *</label>
                  <Input
                    id="lead-contact-name"
                    required
                    value={form.contact_name}
                    onChange={update("contact_name")}
                    placeholder="e.g. Tendai Moyo"
                  />
                </div>
                <div>
                  <label htmlFor="lead-email" className="mb-1 block text-ux-label font-semibold text-orac-text-primary">Email address *</label>
                  <Input
                    id="lead-email"
                    required
                    type="email"
                    value={form.email}
                    onChange={update("email")}
                    placeholder="name@company.co.zw"
                  />
                </div>
                <div>
                  <label htmlFor="lead-phone" className="mb-1 block text-ux-label font-semibold text-orac-text-primary">Phone / WhatsApp</label>
                  <Input
                    id="lead-phone"
                    type="tel"
                    value={form.phone}
                    onChange={update("phone")}
                    placeholder="+263 ..."
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="lead-mine-site" className="mb-1 block text-ux-label font-semibold text-orac-text-primary">Mine site or plant location</label>
                  <Input
                    id="lead-mine-site"
                    value={form.mine_site}
                    onChange={update("mine_site")}
                    placeholder="e.g. Ngezi Concentrator, Plant Area B"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="lead-service-need" className="mb-1 block text-ux-label font-semibold text-orac-text-primary">Scope of service required *</label>
                  <Textarea
                    id="lead-service-need"
                    required
                    rows="4"
                    value={form.service_need}
                    onChange={update("service_need")}
                    placeholder="Describe equipment tag, hydraulic pump failure, conveyor belt alignment, or required trades..."
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="lead-urgency" className="mb-1 block text-ux-label font-semibold text-orac-text-primary">Operational urgency</label>
                  <Select
                    id="lead-urgency"
                    value={form.urgency}
                    onChange={update("urgency")}
                  >
                    <option value="standard">Standard Maintenance (Normal priority)</option>
                    <option value="planned_shutdown">Planned Shutdown (Scheduled date)</option>
                    <option value="urgent_downtime">Critical Emergency Downtime (Immediate dispatch)</option>
                  </Select>
                </div>
              </div>

              {status.message && (
                <div
                  role="alert"
                  className={`rounded-lg border p-4 text-ux-body font-medium ${
                    status.type === "success"
                      ? "border-orac-success-border bg-orac-success-bg text-orac-success-text"
                      : "border-orac-danger-border bg-orac-danger-bg text-orac-danger-text"
                  }`}
                >
                  {status.message}
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                disabled={busy}
                className="w-full min-h-[48px] text-ux-body font-bold"
              >
                {busy ? "Registering request..." : "Submit site service request"}
              </Button>
            </form>
          </div>
        </section>
      </main>

      {/* 7. Footer */}
      <footer className="border-t border-orac-border bg-orac-surface py-10 text-orac-text-muted">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-6 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <div className="flex items-center gap-3">
            <BrandMark size={28} />
            <p className="text-ux-secondary font-medium">
              ORAC-IOS · Orac Industrial Operations System · Zimbabwe & Regional SADC
            </p>
          </div>
          <div className="flex items-center gap-6 text-ux-secondary font-semibold">
            <Link to="/request-access" className="hover:text-orac-text-primary">Request Access</Link>
            <Link to="/login" className="text-orac-accent hover:underline">Portal Sign In</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
