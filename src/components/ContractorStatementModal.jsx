import React from "react";
import Modal from "./Modal.jsx";
import Button from "./ui/Button.jsx";
import Badge from "./ui/Badge.jsx";
import { formatHours } from "../payrollModel.js";

const STATEMENT_PRINT_STYLES = `
@media print {
  body * {
    visibility: hidden;
  }
  #contractor-statement-sheet, #contractor-statement-sheet * {
    visibility: visible;
  }
  #contractor-statement-sheet {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    margin: 0;
    padding: 15mm;
    background: white !important;
    color: black !important;
  }
  .no-print {
    display: none !important;
  }
}
`;

export default function ContractorStatementModal({ isOpen, onClose, employee, month }) {
  if (!isOpen || !employee) return null;

  const normalHours = Number(employee.normal_hours || 0);
  const ot15Hours = Number(employee.overtime_15_hours || 0);
  const ot20Hours = Number(employee.overtime_20_hours || 0);
  const totalHours = Number(employee.total_hours || (normalHours + ot15Hours + ot20Hours));

  const isArtisan = String(employee.trade || "").toLowerCase().includes("artisan") || 
                    String(employee.trade || "").toLowerCase().includes("fitter") ||
                    String(employee.trade || "").toLowerCase().includes("welder") ||
                    String(employee.trade || "").toLowerCase().includes("electrician");

  const normalRate = Number(employee.hourly_rate || (isArtisan ? 2.50 : 1.06));
  const ot15Rate = Number(employee.ot_15_rate || (normalRate * 1.5));
  const ot20Rate = Number(employee.ot_20_rate || (normalRate * 2.0));

  const normalAmount = normalHours * normalRate;
  const ot15Amount = ot15Hours * ot15Rate;
  const ot20Amount = ot20Hours * ot20Rate;
  const grandTotal = normalAmount + ot15Amount + ot20Amount;

  function handlePrint() {
    window.print();
  }

  const pastelCode = employee.employee_code || employee.supplier_code || employee.code || "On file";
  const settlementInfo = employee.phone_number || employee.ecocash_number || (employee.bank_name ? `${employee.bank_name}: ${employee.bank_account}` : "EcoCash Registered");
  const siteProject = employee.assigned_site || employee.project_title || "Solar Project / Commercial Operations";

  return (
    <Modal title="Contractor Timesheet & Payout Statement" isOpen={isOpen} onClose={onClose} maxWidth="max-w-4xl">
      <style>{STATEMENT_PRINT_STYLES}</style>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-orac-border-default pb-3 no-print">
          <div>
            <span className="text-ux-label font-semibold text-orac-text-primary">Official Contractor Statement</span>
            <p className="text-ux-caption text-orac-text-muted">Generated from certified field timesheets. Ready for distribution or PDF export.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose}>Close</Button>
            <Button variant="primary" onClick={handlePrint}>Print / Export PDF</Button>
          </div>
        </div>

        {/* The Printable Statement Paper Container */}
        <div id="contractor-statement-sheet" className="rounded-xl border border-orac-border-strong bg-orac-surface p-6 text-orac-text-primary shadow-sm print:border-none print:shadow-none">
          {/* Header */}
          <div className="border-b-2 border-orac-border-strong pb-4">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-ux-title font-bold tracking-tight text-orac-text-primary">HANDON ENTERPRISES P/L</h1>
                <p className="text-ux-caption font-semibold tracking-wider text-orac-text-secondary uppercase">T/A ORAC SYSTEMS · INDUSTRIAL SERVICE MANAGEMENT</p>
              </div>
              <div className="text-right">
                <Badge tone="neutral">Contractor Statement</Badge>
                <p className="mt-1 text-ux-caption text-orac-text-secondary">Pastel Ref: <span className="font-mono font-bold text-orac-text-primary">{pastelCode}</span></p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4 text-ux-caption sm:grid-cols-4">
              <div>
                <span className="block font-bold text-orac-text-muted uppercase">Contractor Name</span>
                <span className="text-ux-body font-bold text-orac-text-primary">{employee.full_name || employee.name}</span>
              </div>
              <div>
                <span className="block font-bold text-orac-text-muted uppercase">Contract Period</span>
                <span className="text-ux-body font-semibold text-orac-text-primary">{month || "Current Period"}</span>
              </div>
              <div>
                <span className="block font-bold text-orac-text-muted uppercase">Trade / Specialty</span>
                <span className="text-ux-body font-semibold text-orac-text-primary">{employee.trade || "Assistant"}</span>
              </div>
              <div>
                <span className="block font-bold text-orac-text-muted uppercase">Project / Site</span>
                <span className="text-ux-body font-semibold text-orac-text-primary">{siteProject}</span>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-4 text-ux-caption bg-orac-canvas p-2.5 rounded border border-orac-border-default">
              <div>
                <span className="text-orac-text-muted">National ID:</span> <span className="font-semibold text-orac-text-primary">{employee.national_id || "On file"}</span>
              </div>
              <div>
                <span className="text-orac-text-muted">Settlement Channel:</span> <span className="font-semibold text-orac-text-primary">{settlementInfo}</span>
              </div>
              <div>
                <span className="text-orac-text-muted">Days Logged:</span> <span className="font-semibold text-orac-text-primary">{employee.days_worked || "—"}</span>
              </div>
            </div>
          </div>

          {/* Table summary of certified hours */}
          <div className="mt-5">
            <table className="w-full border-collapse border border-orac-border-strong text-ux-caption">
              <thead>
                <tr className="bg-orac-canvas text-orac-text-primary">
                  <th className="border border-orac-border-strong px-3 py-2 text-left font-semibold">Classification</th>
                  <th className="border border-orac-border-strong px-3 py-2 text-center font-semibold">Certified Hours</th>
                  <th className="border border-orac-border-strong px-3 py-2 text-right font-semibold">Agreed Rate (USD)</th>
                  <th className="border border-orac-border-strong px-3 py-2 text-right font-semibold">Total Amount (USD)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-orac-border-strong px-3 py-2.5 font-medium">Normal Working Hours (1.0x)</td>
                  <td className="border border-orac-border-strong px-3 py-2.5 text-center font-mono">{formatHours(normalHours)}</td>
                  <td className="border border-orac-border-strong px-3 py-2.5 text-right font-mono">${normalRate.toFixed(2)}</td>
                  <td className="border border-orac-border-strong px-3 py-2.5 text-right font-mono font-semibold">${normalAmount.toFixed(2)}</td>
                </tr>
                <tr>
                  <td className="border border-orac-border-strong px-3 py-2.5 font-medium">Overtime Hours (1.5x)</td>
                  <td className="border border-orac-border-strong px-3 py-2.5 text-center font-mono">{formatHours(ot15Hours)}</td>
                  <td className="border border-orac-border-strong px-3 py-2.5 text-right font-mono">${ot15Rate.toFixed(2)}</td>
                  <td className="border border-orac-border-strong px-3 py-2.5 text-right font-mono font-semibold">${ot15Amount.toFixed(2)}</td>
                </tr>
                <tr>
                  <td className="border border-orac-border-strong px-3 py-2.5 font-medium">Overtime Hours (2.0x / Sunday / Holiday)</td>
                  <td className="border border-orac-border-strong px-3 py-2.5 text-center font-mono">{formatHours(ot20Hours)}</td>
                  <td className="border border-orac-border-strong px-3 py-2.5 text-right font-mono">${ot20Rate.toFixed(2)}</td>
                  <td className="border border-orac-border-strong px-3 py-2.5 text-right font-mono font-semibold">${ot20Amount.toFixed(2)}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="bg-orac-canvas font-bold text-orac-text-primary">
                  <td className="border border-orac-border-strong px-3 py-2.5">TOTAL CERTIFIED PAYOUT</td>
                  <td className="border border-orac-border-strong px-3 py-2.5 text-center font-mono">{formatHours(totalHours)} hrs</td>
                  <td className="border border-orac-border-strong px-3 py-2.5 text-right">—</td>
                  <td className="border border-orac-border-strong px-3 py-2.5 text-right font-mono text-ux-body">${grandTotal.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Signoff / Certification footer matching binder format */}
          <div className="mt-12 grid grid-cols-2 gap-8 border-t border-orac-border-default pt-6 text-ux-caption text-orac-text-muted">
            <div>
              <div className="border-b border-orac-border-strong pb-1 font-semibold text-orac-text-primary">Prepared by: Operations / Site Supervisor</div>
              <p className="mt-1">Hours verified against certified shift logs.</p>
            </div>
            <div>
              <div className="border-b border-orac-border-strong pb-1 font-semibold text-orac-text-primary">Settled by: Finance Department</div>
              <p className="mt-1">Reconciled for Sage Pastel & EcoCash/EFT payout.</p>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
