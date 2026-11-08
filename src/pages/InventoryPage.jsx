import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { inventory } from "../api/client.js";
import { canAccessRoute } from "../accessPolicy.js";
import {
  isSupplierReceipt, receiptFields, movementProblem, keyForPayload, clearAttempt,
  referenceLinkTarget, reconciliationText
} from "../inventoryModel.js";
import DataTable from "../components/DataTable.jsx";
import AttentionBand from "../components/AttentionBand.jsx";
import Modal from "../components/Modal.jsx";
import PageHeaderBanner from "../components/PageHeaderBanner.jsx";
import TabNav from "../components/TabNav.jsx";
import { ErrorBanner, PageLoadingSkeleton } from "../components/PageStates.jsx";
import { ICONS } from "../components/icons.jsx";

// Business wording for the ledger. reference_type (what the movement was
// for) wins over the raw in/out/adjustment category when present.
const MOVEMENT_LABELS = { in: "Receipt", out: "Issue / use", adjustment: "Correction" };
const REFERENCE_LABELS = {
  supplier: "Supplier receipt",
  // purchase_orders in ORAC are CLIENT purchase orders, so this is a reference, never supplier purchase evidence.
  purchase_order: "Client PO reference",
  dispatch_card: "Service dispatch issue",
  material_usage: "Service dispatch use",
  direct_sale: "Direct sale issue",
  return: "Return to stock",
  scrap: "Scrap / write-off",
  opening_balance: "Opening balance"
};
function movementLabel(m) {
  return REFERENCE_LABELS[m.reference_type] || MOVEMENT_LABELS[m.movement_type] || "Movement";
}

