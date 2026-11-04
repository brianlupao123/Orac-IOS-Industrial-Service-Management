import React, { useEffect, useMemo, useRef, useState } from "react";
import Modal from "./Modal.jsx";
import { collections, dispatch } from "../api/client.js";
import { displayTrade } from "../constants/trades.js";
import { totalHours, reviewHints, newRequestId } from "../lib/timesheetFormLogic.js";
import {
  EMPTY_PAPER_FORM, MAX_SCAN_DATA_URL_CHARS, technicianOptions, validatePaperEntry, buildPaperPayload
} from "../lib/paperEntryLogic.js";

// Sales Desk "Add Timesheet (Paper Entry)": records a signed paper timesheet received from a
// field supervisor, with the paper evidence (booklet / sheet reference, who signed, scan).
// It creates the SAME Timesheet record as the on-site form, through the same endpoint; the
// server decides what is accepted. There is no rate, amount or cost field here.

const inputCls = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-orac-blue focus:outline-none focus:ring-2 focus:ring-orac-blue/20 dark:bg-transparent";
const labelCls = "mb-1 block text-sm font-semibold text-gray-600";

// Phone photos are often several MB. Shrink to fit the upload limit, entirely on this device.
async function shrinkToDataUrl(file) {
  const readAsDataUrl = (blob) => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(new Error("Could not read the image."));
    r.readAsDataURL(blob);
  });
  const original = await readAsDataUrl(file);
  if (original.length <= MAX_SCAN_DATA_URL_CHARS) return original;
  const img = await new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("This image could not be opened. Try a JPG or PNG photo."));
    el.src = original;
  });
  for (const maxSide of [1800, 1400, 1100, 900]) {
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const q of [0.8, 0.65, 0.5]) {
      const out = canvas.toDataURL("image/jpeg", q);
      if (out.length <= MAX_SCAN_DATA_URL_CHARS) return out;
    }
  }
  throw new Error("The image is still too large after shrinking. Take a closer, smaller photo.");
}

