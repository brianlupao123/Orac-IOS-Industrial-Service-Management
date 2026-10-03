import React, { useEffect, useMemo, useState } from "react";
import { collections, dailyTimesheets } from "../api/client.js";
import StatusBadge from "../components/StatusBadge.jsx";
import Modal from "../components/Modal.jsx";
import {
  computeNormalHours, validateDailyTimesheetEntries
} from "../lib/dailyTimesheetLogic.js";

const REVIEW_ROLES = ["Admin", "Operations", "Supervisor"];
const SUBMIT_ROLES = ["Admin", "Operations", "Supervisor", "Technician"];

function emptyRow() {
  return { kind: "entry", date: "", start_time: "", end_time: "", normal_hours: "", ot_15: "", ot_20: "", description: "" };
}

function emptyForm() {
  return {
    name_on_form: "",
    category: "",
    department_section: "",
    cell_number: "",
    entries: [emptyRow()]
  };
}

export default function DailyTimesheetPage({ user }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [comment, setComment] = useState({});

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalError, setModalError] = useState("");
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm());

  const canReview = REVIEW_ROLES.includes(user.role);
  const canSubmit = SUBMIT_ROLES.includes(user.role);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await collections.list("daily_timesheets");
      setItems(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openCreateModal() {
    setForm(emptyForm());
    setModalError("");
    setIsModalOpen(true);
  }

  function updateRow(index, patch) {
    setForm((prev) => {
      const entries = prev.entries.map((row, i) => (i === index ? { ...row, ...patch } : row));
      // Auto-calculate NORMAL from start/end, but let the clerk override it
      // afterwards (the paper form doesn't deduct a lunch break, so a
      // straight end-start figure can legitimately need adjusting).
      if (("start_time" in patch || "end_time" in patch) && entries[index].kind !== "separator") {
        const computed = computeNormalHours(entries[index].start_time, entries[index].end_time);
        if (computed !== null) entries[index].normal_hours = computed;
      }
      return { ...prev, entries };
    });
  }

  function addRow() {
    setForm((prev) => ({ ...prev, entries: [...prev.entries, emptyRow()] }));
  }

  function addSeparatorRow() {
    setForm((prev) => ({ ...prev, entries: [...prev.entries, { kind: "separator" }] }));
  }

  function removeRow(index) {
    setForm((prev) => ({ ...prev, entries: prev.entries.filter((_, i) => i !== index) }));
  }

  const liveErrors = useMemo(() => validateDailyTimesheetEntries(form.entries), [form.entries]);

  async function handleSave(submit) {
    setModalError("");
    if (!form.name_on_form.trim()) {
      setModalError("Name is required.");
      return;
    }
    if (liveErrors.length) {
      setModalError(liveErrors[0]);
      return;
    }
    setModalSubmitting(true);
    try {
      await dailyTimesheets.create({ ...form, submit });
      setIsModalOpen(false);
      await load();
    } catch (err) {
      setModalError(err.message);
    } finally {
      setModalSubmitting(false);
    }
  }

  async function handleSubmitExisting(id) {
    try {
      await dailyTimesheets.submit(id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleReview(id, decision) {
    try {
      await dailyTimesheets.review(id, decision, comment[id] || "");
      setComment((prev) => ({ ...prev, [id]: "" }));
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  function openPrintView(id) {
    window.open(`/daily-timesheets/${id}/print`, "_blank", "noopener");
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-orac-slate">Daily Time Sheets</h1>
          <p className="text-sm text-gray-500">Digitised version of the paper "Daily Time Sheet" form.</p>
        </div>
        {canSubmit && (
          <button onClick={openCreateModal} className="rounded-md bg-orac-cyan px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
            New Time Sheet
          </button>
        )}
      </div>

      {error && <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{error}</div>}
      {loading && <div className="text-sm text-gray-500">Loading...</div>}

      {!loading && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-sm text-gray-600">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2">Rows</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">No daily time sheets yet.</td></tr>
              )}
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-2 font-medium text-gray-800">{item.name_on_form}</td>
                  <td className="px-4 py-2 text-gray-600">{item.category || "-"}</td>
                  <td className="px-4 py-2 text-gray-600">{(item.entries || []).filter((r) => r.kind !== "separator").length}</td>
                  <td className="px-4 py-2"><StatusBadge status={item.status} /></td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <button onClick={() => openPrintView(item.id)} className="text-sm font-semibold text-orac-cyan hover:underline">Print</button>
                      {canSubmit && ["Draft", "Returned_For_Correction"].includes(item.status) && (
                        <button onClick={() => handleSubmitExisting(item.id)} className="text-sm font-semibold text-emerald-700 hover:underline">Submit</button>
                      )}
                      {canReview && item.status === "Submitted" && (
                        <>
                          <input
                            value={comment[item.id] || ""}
                            onChange={(e) => setComment((prev) => ({ ...prev, [item.id]: e.target.value }))}
                            placeholder="Comment (required to return)"
                            className="w-40 rounded border border-gray-200 px-2 py-1 text-xs"
                          />
                          <button onClick={() => handleReview(item.id, "approve")} className="text-sm font-semibold text-emerald-700 hover:underline">Approve</button>
                          <button onClick={() => handleReview(item.id, "return")} className="text-sm font-semibold text-red-700 hover:underline">Return</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal title="New Daily Time Sheet" isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
          {modalError && <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{modalError}</div>}

          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm font-semibold text-gray-700">
              NAME
              <input value={form.name_on_form} onChange={(e) => setForm((p) => ({ ...p, name_on_form: e.target.value }))}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm" />
            </label>
            <label className="text-sm font-semibold text-gray-700">
              CATEGORY
              <input value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                placeholder="e.g. Assistant, plumber, welder"
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm" />
            </label>
            <label className="text-sm font-semibold text-gray-700">
              DEPARTMENT/SECTION
              <input value={form.department_section} onChange={(e) => setForm((p) => ({ ...p, department_section: e.target.value }))}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm" />
            </label>
            <label className="text-sm font-semibold text-gray-700">
              CELL NUMBER
              <input value={form.cell_number} onChange={(e) => setForm((p) => ({ ...p, cell_number: e.target.value }))}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm" />
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-xs border border-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="border border-gray-200 px-1 py-1">Date</th>
                  <th className="border border-gray-200 px-1 py-1">Start</th>
                  <th className="border border-gray-200 px-1 py-1">End</th>
                  <th className="border border-gray-200 px-1 py-1">Normal</th>
                  <th className="border border-gray-200 px-1 py-1">1.5</th>
                  <th className="border border-gray-200 px-1 py-1">2.0</th>
                  <th className="border border-gray-200 px-1 py-1">Description</th>
                  <th className="border border-gray-200 px-1 py-1"></th>
                </tr>
              </thead>
              <tbody>
                {form.entries.map((row, index) => (
                  row.kind === "separator" ? (
                    <tr key={index} className="bg-gray-50">
                      <td colSpan={7} className="border border-gray-200 px-2 py-1 text-center text-gray-400">&mdash; (skip day) &mdash;</td>
                      <td className="border border-gray-200 px-1 py-1 text-center">
                        <button onClick={() => removeRow(index)} className="text-red-600">x</button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={index}>
                      <td className="border border-gray-200 p-0"><input type="date" value={row.date} onChange={(e) => updateRow(index, { date: e.target.value })} className="w-full px-1 py-1" /></td>
                      <td className="border border-gray-200 p-0"><input type="time" value={row.start_time} onChange={(e) => updateRow(index, { start_time: e.target.value })} className="w-full px-1 py-1" /></td>
                      <td className="border border-gray-200 p-0"><input type="time" value={row.end_time} onChange={(e) => updateRow(index, { end_time: e.target.value })} className="w-full px-1 py-1" /></td>
                      <td className="border border-gray-200 p-0"><input value={row.normal_hours} onChange={(e) => updateRow(index, { normal_hours: e.target.value })} className="w-16 px-1 py-1" /></td>
                      <td className="border border-gray-200 p-0"><input value={row.ot_15} onChange={(e) => updateRow(index, { ot_15: e.target.value })} className="w-10 px-1 py-1" /></td>
                      <td className="border border-gray-200 p-0"><input value={row.ot_20} onChange={(e) => updateRow(index, { ot_20: e.target.value })} className="w-10 px-1 py-1" /></td>
                      <td className="border border-gray-200 p-0"><input value={row.description} onChange={(e) => updateRow(index, { description: e.target.value })} className="w-full px-1 py-1" /></td>
                      <td className="border border-gray-200 px-1 py-1 text-center">
                        <button onClick={() => removeRow(index)} className="text-red-600">x</button>
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-2">
            <button onClick={addRow} className="rounded border border-gray-300 px-3 py-1 text-sm font-semibold text-gray-700 hover:bg-gray-50">+ Row</button>
            <button onClick={addSeparatorRow} className="rounded border border-gray-300 px-3 py-1 text-sm font-semibold text-gray-700 hover:bg-gray-50">+ Separator (&mdash;)</button>
          </div>

          <p className="text-[11px] text-gray-400">
            1.5 / 2.0 columns accept a number of hours or "X" for no overtime. NORMAL auto-fills from Start/End
            (no lunch deduction, matching the paper form) but can be overridden.
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <button disabled={modalSubmitting} onClick={() => handleSave(false)} className="rounded border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
              Save as Draft
            </button>
            <button disabled={modalSubmitting} onClick={() => handleSave(true)} className="rounded bg-orac-cyan px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
              Save &amp; Submit
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
