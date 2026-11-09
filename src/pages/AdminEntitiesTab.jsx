import React, { useEffect, useState } from "react";
import { collections, admin } from "../api/client.js";
import DataTable from "../components/DataTable.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import Modal from "../components/Modal.jsx";
import ScopeTrail from "../components/ScopeTrail.jsx";
import SearchableSelect from "../components/SearchableSelect.jsx";
import { ErrorBanner } from "../components/PageStates.jsx";
import { PageLoadingSkeleton } from "../components/PageStates.jsx";
import Button from "../components/ui/Button.jsx";
import Badge from "../components/ui/Badge.jsx";
import { formatMoney } from "../lib/format.js";

// The full master-data chain this tab surfaces. Client sits at the top but
// is managed from the separate Client Directory tab (Admin > Clients), so
// it isn't one of the switchable entities below — it's shown here only as
// context so the hierarchy is never implicit.
const HIERARCHY_CHAIN = ["Client", "Mine Site", "Plant", "Plant Section", "Equipment Tag"];

// Who a record belongs to, shown as a badge so it's never ambiguous at a
// glance. This isn't a stored field — ownership is already structural in
// this source: every node in HIERARCHY_CHAIN always descends from a client
// (mine_sites/plants/plant_sections/equipment_tags all carry a foreign key
// up to one), while catalog_items has no client reference at all and is
// ORAC's own priced-line master data shared across every client's quotes.
// NOTE (owner decision, not invented here): the source has no company/
// branch/department/store schema for ORAC's own internal organisation —
// company_profile is a single flat record with no sub-units. If ORAC wants
// its own internal org units tracked (e.g. multiple depots), that needs an
// explicit schema decision from the owner; this patch does not invent one.
const OWNERSHIP_LABEL = {
  client: "Client-owned asset data",
  orac: "ORAC-owned internal configuration",
};

const ENTITIES = [
  {
    key: "mine_sites",
    label: "Mine Sites",
    singular: "Mine Site",
    purpose: "A client's mine or plant site — the top level under a client that plants and equipment sit within.",
    ownership: "client",
    columns: ["Name", "Client", "Location", "Status", "Actions"],
    parentField: "client_id",
    parentCollection: "clients",
    parentNoun: "client",
    parentLabel: "Client",
    childNoun: "plants",
  },
  {
    key: "plants",
    label: "Plants",
    singular: "Plant",
    purpose: "A processing plant at a mine site (e.g. a concentrator or smelter), made up of plant sections and equipment.",
    ownership: "client",
    columns: ["Name", "Mine Site", "Status", "Actions"],
    parentField: "mine_site_id",
    parentCollection: "mine_sites",
    parentNoun: "mine site",
    parentLabel: "Mine Site",
    childNoun: "plant sections",
  },
  {
    key: "plant_sections",
    label: "Plant Sections",
    singular: "Plant Section",
    purpose: "A functional section within a plant (e.g. a cyclone cluster or furnace) that groups related equipment tags.",
    ownership: "client",
    columns: ["Name", "Plant", "Status", "Actions"],
    parentField: "plant_id",
    parentCollection: "plants",
    parentNoun: "plant",
    parentLabel: "Plant",
    childNoun: "equipment tags",
  },
  {
    key: "equipment_tags",
    label: "Equipment Tags",
    singular: "Equipment Tag",
    purpose: "A specific tagged piece of equipment that quotes, dispatches, Timesheets and maintenance contracts reference for the work performed on it.",
    ownership: "client",
    columns: ["Tag Code", "Equipment Name", "Plant Section", "Status", "Actions"],
    parentField: "plant_section_id",
    parentCollection: "plant_sections",
    parentNoun: "plant section",
    parentLabel: "Plant Section",
    childNoun: null,
    statusEffect: "Marking this inactive keeps it on historical quotes, dispatches, Timesheets and documents, but it can no longer be linked to new quotes, service requests or maintenance schedules.",
  },
  {
    key: "catalog_items",
    label: "Catalog Items",
    singular: "Catalog Item",
    purpose: "A priced service or material line used to build quotes. Not part of the site hierarchy, and not owned by any one client.",
    ownership: "orac",
    columns: ["Item Code", "Item Name", "Unit Price", "Status", "Actions"],
    parentField: null,
  },
];

