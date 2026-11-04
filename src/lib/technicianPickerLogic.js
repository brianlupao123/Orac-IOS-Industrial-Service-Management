// Pure helpers for the Technician picker on the Timesheet form.
// No React, no fetch. The server re-validates the technician on save: nothing here is trusted,
// it only shapes the list and fills the read-only identity fields so the capturer never re-types them.

// Roles that capture a Timesheet on behalf of a Technician and so need the picker.
// (A Technician capturing their own Timesheet does not pick anyone.)
export const TECHNICIAN_PICKER_ROLES = ["Admin", "Operations", "Supervisor", "Sales"];
export const canPickTechnician = (role) => TECHNICIAN_PICKER_ROLES.includes(role);

// The identity fields that come from the picked profile. They are shown read-only and are
// never typed by the capturer. Kept in one place so the payload and the form agree.
export const TECHNICIAN_IDENTITY_FIELDS = ["technician_id", "worker_name", "technician_trade", "national_id"];
export const EMPTY_TECHNICIAN_IDENTITY = () => ({ technician_id: "", worker_name: "", technician_trade: "", national_id: "" });

const clean = (v) => String(v ?? "").trim();

function fullNameOf(p) {
  const first = clean(p.first_name ?? p.firstname ?? p.firstName);
  const last = clean(p.last_name ?? p.lastname ?? p.surname ?? p.lastName);
  const joined = `${first} ${last}`.trim();
  return joined || clean(p.full_name ?? p.name ?? p.display_name);
}

// One profile -> { id, name, trade, national_id } or null when it cannot identify a person.
export function normalizeTechnicianProfile(p) {
  if (!p || typeof p !== "object") return null;
  const id = clean(p.technician_id ?? p.user_id ?? p.id);
  const name = fullNameOf(p);
  if (!id || !name) return null;
  if (p.is_active === false || /^(inactive|suspended|disabled)$/i.test(clean(p.status))) return null;
  if (p.role && clean(p.role).toLowerCase() !== "technician") return null; // /users fallback: Technicians only
  return {
    id,
    name,
    trade: clean(p.technician_trade ?? p.trade ?? p.worker_category),
    national_id: clean(p.national_id ?? p.id_number ?? p.nationalId)
  };
}

export function normalizeTechnicianProfiles(list) {
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(list) ? list : []) {
    const t = normalizeTechnicianProfile(raw);
    if (!t || seen.has(t.id)) continue;
    seen.add(t.id);
    out.push(t);
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

// `[Boilermaker] Tinashe Moyo (ID: 63-1234567-X-42)`
export function technicianLabel(t) {
  return `[${t.trade || "Unclassified"}] ${t.name} (ID: ${t.national_id || "not on file"})`;
}

// Options for SearchableSelect. Typing a name, trade or ID number filters the list.
export const technicianOptions = (techs) => (techs || []).map((t) => ({ value: t.id, label: technicianLabel(t) }));

// The form fields a picked technician fills in. An empty / unknown id clears them all.
export function identityFromTechnician(techs, id) {
  const t = (techs || []).find((x) => x.id === id);
  if (!t) return EMPTY_TECHNICIAN_IDENTITY();
  return { technician_id: t.id, worker_name: t.name, technician_trade: t.trade, national_id: t.national_id };
}
