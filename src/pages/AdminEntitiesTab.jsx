import React, { useEffect, useState } from "react";
import { collections, admin } from "../api/client.js";
import DataTable from "../components/DataTable.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import Modal from "../components/Modal.jsx";
import { ErrorBanner } from "../components/PageStates.jsx";

const ENTITIES = [
  { key: "mine_sites", label: "Mine Sites", columns: ["Name", "Location", "Client ID", "Status", "Actions"] },
  { key: "plants", label: "Plants", columns: ["Name", "Mine Site ID", "Status", "Actions"] },
  { key: "plant_sections", label: "Plant Sections", columns: ["Name", "Plant ID", "Status", "Actions"] },
  { key: "equipment_tags", label: "Equipment Tags", columns: ["Tag Code", "Equipment Name", "Plant Section ID", "Status", "Actions"] },
  { key: "catalog_items", label: "Catalog Items", columns: ["Item Code", "Item Name", "Unit Price", "Status", "Actions"] },
];

export default function AdminEntitiesTab({ user }) {
  const canManageCatalog = ["Admin", "Management"].includes(user.role);
  const visibleEntities = ENTITIES.filter((entity) => entity.key !== "catalog_items" || canManageCatalog);
  const [activeEntity, setActiveEntity] = useState(visibleEntities[0].key);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [modal, setModal] = useState({ open: false, item: null });

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const items = await collections.list(activeEntity);
      setData(items);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [activeEntity]);

  async function handleSave(e) {
    e.preventDefault();
    const form = new FormData(e.target);
    const payload = Object.fromEntries(form.entries());
    
    // Type casting
    if (payload.is_active) payload.is_active = payload.is_active === "true";
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
      loadData();
    } catch (err) {
      alert("Error saving: " + err.message);
    }
  }

  const currentConfig = visibleEntities.find(e => e.key === activeEntity);

  return (
    <div className="flex flex-col md:flex-row gap-6 animate-in fade-in">
      {/* Side Menu */}
      <div className="w-full md:w-64 flex-shrink-0">
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50">
            <h3 className="font-semibold text-orac-blue">Entities</h3>
          </div>
          <div className="flex flex-col p-2">
            {visibleEntities.map(ent => (
              <button
                key={ent.key}
                onClick={() => setActiveEntity(ent.key)}
                className={`text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  activeEntity === ent.key 
                    ? "bg-orac-blue/10 text-orac-blue" 
                    : "text-gray-600 hover:bg-gray-50"
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
        <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-orac-blue">{currentConfig.label}</h2>
            <p className="text-sm text-gray-500">Manage all records for this entity.</p>
          </div>
          <button
            onClick={() => setModal({ open: true, item: null })}
            className="px-4 py-2 bg-orac-slate text-white text-sm font-medium rounded-lg shadow-sm hover:shadow-md hover:bg-slate-700 transition-all"
          >
            + Add New
          </button>
        </div>

        {error && <ErrorBanner message={error} />}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-400">Loading {currentConfig.label}...</div>
          ) : (
            <DataTable
              title=""
              columns={currentConfig.columns}
              rows={data}
              emptyText={`No ${currentConfig.label.toLowerCase()} found.`}
              renderRow={(row) => (
                <tr key={row.id} className="transition-colors hover:bg-gray-50/80 group">
                  {/* Common Render logic, dynamically handled based on entity */}
                  {activeEntity === "mine_sites" && (
                    <>
                      <td className="px-5 py-4 text-sm font-medium text-orac-blue">{row.name}</td>
                      <td className="px-5 py-4 text-sm text-gray-500">{row.location || "—"}</td>
                      <td className="px-5 py-4 text-sm text-gray-500">{row.client_id}</td>
                    </>
                  )}
                  {activeEntity === "plants" && (
                    <>
                      <td className="px-5 py-4 text-sm font-medium text-orac-blue">{row.name}</td>
                      <td className="px-5 py-4 text-sm text-gray-500">{row.mine_site_id}</td>
                    </>
                  )}
                  {activeEntity === "plant_sections" && (
                    <>
                      <td className="px-5 py-4 text-sm font-medium text-orac-blue">{row.name}</td>
                      <td className="px-5 py-4 text-sm text-gray-500">{row.plant_id}</td>
                    </>
                  )}
                  {activeEntity === "equipment_tags" && (
                    <>
                      {/* FIX: backend/schema field names are tag_code and
                          equipment_name (see schemas.js AdminCreateEquipmentTagSchema
                          and curatedDemoData.js), not tag_number/name. The old
                          bindings rendered blank cells for every real record. */}
                      <td className="px-5 py-4 text-sm font-medium text-orac-blue">{row.tag_code}</td>
                      <td className="px-5 py-4 text-sm text-gray-500">{row.equipment_name}</td>
                      <td className="px-5 py-4 text-sm text-gray-500">{row.plant_section_id}</td>
                    </>
                  )}
                  {activeEntity === "catalog_items" && (
                    <>
                      {/* FIX: backend/schema field names are item_code and
                          item_name (see schemas.js AdminCreateCatalogItemSchema
                          and curatedDemoData.js), not part_number/description. */}
                      <td className="px-5 py-4 text-sm font-medium text-orac-blue">{row.item_code}</td>
                      <td className="px-5 py-4 text-sm text-gray-500">{row.item_name}</td>
                      <td className="px-5 py-4 text-sm text-gray-500">${row.unit_price}</td>
                    </>
                  )}
                  
                  <td className="px-5 py-4 text-sm">
                    <StatusBadge status={row.is_active ? "Active" : "Inactive"} />
                  </td>
                  <td className="px-5 py-4 text-sm text-right space-x-3">
                    <button
                      onClick={() => setModal({ open: true, item: row })}
                      className="text-orac-blue font-medium hover:underline transition-colors opacity-70 group-hover:opacity-100 group-focus-within:opacity-100"
                    >
                      Edit
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm(`${row.is_active ? "Deactivate" : "Reactivate"} this record?`)) return;
                        try {
                          if (row.is_active) {
                            await admin.deactivateEntity(activeEntity, row.id);
                          } else {
                            await admin.reactivateEntity(activeEntity, row.id);
                          }
                          loadData();
                        } catch (err) { alert("Error: " + err.message); }
                      }}
                      className={`font-medium transition-colors opacity-70 group-hover:opacity-100 group-focus-within:opacity-100 ${
                        row.is_active ? "text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300" : "text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
                      }`}
                    >
                      {row.is_active ? "Disable" : "Enable"}
                    </button>
                  </td>
                </tr>
              )}
            />
          )}
        </div>
      </div>

      <Modal
        title={modal.item ? `Edit ${currentConfig.label.slice(0, -1)}` : `New ${currentConfig.label.slice(0, -1)}`}
        isOpen={modal.open}
        onClose={() => setModal({ open: false, item: null })}
      >
        <form onSubmit={handleSave} className="space-y-4">
          {/* Dynamic Fields */}
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
                <label className="mb-1 block text-xs font-semibold text-gray-600 uppercase">Item Code</label>
                <input name="item_code" defaultValue={modal.item?.item_code || ""} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600 uppercase">Item Name</label>
                <input name="item_name" defaultValue={modal.item?.item_name || ""} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600 uppercase">Unit Price</label>
                <input name="unit_price" type="number" step="0.01" defaultValue={modal.item?.unit_price || ""} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20" />
              </div>
            </>
          ) : activeEntity !== "equipment_tags" ? (
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600 uppercase">Name</label>
              <input name="name" defaultValue={modal.item?.name || ""} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20" />
            </div>
          ) : null}

          {activeEntity === "mine_sites" && (
            <>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600 uppercase">Location</label>
                <input name="location" defaultValue={modal.item?.location || ""} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600 uppercase">Client ID</label>
                <input name="client_id" defaultValue={modal.item?.client_id || ""} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20" />
              </div>
            </>
          )}

          {activeEntity === "plants" && (
            <>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600 uppercase">Mine Site ID</label>
                <input name="mine_site_id" defaultValue={modal.item?.mine_site_id || ""} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600 uppercase">Plant Code</label>
                <input name="plant_code" defaultValue={modal.item?.plant_code || ""} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20" />
              </div>
            </>
          )}

          {activeEntity === "plant_sections" && (
            <>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600 uppercase">Plant ID</label>
                <input name="plant_id" defaultValue={modal.item?.plant_id || ""} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600 uppercase">Section Code</label>
                <input name="section_code" defaultValue={modal.item?.section_code || ""} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20" />
              </div>
            </>
          )}

          {activeEntity === "equipment_tags" && (
            <>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600 uppercase">Tag Code</label>
                <input name="tag_code" defaultValue={modal.item?.tag_code || ""} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600 uppercase">Equipment Name</label>
                <input name="equipment_name" defaultValue={modal.item?.equipment_name || ""} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600 uppercase">Plant Section ID</label>
                <input name="plant_section_id" defaultValue={modal.item?.plant_section_id || ""} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20" />
              </div>
            </>
          )}

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600 uppercase">Status</label>
            <select name="is_active" defaultValue={modal.item ? String(modal.item.is_active) : "true"} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orac-blue focus:ring-2 focus:ring-orac-blue/20 bg-white">
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={() => setModal({ open: false, item: null })} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">Cancel</button>
            <button type="submit" className="px-5 py-2 bg-orac-slate text-white text-sm font-medium rounded-lg hover:bg-slate-800 shadow-sm">Save</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