export default function PaperEntryModal({ isOpen, onClose, user, dispatches, worksheets, onSaved }) {
  const [form, setForm] = useState(EMPTY_PAPER_FORM());
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);
  const [scanName, setScanName] = useState("");
  const fileRef = useRef(null);
  const cameraRef = useRef(null);

  // Fresh form each time it opens; the technician list is read once per opening.
  useEffect(() => {
    if (!isOpen) return;
    setForm({ ...EMPTY_PAPER_FORM(), client_request_id: newRequestId() });
    setError(""); setScanName("");
    let alive = true;
    collections.list("users").then((u) => { if (alive) setUsers(Array.isArray(u) ? u : []); }).catch(() => { if (alive) setUsers([]); });
    return () => { alive = false; };
  }, [isOpen]);

  const technicians = useMemo(() => technicianOptions(users, worksheets), [users, worksheets]);
  const tech = technicians.find((t) => t.id === form.technician_id) || null;
  const dispatchOptions = useMemo(() => (dispatches || []).map((d) => ({ id: d.id, label: d.dispatch_number || d.title || d.id })), [dispatches]);
  const set = (patch) => setForm((p) => ({ ...p, ...patch }));
  const total = totalHours(form);
  const hints = reviewHints(form);

  async function onScan(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(""); setScanBusy(true);
    try {
      set({ signed_copy_image: await shrinkToDataUrl(file) });
      setScanName(file.name || "Camera photo");
    } catch (err) { setError(err.message); }
    finally { setScanBusy(false); }
  }

  async function save(submit) {
    const errors = validatePaperEntry(form, tech, { submit, role: user.role });
    if (errors.length) { setError(errors[0]); return; }
    setBusy(true); setError("");
    try {
      await dispatch.createWorksheet(form.dispatch_card_id, buildPaperPayload(form, tech, { submit, role: user.role }));
      onSaved(submit
        ? `Paper timesheet ${form.paper_reference.trim()} submitted. It now follows the normal acknowledgement and approval steps.`
        : `Paper timesheet ${form.paper_reference.trim()} saved as a Draft.`);
      onClose();
    } catch (err) {
      setError(err.message || "The paper timesheet could not be saved.");
    } finally { setBusy(false); }
  }

  return (
    <Modal title="Add Timesheet (Paper Entry)" isOpen={isOpen} onClose={onClose} size="xl">
      <form onSubmit={(e) => { e.preventDefault(); save(false); }} className="space-y-5">
        <p className="rounded-lg bg-sky-50 p-3 text-xs text-sky-900 dark:bg-sky-950/30 dark:text-sky-200">
          Use this for a signed paper timesheet received from a field supervisor. Type exactly what the paper shows, and keep the original booklet safe.
        </p>
        {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div>}

        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-gray-500">Paper evidence</legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="pe-ref" className={labelCls}>Physical Booklet / Sheet Ref # <span className="text-red-600">*</span></label>
              <input id="pe-ref" required value={form.paper_reference} onChange={(e) => set({ paper_reference: e.target.value })} placeholder="Booklet #42 - Sheet 15" className={inputCls} />
            </div>
            <div>
              <label htmlFor="pe-signer" className={labelCls}>Client Representative Who Signed</label>
              <input id="pe-signer" value={form.client_signatory} onChange={(e) => set({ client_signatory: e.target.value })} placeholder="Eng. J. Phiri - Plant Manager" className={inputCls} />
              <p className="mt-1 text-xs text-gray-500">Needed to submit.</p>
            </div>
          </div>
          <div>
            <span className={labelCls}>Attach Scanned Copy / Photo</span>
            <div className="flex flex-wrap items-center gap-3">
              <input ref={fileRef} id="pe-scan" type="file" accept="image/*" onChange={onScan} className="sr-only" />
              <input ref={cameraRef} id="pe-camera" type="file" accept="image/*" capture="environment" onChange={onScan} className="sr-only" />
              <button type="button" onClick={() => fileRef.current?.click()} className="min-h-[44px] rounded-lg border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 dark:bg-transparent dark:text-slate-200">Choose file</button>
              <button type="button" onClick={() => cameraRef.current?.click()} className="min-h-[44px] rounded-lg border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 dark:bg-transparent dark:text-slate-200">Take photo</button>
              {scanBusy && <span role="status" className="text-xs text-gray-500">Preparing image...</span>}
              {form.signed_copy_image && !scanBusy && (
                <span className="flex items-center gap-2 text-xs text-emerald-700">
                  Attached{scanName ? `: ${scanName}` : ""}
                  <button type="button" onClick={() => { set({ signed_copy_image: "" }); setScanName(""); }} className="font-semibold text-red-700 underline">Remove</button>
                </span>
              )}
            </div>
            {form.signed_copy_image && <img src={form.signed_copy_image} alt="Scanned paper timesheet preview" className="mt-3 max-h-48 rounded-lg border border-gray-200" />}
            <p className="mt-1 text-xs text-gray-500">Photos are shrunk on this device if they are large. Needed to submit.</p>
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-gray-500">Technician</legend>
          <div>
            <label htmlFor="pe-tech" className={labelCls}>Technician <span className="text-red-600">*</span></label>
            <select id="pe-tech" required value={form.technician_id} onChange={(e) => set({ technician_id: e.target.value })} className={inputCls}>
              <option value="">Select a technician</option>
              {technicians.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            {technicians.length === 0 && <p className="mt-1 text-xs text-amber-800">No technicians are available to your account yet. Ask an Admin to check the technician list.</p>}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="pe-trade" className={labelCls}>Trade</label>
              <input id="pe-trade" readOnly value={tech ? displayTrade(tech.trade) : ""} placeholder="Fills in from the technician" className={`${inputCls} bg-gray-50`} />
            </div>
            <div>
              <label htmlFor="pe-nid" className={labelCls}>National ID</label>
              <input id="pe-nid" readOnly value={tech ? (tech.national_id || "Not on file") : ""} placeholder="Fills in from the technician" className={`${inputCls} bg-gray-50`} />
            </div>
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-gray-500">Job &amp; hours (as written on the paper)</legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="pe-dispatch" className={labelCls}>Job (dispatch card)</label>
              <select id="pe-dispatch" required value={form.dispatch_card_id} onChange={(e) => set({ dispatch_card_id: e.target.value })} className={inputCls}>
                <option value="">Select a job</option>
                {dispatchOptions.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="pe-date" className={labelCls}>Work date</label>
              <input id="pe-date" type="date" required value={form.work_date} onChange={(e) => set({ work_date: e.target.value })} className={inputCls} />
            </div>
          </div>
          <div>
            <label htmlFor="pe-activity" className={labelCls}>Work description</label>
            <textarea id="pe-activity" rows={3} required value={form.activity} onChange={(e) => set({ activity: e.target.value })} className={inputCls} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[["normal", "Normal"], ["ot_15", "1.5"], ["ot_20", "2.0"]].map(([k, label]) => (
              <div key={k}>
                <label htmlFor={`pe-${k}`} className={labelCls}>{label}</label>
                <input id={`pe-${k}`} type="number" inputMode="decimal" min="0" max="24" step="0.25" value={form[k]} onChange={(e) => set({ [k]: e.target.value })} className={inputCls} />
              </div>
            ))}
          </div>
          <p className="text-sm text-gray-600" aria-live="polite">Total: <strong>{Number.isFinite(total) ? total : "-"}</strong> hours. Type the classes shown on the paper.</p>
          {hints.map((h) => <p key={h} className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">{h}</p>)}
        </fieldset>

        <div className="flex flex-wrap justify-end gap-3 border-t border-gray-100 pt-4">
          <button type="button" onClick={onClose} className="min-h-[44px] px-4 text-sm font-medium text-gray-600">Cancel</button>
          <button type="submit" disabled={busy || scanBusy} className="min-h-[44px] rounded-lg border border-gray-300 bg-white px-5 text-sm font-semibold text-gray-700 disabled:opacity-50 dark:bg-transparent dark:text-slate-200">{busy ? "Saving..." : "Save as draft"}</button>
          <button type="button" disabled={busy || scanBusy} onClick={() => save(true)} className="min-h-[44px] rounded-lg bg-orac-blue px-5 text-sm font-semibold text-white disabled:opacity-50">Submit paper entry</button>
        </div>
      </form>
    </Modal>
  );
}
