import React, { useEffect, useState } from "react";
import { inventory } from "../api/client.js";
import DataTable from "../components/DataTable.jsx";
import IconStatCard from "../components/IconStatCard.jsx";
import Modal from "../components/Modal.jsx";
import PageHeaderBanner from "../components/PageHeaderBanner.jsx";
import { ErrorBanner } from "../components/PageStates.jsx";
import { ICONS } from "../components/icons.jsx";

export default function InventoryPage({ user }) {
  const [items, setItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("stock");
  
  const [form, setForm] = useState({ stock_item_id: "", movement_type: "in", quantity: "", reason: "", override_negative: false });

  const [itemModal, setItemModal] = useState({ open: false, data: null });
  const [supplierModal, setSupplierModal] = useState({ open: false, data: null });

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

  async function handleMovement(e) {
    e.preventDefault();
    setError("");
    try {
      await inventory.recordMovement({
        stock_item_id: form.stock_item_id,
        movement_type: form.movement_type,
        quantity: Number(form.quantity),
        reason: form.reason,
        // Only meaningful when movement_type is "out" or a negative "adjustment", and only
        // Admin/Operations are permitted to use it; the backend re-checks role and always
        // has final say (see inventoryController.recordStockMovement).
        override_negative: form.override_negative
      });
      setForm({ stock_item_id: "", movement_type: "in", quantity: "", reason: "", override_negative: false });
      await load();
    } catch (err) {
      // Gracefully show negative stock blocks from backend
      setError(err.message);
    }
  }

  async function handleItemSave(e) {
    e.preventDefault();
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
      alert("Error saving item: " + err.message);
    }
  }

  async function handleSupplierSave(e) {
    e.preventDefault();
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
      alert("Error saving supplier: " + err.message);
    }
  }

  const lowStockCount = items.filter((i) => i.quantity_on_hand <= i.reorder_level).length;
  const totalValue = items.reduce((sum, i) => sum + (i.quantity_on_hand * Number(i.unit_cost || 0)), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="space-y-6">
        <PageHeaderBanner eyebrow="Materials control" title="Inventory Management" subtitle="Track stock levels, record movements, and manage suppliers." iconPath={ICONS.inventory} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <IconStatCard label="Total Items" value={items.length} iconPath={ICONS.inventory} tone="neutral" />
          <IconStatCard label="Low Stock Alerts" value={lowStockCount} iconPath={ICONS.warning} tone={lowStockCount > 0 ? "red" : "green"} />
          <IconStatCard label="Total Value On Hand" value={`$${totalValue.toLocaleString(undefined, {minimumFractionDigits:2})}`} iconPath={ICONS.money} tone="blue" />
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button onClick={() => setActiveTab("stock")} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === "stock" ? "border-orac-blue text-orac-blue" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}`}>
            Stock & Movements
          </button>
          <button onClick={() => setActiveTab("suppliers")} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === "suppliers" ? "border-orac-blue text-orac-blue" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}`}>
            Suppliers
          </button>
        </nav>
      </div>

      <div className="pt-2">
        {/* STOCK TAB */}
        {activeTab === "stock" && (
          <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
            {/* Record Movement Form */}
            {canManage && (
              <div className="lg:col-span-1">
                <form onSubmit={handleMovement} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm sticky top-6">
                  <h2 className="mb-5 text-sm font-semibold text-orac-slate">Record Movement</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-gray-600 uppercase">Item</label>
                      <select
                        value={form.stock_item_id}
                        onChange={(e) => setForm({ ...form, stock_item_id: e.target.value })}
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
                        <label className="mb-1 block text-xs font-semibold text-gray-600 uppercase">Type</label>
                        <select
                          value={form.movement_type}
                          onChange={(e) => setForm({ ...form, movement_type: e.target.value })}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20 bg-white"
                        >
                          <option value="in">In (+)</option>
                          <option value="out">Out (-)</option>
                          <option value="adjustment">Adj</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-gray-600 uppercase">Qty</label>
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
                      <label className="mb-1 block text-xs font-semibold text-gray-600 uppercase">Reason</label>
                      <input
                        type="text"
                        value={form.reason}
                        onChange={(e) => setForm({ ...form, reason: e.target.value })}
                        placeholder="e.g. Received from supplier"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20"
                        required
                      />
                    </div>
                    {(form.movement_type === "out" || form.movement_type === "adjustment") && (
                      <label className="flex items-start gap-2 text-xs text-gray-600">
                        <input
                          type="checkbox"
                          checked={form.override_negative}
                          onChange={(e) => setForm({ ...form, override_negative: e.target.checked })}
                          className="mt-0.5 rounded border-gray-300 text-orac-blue focus:ring-orac-blue/20"
                        />
                        <span>
                          Allow this movement to take stock below zero.
                          <span className="block text-gray-400">Only Admin or Operations accounts can use this; the server will reject it otherwise.</span>
                        </span>
                      </label>
                    )}
                    <button type="submit" className="w-full rounded-lg bg-orac-blue py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-orac-blue/90 mt-2">
                      Submit Movement
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Stock List */}
            <div className={canManage ? "lg:col-span-1" : "lg:col-span-2"}>
              <div className="flex justify-end mb-4">
                {canManage && (
                  <button onClick={() => setItemModal({ open: true, data: null })} className="px-4 py-2 bg-orac-slate text-white text-sm font-medium rounded-lg shadow-sm hover:bg-slate-700 transition-all">
                    + New Stock Item
                  </button>
                )}
              </div>
              {loading ? (
                <div className="py-12 text-center text-gray-400">Loading inventory...</div>
              ) : (
                <DataTable
                  title="Current Stock Levels"
                  columns={["Code", "Name", "On Hand", "Reorder", "Actions"]}
                  rows={items}
                  emptyText="No inventory items found."
                  renderRow={(i) => (
                    <tr key={i.id} className={`transition-colors hover:bg-gray-50/80 group ${i.quantity_on_hand <= i.reorder_level ? "bg-red-50/30" : ""}`}>
                      <td className="px-5 py-4 text-sm font-medium text-orac-slate">{i.item_code}</td>
                      <td className="px-5 py-4 text-sm text-gray-600">{i.item_name}</td>
                      <td className="px-5 py-4 text-sm tabular-nums">
                        <span className={i.quantity_on_hand <= i.reorder_level ? "font-bold text-red-600" : "font-medium text-gray-900"}>
                          {i.quantity_on_hand} {i.unit_of_measure}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm tabular-nums text-gray-400">{i.reorder_level}</td>
                      <td className="px-5 py-4 text-sm text-right">
                        {canManage && (
                          <button onClick={() => setItemModal({ open: true, data: i })} className="text-orac-navy font-medium hover:text-orac-ink opacity-70 group-hover:opacity-100 transition-all">
                            Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  )}
                />
              )}
            </div>
          </div>
        )}

        {/* SUPPLIERS TAB */}
        {activeTab === "suppliers" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              {canManage && (
                <button onClick={() => setSupplierModal({ open: true, data: null })} className="px-4 py-2 bg-orac-blue text-white text-sm font-medium rounded-lg shadow-sm hover:bg-orac-blue/90 transition-all">
                  + Add Supplier
                </button>
              )}
            </div>
            {loading ? (
              <div className="py-12 text-center text-gray-400">Loading suppliers...</div>
            ) : (
              <DataTable
                title="Suppliers"
                columns={["Supplier Name", "Contact", "Email", "Lead Time", "Actions"]}
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
                        <button onClick={() => setSupplierModal({ open: true, data: s })} className="text-orac-navy font-medium hover:text-orac-ink opacity-70 group-hover:opacity-100 transition-all">
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
      <Modal title={itemModal.data ? "Edit Stock Item" : "Create Stock Item"} isOpen={itemModal.open} onClose={() => setItemModal({ open: false, data: null })}>
        <form onSubmit={handleItemSave} className="space-y-4">
          <div><label className="mb-1 block text-xs font-semibold text-gray-600 uppercase">Item Code</label><input name="item_code" defaultValue={itemModal.data?.item_code || ""} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20" /></div>
          <div><label className="mb-1 block text-xs font-semibold text-gray-600 uppercase">Item Name</label><input name="item_name" defaultValue={itemModal.data?.item_name || ""} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-xs font-semibold text-gray-600 uppercase">Unit of Measure</label><input name="unit_of_measure" defaultValue={itemModal.data?.unit_of_measure || ""} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20" placeholder="e.g. m2, each, set" /></div>
            <div><label className="mb-1 block text-xs font-semibold text-gray-600 uppercase">Unit Cost</label><input name="unit_cost" type="number" step="0.01" defaultValue={itemModal.data?.unit_cost || "0"} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-xs font-semibold text-gray-600 uppercase">Starting Qty (On Hand)</label><input name="quantity_on_hand" type="number" defaultValue={itemModal.data?.quantity_on_hand || "0"} disabled={!!itemModal.data} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-gray-50 focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20 disabled:text-gray-400" /></div>
            <div><label className="mb-1 block text-xs font-semibold text-gray-600 uppercase">Reorder Level</label><input name="reorder_level" type="number" defaultValue={itemModal.data?.reorder_level || "0"} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20" /></div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600 uppercase">Primary Supplier</label>
            <select name="supplier_id" defaultValue={itemModal.data?.supplier_id || ""} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20 bg-white">
              <option value="">None / Unknown</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={() => setItemModal({ open: false, data: null })} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">Cancel</button>
            <button type="submit" className="px-5 py-2 bg-orac-slate text-white text-sm font-medium rounded-lg hover:bg-slate-800 shadow-sm">Save Item</button>
          </div>
        </form>
      </Modal>

      {/* Supplier Modal */}
      <Modal title={supplierModal.data ? "Edit Supplier" : "Add Supplier"} isOpen={supplierModal.open} onClose={() => setSupplierModal({ open: false, data: null })}>
        <form onSubmit={handleSupplierSave} className="space-y-4">
          <div><label className="mb-1 block text-xs font-semibold text-gray-600 uppercase">Supplier Name</label><input name="name" defaultValue={supplierModal.data?.name || ""} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20" /></div>
          <div><label className="mb-1 block text-xs font-semibold text-gray-600 uppercase">Contact Person</label><input name="contact_person" defaultValue={supplierModal.data?.contact_person || ""} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-xs font-semibold text-gray-600 uppercase">Email</label><input name="email" type="email" defaultValue={supplierModal.data?.email || ""} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20" /></div>
            <div><label className="mb-1 block text-xs font-semibold text-gray-600 uppercase">Phone</label><input name="phone" defaultValue={supplierModal.data?.phone || ""} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20" /></div>
          </div>
          <div><label className="mb-1 block text-xs font-semibold text-gray-600 uppercase">Lead Time (Days)</label><input name="lead_time_days" type="number" defaultValue={supplierModal.data?.lead_time_days || "0"} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20" /></div>
          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={() => setSupplierModal({ open: false, data: null })} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">Cancel</button>
            <button type="submit" className="px-5 py-2 bg-orac-blue text-white text-sm font-medium rounded-lg hover:bg-orac-blue/90 shadow-sm">Save Supplier</button>
          </div>
        </form>
      </Modal>

    </div>
  );
}