function statusEffectNote(config) {
  if (config.statusEffect) return config.statusEffect;
  if (config.childNoun) {
    return `Marking this inactive keeps existing ${config.childNoun} linked and visible, but it can no longer be chosen as the parent for new ${config.childNoun}.`;
  }
  return null;
}

// The node one level up from `row` itself in its hierarchy_path (the
// immediate parent), and everything above that parent joined into a
// breadcrumb — e.g. for a plant section, that's the plant and "Client ›
// Mine Site" respectively. Relies on the readable-name enrichment the
// backend now attaches to every mine_sites/plants/plant_sections/
// equipment_tags record (see services/entityHierarchy.js).
function immediateParentNode(row) {
  const path = row.hierarchy_path;
  if (!path || path.length < 2) return null;
  return path[path.length - 2];
}
function ancestorsAboveParent(row) {
  const path = row.hierarchy_path;
  if (!path || path.length < 3) return "";
  return path.slice(0, -2).map((n) => n.name).join(" \u203a ");
}

function ParentContextCell({ row }) {
  const parent = immediateParentNode(row);
  if (!parent) return <span className="text-orac-text-muted">—</span>;
  const ancestors = ancestorsAboveParent(row);
  return (
    <div>
      <div className={`text-ux-body ${row.parent_orphaned ? "text-orac-danger-text font-medium" : "text-orac-text-primary"}`}>
        {parent.name}
        {row.parent_orphaned && (
          <span className="ml-2">
            <Badge tone="danger">Orphan link</Badge>
          </span>
        )}
        {!row.parent_orphaned && parent.is_active === false && (
          <span className="ml-2">
            <Badge tone="neutral">Parent inactive</Badge>
          </span>
        )}
      </div>
      {ancestors && <div className="text-ux-caption text-orac-text-muted">{ancestors}</div>}
    </div>
  );
}

