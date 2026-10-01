import React from "react";
import { worksheetNextAction, worksheetStatusLabel, worksheetTone } from "../fieldStatusModel.js";

// Presentational only. Shows, for one worksheet (Timesheet): the plain status, what
// happens next for this role, the return reason, the client's acknowledgement
// evidence and the internal approval. Client acknowledgement and Supervisor
// approval are shown as two separate facts.
const TONE = {
  slate: "bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-200",
  sky: "bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  red: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300",
  green: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
};

export function formatWhen(value) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
}

export function StatusPill({ status }) {
  return (
    <span className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-semibold ${TONE[worksheetTone(status)]}`}>
      {worksheetStatusLabel(status)}
    </span>
  );
}

export default function WorksheetEvidence({ worksheet, role }) {
  const ack = worksheet.client_acknowledgement;
  const next = worksheetNextAction(role, worksheet);
  return (
    <div className="mt-3 space-y-2 text-sm">
      {next && (
        <p className="text-orac-slate"><span className="font-semibold">Next: </span>{next}</p>
      )}
      {worksheet.status === "Returned_For_Correction" && (
        <div role="note" className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800 dark:bg-red-950/30 dark:text-red-200">
          <p className="font-semibold">Returned for correction</p>
          <p>{worksheet.supervisor_comment || "No reason was recorded."}</p>
        </div>
      )}
      {ack && (
        <div className="rounded-lg border border-orac-border bg-orac-surface p-3">
          <p className="font-semibold text-orac-slate">Client acknowledgement</p>
          <p>{ack.signer_name}{ack.signer_role ? `, ${ack.signer_role}` : ""}</p>
          <p className="text-xs text-orac-secondary">Acknowledged {formatWhen(ack.acknowledged_at)}{ack.evidence_reference ? ` · Reference ${ack.evidence_reference}` : ""}</p>
        </div>
      )}
      {worksheet.status === "Supervisor_Approved" && (
        <div className="rounded-lg border border-orac-border bg-orac-surface p-3">
          <p className="font-semibold text-orac-slate">Supervisor approval (internal)</p>
          <p className="text-xs text-orac-secondary">Approved {formatWhen(worksheet.approved_at)}</p>
          {worksheet.supervisor_comment && <p>{worksheet.supervisor_comment}</p>}
        </div>
      )}
      {(worksheet.revision_number || 1) > 1 && (
        <p className="text-xs text-orac-secondary">Revision {worksheet.revision_number}{worksheet.revision_reason ? `. Reason: ${worksheet.revision_reason}` : ""}</p>
      )}
      {worksheet.superseded_by && <p className="text-xs text-orac-secondary">Superseded by a later revision.</p>}
    </div>
  );
}
