import React, { useEffect, useMemo, useState } from "react";
import { collections, contractorLogs } from "../api/client.js";
import StatusBadge from "../components/StatusBadge.jsx";
import Modal from "../components/Modal.jsx";
import { computeLogTotals, validateContractorLogRows } from "../lib/contractorLogLogic.js";

const REVIEW_ROLES = ["Admin", "Operations", "Supervisor"];
const CREATE_ROLES = ["Admin", "Operations", "Supervisor"];

function emptyRow() {
  return { worker_name: "", grade: "", normal: "", ot_15: "", ot_20: "", comments: "" };
}

function emptyForm() {
  return {
    contractor_name: "",
    department_section: "",
    section: "",
    order_no: "",
    log_date: "",
    work_description: "",
    rows: [emptyRow(), emptyRow()]
  };
}

export default function ContractorLogPage({ user }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [comment, setComment] = useState({});

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalError, setModalError] = useState("");
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm());

  const canCreate = CREATE_ROLES.includes(user.role);
  const canReview = REVIEW_ROLES.includes(user.role);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await collections.list("contractor_log_sheets");
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
    setForm((prev) => ({ ...prev, rows: prev.rows.map((row, i) => (i === index ? { ...row, ...patch } : row)) }));
  }

  function addRow() {
    setForm((prev) => ({ ...prev, rows: [...prev.rows, emptyRow()] }));
  }

  function removeRow(index) {
    setForm((prev) => ({ ...prev, rows: prev.rows.filter((_, i) => i !== index) }));
  }

  const liveErrors = useMemo(() => validateContractorLogRows(form.rows), [form.rows]);
  const liveTotals = useMemo(() => computeLogTotals(form.rows), [form.rows]);

  async function handleSave(submit) {
    setModalError("");
    if (!form.contractor_name.trim()) {
      setModalError("Name of Contractor is required.");
      return;
    }
    if (liveErrors.length) {
      setModalError(liveErrors[0]);
      return;
    }
    setModalSubmitting(true);
    try {
      await contractorLogs.create({ ...form, submit });
      setIsModalOpen(false);
      await load();
    } catch (err) {
      setModalError(err.message);
    } finally {
      setModalSubmitting(false);
    }
  }

  async function handleReview(id, decision) {
    try {
      await contractorLogs.review(id, decision, comment[id] || "");
      setComment((prev) => ({ ...prev, [id]: "" }));
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  function openPrintView(id) {
    window.open(`/contractor-logs/${id}/print`, "_blank", "noopener");
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-orac-slate">Contractors Log Sheet</h1>
          <p className="text-sm text-gray-500">Digitised version of the "Contractors Work Specification Form" paper log.</p>
        </div>
        {canCreate && (
          <button onClick={openCreateModal} className="rounded-md bg-orac-cyan px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
            New Log Sheet
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
                <th className="px-4 py-2">Contractor</th>
                <th className="px-4 py-2">Order No.</th>
                <th className="px-4 py-2">Workers</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">No contractor log sheets yet.</td></tr>
              )}
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-2 font-medium text-gray-800">{item.contractor_name}</td>
                  <td className="px-4 py-2 text-gray-600">{item.order_no || "-"}</td>
                  <td className="px-4 py-2 text-gray-600">{(item.rows || []).filter((r) => (r.worker_name || "").trim()).length}</td>
                  <td className="px-4 py-2"><StatusBadge status={item.status} /></td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <button onClick={() => openPrintView(item.id)} className="text-sm font-semibold text-orac-cyan hover:underline">Print</button>
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

      <Modal title="New Contractors Log Sheet" isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
          {modalError && <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{modalError}</div>}

          <div className="grid grid-cols-3 gap-3">
            <label className="text-sm font-semibold text-gray-700 col-span-2">
              Name of Contractor
              <input value={form.contractor_name} onChange={(e) => setForm((p) => ({ ...p, contractor_name: e.target.value }))}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm" />
            </label>
            <label className="text-sm font-semibold text-gray-700">
              Order No.
              <input value={form.order_no} onChange={(e) => setForm((p) => ({ ...p, order_no: e.target.value }))}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm" />
            </label>
            <label className="text-sm font-semibold text-gray-700">
              Department
              <input value={form.department_section} onChange={(e) => setForm((p) => ({ ...p, department_section: e.target.value }))}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm" />
            </label>
            <label className="text-sm font-semibold text-gray-700">
              Section
              <input value={form.section} onChange={(e) => setForm((p) => ({ ...p, section: e.target.value }))}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm" />
            </label>
            <label className="text-sm font-semibold text-gray-700">
              Date
              <input type="date" value={form.log_date} onChange={(e) => setForm((p) => ({ ...p, log_date: e.target.value }))}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm" />
            </label>
            <label className="text-sm font-semibold text-gray-700 col-span-3">
              Work description
              <input value={form.work_description} onChange={(e) => setForm((p) => ({ ...p, work_description: e.target.value }))}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm" />
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-xs border border-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="border border-gray-200 px-1 py-1">Name</th>
                  <th className="border border-gray-200 px-1 py-1">Grade</th>
                  <th className="border border-gray-200 px-1 py-1">Normal</th>
                  <th className="border border-gray-200 px-1 py-1">OT 1.5</th>
                  <th className="border border-gray-200 px-1 py-1">OT 2.0</th>
                  <th className="border border-gray-200 px-1 py-1">Total Hrs*</th>
                  <th className="border border-gray-200 px-1 py-1">Comments</th>
                  <th className="border border-gray-200 px-1 py-1"></th>
                </tr>
              </thead>
              <tbody>
                {form.rows.map((row, index) => {
                  const rowTotals = computeLogTotals([row]);
                  return (
                    <tr key={index}>
                      <td className="border border-gray-200 p-0"><input value={row.worker_name} onChange={(e) => updateRow(index, { worker_name: e.target.value })} className="w-full px-1 py-1" /></td>
                      <td className="border border-gray-200 p-0">
                        <select value={row.grade} onChange={(e) => updateRow(index, { grade: e.target.value })} className="w-full px-1 py-1">
                          <option value="">-</option>
                          <option value="Artisan">Artisan</option>
                          <option value="Assistant">Assistant</option>
                        </select>
                      </td>
                      <td className="border border-gray-200 p-0"><input value={row.normal} onChange={(e) => updateRow(index, { normal: e.target.value })} className="w-14 px-1 py-1" /></td>
                      <td className="border border-gray-200 p-0"><input value={row.ot_15} onChange={(e) => updateRow(index, { ot_15: e.target.value })} className="w-14 px-1 py-1" /></td>
                      <td className="border border-gray-200 p-0"><input value={row.ot_20} onChange={(e) => updateRow(index, { ot_20: e.target.value })} className="w-14 px-1 py-1" /></td>
                      <td className="border border-gray-200 px-1 py-1 text-center text-gray-500">{rowTotals.total_hours || "-"}</td>
                      <td className="border border-gray-200 p-0"><input value={row.comments} onChange={(e) => updateRow(index, { comments: e.target.value })} className="w-full px-1 py-1" /></td>
                      <td className="border border-gray-200 px-1 py-1 text-center">
                        <button onClick={() => removeRow(index)} className="text-red-600">x</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-50 font-semibold">
                <tr>
                  <td colSpan={2} className="border border-gray-200 px-2 py-1 text-right">Totals</td>
                  <td className="border border-gray-200 px-1 py-1 text-center">{liveTotals.normal}</td>
                  <td className="border border-gray-200 px-1 py-1 text-center">{liveTotals.ot_15}</td>
                  <td className="border border-gray-200 px-1 py-1 text-center">{liveTotals.ot_20}</td>
                  <td className="border border-gray-200 px-1 py-1 text-center">{liveTotals.total_hours}</td>
                  <td colSpan={2} className="border border-gray-200"></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <button onClick={addRow} className="rounded border border-gray-300 px-3 py-1 text-sm font-semibold text-gray-700 hover:bg-gray-50">+ Row</button>

          <p className="text-[11px] text-gray-400">
            * Total Hrs here = Normal + 1.5&times;(OT 1.5) + 2&times;(OT 2.0), an assumption carried from the
            paper-form prototype and not yet confirmed against how labour is actually billed elsewhere in
            this system (see the feature README).
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
