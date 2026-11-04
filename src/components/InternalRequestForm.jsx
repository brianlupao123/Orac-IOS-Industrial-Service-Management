import React, { useState } from "react";
import { ErrorBanner, PageEmptyState } from "./PageStates.jsx";
import { ICONS } from "./icons.jsx";
import {
  COORDINATION_ONLY_NOTICE, EMPTY_INTERNAL_REQUEST_FORM, EMPTY_TECHNICIAN_DETAILS, buildInternalRequestPayload,
  findOption, relatedTypeChoices, validateInternalRequestForm
} from "../internalWorkRequestModel.js";

const fieldClass = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-orac-blue focus:outline-none focus:ring-2 focus:ring-orac-blue/20";
const labelClass = "mb-1 block text-xs font-medium uppercase tracking-wider text-gray-600";

// New-request form. Every choice (types, recipients, priorities, related-record
// kinds, length limits) comes from GET /internal-work-requests/options. The
// server re-validates the pairing, the related record and the limits.
export default function InternalRequestForm({ options, requesterRole, onCreate }) {
  const [form, setForm] = useState({ ...EMPTY_INTERNAL_REQUEST_FORM, technician: { ...EMPTY_TECHNICIAN_DETAILS } });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");

  const option = findOption(options, form.request_type);
  const choices = relatedTypeChoices(option, requesterRole);
  const registration = option?.technician_registration || null;
  const { limits } = options;

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const updateDetail = (key) => (event) => setForm((current) => ({ ...current, technician: { ...current.technician, [key]: event.target.value } }));

  function chooseType(event) {
    const next = findOption(options, event.target.value);
    const nextChoices = relatedTypeChoices(next, requesterRole);
    setForm((current) => ({
      ...current,
      request_type: event.target.value,
      recipient_role: "",
      technician: { ...EMPTY_TECHNICIAN_DETAILS },
      related_entity_type: next?.related_required && nextChoices.length === 1 ? nextChoices[0].type : "",
      related_entity_id: ""
    }));
    setFormError("");
  }

  function chooseRelatedType(event) {
    setForm((current) => ({ ...current, related_entity_type: event.target.value, related_entity_id: "" }));
  }

  async function submit(event) {
    event.preventDefault();
    setNotice("");
    const problem = validateInternalRequestForm(form, option, limits, requesterRole);
    if (problem) { setFormError(problem); return; }
    setFormError("");
    setSubmitting(true);
    try {
      await onCreate(buildInternalRequestPayload(form, option));
      setForm({ ...EMPTY_INTERNAL_REQUEST_FORM, technician: { ...EMPTY_TECHNICIAN_DETAILS } });
      setNotice("Your request was sent. Follow its progress under My Requests.");
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (options.types.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <PageEmptyState iconPath={ICONS.clipboard} title="No request types available" subtitle="There are no internal request types you can raise." />
      </div>
    );
  }

  return (
    <form onSubmit={submit} aria-labelledby="internal-request-form-heading" data-evidence="internal-request-form" className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <h2 id="internal-request-form-heading" className="mb-4 text-sm font-semibold text-orac-slate">New internal request</h2>
      <div className="space-y-4">
        <div>
          <label htmlFor="iwr-type" className={labelClass}>Request type</label>
          <select id="iwr-type" value={form.request_type} onChange={chooseType} className={fieldClass} required>
            <option value="">Choose a type</option>
            {options.types.map((entry) => <option key={entry.request_type} value={entry.request_type}>{entry.label}</option>)}
          </select>
        </div>

        {option && (
          <>
            <div>
              {option.recipients.length === 1 ? (
                <>
                  <p className={labelClass}>Send to</p>
                  <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800">{option.recipients[0]}</p>
                </>
              ) : (
                <>
                  <label htmlFor="iwr-recipient" className={labelClass}>Send to</label>
                  <select id="iwr-recipient" value={form.recipient_role} onChange={update("recipient_role")} className={fieldClass} required>
                    <option value="">Choose who receives it</option>
                    {option.recipients.map((role) => <option key={role} value={role}>{role}</option>)}
                  </select>
                </>
              )}
            </div>

            <div>
              <label htmlFor="iwr-priority" className={labelClass}>Priority</label>
              <select id="iwr-priority" value={form.priority} onChange={update("priority")} className={fieldClass}>
                <option value="">Default priority</option>
                {options.priorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
              </select>
            </div>

            {registration ? (
              <fieldset className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-3" data-evidence="technician-details">
                <legend className="px-1 text-xs font-medium uppercase tracking-wider text-gray-600">New technician details</legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="iwr-first-name" className={labelClass}>First name</label>
                    <input id="iwr-first-name" type="text" autoComplete="off" value={form.technician.first_name} onChange={updateDetail("first_name")} maxLength={registration.limits.name} className={fieldClass} required />
                  </div>
                  <div>
                    <label htmlFor="iwr-last-name" className={labelClass}>Last name</label>
                    <input id="iwr-last-name" type="text" autoComplete="off" value={form.technician.last_name} onChange={updateDetail("last_name")} maxLength={registration.limits.name} className={fieldClass} required />
                  </div>
                </div>
                <div>
                  <label htmlFor="iwr-national-id" className={labelClass}>National ID</label>
                  <input id="iwr-national-id" type="text" autoComplete="off" value={form.technician.national_id} onChange={updateDetail("national_id")} maxLength={registration.limits.nationalId} className={fieldClass} required />
                  <p className="mt-1 text-xs text-gray-500">Used to make sure the same person is not registered twice. It is shown only to you and the person who approves the request.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="iwr-trade" className={labelClass}>Trade</label>
                    <select id="iwr-trade" value={form.technician.trade} onChange={updateDetail("trade")} className={fieldClass} required>
                      <option value="">Choose a trade</option>
                      {registration.trades.map((trade) => <option key={trade} value={trade}>{trade}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="iwr-worker-type" className={labelClass}>Worker type</label>
                    <select id="iwr-worker-type" value={form.technician.worker_type} onChange={updateDetail("worker_type")} className={fieldClass} required>
                      <option value="">Choose a type</option>
                      {registration.worker_types.map((kind) => <option key={kind} value={kind}>{kind.charAt(0).toUpperCase() + kind.slice(1)}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label htmlFor="iwr-phone" className={labelClass}>Phone number</label>
                  <input id="iwr-phone" type="tel" autoComplete="off" value={form.technician.phone_number} onChange={updateDetail("phone_number")} maxLength={registration.limits.phone} className={fieldClass} required />
                </div>
              </fieldset>
            ) : (
            <>
            <div>
              <label htmlFor="iwr-subject" className={labelClass}>Subject</label>
              <input id="iwr-subject" type="text" value={form.subject} onChange={update("subject")} maxLength={limits.subject} className={fieldClass} required />
            </div>

            <div>
              <label htmlFor="iwr-description" className={labelClass}>What do you need?</label>
              <textarea id="iwr-description" rows={4} value={form.description} onChange={update("description")} maxLength={limits.description} className={fieldClass} required />
              <p className="mt-1 text-xs text-gray-500">{form.description.length} of {limits.description} characters</p>
            </div>

            {choices.length > 0 && (
              <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                <div>
                  <label htmlFor="iwr-related-type" className={labelClass}>Related record {option.related_required ? "(required)" : "(optional)"}</label>
                  <select id="iwr-related-type" value={form.related_entity_type} onChange={chooseRelatedType} className={fieldClass} required={option.related_required}>
                    <option value="">{option.related_required ? "Choose a record type" : "None"}</option>
                    {choices.map((item) => <option key={item.type} value={item.type}>{item.label}</option>)}
                  </select>
                </div>
                {form.related_entity_type && (
                  <div>
                    <label htmlFor="iwr-related-id" className={labelClass}>Record ID</label>
                    <input id="iwr-related-id" type="text" value={form.related_entity_id} onChange={update("related_entity_id")} maxLength={limits.relatedId} className={fieldClass} required />
                    <p className="mt-1 text-xs text-gray-500">The server checks that you are allowed to use this record.</p>
                  </div>
                )}
              </div>
            )}
            {option.related_required && choices.length === 0 && (
              <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">This request type needs a related record, but no record type is available to you.</p>
            )}
            </>
            )}
          </>
        )}

        <p className="text-xs text-gray-600" data-evidence="coordination-notice-form">{COORDINATION_ONLY_NOTICE}</p>
        {formError && <ErrorBanner message={formError} />}
        {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
        <button type="submit" disabled={submitting || !option} className="w-full rounded-lg bg-orac-blue py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:brightness-105 disabled:opacity-50">
          {submitting ? "Sending..." : "Send request"}
        </button>
      </div>
    </form>
  );
}
