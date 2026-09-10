import React, { useEffect, useState } from "react";
import { inventory } from "../api/client.js";
import DataTable from "../components/DataTable.jsx";
import StatCard from "../components/StatCard.jsx";

export default function InventoryPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ stock_item_id: "", movement_type: "in", quantity: "", reason: "" });

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await inventory.listStockItems();
      setItems(data);
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
        reason: form.reason
      });
      setForm({ stock_item_id: "", movement_type: "in", quantity: "", reason: "" });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  const lowStockCount = items.filter((i) => i.quantity_on_hand <= i.reorder_level).length;
  const totalValue = items.reduce((sum, i) => sum + (i.quantity_on_hand * Number(i.unit_cost || 0)), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-orac-slate">Inventory Management</h1>
        <p className="mt-1 text-sm text-gray-400">Track stock levels and record movements</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Total Items" value={items.length} icon="📦" tone="slate" />
        <StatCard
          label="Low Stock Alerts"
          value={lowStockCount}
          icon="⚠️"
          tone={lowStockCount > 0 ? "red" : "green"}
        />
        <StatCard
          label="Total Value On Hand"
          value={`R ${totalValue.toLocaleString()}`}
          icon="📈"
          tone="slate"
        />
      </div>

      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Record Movement Form (1 column on large screens) */}
        <div className="lg:col-span-1">
          <form onSubmit={handleMovement} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-orac-slate">Record Movement</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 uppercase tracking-wider">Item</label>
                <select
                  value={form.stock_item_id}
                  onChange={(e) => setForm({ ...form, stock_item_id: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:outline-none focus:ring-2 focus:ring-orac-blue/20"
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
                  <label className="mb-1 block text-xs font-medium text-gray-500 uppercase tracking-wider">Type</label>
                  <select
                    value={form.movement_type}
                    onChange={(e) => setForm({ ...form, movement_type: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:outline-none focus:ring-2 focus:ring-orac-blue/20"
                  >
                    <option value="in">In (+)</option>
                    <option value="out">Out (-)</option>
                    <option value="adjustment">Adj</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</label>
                  <input
                    type="number"
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:outline-none focus:ring-2 focus:ring-orac-blue/20"
                    required
                    min="1"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</label>
                <input
                  type="text"
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="e.g. Received from supplier"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:outline-none focus:ring-2 focus:ring-orac-blue/20"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-lg bg-orac-blue py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:brightness-105"
              >
                Record Movement
              </button>
            </div>
          </form>
        </div>

        {/* Stock List (2 columns on large screens) */}
        <div className="lg:col-span-2">
          {loading ? (
            <div className="py-12 text-center text-gray-400">Loading inventory...</div>
          ) : (
            <DataTable
              title="Current Stock Levels"
              columns={["Code", "Name", "On Hand", "Reorder", "Unit Cost"]}
              rows={items}
              emptyText="No inventory items found."
              renderRow={(i) => (
                <tr key={i.id} className={`transition-colors hover:bg-gray-50 ${i.quantity_on_hand <= i.reorder_level ? "bg-red-50/50" : ""}`}>
                  <td className="px-4 py-2.5 font-medium text-orac-slate">{i.item_code}</td>
                  <td className="px-4 py-2.5">{i.item_name}</td>
                  <td className="px-4 py-2.5 tabular-nums">
                    <span className={i.quantity_on_hand <= i.reorder_level ? "font-bold text-red-600" : ""}>
                      {i.quantity_on_hand}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-gray-500">{i.reorder_level}</td>
                  <td className="px-4 py-2.5 tabular-nums text-gray-500">{i.unit_cost}</td>
                </tr>
              )}
            />
          )}
        </div>
      </div>
    </div>
  );
}