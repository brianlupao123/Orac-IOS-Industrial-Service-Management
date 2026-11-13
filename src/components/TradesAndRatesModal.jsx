import React, { useState } from "react";
import Modal from "./Modal.jsx";
import Button from "./ui/Button.jsx";
import Badge from "./ui/Badge.jsx";
import Input from "./ui/Input.jsx";
import { getTradeProfiles, saveTradeProfile, computeTradeHeadcounts, resetTradeProfilesToDefault } from "../tradeMaster.js";

export default function TradesAndRatesModal({ isOpen, onClose, users = [] }) {
  const [profiles, setProfiles] = useState(() => getTradeProfiles());
  const [editingTrade, setEditingTrade] = useState(null);
  const [savedNotice, setSavedNotice] = useState("");

  if (!isOpen) return null;

  const headcounts = computeTradeHeadcounts(users);

  function handleEdit(trade) {
    setEditingTrade({ ...trade });
    setSavedNotice("");
  }

  function handleSave(e) {
    e.preventDefault();
    if (!editingTrade) return;
    const updated = saveTradeProfile(editingTrade);
    setProfiles(updated);
    setEditingTrade(null);
    setSavedNotice(`Successfully updated rates for ${editingTrade.name}`);
    setTimeout(() => setSavedNotice(""), 3500);
  }

  function handleReset() {
    if (!confirm("Reset all trade pay rates to standard baseline?")) return;
    const reset = resetTradeProfilesToDefault();
    setProfiles(reset);
    setEditingTrade(null);
    setSavedNotice("Rates reset to standard baseline.");
    setTimeout(() => setSavedNotice(""), 3500);
  }

  return (
    <Modal title="Trade & Skill Categories — Master Rates & Roster" isOpen={isOpen} onClose={onClose} maxWidth="max-w-5xl">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-orac-border-default pb-3">
          <div>
            <span className="text-ux-label font-semibold text-orac-text-primary">Wage Rates & Skill Profiles</span>
            <p className="text-ux-caption text-orac-text-muted">Configure baseline hourly wage rates (USD), overtime scales, and track active deployed headcount per trade.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={handleReset}>Reset Defaults</Button>
            <Button variant="primary" onClick={onClose}>Done</Button>
          </div>
        </div>

        {savedNotice && (
          <div className="rounded-lg border border-orac-success-border bg-orac-success-bg px-4 py-2 text-ux-caption font-semibold text-orac-success-text">
            {savedNotice}
          </div>
        )}

        {editingTrade && (
          <form onSubmit={handleSave} className="rounded-xl border border-orac-accent/30 bg-orac-surface p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-ux-label font-bold text-orac-accent">Edit Trade: {editingTrade.name}</span>
              <Badge tone={editingTrade.category === "Artisan" ? "info" : "neutral"}>{editingTrade.category}</Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-ux-caption font-semibold text-orac-text-muted">Normal Rate ($/hr)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={editingTrade.hourly_rate}
                  onChange={(e) => {
                    const rate = parseFloat(e.target.value) || 0;
                    setEditingTrade((p) => ({
                      ...p,
                      hourly_rate: rate,
                      ot_15_rate: Number((rate * 1.5).toFixed(2)),
                      ot_20_rate: Number((rate * 2.0).toFixed(2))
                    }));
                  }}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-ux-caption font-semibold text-orac-text-muted">Overtime 1.5 Rate ($/hr)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={editingTrade.ot_15_rate}
                  onChange={(e) => setEditingTrade((p) => ({ ...p, ot_15_rate: parseFloat(e.target.value) || 0 }))}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-ux-caption font-semibold text-orac-text-muted">Overtime 2.0 Rate ($/hr)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={editingTrade.ot_20_rate}
                  onChange={(e) => setEditingTrade((p) => ({ ...p, ot_20_rate: parseFloat(e.target.value) || 0 }))}
                  required
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-ux-caption font-semibold text-orac-text-muted">Job Scope & Technical Description</label>
              <Input
                value={editingTrade.description}
                onChange={(e) => setEditingTrade((p) => ({ ...p, description: e.target.value }))}
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setEditingTrade(null)}>Cancel</Button>
              <Button type="submit" variant="primary">Save Changes</Button>
            </div>
          </form>
        )}

        {/* Master Trade Table */}
        <div className="overflow-x-auto rounded-lg border border-orac-border-default">
          <table className="w-full text-left border-collapse text-ux-caption">
            <thead>
              <tr className="bg-orac-canvas border-b border-orac-border-default text-orac-text-primary">
                <th className="px-4 py-2.5 font-semibold">Trade / Specialty</th>
                <th className="px-3 py-2.5 font-semibold">Skill Level</th>
                <th className="px-4 py-2.5 font-semibold">Job Description / Scope</th>
                <th className="px-3 py-2.5 font-semibold text-right">Normal ($)</th>
                <th className="px-3 py-2.5 font-semibold text-right">OT 1.5 ($)</th>
                <th className="px-3 py-2.5 font-semibold text-right">OT 2.0 ($)</th>
                <th className="px-3 py-2.5 font-semibold text-center">Headcount</th>
                <th className="px-3 py-2.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-orac-border-default bg-orac-surface">
              {profiles.map((t) => {
                const count = headcounts[t.name] || 0;
                return (
                  <tr key={t.name} className="hover:bg-orac-row-hover transition-colors">
                    <td className="px-4 py-3 font-semibold text-orac-text-primary">{t.name}</td>
                    <td className="px-3 py-3">
                      <Badge tone={t.category === "Artisan" ? "info" : "neutral"}>{t.category}</Badge>
                    </td>
                    <td className="px-4 py-3 text-orac-text-secondary max-w-xs truncate" title={t.description}>
                      {t.description}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-orac-text-primary">${Number(t.hourly_rate).toFixed(2)}</td>
                    <td className="px-3 py-3 text-right font-mono text-orac-text-secondary">${Number(t.ot_15_rate).toFixed(2)}</td>
                    <td className="px-3 py-3 text-right font-mono text-orac-text-secondary">${Number(t.ot_20_rate).toFixed(2)}</td>
                    <td className="px-3 py-3 text-center">
                      <Badge tone={count > 0 ? "success" : "neutral"}>
                        {count} {count === 1 ? "worker" : "workers"}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Button variant="link" onClick={() => handleEdit(t)} className="text-orac-accent font-semibold">
                        Edit
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}
