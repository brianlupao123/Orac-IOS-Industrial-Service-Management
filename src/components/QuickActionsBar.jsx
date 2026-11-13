import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import RecordOfWorkDossier from "./RecordOfWorkDossier.jsx";
import TradesAndRatesModal from "./TradesAndRatesModal.jsx";

export default function QuickActionsBar({ user }) {
  const navigate = useNavigate();
  const [dossierOpen, setDossierOpen] = useState(false);
  const [tradesModalOpen, setTradesModalOpen] = useState(false);

  const role = user?.role || "Technician";

  // Build role-specific quick action cards
  const getActions = () => {
    switch (role) {
      case "Admin":
        return [
          {
            id: "onboard_worker",
            title: "Onboard Worker",
            subtitle: "Create technician profile",
            tone: "accent",
            icon: (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            ),
            onClick: () => navigate("/admin")
          },
          {
            id: "record_of_work",
            title: "Record of Work",
            subtitle: "360° Client & Site Dossier",
            tone: "info",
            icon: (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            ),
            onClick: () => setDossierOpen(true)
          },
          {
            id: "trades_and_rates",
            title: "Trades & Rates",
            subtitle: "Master wage rates & skills",
            tone: "success",
            icon: (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ),
            onClick: () => setTradesModalOpen(true)
          },
          {
            id: "bulk_import",
            title: "Data Import",
            subtitle: "Batch upload Excel records",
            tone: "warning",
            icon: (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            ),
            onClick: () => navigate("/imports")
          },
          {
            id: "commercial_ledger",
            title: "PO & Invoicing",
            subtitle: "Financial settlement",
            tone: "danger",
            icon: (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            ),
            onClick: () => navigate("/finance")
          }
        ];

      case "Finance":
        return [
          {
            id: "tech_payroll",
            title: "Technician Payroll",
            subtitle: "Hours, EcoCash & Banks",
            tone: "success",
            icon: (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            ),
            onClick: () => navigate("/reports")
          },
          {
            id: "po_invoicing",
            title: "PO Ledger",
            subtitle: "Contracts & PO balances",
            tone: "info",
            icon: (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            ),
            onClick: () => navigate("/finance")
          },
          {
            id: "invoice_readiness",
            title: "Invoice Readiness",
            subtitle: "Unbilled certified work",
            tone: "accent",
            icon: (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            ),
            onClick: () => navigate("/invoice-readiness")
          },
          {
            id: "record_of_work",
            title: "Site Dossier",
            subtitle: "Audit client work & billing",
            tone: "warning",
            icon: (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            ),
            onClick: () => setDossierOpen(true)
          },
          {
            id: "quotations",
            title: "Quotations",
            subtitle: "Approve pricing & margins",
            tone: "danger",
            icon: (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            ),
            onClick: () => navigate("/quotations")
          }
        ];

      case "Operations":
      case "Supervisor":
        return [
          {
            id: "timesheets",
            title: "Daily Timesheets",
            subtitle: "Log & verify crew hours",
            tone: "info",
            icon: (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ),
            onClick: () => navigate("/worksheets")
          },
          {
            id: "worksheets",
            title: "Monthly Worksheets",
            subtitle: "Client certified registers",
            tone: "success",
            icon: (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            ),
            onClick: () => navigate("/monthly-worksheets")
          },
          {
            id: "job_cards",
            title: "Job Cards",
            subtitle: "Field dispatches & tags",
            tone: "warning",
            icon: (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            ),
            onClick: () => navigate("/job-cards")
          },
          {
            id: "record_of_work",
            title: "Site Dossier",
            subtitle: "Audit site work records",
            tone: "accent",
            icon: (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            ),
            onClick: () => setDossierOpen(true)
          },
          {
            id: "internal_req",
            title: "Mobilization Request",
            subtitle: "Request techs & materials",
            tone: "danger",
            icon: (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            ),
            onClick: () => navigate("/internal-requests")
          }
        ];

      case "Technician":
        return [
          {
            id: "log_shift",
            title: "Log My Shift",
            subtitle: "Enter hours & plant section",
            tone: "info",
            icon: (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ),
            onClick: () => navigate("/worksheets")
          },
          {
            id: "my_statement",
            title: "My Pay Statement",
            subtitle: "View certified work hours",
            tone: "success",
            icon: (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            ),
            onClick: () => navigate("/monthly-worksheets")
          },
          {
            id: "my_jobs",
            title: "Assigned Jobs",
            subtitle: "Active site dispatches",
            tone: "warning",
            icon: (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            ),
            onClick: () => navigate("/job-cards")
          },
          {
            id: "internal_help",
            title: "Submit Request",
            subtitle: "PPE, tools, or assistance",
            tone: "accent",
            icon: (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            ),
            onClick: () => navigate("/internal-requests")
          }
        ];

      case "Client Viewer":
        return [
          {
            id: "record_of_work",
            title: "Record of Work",
            subtitle: "360° Site dossier & audits",
            tone: "info",
            icon: (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            ),
            onClick: () => setDossierOpen(true)
          },
          {
            id: "contracts",
            title: "POs & Contracts",
            subtitle: "Track order balances",
            tone: "success",
            icon: (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            ),
            onClick: () => navigate("/portal")
          },
          {
            id: "monthly_worksheets",
            title: "Certified Hours",
            subtitle: "Review monthly registers",
            tone: "warning",
            icon: (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ),
            onClick: () => navigate("/portal")
          }
        ];

      default:
        return [
          {
            id: "record_of_work",
            title: "Record of Work",
            subtitle: "Client & site dossier",
            tone: "info",
            icon: (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            ),
            onClick: () => setDossierOpen(true)
          },
          {
            id: "quotations",
            title: "Quotations",
            subtitle: "Sales pipeline",
            tone: "success",
            icon: (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            ),
            onClick: () => navigate("/quotations")
          },
          {
            id: "reports",
            title: "Executive Reports",
            subtitle: "Operations & finance analytics",
            tone: "warning",
            icon: (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            ),
            onClick: () => navigate("/reports")
          }
        ];
    }
  };

  const actions = getActions();

  function getActionBadgeStyle(variant) {
    switch (variant) {
      case "accent":
        return "bg-orac-accent/10 text-orac-accent border border-orac-accent/20";
      case "success":
        return "bg-orac-success-bg text-orac-success-text border border-orac-success-border";
      case "warning":
        return "bg-orac-warning-bg text-orac-warning-text border border-orac-warning-border";
      case "danger":
        return "bg-orac-danger-bg text-orac-danger-text border border-orac-danger-border";
      case "info":
      default:
        return "bg-orac-info-bg text-orac-info-text border border-orac-info-border";
    }
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-ux-section font-semibold text-orac-text-primary">Quick Actions</span>
          <span className="text-ux-caption text-orac-text-muted">1-Click Operational Shortcuts</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {actions.map((act) => (
            <div
              key={act.id}
              onClick={act.onClick}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  act.onClick();
                }
              }}
              className="group flex flex-col justify-between rounded-xl border border-orac-border-default bg-orac-surface p-4 shadow-2xs hover:border-orac-accent/40 hover:shadow-xs hover:bg-orac-row-hover transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-orac-accent"
            >
              <div className="flex items-center justify-between">
                <div className={`flex h-11 w-11 items-center justify-center rounded-lg shadow-2xs transition-transform group-hover:scale-105 ${getActionBadgeStyle(act.tone)}`}>
                  {act.icon}
                </div>
                <span className="text-orac-text-muted group-hover:text-orac-accent group-hover:translate-x-0.5 transition-all text-ux-caption">
                  &rarr;
                </span>
              </div>
              <div className="mt-3">
                <span className="block text-ux-body font-semibold text-orac-text-primary group-hover:text-orac-accent transition-colors">
                  {act.title}
                </span>
                <span className="mt-0.5 block text-ux-caption text-orac-text-muted line-clamp-1">
                  {act.subtitle}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {dossierOpen && (
        <RecordOfWorkDossier isOpen={dossierOpen} onClose={() => setDossierOpen(false)} />
      )}

      {tradesModalOpen && (
        <TradesAndRatesModal isOpen={tradesModalOpen} onClose={() => setTradesModalOpen(false)} />
      )}
    </>
  );
}
