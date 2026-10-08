// Frontend switches for the Timesheet workflow packet. ALL default off; with none set the
// application renders and routes exactly as before. They are display switches only: the
// server flags (TIMESHEET_*) are the real controls and every action is enforced there.
// Vite supplies import.meta.env in the browser; the process.env fallback exists only so node tests can set a flag.
const env = (name) => (typeof import.meta !== "undefined" && import.meta.env && import.meta.env[name] !== undefined ? import.meta.env[name] : (typeof process !== "undefined" ? process.env?.[name] : undefined));
const on = (name) => env(name) === "enabled";

export const tsFlags = () => ({
  workflowUi: on("VITE_TIMESHEET_WORKFLOW_UI"),
  clientReturn: on("VITE_TIMESHEET_CLIENT_RETURN"),
  authority: on("VITE_TIMESHEET_AUTHORITY"),
  batchConfirm: on("VITE_TIMESHEET_BATCH_CONFIRM"),
  opsRestrict: on("VITE_TIMESHEET_OPS_RESTRICT"),
  kioskHidden: on("VITE_TIMESHEET_KIOSK_HIDDEN")
});

// The technical role stays "Client Viewer"; people see "Client".
export const roleLabel = (role) => (role === "Client Viewer" ? "Client" : role);

// Business labels (contract 2.1). Technical statuses are never renamed; only shown differently,
// and only once the authority flag is on.
const BUSINESS = {
  Submitted: "Awaiting Client Confirmation",
  Client_Acknowledged: "Client Confirmed",
  Captured_From_Signed_Paper: "Captured from Signed Paper",
  Supervisor_Approved: "Approved (historical)"
};
export const statusLabel = (status) => (tsFlags().authority && BUSINESS[status]) || String(status || "Unknown").replace(/_/g, " ");
