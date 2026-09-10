// Orac-IOS API client.
// Verified against src/router.js, authController.js, coreController.js,
// stateMachine.js. See ORAC_API_CONTRACT_REFERENCE.md for the source-checked
// contract this file implements.

const BASE = import.meta.env.VITE_API_BASE_URL || "/api";

function getToken() {
  return localStorage.getItem("orac_token") || "";
}

function setSession(user, token) {
  localStorage.setItem("orac_token", token);
  localStorage.setItem("orac_user", JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem("orac_token");
  localStorage.removeItem("orac_user");
}

function getCachedUser() {
  const raw = localStorage.getItem("orac_user");
  try { return raw ? JSON.parse(raw) : null; }
  catch { clearSession(); return null; }
}

async function request(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const body = await res.json().catch(() => ({}));

  if (!res.ok || body.success === false) {
    const message = body.message || `Request failed (${res.status})`;
    throw new Error(message);
  }
  // Every backend response is { success: true, data: ... } â€” always unwrap.
  return body.data;
}

export const auth = {
  async login(email) {
    const data = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email })
    });
    // Confirmed shape: { user, token } â€” not { role } at the top level.
    setSession(data.user, data.token);
    return data.user;
  },
  async restoreSession() {
    if (!getToken()) return null;
    try {
      const user = await request("/auth/me");
      setSession(user, getToken());
      return user;
    } catch {
      clearSession();
      return null;
    }
  },
  logout() {
    clearSession();
  },
  getCachedUser,
  getToken
};

export const collections = {
  list(name) {
    // e.g. list("quotes"), list("dispatch_cards"), list("field_worksheets")
    return request(`/${name}`);
  }
};

export const summary = {
  get() {
    return request("/summary");
  }
};

export const quotes = {
  create(payload) {
    return request("/quotes", { method: "POST", body: JSON.stringify(payload) });
  },
  transition(id, targetState, extra = {}) {
    // Confirmed field name: target_state, not to_status.
    return request(`/quotes/${id}/transition`, {
      method: "POST",
      body: JSON.stringify({ target_state: targetState, ...extra })
    });
  },
  verifyPo(id, po_reference, po_amount, extra = {}) {
    return request(`/quotes/${id}/po`, {
      method: "POST",
      body: JSON.stringify({ po_reference, po_amount, ...extra })
    });
  }
};

export const dispatch = {
  addTimesheet(dispatchId, hours_logged, hourly_rate, extra = {}) {
    // Timesheets: hours_logged + hourly_rate (feeds invoice labor total).
    return request(`/dispatch_cards/${dispatchId}/timesheets`, {
      method: "POST",
      body: JSON.stringify({ hours_logged, hourly_rate, ...extra })
    });
  },
  addMaterialUsage(dispatchId, payload) {
    return request(`/dispatch_cards/${dispatchId}/materials`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  createWorksheet(dispatchId, payload) {
    // Worksheets: hours (not hours_logged), activity, outcomes, etc.
    return request(`/dispatch_cards/${dispatchId}/worksheets`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }
};

export const worksheets = {
  submit(id) {
    return request(`/field_worksheets/${id}/submit`, { method: "POST" });
  },
  review(id, decision, comment = "") {
    return request(`/field_worksheets/${id}/review`, {
      method: "POST",
      body: JSON.stringify({ decision, comment })
    });
  }
};

export const notifications = {
  list() {
    return request("/notifications");
  },
  markRead(id) {
    return request(`/notifications/${id}/read`, { method: "POST" });
  },
  markAllRead() {
    return request("/notifications/read-all", { method: "POST" });
  }
};

export async function openDocument(type, id) {
  // Printable documents require the Bearer token â€” a plain window.open()
  // to a protected URL will 401.
  const res = await fetch(`${BASE}/document-data/${type}/${id}`, {
    headers: { Authorization: `Bearer ${getToken()}` }
  });
  if (!res.ok) throw new Error(`Could not load document (${res.status})`);
  const body = await res.json();
  return body.data;
}

// --- Phase 17b additions -----------------------------------------------------
// Verified against src/router.js and src/schemas.js (StockMovementSchema,
// CreateStockItemSchema, AdminCompanyProfileSchema, ClientSubmitPoSchema).

export const inventory = {
  listStockItems() {
    return request("/inventory/stock_items");
  },
  createStockItem(payload) {
    return request("/inventory/stock_items", { method: "POST", body: JSON.stringify(payload) });
  },
  updateStockItem(id, payload) {
    return request(`/inventory/stock_items/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
  },
  recordMovement(payload) {
    // payload: { stock_item_id, movement_type: "in"|"out"|"adjustment", quantity, reason, reference_id?, override_negative? }
    return request("/inventory/movements", { method: "POST", body: JSON.stringify(payload) });
  },
  lowStockReport() {
    return request("/inventory/reports/low-stock");
  },
  listSuppliers() {
    return request("/inventory/suppliers");
  },
  createSupplier(payload) {
    return request("/inventory/suppliers", { method: "POST", body: JSON.stringify(payload) });
  },
  updateSupplier(id, payload) {
    return request(`/inventory/suppliers/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
  }
};

export const reports = {
  get(name) {
    // name: "pipeline" | "po-compliance" | "dispatch" | "worksheets" | "invoice-ready" | "variance"
    return request(`/reports/${name}`);
  }
};

export const admin = {
  getCompanyProfile() {
    return request("/admin/company_profile");
  },
  updateCompanyProfile(payload) {
    return request("/admin/company_profile", { method: "PATCH", body: JSON.stringify(payload) });
  },
  createUser(payload) {
    return request("/admin/users", { method: "POST", body: JSON.stringify(payload) });
  },
  updateUser(id, payload) {
    return request(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
  },
  createClient(payload) {
    return request("/admin/clients", { method: "POST", body: JSON.stringify(payload) });
  },
  updateClient(id, payload) {
    return request(`/admin/clients/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
  }
};

// Attach to the existing `quotes` export rather than redefining it.
quotes.submitClientPo = (id, po_reference, po_amount, extra = {}) => {
  return request(`/quotes/${id}/client-po`, {
    method: "POST",
    body: JSON.stringify({ po_reference, po_amount, ...extra })
  });
};