export default function InventoryPage({ user }) {
  const [items, setItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("stock");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  
  const [form, setForm] = useState({ stock_item_id: "", movement_type: "in", quantity: "", reason: "", category: "", supplier_id: "", source_document_ref: "", override_negative: false });
  const [submitting, setSubmitting] = useState(false);
  // Same payload => same duplicate-submission key, so a double click or a retry is ONE movement on the server.
  const attempt = useRef({ signature: null, key: null });
  const [recon, setRecon] = useState({ loading: false, error: "", data: null });

  const [itemModal, setItemModal] = useState({ open: false, data: null });
  const [supplierModal, setSupplierModal] = useState({ open: false, data: null });
  const [itemModalError, setItemModalError] = useState("");
  const [supplierModalError, setSupplierModalError] = useState("");
  const [historyModal, setHistoryModal] = useState({ open: false, item: null, movements: [], loading: false, error: "" });

  const canManage = ["Admin", "Management", "Operations"].includes(user.role);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [itemsData, suppliersData] = await Promise.all([
        inventory.listStockItems(),
        inventory.listSuppliers()
      ]);
      setItems(itemsData);
      setSuppliers(suppliersData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function loadReconciliation() {
    setRecon((r) => ({ ...r, loading: true, error: "" }));
    try {
      const data = await inventory.reconciliation();
      setRecon({ loading: false, error: "", data });
    } catch (err) {
      setRecon({ loading: false, error: err.message, data: null });
    }
  }

  useEffect(() => { if (activeTab === "reconciliation") loadReconciliation(); }, [activeTab]);

  async function handleMovement(e) {
    e.preventDefault();
    if (submitting) return;
    setError("");
    const problem = movementProblem(form);
    if (problem) { setError(problem); return; }
    setSubmitting(true);
    try {
      const payload = {
        stock_item_id: form.stock_item_id,
        movement_type: form.movement_type,
        quantity: Number(form.quantity),
        reason: form.reason,
        // Optional business category (return / scrap). Omitted when blank so
        // ordinary receipts, issues and corrections are sent exactly as before.
        ...(form.category ? { reference_type: form.category } : {}),
        // A receipt names its supplier and source document; other movements add nothing here.
        ...receiptFields(form),
        // Only meaningful when movement_type is "out" or a negative "adjustment", and only
        // Admin/Operations are permitted to use it; the backend re-checks role and always
        // has final say (see inventoryController.recordStockMovement).
        override_negative: form.override_negative
      };
      await inventory.recordMovement({ ...payload, idempotency_key: keyForPayload(attempt.current, payload) });
      clearAttempt(attempt.current);
      setForm({ stock_item_id: "", movement_type: "in", quantity: "", reason: "", category: "", supplier_id: "", source_document_ref: "", override_negative: false });
      await load();
    } catch (err) {
      // Gracefully show negative stock blocks from backend. The attempt key is kept, so retrying the
      // identical request cannot create a second movement if the first one actually succeeded.
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function openHistory(item) {
    setHistoryModal({ open: true, item, movements: [], loading: true, error: "" });
    try {
      const result = await inventory.itemMovements(item.id);
      setHistoryModal({ open: true, item: result.stock_item || item, movements: result.movements || [], loading: false, error: "" });
    } catch (err) {
      setHistoryModal({ open: true, item, movements: [], loading: false, error: err.message });
    }
  }

  async function handleItemSave(e) {
    e.preventDefault();
    setItemModalError("");
    const formData = new FormData(e.target);
    const payload = Object.fromEntries(formData.entries());
    payload.quantity_on_hand = Number(payload.quantity_on_hand || 0);
    payload.reorder_level = Number(payload.reorder_level || 0);
    payload.unit_cost = Number(payload.unit_cost || 0);

    try {
      if (itemModal.data?.id) {
        await inventory.updateStockItem(itemModal.data.id, payload);
      } else {
        await inventory.createStockItem(payload);
      }
      setItemModal({ open: false, data: null });
      load();
    } catch (err) {
      setItemModalError("Error saving item: " + err.message);
    }
  }

  async function handleSupplierSave(e) {
    e.preventDefault();
    setSupplierModalError("");
    const formData = new FormData(e.target);
    const payload = Object.fromEntries(formData.entries());
    payload.lead_time_days = Number(payload.lead_time_days || 0);

    try {
      if (supplierModal.data?.id) {
        await inventory.updateSupplier(supplierModal.data.id, payload);
      } else {
        await inventory.createSupplier(payload);
      }
      setSupplierModal({ open: false, data: null });
      load();
    } catch (err) {
      setSupplierModalError("Error saving supplier: " + err.message);
    }
  }

  const lowStockCount = items.filter((i) => i.quantity_on_hand <= i.reorder_level).length;
  const totalValue = items.reduce((sum, i) => sum + (i.quantity_on_hand * Number(i.unit_cost || 0)), 0);
  const visibleItems = lowStockOnly ? items.filter((i) => i.quantity_on_hand <= i.reorder_level) : items;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <PageHeaderBanner
        eyebrow="Materials control"
        title="Inventory management"
        subtitle="Track stock levels, record movements, and manage suppliers."
        iconPath={ICONS.inventory}
        meta={[`${items.length} items`, `${suppliers.length} suppliers`]}
      />
      <AttentionBand
        items={[
          { label: "Total items", value: items.length, iconPath: ICONS.inventory },
          {
            label: "Low stock alerts",
            value: lowStockCount,
            iconPath: ICONS.warning,
            attention: lowStockCount > 0,
          },
          {
            label: "Total value on hand",
            value: `$${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
            iconPath: ICONS.money,
          },
        ]}
      />

      {error && <ErrorBanner message={error} />}

      {/* Tabs */}
      <TabNav
        tabs={[
          { id: "stock", label: "Stock & movements" },
          { id: "suppliers", label: "Suppliers" },
          ...(canManage ? [{ id: "reconciliation", label: "Reconciliation" }] : []),
        ]}
        activeId={activeTab}
        onChange={setActiveTab}
        label="Inventory sections"
      />

      <div role="tabpanel" id={`panel-${activeTab}`} aria-labelledby={`tab-${activeTab}`} tabIndex={-1}>
        {/* STOCK TAB */}
        {activeTab === "stock" && (
          <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
            {/* Record Movement Form */}
            {canManage && (
              <div className="min-w-0 lg:col-span-1">
                <form onSubmit={handleMovement} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm sticky top-6">
                  <h2 className="mb-5 text-sm font-semibold text-orac-slate">Record movement</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-gray-700">Item</label>
                      <select
                        value={form.stock_item_id}
                        onChange={(e) => {
                          const chosen = items.find((i) => i.id === e.target.value);
                          setForm({ ...form, stock_item_id: e.target.value, supplier_id: chosen?.supplier_id || "" });
                        }}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20 bg-white"
                        required
                      >
                        <option value="">Select item...</option>
                        {items.map((i) => (
                          <option key={i.id} value={i.id}>{i.item_code} — {i.item_name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-sm font-semibold text-gray-700">Type</label>
                        <select
                          value={form.movement_type}
                          onChange={(e) => setForm({ ...form, movement_type: e.target.value, category: "" })}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20 bg-white"
                        >
                          <option value="in">Receipt (increases stock)</option>
                          <option value="out">Issue / use (decreases stock)</option>
                          <option value="adjustment">Correction (adjustment)</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-semibold text-gray-700">Quantity</label>
                        <input
                          type="number"
                          value={form.quantity}
                          onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20"
                          required
                          min={form.movement_type === "adjustment" ? undefined : "1"}
                        />
                        {form.movement_type === "adjustment" && (
                          <p className="mt-1 text-xs text-gray-500">Use a signed quantity to correct stock, for example -2 to reduce stock.</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-gray-700">Reason</label>
                      <input
                        type="text"
                        value={form.reason}
                        onChange={(e) => setForm({ ...form, reason: e.target.value })}
                        placeholder="e.g. Received from supplier"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20"
                        required
                      />
                    </div>
                    {isSupplierReceipt(form) && (
                      <div data-evidence="inventory-receipt-source" className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                        <div>
                          <label className="mb-1 block text-sm font-semibold text-gray-700">Received from (supplier)</label>
                          <select data-evidence="inventory-receipt-supplier" value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white" required>
                            <option value="">Select supplier...</option>
                            {suppliers.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-semibold text-gray-700">Delivery note / supplier invoice no.</label>
                          <input data-evidence="inventory-receipt-document" type="text" value={form.source_document_ref} onChange={(e) => setForm({ ...form, source_document_ref: e.target.value })} maxLength={120} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" required />
                          <p className="mt-1 text-xs text-gray-500">Proof of delivery. A client purchase order is not supplier evidence.</p>
                        </div>
                      </div>
                    )}
                    {form.movement_type !== "out" && (
                      <div>
                        <label className="mb-1 block text-sm font-semibold text-gray-700">Category (optional)</label>
                        <select data-evidence="inventory-movement-category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white">
                          {form.movement_type === "in" ? (
                            <>
                              <option value="">Receipt</option>
                              <option value="return">Return to stock</option>
                            </>
                          ) : (
                            <>
                              <option value="">Controlled correction</option>
                              <option value="scrap">Scrap / write-off</option>
                            </>
                          )}
                        </select>
                      </div>
                    )}
                    {(form.movement_type === "out" || form.movement_type === "adjustment") && (
                      <label className="flex items-start gap-2 text-sm text-gray-600">
                        <input
                          type="checkbox"
                          checked={form.override_negative}
                          onChange={(e) => setForm({ ...form, override_negative: e.target.checked })}
                          className="mt-0.5 rounded border-gray-300 text-orac-blue focus:ring-orac-blue/20"
                        />
                        <span>
                          Allow this movement to take stock below zero.
                          <span className="block text-orac-text-muted">Only Admin or Operations accounts can use this; the server will reject it otherwise.</span>
                        </span>
                      </label>
                    )}
                    <button type="submit" data-evidence="inventory-submit-movement" disabled={submitting} className="w-full rounded-lg bg-orac-blue py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-orac-blue/90 mt-2 disabled:cursor-not-allowed disabled:opacity-60">
                      {submitting ? "Saving..." : "Submit movement"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Stock List */}
            <div className={canManage ? "min-w-0 lg:col-span-1" : "min-w-0 lg:col-span-2"}>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={lowStockOnly}
                    onChange={(e) => setLowStockOnly(e.target.checked)}
                    className="rounded border-gray-300 text-orac-blue focus:ring-orac-blue/20"
                  />
                  Show reorder attention only ({lowStockCount})
                </label>
                {canManage && (
                  <button onClick={() => { setItemModalError(""); setItemModal({ open: true, data: null }); }} className="px-4 py-2 bg-orac-slate text-white text-sm font-medium rounded-lg shadow-sm hover:bg-slate-700 transition-all">
                    + New stock item
                  </button>
                )}
              </div>
              {loading ? (
                <div data-evidence="inventory-stock-loading"><PageLoadingSkeleton label="Loading inventory" /></div>
              ) : lowStockOnly && visibleItems.length === 0 ? (
                <div data-evidence="inventory-stock-filter-empty" className="rounded-xl border border-gray-100 bg-white p-8 text-center text-sm text-gray-500 shadow-sm">
                  No items currently need reorder attention.
                </div>
              ) : (
                <DataTable
                  title="Current stock levels"
                  columns={["Code", "Name", "On hand", "Reorder level", "Status", "Actions"]}
                  rows={visibleItems}
                  emptyText="No inventory items found."
                  renderRow={(i) => {
                    const needsReorder = i.quantity_on_hand <= i.reorder_level;
                    return (
                      <tr key={i.id} className={`transition-colors hover:bg-gray-50/80 group ${needsReorder ? "bg-red-50/30" : ""}`}>
                        <td className="px-5 py-4 text-sm font-medium text-orac-slate">{i.item_code}</td>
                        <td className="px-5 py-4 text-sm text-gray-600">{i.item_name}</td>
                        <td className="px-5 py-4 text-sm tabular-nums">
                          <span className={needsReorder ? "font-bold text-red-600" : "font-medium text-gray-900"}>
                            {i.quantity_on_hand} {i.unit_of_measure}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm tabular-nums text-orac-text-muted">{i.reorder_level}</td>
                        <td className="px-5 py-4 text-sm">
                          {needsReorder ? (
                            <span data-evidence="inventory-reorder-badge" className="inline-block rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800">Reorder now</span>
                          ) : (
                            <span className="inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600">OK</span>
                          )}
                          {/* Explains reorder status using only what the server actually knows
                              (on-hand, reorder level, and supplier lead time when one is
                              recorded) — never an invented lead time or reference. */}
                          {i.reorder_explanation && (
                            <p data-evidence="inventory-reorder-explanation" className="mt-1 max-w-[220px] text-xs text-gray-500">{i.reorder_explanation}</p>
                          )}
                        </td>
                        <td className="px-5 py-4 text-sm text-right whitespace-nowrap">
                          <button onClick={() => openHistory(i)} className="mr-3 text-gray-500 font-medium hover:text-orac-navy opacity-70 group-hover:opacity-100 transition-all">
                            History
                          </button>
                          {canManage && (
                            <button onClick={() => { setItemModalError(""); setItemModal({ open: true, data: i }); }} className="text-orac-navy font-medium hover:text-orac-ink opacity-70 group-hover:opacity-100 transition-all">
                              Edit
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  }}
                />
              )}
            </div>
          </div>
        )}

        {/* RECONCILIATION TAB - read-only: stored balance vs what the ledger adds up to */}
        {activeTab === "reconciliation" && canManage && (
          <div data-evidence="inventory-reconciliation" className="space-y-4">
            <p className="text-sm text-gray-600">
              Compares each item's balance with its movement history. This view only reports; it never changes stock.
              Quantities are compared within one unit of measure.
            </p>
            {recon.loading ? (
              <div className="py-8 text-center text-sm text-orac-text-muted">Checking the ledger...</div>
            ) : recon.error ? (
              <ErrorBanner message={recon.error} />
            ) : recon.data ? (
              <>
                <p data-evidence="inventory-reconciliation-summary" className="text-sm font-semibold text-orac-slate">
                  {recon.data.totals.reconciled} of {recon.data.totals.items} items reconcile
                  {recon.data.totals.with_exceptions ? ` - ${recon.data.totals.with_exceptions} need attention` : ""}
                  {recon.data.totals.system_exceptions ? ` - ${recon.data.totals.system_exceptions} worksheet usage record(s) never reached the ledger` : ""}
                </p>
                <div className="space-y-3">
                  {recon.data.items.map((r) => (
                    <div key={r.stock_item_id} data-evidence="inventory-reconciliation-row" className="rounded-lg border border-gray-200 bg-white p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-gray-800">{r.item_code} - {r.item_name}</span>
                        <span className={r.status === "reconciled" ? "text-emerald-700" : "text-red-700"}>{r.status === "reconciled" ? "Reconciled" : "Needs attention"}</span>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        On hand {r.quantity_on_hand} {r.unit_of_measure} · ledger balance {r.ledger_balance ?? "none"} · {r.movement_count} movement(s)
                      </p>
                      {r.exceptions.length > 0 && (
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-red-700">
                          {r.exceptions.map((x, idx) => (<li key={`${x.code}-${x.movement_id || idx}`}>{reconciliationText(x.code)}: {x.message}</li>))}
                        </ul>
                      )}
                    </div>
                  ))}
                  {recon.data.system_exceptions.map((x) => (
                    <div key={x.material_usage_id} data-evidence="inventory-reconciliation-system" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{reconciliationText(x.code)}: {x.message}</div>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* SUPPLIERS TAB */}
        {activeTab === "suppliers" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              {canManage && (
                <button onClick={() => { setSupplierModalError(""); setSupplierModal({ open: true, data: null }); }} className="px-4 py-2 bg-orac-blue text-white text-sm font-medium rounded-lg shadow-sm hover:bg-orac-blue/90 transition-all">
                  + Add supplier
                </button>
              )}
            </div>
            {loading ? (
              <div className="py-12 text-center text-orac-text-muted">Loading suppliers...</div>
            ) : (
              <DataTable
                title="Suppliers"
                columns={["Supplier name", "Contact", "Email", "Lead time", "Actions"]}
                rows={suppliers}
                emptyText="No suppliers found."
                renderRow={(s) => (
                  <tr key={s.id} className="transition-colors hover:bg-gray-50/80 group">
                    <td className="px-5 py-4 text-sm font-medium text-orac-slate">{s.name}</td>
                    <td className="px-5 py-4 text-sm text-gray-600">{s.contact_person || "—"}</td>
                    <td className="px-5 py-4 text-sm text-gray-500">{s.email || "—"}</td>
                    <td className="px-5 py-4 text-sm text-gray-500">{s.lead_time_days ? `${s.lead_time_days} days` : "—"}</td>
                    <td className="px-5 py-4 text-sm text-right">
                      {canManage && (
                        <button onClick={() => { setSupplierModalError(""); setSupplierModal({ open: true, data: s }); }} className="text-orac-navy font-medium hover:text-orac-ink opacity-70 group-hover:opacity-100 transition-all">
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                )}
              />
            )}
          </div>
        )}
      </div>

      {/* Item Modal */}
      <Modal title={itemModal.data ? "Edit stock item" : "Create stock item"} isOpen={itemModal.open} onClose={() => { setItemModal({ open: false, data: null }); setItemModalError(""); }} size="lg">
        <form onSubmit={handleItemSave} className="space-y-4">
          {itemModalError && <ErrorBanner message={itemModalError} />}
          <div><label className="mb-1 block text-sm font-semibold text-gray-700">Item Code</label><input name="item_code" defaultValue={itemModal.data?.item_code || ""} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20" /></div>
          <div><label className="mb-1 block text-sm font-semibold text-gray-700">Item Name</label><input name="item_name" defaultValue={itemModal.data?.item_name || ""} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-sm font-semibold text-gray-700">Unit of measure</label><input name="unit_of_measure" defaultValue={itemModal.data?.unit_of_measure || ""} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20" placeholder="e.g. m2, each, set" /></div>
            <div><label className="mb-1 block text-sm font-semibold text-gray-700">Unit cost</label><input name="unit_cost" type="number" step="0.01" defaultValue={itemModal.data?.unit_cost || "0"} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-sm font-semibold text-gray-700">Starting quantity on hand</label><input name="quantity_on_hand" type="number" defaultValue={itemModal.data?.quantity_on_hand || "0"} disabled={!!itemModal.data} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-gray-50 focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20 disabled:text-orac-border-strong" /></div>
            <div><label className="mb-1 block text-sm font-semibold text-gray-700">Reorder level</label><input name="reorder_level" type="number" defaultValue={itemModal.data?.reorder_level || "0"} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20" /></div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-700">Primary supplier</label>
            <select name="supplier_id" defaultValue={itemModal.data?.supplier_id || ""} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20 bg-white">
              <option value="">None / Unknown</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={() => { setItemModal({ open: false, data: null }); setItemModalError(""); }} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">Cancel</button>
            <button type="submit" className="px-5 py-2 bg-orac-slate text-white text-sm font-medium rounded-lg hover:bg-slate-800 shadow-sm">Save Item</button>
          </div>
        </form>
      </Modal>

      {/* Supplier Modal */}
      <Modal title={supplierModal.data ? "Edit supplier" : "Add supplier"} isOpen={supplierModal.open} onClose={() => { setSupplierModal({ open: false, data: null }); setSupplierModalError(""); }} size="lg">
        <form onSubmit={handleSupplierSave} className="space-y-4">
          {supplierModalError && <ErrorBanner message={supplierModalError} />}
          <div><label className="mb-1 block text-sm font-semibold text-gray-700">Supplier name</label><input name="name" defaultValue={supplierModal.data?.name || ""} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20" /></div>
          <div><label className="mb-1 block text-sm font-semibold text-gray-700">Contact person</label><input name="contact_person" defaultValue={supplierModal.data?.contact_person || ""} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-sm font-semibold text-gray-700">Email</label><input name="email" type="email" defaultValue={supplierModal.data?.email || ""} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20" /></div>
            <div><label className="mb-1 block text-sm font-semibold text-gray-700">Phone</label><input name="phone" defaultValue={supplierModal.data?.phone || ""} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20" /></div>
          </div>
          <div><label className="mb-1 block text-sm font-semibold text-gray-700">Lead time (days)</label><input name="lead_time_days" type="number" defaultValue={supplierModal.data?.lead_time_days || "0"} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20" /></div>
          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={() => { setSupplierModal({ open: false, data: null }); setSupplierModalError(""); }} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">Cancel</button>
            <button type="submit" className="px-5 py-2 bg-orac-blue text-white text-sm font-medium rounded-lg hover:bg-orac-blue/90 shadow-sm">Save Supplier</button>
          </div>
        </form>
      </Modal>

      {/* Movement History Modal */}
      <Modal title={historyModal.item ? `Movement History — ${historyModal.item.item_code}` : "Movement History"} isOpen={historyModal.open} onClose={() => setHistoryModal({ open: false, item: null, movements: [], loading: false, error: "" })}>
        {historyModal.loading ? (
          <div data-evidence="inventory-history-loading" className="py-8 text-center text-sm text-orac-text-muted">Loading movement history...</div>
        ) : historyModal.error ? (
          <ErrorBanner message={historyModal.error} />
        ) : historyModal.movements.length === 0 ? (
          <div data-evidence="inventory-history-empty" className="py-8 text-center text-sm text-gray-500">No movements recorded for this item yet.</div>
        ) : (
          <div className="max-h-[60vh] space-y-3 overflow-y-auto">
            {historyModal.movements.map((m) => (
              <div key={m.id} data-evidence="inventory-history-row" className="rounded-lg border border-gray-200 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className={`font-semibold ${m.direction === "increase" ? "text-emerald-700" : "text-red-700"}`}>
                    {m.direction === "increase" ? "+" : "-"}{Math.abs(m.quantity)} {m.unit_of_measure || m.item_unit_of_measure}
                  </span>
                  <span className="text-xs text-orac-text-muted">{new Date(m.created_at).toLocaleString()}</span>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {m.quantity_before} → {m.quantity_after} {m.unit_of_measure || m.item_unit_of_measure} · {movementLabel(m)}
                </p>
                <p className="mt-1 text-gray-700">{m.reason}</p>
                <p className="mt-1 text-xs text-gray-500">
                  By {m.actor_name || "Unknown user"}
                  {m.reference_label ? <> · {m.reference_label}</> : null}
                  {m.source_document_ref ? <> · Source document {m.source_document_ref}</> : null}
                  {m.override_negative ? <> · Negative-stock override</> : null}
                  {referenceLinkTarget(m, canAccessRoute(user.role, "/worksheets")) ? <> · <Link data-evidence="inventory-history-link" className="text-orac-blue underline" to={referenceLinkTarget(m, true)}>Open Timesheets</Link></> : null}
                </p>
              </div>
            ))}
          </div>
        )}
      </Modal>

    </div>
  );
}
