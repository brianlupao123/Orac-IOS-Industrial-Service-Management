import React from "react";
import { ErrorBanner } from "./PageStates.jsx";
import {
  APPROVE_REGISTRATION_ACTION, REGISTRATION_APPROVAL_NOTICE, actionButtonsFor, describeHistoryEntry, describeRegistration,
  describeRelated, formatWhen, priorityTone, statusTone
} from "../internalWorkRequestModel.js";

const buttonClass = "rounded-md border px-3 py-1.5 text-sm font-semibold transition-colors disabled:opacity-50";
// Presentation-only accent so a busy inbox can be scanned at a glance; the
// server's priority value drives it, nothing here changes behaviour or order.
const PRIORITY_ACCENT = { Urgent: "border-l-4 border-l-red-400", High: "border-l-4 border-l-amber-300" };
const priorityAccent = (priority) => PRIORITY_ACCENT[priority] || "border-l-4 border-l-transparent";

// One request. Everything shown, including the buttons, is what the server
// returned for this viewer: allowed_actions is the only source of actions.
export default function InternalRequestCard({ item, mode, open, detail, note, noteLimit, busy, onToggle, onNoteChange, onAction }) {
  const view = detail?.data || item;
  const buttons = actionButtonsFor(view.allowed_actions);
  const related = describeRelated(view.related_entity);
  const registration = describeRegistration(view.payload);
  const canApprove = buttons.some((button) => button.action === APPROVE_REGISTRATION_ACTION);
  const from = view.created_by_name ? `${view.created_by_name} (${view.created_by_role})` : view.created_by_role;
  const noteId = `iwr-note-${item.id}`;

  return (
    <li data-evidence="internal-request-item" className={`rounded-lg border border-gray-200 bg-white p-5 shadow-sm ${priorityAccent(view.priority)}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-orac-slate">{view.subject}</h3>
          <p className="text-sm text-gray-600">
            {view.request_type_label}
            {mode === "inbox" ? ` - from ${from}` : ` - to ${view.recipient_role}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${priorityTone(view.priority)}`}>{view.priority}</span>
          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusTone(view.status)}`}>{view.status}</span>
        </div>
      </div>

      <p className="mt-3 whitespace-pre-wrap text-sm text-gray-800">{view.description}</p>

      {registration.length > 0 && (
        <dl data-evidence="technician-registration-details" className="mt-3 grid gap-x-6 gap-y-1 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-800 sm:grid-cols-2">
          {registration.map((row) => <div key={row.label}><dt className="inline font-medium">{row.label}: </dt><dd className="inline">{row.value}</dd></div>)}
        </dl>
      )}
      {view.registered_user_id && <p data-evidence="technician-registered" className="mt-2 text-sm font-medium text-emerald-800">This person is now in the technician registry.</p>}

      <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm text-gray-600 sm:grid-cols-2">
        {related && <div><dt className="inline font-medium">Related record: </dt><dd className="inline">{related}</dd></div>}
        <div><dt className="inline font-medium">Assigned to: </dt><dd className="inline">{view.assigned_to_name || "Not yet acknowledged"}</dd></div>
        <div><dt className="inline font-medium">Sent: </dt><dd className="inline">{formatWhen(view.created_at)}</dd></div>
        <div><dt className="inline font-medium">Updated: </dt><dd className="inline">{formatWhen(view.updated_at)}</dd></div>
      </dl>
      {view.resolution_note && (
        <p className="mt-2 text-sm text-gray-700"><span className="font-medium">Resolution or reason:</span> {view.resolution_note}</p>
      )}

      {open && (
        <div className="mt-4 border-t border-gray-100 pt-4" data-evidence="internal-request-detail">
          {detail?.loading && <p role="status" className="text-sm text-gray-500">Loading history...</p>}
          {detail?.error && <ErrorBanner message={detail.error} />}
          {Array.isArray(detail?.data?.history) && (
            detail.data.history.length === 0 ? (
              <p className="text-sm text-gray-500">No history recorded.</p>
            ) : (
              <ol className="space-y-2">
                {detail.data.history.map((entry, index) => (
                  <li key={`${entry.at}-${index}`} className="text-sm text-gray-700">
                    <span className="text-gray-500">{formatWhen(entry.at)}</span> - {describeHistoryEntry(entry)}
                    {entry.note && <span className="block text-gray-600">Note: {entry.note}</span>}
                  </li>
                ))}
              </ol>
            )
          )}
        </div>
      )}

      {buttons.length > 0 && (
        <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
          <div>
            <label htmlFor={noteId} className="mb-1 block text-xs font-medium uppercase tracking-wider text-gray-600">Note or reason</label>
            <textarea id={noteId} rows={2} value={note} maxLength={noteLimit} onChange={(event) => onNoteChange(event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:outline-none focus:ring-2 focus:ring-orac-blue/20" />
            <p className="mt-1 text-xs text-gray-500">Sent with Start work, Complete, Reject or Cancel. The server tells you if a note is required.</p>
          </div>
          {canApprove && <p data-evidence="technician-approval-notice" className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">{REGISTRATION_APPROVAL_NOTICE}</p>}
          <div className="flex flex-wrap gap-2">
            {buttons.map((button) => (
              <button key={button.action} type="button" disabled={busy} onClick={() => onAction(item, button.action)}
                className={`${buttonClass} ${button.tone === "danger" ? "border-red-200 text-red-700 hover:bg-red-50" : "border-orac-blue bg-orac-blue text-white hover:brightness-105"}`}>
                {busy ? "Working..." : button.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4">
        <button type="button" onClick={() => onToggle(item.id)} aria-expanded={open} className="text-sm font-medium text-orac-blue hover:underline">
          {open ? "Hide history" : "Show history"}
        </button>
      </div>
    </li>
  );
}
