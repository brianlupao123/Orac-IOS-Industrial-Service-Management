import React, { useEffect, useMemo, useState } from "react";
import Modal from "./Modal.jsx";
import { dispatch, worksheets } from "../api/client.js";
import { saveDraft, loadDraft, clearDraft } from "../offlineDraftModel.js";
import { enqueueTimesheet, isNetworkError, loadDispatchOptions } from "../offlineTimesheetOutbox.js";
import {
  EMPTY_TIMESHEET_FORM, newRequestId, totalHours, reviewHints, validateTimesheetForm, buildTimesheetPayload, formFromTimesheet, isTimesheetV2
} from "../lib/timesheetFormLogic.js";

// The ONE Timesheet form: job/dispatch, client (from the job), worker and category, work description,
// materials, Normal / 1.5 / 2.0 hours, the worker's sign-off, then the existing customer acknowledgement
// and Supervisor review. Works without a connection: an unsent Timesheet is kept on this device and sent
// automatically, once, when the connection returns (see offlineTimesheetOutbox.js).
// There is no rate, amount or cost field anywhere on this form.

const STAFF_ROLES = ["Admin", "Operations", "Supervisor"];
const MAX_PHOTO_BYTES = 1_000_000;
function storage() { try { return window.localStorage; } catch { return null; } }
const inputCls = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-orac-blue focus:outline-none focus:ring-2 focus:ring-orac-blue/20";
const labelCls = "mb-1 block text-sm font-semibold text-gray-600";