export default function AdminEntitiesTab({ user }) {
  const canManageCatalog = ["Admin", "Management"].includes(user.role);
  // Same rule as AdminPage.jsx's Client Directory tab: Operations can manage
  // assets but not clients, so don't point them at a tab they cannot see.
  const canManageClients = ["Admin", "Management"].includes(user.role);
  const visibleEntities = ENTITIES.filter((entity) => entity.key !== "catalog_items" || canManageCatalog);
  const [activeEntity, setActiveEntity] = useState(visibleEntities[0].key);
  const [data, setData] = useState([]);
  const [parentOptions, setParentOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [modal, setModal] = useState({ open: false, item: null });
  const [parentId, setParentId] = useState("");
  const [formError, setFormError] = useState("");

  const currentConfig = visibleEntities.find((e) => e.key === activeEntity);

  async function loadData(entityKey) {
    const config = ENTITIES.find((e) => e.key === entityKey);
    setLoading(true);
    setError("");
    try {
      const tasks = [collections.list(entityKey)];
      if (config.parentCollection) tasks.push(collections.list(config.parentCollection));
      const [items, parents] = await Promise.all(tasks);
      setData(items);
      setParentOptions(parents || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData(activeEntity);
  }, [activeEntity]);

  // Keep the parent picker's controlled value in sync whenever the modal is
  // (re)opened, for either a new record (starts empty) or an existing one
  // (starts on its current parent, even if that parent is now inactive —
  // see the active-parent filter below).
  useEffect(() => {
    if (modal.open) {
      setParentId(currentConfig.parentField ? modal.item?.[currentConfig.parentField] || "" : "");
      setFormError("");
    }
  }, [modal.open, modal.item, activeEntity]);

  async function handleSave(e) {
    e.preventDefault();
    setFormError("");

    if (currentConfig.parentField && !parentId) {
      setFormError(`Select a ${currentConfig.parentNoun} before saving.`);
      return;
    }

    const form = new FormData(e.target);
    const payload = Object.fromEntries(form.entries());
    if (currentConfig.parentField) payload[currentConfig.parentField] = parentId;

    // Type casting
    if (payload.unit_price) payload.unit_price = Number(payload.unit_price);

    try {
      const isEdit = !!modal.item?.id;

      switch (activeEntity) {
        case "mine_sites":
          isEdit ? await admin.updateMineSite(modal.item.id, payload) : await admin.createMineSite(payload);
          break;
        case "plants":
          isEdit ? await admin.updatePlant(modal.item.id, payload) : await admin.createPlant(payload);
          break;
        case "plant_sections":
          isEdit ? await admin.updatePlantSection(modal.item.id, payload) : await admin.createPlantSection(payload);
          break;
        case "equipment_tags":
          isEdit ? await admin.updateEquipmentTag(modal.item.id, payload) : await admin.createEquipmentTag(payload);
          break;
        case "catalog_items":
          isEdit ? await admin.updateCatalogItem(modal.item.id, payload) : await admin.createCatalogItem(payload);
          break;
      }

      setModal({ open: false, item: null });
      loadData(activeEntity);
    } catch (err) {
      setFormError(err.message);
    }
  }

  // Active parents, plus whichever parent this record already has (even if
  // that parent has since been deactivated) so editing an existing record
  // never silently drops its historical link. Matches the same pattern
  // ContractsPage.jsx already uses for its equipment-tag picker.
  const parentSelectOptions = parentOptions
    .filter((p) => p.is_active !== false || p.id === modal.item?.[currentConfig.parentField])
    .map((p) => ({
      value: p.id,
      label: p.name,
      hint: (p.is_active === false ? "Inactive — " : "") +
        (currentConfig.parentCollection === "clients"
          ? (p.client_type === "walk_in" ? "Walk-in client" : "Permanent client")
          : (p.hierarchy_label || ""))
    }));

  const selectedParent = parentOptions.find((p) => p.id === parentId);
  const statusEffect = statusEffectNote(currentConfig);
  const editingCurrentParentIsInactive = Boolean(
    currentConfig.parentField &&
    modal.item &&
    parentOptions.find((p) => p.id === modal.item[currentConfig.parentField])?.is_active === false
  );

  return (
    <div className="flex flex-col md:flex-row gap-6 animate-in fade-in">
      {/* Side Menu */}
      <div className="w-full md:w-64 flex-shrink-0">
        <div className="bg-orac-surface border border-orac-border-default rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-orac-border-default bg-orac-surface-muted">
            <h3 className="text-ux-section font-semibold text-orac-text-primary">Entities</h3>
            <p className="mt-1 text-ux-caption text-orac-text-muted">
              Hierarchy: {HIERARCHY_CHAIN.join(" \u203a ")}.{" "}
              {canManageClients
                ? "Clients are managed from the Client Directory tab."
                : "Clients are managed by Admin or Management."}
            </p>
          </div>
          <div className="flex flex-col p-2 space-y-1">
            {visibleEntities.map(ent => (
              <button
                key={ent.key}
                onClick={() => setActiveEntity(ent.key)}
                aria-current={activeEntity === ent.key ? "page" : undefined}
                className={`text-left px-4 py-2.5 rounded-lg text-ux-label font-medium transition-colors ${
                  activeEntity === ent.key 
                    ? "bg-orac-accent/10 text-orac-accent font-semibold" 
                    : "text-orac-text-secondary hover:bg-orac-row-hover hover:text-orac-text-primary"
                }`}
              >
                {ent.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 space-y-4">
        <div className="bg-orac-surface p-6 rounded-xl shadow-sm border border-orac-border-default space-y-4">
          {currentConfig.key !== "catalog_items" && (
            <ScopeTrail
              items={HIERARCHY_CHAIN.map((label) => ({ label, active: label === currentConfig.singular }))}
            />
          )}
          <div className="flex justify-between items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-ux-section font-semibold text-orac-text-primary">{currentConfig.label}</h2>
                <Badge tone={currentConfig.ownership === "orac" ? "info" : "success"}>
                  {OWNERSHIP_LABEL[currentConfig.ownership]}
                </Badge>
              </div>
              <p className="mt-1 text-ux-body text-orac-text-secondary">{currentConfig.purpose}</p>
            </div>
            <Button
              onClick={() => setModal({ open: true, item: null })}
              variant="primary"
              className="whitespace-nowrap"
            >
              + Add new
            </Button>
          </div>
        </div>

        {error && <ErrorBanner message={error} />}

        <div className="rounded-xl shadow-sm border border-orac-border-default overflow-hidden">
          {loading ? (
            <PageLoadingSkeleton label={`Loading ${currentConfig.label}`} />
          ) : (
            <DataTable
              title=""
              columns={currentConfig.columns}
              rows={data}
              emptyText={`No ${currentConfig.label.toLowerCase()} found.`}
              renderRow={(row) => (
                <tr key={row.id} className="transition-colors hover:bg-orac-row-hover group">
                  {/* Common Render logic, dynamically handled based on entity */}
                  {activeEntity === "mine_sites" && (
                    <>
                      <td className="px-6 py-4">
                        <a onClick={() => setModal({ open: true, item: row })} className="cursor-pointer text-ux-body font-semibold text-orac-text-primary hover:underline hover:text-orac-accent">{row.name}</a>
                      </td>
                      <td className="px-6 py-4"><ParentContextCell row={row} /></td>
                      <td className="px-6 py-4 text-ux-body text-orac-text-secondary">{row.location || "—"}</td>
                    </>
                  )}
                  {activeEntity === "plants" && (
                    <>
                      <td className="px-6 py-4">
                        <a onClick={() => setModal({ open: true, item: row })} className="cursor-pointer text-ux-body font-semibold text-orac-text-primary hover:underline hover:text-orac-accent">{row.name}</a>
                      </td>
                      <td className="px-6 py-4"><ParentContextCell row={row} /></td>
                    </>
                  )}
                  {activeEntity === "plant_sections" && (
                    <>
                      <td className="px-6 py-4">
                        <a onClick={() => setModal({ open: true, item: row })} className="cursor-pointer text-ux-body font-semibold text-orac-text-primary hover:underline hover:text-orac-accent">{row.name}</a>
                      </td>
                      <td className="px-6 py-4"><ParentContextCell row={row} /></td>
                    </>
                  )}
                  {activeEntity === "equipment_tags" && (
                    <>
                      <td className="px-6 py-4">
                        <a onClick={() => setModal({ open: true, item: row })} className="cursor-pointer text-ux-body font-semibold text-orac-text-primary hover:underline hover:text-orac-accent">{row.tag_code}</a>
                      </td>
                      <td className="px-6 py-4 text-ux-body text-orac-text-secondary">{row.equipment_name}</td>
                      <td className="px-6 py-4"><ParentContextCell row={row} /></td>
                    </>
                  )}
                  {activeEntity === "catalog_items" && (
                    <>
                      <td className="px-6 py-4">
                        <a onClick={() => setModal({ open: true, item: row })} className="cursor-pointer text-ux-body font-semibold text-orac-text-primary hover:underline hover:text-orac-accent">{row.item_code}</a>
                      </td>
                      <td className="px-6 py-4 text-ux-body text-orac-text-secondary">{row.item_name}</td>
                      <td className="px-6 py-4 text-ux-body tabular-nums text-orac-text-primary font-semibold">{formatMoney(row.unit_price)}</td>
                    </>
                  )}

                  <td className="px-6 py-4">
                    <StatusBadge status={row.is_active !== false ? "Active" : "Inactive"} />
                  </td>
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-2 opacity-70 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                      <Button
                        variant="link"
                        onClick={() => setModal({ open: true, item: row })}
                        className="font-bold text-orac-accent"
                      >
                        Edit
                      </Button>
                      <Button
                        variant="link"
                        onClick={async () => {
                          const isActive = row.is_active !== false;
                          const effect = isActive
                            ? statusEffectNote(currentConfig)
                            : "It becomes available for new links again.";
                          if (!confirm(`${isActive ? "Deactivate" : "Reactivate"} this record?${effect ? `\n\n${effect}` : ""}`)) return;
                          try {
                            if (isActive) {
                              await admin.deactivateEntity(activeEntity, row.id);
                            } else {
                              await admin.reactivateEntity(activeEntity, row.id);
                            }
                            loadData(activeEntity);
                          } catch (err) { alert("Error: " + err.message); }
                        }}
                        className={`font-bold ${
                          row.is_active !== false ? "text-orac-warning-text hover:text-amber-800" : "text-orac-success-text hover:text-green-800"
                        }`}
                      >
                        {row.is_active !== false ? "Disable" : "Enable"}
                      </Button>
                    </div>
                  </td>
                </tr>
              )}
            />
          )}
        </div>
      </div>

      <Modal
        title={modal.item ? `Edit ${currentConfig.singular}` : `New ${currentConfig.singular}`}
        isOpen={modal.open}
        onClose={() => setModal({ open: false, item: null })}
        size="lg"
      >
        <form onSubmit={handleSave} className="space-y-4">
          {formError && <ErrorBanner message={formError} />}

          {currentConfig.parentField && (
            <div>
              <ScopeTrail
                items={(selectedParent?.hierarchy_path || []).map((n) => ({ label: n.name }))}
              />
              <label className="mb-1 block text-ux-label font-semibold text-orac-text-primary">
                {currentConfig.parentLabel}
              </label>
              <SearchableSelect
                ariaLabel={currentConfig.parentLabel}
                options={parentSelectOptions}
                value={parentId}
                onChange={setParentId}
                placeholder={`Select ${currentConfig.parentNoun}...`}
              />
              <p className="mt-1 text-ux-caption text-orac-text-muted">
                Only active {currentConfig.parentNoun}s are offered for a new link
                {editingCurrentParentIsInactive
                  ? " — this record's current one is shown even though it is now inactive, so its history is not lost."
                  : "."}
              </p>
            </div>
          )}

          {/* FIX: field names below now match the real backend schemas
              (schemas.js) and seeded records (curatedDemoData.js). The
              previous names (part_number/description/tag_number, and the
              missing plant_code/section_code inputs) meant these forms
              submitted payloads the backend's Zod schemas rejected with
              "X is required" for every entity except Mine Sites, and the
              catalog/equipment tables rendered blank for existing records. */}
          {activeEntity === "catalog_items" ? (
            <>
              <div>
                <label className="mb-1 block text-ux-label font-semibold text-orac-text-primary">Item Code</label>
                <input name="item_code" defaultValue={modal.item?.item_code || ""} required className="w-full min-h-[44px] rounded-lg border border-orac-border-strong bg-orac-canvas px-3.5 py-2 text-ux-body text-orac-text-primary focus:border-orac-accent focus:ring-2 focus:ring-orac-focus-ring/30" />
              </div>
              <div>
                <label className="mb-1 block text-ux-label font-semibold text-orac-text-primary">Item Name</label>
                <input name="item_name" defaultValue={modal.item?.item_name || ""} required className="w-full min-h-[44px] rounded-lg border border-orac-border-strong bg-orac-canvas px-3.5 py-2 text-ux-body text-orac-text-primary focus:border-orac-accent focus:ring-2 focus:ring-orac-focus-ring/30" />
              </div>
              <div>
                <label className="mb-1 block text-ux-label font-semibold text-orac-text-primary">Unit Price</label>
                <input name="unit_price" type="number" step="0.01" defaultValue={modal.item?.unit_price || ""} required className="w-full min-h-[44px] rounded-lg border border-orac-border-strong bg-orac-canvas px-3.5 py-2 text-ux-body text-orac-text-primary focus:border-orac-accent focus:ring-2 focus:ring-orac-focus-ring/30" />
              </div>
            </>
          ) : activeEntity !== "equipment_tags" ? (
            <div>
              <label className="mb-1 block text-ux-label font-semibold text-orac-text-primary">Name</label>
              <input name="name" defaultValue={modal.item?.name || ""} required className="w-full min-h-[44px] rounded-lg border border-orac-border-strong bg-orac-canvas px-3.5 py-2 text-ux-body text-orac-text-primary focus:border-orac-accent focus:ring-2 focus:ring-orac-focus-ring/30" />
            </div>
          ) : null}

          {activeEntity === "mine_sites" && (
            <div>
              <label className="mb-1 block text-ux-label font-semibold text-orac-text-primary">Location</label>
              <input name="location" defaultValue={modal.item?.location || ""} className="w-full min-h-[44px] rounded-lg border border-orac-border-strong bg-orac-canvas px-3.5 py-2 text-ux-body text-orac-text-primary focus:border-orac-accent focus:ring-2 focus:ring-orac-focus-ring/30" />
            </div>
          )}

          {activeEntity === "plants" && (
            <div>
              <label className="mb-1 block text-ux-label font-semibold text-orac-text-primary">Plant Code</label>
              <input name="plant_code" defaultValue={modal.item?.plant_code || ""} required className="w-full min-h-[44px] rounded-lg border border-orac-border-strong bg-orac-canvas px-3.5 py-2 text-ux-body text-orac-text-primary focus:border-orac-accent focus:ring-2 focus:ring-orac-focus-ring/30" />
            </div>
          )}

          {activeEntity === "plant_sections" && (
            <div>
              <label className="mb-1 block text-ux-label font-semibold text-orac-text-primary">Section Code</label>
              <input name="section_code" defaultValue={modal.item?.section_code || ""} required className="w-full min-h-[44px] rounded-lg border border-orac-border-strong bg-orac-canvas px-3.5 py-2 text-ux-body text-orac-text-primary focus:border-orac-accent focus:ring-2 focus:ring-orac-focus-ring/30" />
            </div>
          )}

          {activeEntity === "equipment_tags" && (
            <>
              <div>
                <label className="mb-1 block text-ux-label font-semibold text-orac-text-primary">Tag Code</label>
                <input name="tag_code" defaultValue={modal.item?.tag_code || ""} required className="w-full min-h-[44px] rounded-lg border border-orac-border-strong bg-orac-canvas px-3.5 py-2 text-ux-body text-orac-text-primary focus:border-orac-accent focus:ring-2 focus:ring-orac-focus-ring/30" />
              </div>
              <div>
                <label className="mb-1 block text-ux-label font-semibold text-orac-text-primary">Equipment Name</label>
                <input name="equipment_name" defaultValue={modal.item?.equipment_name || ""} required className="w-full min-h-[44px] rounded-lg border border-orac-border-strong bg-orac-canvas px-3.5 py-2 text-ux-body text-orac-text-primary focus:border-orac-accent focus:ring-2 focus:ring-orac-focus-ring/30" />
              </div>
            </>
          )}

          {/* FIX: this used to be an Active/Inactive <select>, but the backend
              never reads is_active from create/update bodies for these
              collections (only users), so choosing "Inactive" silently did
              nothing. Status changes only through the audited Disable/Enable
              action (deactivateEntity/reactivateEntity, which records who and
              when), so the form now says so instead of offering a dead control. */}
          <div>
            <label className="mb-1 block text-ux-label font-semibold text-orac-text-primary">Status</label>
            <p className="text-ux-body text-orac-text-primary">
              {!modal.item ? "New records start Active." : modal.item.is_active !== false ? "Active" : "Inactive"}
            </p>
            <p className="mt-1 text-ux-caption text-orac-text-muted">
              {modal.item
                ? "Change this with Disable / Enable in the table; that action is recorded in the audit log."
                : "You can disable it later from the table; that action is recorded in the audit log."}
              {statusEffect ? ` ${statusEffect}` : ""}
            </p>
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setModal({ open: false, item: null })}>Cancel</Button>
            <Button type="submit" variant="primary">Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
