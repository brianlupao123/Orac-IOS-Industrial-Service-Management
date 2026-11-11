import React from "react";
import BrandMark from "./BrandMark.jsx";

const DEFAULT_WORKFLOW = [
  "Service Request",
  "Quote & Approval",
  "Dispatch",
  "Field Worksheet",
  "Timesheet",
  "Invoice & Settlement"
];

export default function BrandPanel({
  title = "Every job, from request to invoice, in one place.",
  subtitle = "Clients follow their requests, field teams record the work, and finance bills from approved records. One portal, role-governed.",
  showChain = true,
  workflow = DEFAULT_WORKFLOW,
  className = ""
}) {
  return (
    <div
      data-ux="brand-panel"
      className={`relative flex flex-col justify-between overflow-hidden orac-brand-panel-bg p-8 text-white sm:p-12 lg:p-14 ${className}`}
    >
      {/* Background contour overlay matching V5 mock */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full opacity-25"
        viewBox="0 0 600 800"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <g fill="none" className="orac-brand-panel-contour" strokeWidth="1.2">
          <path d="M-20 700C140 620 220 720 380 650S560 560 640 600" />
          <path d="M-20 640C140 560 220 660 380 590S560 500 640 540" />
          <path d="M-20 580C140 500 220 600 380 530S560 440 640 480" />
          <path d="M-20 520C140 440 220 540 380 470S560 380 640 420" />
          <path d="M-20 460C140 380 220 480 380 410S560 320 640 360" />
          <path d="M-20 400C140 320 220 420 380 350S560 260 640 300" />
          <path d="M-20 340C140 260 220 360 380 290S560 200 640 240" />
        </g>
      </svg>

      {/* Top BrandMark */}
      <div className="relative z-10">
        <div className="flex items-center gap-3">
          <BrandMark size={44} />
          <div>
            <div className="text-lg font-extrabold tracking-wider text-white">ORAC SYSTEMS</div>
            <div className="text-ux-caption font-medium uppercase tracking-widest orac-brand-panel-tag">Operational Portal</div>
          </div>
        </div>
      </div>

      {/* Middle Headline, Subtitle, and Workflow Chain */}
      <div className="relative z-10 my-8 max-w-xl">
        <h1 className="text-3xl font-extrabold leading-tight text-white sm:text-4xl lg:text-5xl">
          {title}
        </h1>
        <p className="mt-4 text-base orac-brand-panel-subtitle sm:text-lg">
          {subtitle}
        </p>

        {showChain && (
          <div className="mt-8 hidden flex-wrap items-center gap-2 lg:flex" aria-label="Operational Workflow">
            {workflow.map((step, idx) => (
              <React.Fragment key={step}>
                <span className="rounded-full border border-white/30 bg-white/10 px-3.5 py-1 text-ux-caption font-semibold tracking-wide text-white backdrop-blur-xs">
                  {step}
                </span>
                {idx < workflow.length - 1 && (
                  <span className="text-ux-caption text-white/50" aria-hidden="true">→</span>
                )}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Tagline / Assistance Note */}
      <div className="relative z-10 hidden border-t border-white/15 pt-6 text-ux-caption orac-brand-panel-footer sm:block">
        <p>ORAC Systems · Industrial Service Management · Harare / Johannesburg</p>
      </div>
    </div>
  );
}