export default function TimesheetFormModal({ isOpen, onClose, user, dispatches, editing, onSaved }) {
  const [form, setForm] = useState(EMPTY_TIMESHEET_FORM());
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const isStaff = STAFF_ROLES.includes(user.role);
  const online = typeof navigator === "undefined" ? true : navigator.onLine !== false;

  const dispatchOptions = useMemo(() => {
    const live = (dispatches || []).map((d) => ({ id: d.id, label: d.dispatch_number || d.title || d.id }));
    return live.length ? live : loadDispatchOptions(storage(), user.id);
  }, [dispatches, user.id, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setError(""); setNote("");
    if (editing) { setForm({ ...formFromTimesheet(editing), client_request_id: "" }); return; }
    const saved = loadDraft(storage(), user.id, "timesheet", "new");
    setForm({ ...EMPTY_TIMESHEET_FORM(), ...(saved?.data?.form || {}), client_request_id: saved?.data?.form?.client_request_id || newRequestId(), signed_copy_image: "", employee_attest: false });
    if (saved) setNote("Restored an unsent draft saved on this device. The worker's declaration must be given again.");
  }, [isOpen, editing, user.id]);

  // Unsent text is kept on this device. The declaration and photo are never stored in the draft.
  useEffect(() => {
    if (!isOpen || editing) return;
    if (form.activity || form.normal || form.ot_15 || form.ot_20) {
      const { signed_copy_image, employee_attest, ...text } = form;
      saveDraft(storage(), user.id, "timesheet", "new", { form: text });
    }
  }, [form, isOpen, editing]);

  const set = (patch) => setForm((p) => ({ ...p, ...patch }));
  const total = totalHours(form);
  const hints = reviewHints(form);

  function setMaterial(i, patch) { setForm((p) => ({ ...p, materials: p.materials.map((m, k) => (k === i ? { ...m, ...patch } : m)) })); }

  function onPhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return set({ signed_copy_image: "" });
    if (file.size > MAX_PHOTO_BYTES) { setError("The signed copy photo is too large (over 1 MB). Take a smaller photo."); e.target.value = ""; return; }
    const reader = new FileReader();
    reader.onload = () => set({ signed_copy_image: String(reader.result || "") });
    reader.readAsDataURL(file);
  }

  async function save(submit) {
    const errors = validateTimesheetForm(form, { submit, role: user.role });
    if (errors.length) { setError(errors[0]); return; }
    setBusy(true); setError("");
    try {
      if (editing) {
        const { client_request_id, submit: _s, captured_offline_at, ...update } = buildTimesheetPayload(form, { submit: false, role: user.role });
        await worksheets.update(editing.id, update);
        onSaved("Timesheet updated.");
        onClose();
        return;
      }
      const body = buildTimesheetPayload(form, { submit, role: user.role });
      const reference = body.client_request_id;
      if (!online) return queue(form.dispatch_card_id, { ...body, captured_offline_at: new Date().toISOString() }, submit);
      try {
        await dispatch.createWorksheet(form.dispatch_card_id, body);
        clearDraft(storage(), user.id, "timesheet", "new");
        onSaved(submit ? "Timesheet submitted. The customer representative is asked to acknowledge it next." : "Timesheet saved as a Draft.");
        onClose();
      } catch (err) {
        if (isNetworkError(err) && !err.sessionExpired) return queue(form.dispatch_card_id, { ...body, captured_offline_at: new Date().toISOString() }, submit);
        setError(err.message);
        void reference;
      }
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  function queue(dispatchId, body, submit) {
    const r = enqueueTimesheet(storage(), user.id, { dispatchId, body });
    if (!r.ok) { setError(r.error); return; }
    clearDraft(storage(), user.id, "timesheet", "new");
    onSaved(`Saved on this device. It will be sent automatically when you are back online${submit ? "" : " (as a Draft)"}. You can see it under "Waiting to send".`, { queued: true });
    onClose();
  }

  const editingLegacy = editing && !isTimesheetV2(editing);

  return (
    <Modal title={editing ? "Edit Timesheet" : "Create Timesheet"} isOpen={isOpen} onClose={onClose} size="xl">
      <form onSubmit={(e) => { e.preventDefault(); save(false); }} className="space-y-5">
        {!online && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">You are offline. This Timesheet will be kept on this device and sent when the connection returns. The server still checks it before anyone can approve it.</p>}
        {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div>}
        {note && <p role="status" className="text-xs text-gray-500">{note}</p>}
        {editingLegacy && <p className="rounded-lg bg-sky-50 p-3 text-xs text-sky-900">This Timesheet was recorded before Normal / 1.5 / 2.0 hours were captured. Enter the breakdown to bring it up to date.</p>}

        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-gray-500">Dispatch &amp; date</legend>
          <div>
            <label htmlFor="ts-dispatch" className={labelCls}>Job (dispatch card)</label>
            <select id="ts-dispatch" required disabled={Boolean(editing)} value={form.dispatch_card_id} onChange={(e) => set({ dispatch_card_id: e.target.value })} className={inputCls}>
              <option value="">Select a job</option>
              {dispatchOptions.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
            <p className="mt-1 text-xs text-gray-500">The client comes from the job. Jobs are remembered on this device so you can start a Timesheet offline.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="ts-date" className={labelCls}>Work date</label>
              <input id="ts-date" type="date" required value={form.work_date} onChange={(e) => set({ work_date: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label htmlFor="ts-start" className={labelCls}>Start time</label>
              <input id="ts-start" type="time" value={form.start_time} onChange={(e) => set({ start_time: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label htmlFor="ts-end" className={labelCls}>End time</label>
              <input id="ts-end" type="time" value={form.end_time} onChange={(e) => set({ end_time: e.target.value })} className={inputCls} />
            </div>
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-gray-500">Worker</legend>
          {isStaff && !editing && (
            <div>
              <label htmlFor="ts-worker-type" className={labelCls}>Who did the work</label>
              <select id="ts-worker-type" value={form.worker_type} onChange={(e) => set({ worker_type: e.target.value })} className={inputCls}>
                <option value="technician">A Technician (their own account)</option>
                <option value="contractor">A contractor without an account (enter by name)</option>
              </select>
            </div>
          )}
          {isStaff && !editing && form.worker_type === "contractor" && (
            <div>
              <label htmlFor="ts-worker-name" className={labelCls}>Contractor name</label>
              <input id="ts-worker-name" value={form.worker_name} onChange={(e) => set({ worker_name: e.target.value })} className={inputCls} />
            </div>
          )}
          <div>
            <label htmlFor="ts-category" className={labelCls}>Category / trade (optional)</label>
            <input id="ts-category" value={form.worker_category} onChange={(e) => set({ worker_category: e.target.value })} className={inputCls} />
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-gray-500">Work details</legend>
          <div>
            <label htmlFor="ts-activity" className={labelCls}>Work description</label>
            <textarea id="ts-activity" rows={3} required value={form.activity} onChange={(e) => set({ activity: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label htmlFor="ts-outcomes" className={labelCls}>Outcomes (optional)</label>
            <textarea id="ts-outcomes" rows={2} value={form.outcomes} onChange={(e) => set({ outcomes: e.target.value })} className={inputCls} />
          </div>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-gray-500">Hours</legend>
          <div className="grid grid-cols-3 gap-3">
            {[["normal", "Normal"], ["ot_15", "1.5"], ["ot_20", "2.0"]].map(([k, label]) => (
              <div key={k}>
                <label htmlFor={`ts-${k}`} className={labelCls}>{label}</label>
                <input id={`ts-${k}`} type="number" inputMode="decimal" min="0" max="24" step="0.25" value={form[k]} onChange={(e) => set({ [k]: e.target.value })} className={inputCls} />
              </div>
            ))}
          </div>
          <p className="text-sm text-gray-600" aria-live="polite">Total: <strong>{Number.isFinite(total) ? total : "-"}</strong> hours</p>
          {hints.map((h) => <p key={h} className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">{h}</p>)}
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-gray-500">Materials used (optional)</legend>
          {form.materials.map((m, i) => (
            <div key={i} className="grid grid-cols-[1fr_5rem_5rem_auto] gap-2">
              <input aria-label={`Material ${i + 1} description`} placeholder="Description" value={m.description} onChange={(e) => setMaterial(i, { description: e.target.value })} className={inputCls} />
              <input aria-label={`Material ${i + 1} quantity`} type="number" min="0" step="any" placeholder="Qty" value={m.quantity} onChange={(e) => setMaterial(i, { quantity: e.target.value })} className={inputCls} />
              <input aria-label={`Material ${i + 1} unit`} placeholder="Unit" value={m.unit} onChange={(e) => setMaterial(i, { unit: e.target.value })} className={inputCls} />
              <button type="button" onClick={() => setForm((p) => ({ ...p, materials: p.materials.filter((_, k) => k !== i) }))} className="px-2 text-sm text-red-700">Remove</button>
            </div>
          ))}
          <button type="button" onClick={() => setForm((p) => ({ ...p, materials: [...p.materials, { description: "", quantity: "", unit: "" }] }))} className="text-sm font-semibold text-orac-blue underline">+ Add a material</button>
          <p className="text-xs text-gray-500">Stock is issued and checked through the job's materials panel; this list records what the worker says was used.</p>
        </fieldset>

        {!editing && (
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-gray-500">Worker sign-off (needed to submit)</legend>
            <div>
              <label htmlFor="ts-employee" className={labelCls}>Worker's full name</label>
              <input id="ts-employee" value={form.employee_name} onChange={(e) => set({ employee_name: e.target.value })} className={inputCls} />
            </div>
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.employee_attest} onChange={(e) => set({ employee_attest: e.target.checked })} className="mt-1" />
              <span>I confirm these hours and this work are correct and were done by the person named above.</span>
            </label>
            <div>
              <label htmlFor="ts-photo" className={labelCls}>Or attach a photo of the signed paper copy (under 1 MB)</label>
              <input id="ts-photo" type="file" accept="image/*" onChange={onPhoto} className="text-sm" />
            </div>
            <p className="text-xs text-gray-500">After you submit, the customer's representative acknowledges it, then a Supervisor approves it. Those two sign-offs are recorded by their own accounts.</p>
          </fieldset>
        )}

        <div className="flex flex-wrap justify-end gap-3 border-t border-gray-100 pt-4">
          <button type="button" onClick={onClose} className="min-h-[44px] px-4 text-sm font-medium text-gray-600">Cancel</button>
          <button type="submit" disabled={busy} className="min-h-[44px] rounded-lg border border-gray-300 bg-white px-5 text-sm font-semibold text-gray-700 disabled:opacity-50">{busy ? "Saving..." : editing ? "Save changes" : "Save as draft"}</button>
          {!editing && <button type="button" disabled={busy} onClick={() => save(true)} className="min-h-[44px] rounded-lg bg-orac-blue px-5 text-sm font-semibold text-white disabled:opacity-50">Sign and submit</button>}
        </div>
      </form>
    </Modal>
  );
}
