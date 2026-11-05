// Orac-IOS API client.
// Verified against src/router.js, authController.js, coreController.js,
// stateMachine.js. See ORAC_API_CONTRACT_REFERENCE.md for the source-checked
// contract this file implements.

const BASE = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");

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

const sessionExpiredListeners = new Set();

function notifySessionExpired() {
  clearSession();
  for (const listener of sessionExpiredListeners) {
    try { listener(); } catch { /* One UI listener must not affect another. */ }
  }
}

export function onSessionExpired(listener) {
  sessionExpiredListeners.add(listener);
  return () => sessionExpiredListeners.delete(listener);
}

// --- Test-only UAT state gate (UAT Closure phase) ------------------------
// Compiles to `false` unless a build is deliberately produced with
// VITE_UAT_STATE_MODE=true (see .env.uat / package.json "build:uat"). The
// ordinary `npm run build` (production) does not define this flag, so it
// is absent from normal and deployed-production builds by construction,
// not by a runtime check that could be bypassed. When enabled, it may only
// short-circuit read requests to a deterministic, already-existing UI
// state or replay the app's own real session-expiry pathway below. It
// never mutates backend data, never issues a request in "error"/"empty"
// mode, and never touches role or auth-decision logic.
const UAT_STATE_MODE_ENABLED = import.meta.env.VITE_UAT_STATE_MODE === "true";

// Read paths this file's own exports (collections.list, notifications.list,
// inventory.listStockItems/listSuppliers, accessRequests.list) are known to
// resolve to an array. Object-shaped reads (e.g. /summary, /reports/:name)
// are intentionally excluded: forcing an unverified object shape to `[]`
// risks a page crash rather than a genuine empty state, so those remain
// out of scope until the consuming page source can be reviewed (see
// FINAL_DELIVERY_READINESS.md).
const UAT_EMPTY_ARRAY_PATH_PREFIXES = ["/notifications", "/inventory/stock_items", "/inventory/suppliers", "/access_requests"];
function isKnownArrayReadPath(path) {
  return UAT_EMPTY_ARRAY_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function uatStateFromUrl() {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("uatState");
}

export const uatState = {
  isEnabled() { return UAT_STATE_MODE_ENABLED; },
  mode() { return UAT_STATE_MODE_ENABLED ? uatStateFromUrl() : null; },
  // Test-only: replays the app's real session-expiry pathway (the same
  // clearSession + listener notification restoreSession/401 handling
  // already uses below), rather than fabricating a separate UI. A no-op
  // whenever the build-time flag is absent.
  simulateSessionExpired() {
    if (!UAT_STATE_MODE_ENABLED) return;
    notifySessionExpired();
  }
};

async function request(path, options = {}) {
  if (UAT_STATE_MODE_ENABLED) {
    const mode = uatStateFromUrl();
    if (mode === "error") {
      // Test-only: no fetch is made. The same thrown-Error shape a real
      // failed request already produces is replayed so each page's own
      // existing error UI renders against real component code.
      throw new Error("Simulated UAT error state (test-only; no backend contact was made).");
    }
    if (mode === "empty" && (!options.method || options.method === "GET") && isKnownArrayReadPath(path)) {
      return [];
    }
  }
  if (import.meta.env.PROD && !import.meta.env.VITE_API_BASE_URL) {
    throw new Error("The service is not connected yet. Please try again later.");
  }
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${BASE}${path}`, { ...options, headers });
  } catch (cause) {
    // No answer from the server at all (offline, DNS, dropped connection). Marked
    // so a page can keep an unsent draft instead of treating it as a server refusal.
    const error = new Error("Could not reach the server. Check your connection and try again.");
    error.network = true;
    error.cause = cause;
    throw error;
  }
  const contentType = res.headers?.get?.("content-type") || "";
  const canReadText = typeof res.text === "function";
  const rawBody = canReadText ? await res.text() : "";
  let body;
  try {
    body = canReadText ? (rawBody ? JSON.parse(rawBody) : null) : await res.json();
  } catch {
    body = null;
  }

  const isJsonContent = !contentType || contentType.toLowerCase().includes("application/json");
  if (!isJsonContent || !body) {
    const responseKind = rawBody.trimStart().startsWith("<") ? "HTML" : "non-JSON data";
    throw new Error(`The service returned ${responseKind} instead of API data. Check the service connection and try again.`);
  }

  if (!res.ok || body.success !== true) {
    const message = body.message || `Request failed (${res.status})`;
    if (res.status === 401) {
      notifySessionExpired();
      const error = new Error(message);
      error.sessionExpired = true;
      error.status = res.status;
      throw error;
    }
    // The status lets a page tell "not allowed" or "changed under you" from a
    // generic failure without parsing the message text.
    const error = new Error(message);
    error.status = res.status;
    if (body.code) error.code = body.code; // machine-readable server code (e.g. STALE_HASH)
    throw error;
  }
  // Every backend response is { success: true, data: ... } â€” always unwrap.
  return body.data;
}

export const auth = {
  async login(email, password) {
    const data = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
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
    // Explicit logout also removes unsent offline drafts from this device. Session
    // expiry deliberately does not, so work in progress survives a timeout.
    // The prefix is the same one offlineDraftModel.js uses (a test keeps them equal);
    // it is repeated here because this file must stay free of relative imports.
    try {
      const doomed = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key && key.startsWith("orac-draft:v1:")) doomed.push(key);
      }
      doomed.forEach((key) => localStorage.removeItem(key));
    } catch { /* storage unavailable */ }
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

export const assistant = {
  health() {
    return request("/ai/health");
  },
  briefing() {
    return request("/ai/briefing", { method: "POST", body: JSON.stringify({}) });
  },
  attention() {
    return request("/ai/attention", { method: "POST", body: JSON.stringify({}) });
  },
  explain(metric) {
    return request("/ai/explain", { method: "POST", body: JSON.stringify({ metric }) });
  },
  chat(message, lastContext = null) {
    return request("/ai/chat", { method: "POST", body: JSON.stringify({ message, lastContext }) });
  },
  workflow(articleId) {
    return request("/ai/workflow", { method: "POST", body: JSON.stringify({ article_id: articleId }) });
  },
  recordAnalysis(recordType, recordId) {
    return request("/ai/record-analysis", { method: "POST", body: JSON.stringify({ record_type: recordType, record_id: recordId }) });
  },
  flag(requestId) {
    return request("/ai/feedback", { method: "POST", body: JSON.stringify({ request_id: requestId }) });
  }
};

export const quotes = {
  create(payload) {
    return request("/quotes", { method: "POST", body: JSON.stringify(payload) });
  },
  update(id, payload) {
    return request(`/quotes/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) });
  },
  cancel(id) {
    return request(`/quotes/${encodeURIComponent(id)}/cancel`, { method: "POST", body: JSON.stringify({}) });
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
  },
  rejectPo(id, reason) {
    return request(`/quotes/${id}/reject-po`, {
      method: "POST",
      body: JSON.stringify({ reason })
    });
  },
  createRevision(id, payload) {
    return request(`/quotes/${encodeURIComponent(id)}/revisions`, { method: "POST", body: JSON.stringify(payload) });
  },
  recordAmendedPoEvidence(id, payload) {
    return request(`/quotes/${encodeURIComponent(id)}/amended-po-evidence`, { method: "POST", body: JSON.stringify(payload) });
  }
};

export const purchaseOrders = {
  approveAmendment(poId, { new_amount, reason } = {}) {
    const body = { new_amount };
    if (typeof reason === "string" && reason.trim()) body.reason = reason.trim();
    return request(`/purchase_orders/${encodeURIComponent(poId)}/amendments`, { method: "POST", body: JSON.stringify(body) });
  }
};

// V5 signature evidence. Evidence-only: no account, role, OTP or rate is sent or read.
export const v5Signature = {
  state(sheetId) { return request(`/field_worksheets/${encodeURIComponent(sheetId)}/v5-signature-state`); },
  recordPaper(sheetId, payload) { return request(`/field_worksheets/${encodeURIComponent(sheetId)}/v5-paper-signature`, { method: "POST", body: JSON.stringify(payload) }); },
  confirm(sheetId, payload) { return request(`/field_worksheets/${encodeURIComponent(sheetId)}/v5-supervisor-confirmation`, { method: "POST", body: JSON.stringify(payload) }); },
  contacts(dispatchId) { return request(`/dispatch_cards/${encodeURIComponent(dispatchId)}/v5-client-supervisor-contacts`); },
  addContact(dispatchId, payload) { return request(`/dispatch_cards/${encodeURIComponent(dispatchId)}/v5-client-supervisor-contacts`, { method: "POST", body: JSON.stringify(payload) }); },
  withdrawContact(contactId) { return request(`/v5-client-supervisor-contacts/${encodeURIComponent(contactId)}/withdraw`, { method: "POST", body: JSON.stringify({}) }); }
};

// V5 invoice writer. Requests name evidence only; money, tax and numbering are
// calculated by the server. Both V5 server flags remain authoritative.
export const v5InvoiceWriter = {
  workspace(dispatchId) { return request(`/dispatch_cards/${encodeURIComponent(dispatchId)}/v5-invoice-draft-workspace`); },
  drafts(dispatchId) { return request(`/dispatch_cards/${encodeURIComponent(dispatchId)}/v5-invoice-drafts`); },
  createDraft(dispatchId, payload) { return request(`/dispatch_cards/${encodeURIComponent(dispatchId)}/v5-invoice-drafts`, { method: "POST", body: JSON.stringify(payload) }); },
  issueDraft(draftId, payload) { return request(`/v5-invoice-drafts/${encodeURIComponent(draftId)}/issue`, { method: "POST", body: JSON.stringify(payload) }); }
};

// Legacy billing uses a separate controlled path from the V5 evidence writer.
// The server calculates all money and evidence from stored records; this client
// sends only a retry-safe command key.
export const legacyInvoiceDrafts = {
  list(dispatchId) { return request(`/dispatch_cards/${encodeURIComponent(dispatchId)}/legacy-invoice-drafts`); },
  create(dispatchId, payload) { return request(`/dispatch_cards/${encodeURIComponent(dispatchId)}/legacy-invoice-drafts`, { method: "POST", body: JSON.stringify(payload) }); },
  issue(draftId, payload) { return request(`/legacy-invoice-drafts/${encodeURIComponent(draftId)}/issue`, { method: "POST", body: JSON.stringify(payload) }); }
};

export const invoices = {
  settlement(invoiceId) { return request(`/invoices/${encodeURIComponent(invoiceId)}/settlement`); },
  recordPayment(invoiceId, { idempotency_key, ...payment }) {
    return request(`/invoices/${encodeURIComponent(invoiceId)}/payments`, {
      method: "POST", headers: { "Idempotency-Key": idempotency_key }, body: JSON.stringify(payment)
    });
  },
  voidPayment(invoiceId, paymentId, reason) {
    return request(`/invoices/${encodeURIComponent(invoiceId)}/payments/${encodeURIComponent(paymentId)}/void`, {
      method: "POST", body: JSON.stringify({ reason })
    });
  },
  createCreditNote(invoiceId, { idempotency_key, ...creditNote }) {
    return request(`/invoices/${encodeURIComponent(invoiceId)}/credit-notes`, {
      method: "POST", headers: { "Idempotency-Key": idempotency_key }, body: JSON.stringify(creditNote)
    });
  },
  issueCreditNote(creditNoteId, idempotency_key) {
    return request(`/credit-notes/${encodeURIComponent(creditNoteId)}/issue`, {
      method: "POST", body: JSON.stringify({ idempotency_key })
    });
  },
  void(invoiceId, reason) {
    return request(`/invoices/${encodeURIComponent(invoiceId)}/void`, { method: "POST", body: JSON.stringify({ reason }) });
  }
};

export const salesPortfolio = {
  dispatches() { return request(`/sales-portfolio/dispatches`); },
  dispatchProgress(dispatchId) { return request(`/sales-portfolio/dispatches/${encodeURIComponent(dispatchId)}/progress`); },
  approvedWork(dispatchId) { return request(`/sales-portfolio/dispatches/${encodeURIComponent(dispatchId)}/approved-work`); },
  materials(dispatchId) { return request(`/sales-portfolio/dispatches/${encodeURIComponent(dispatchId)}/materials`); },
  invoices() { return request(`/sales-portfolio/invoices`); },
  purchaseOrders() { return request(`/sales-portfolio/purchase_orders`); }
};

export const dispatch = {
  // Read-only, role-scoped operational summary. The server removes financial
  // values and assignment details that the current role is not allowed to see.
  jobCard(dispatchId) {
    return request(`/dispatch_cards/${encodeURIComponent(dispatchId)}/job-card`);
  },
  invoiceReadiness(dispatchId) {
    return request(`/dispatch_cards/${encodeURIComponent(dispatchId)}/invoice-readiness`);
  },
  v5BillingReadiness(dispatchId) {
    return request(`/dispatch_cards/${encodeURIComponent(dispatchId)}/v5-billing-readiness`);
  },
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
  // Kiosk and Technician time entries on one dispatch, for the roles allowed to read them.
  // The server never returns a rate on these reads.
  timesheets(dispatchId, workDate) {
    const query = workDate ? `?work_date=${encodeURIComponent(workDate)}` : "";
    return request(`/dispatch_cards/${encodeURIComponent(dispatchId)}/timesheets${query}`);
  },
  // Plain-language stock status for materials already used on this assigned job only.
  materialStatus(dispatchId) {
    return request(`/dispatch_cards/${encodeURIComponent(dispatchId)}/materials/status`);
  },
  // Admin/Operations: roster plus a Supervisor picker, and the way to resolve "no Supervisor assigned".
  roster(dispatchId) {
    return request(`/dispatch_cards/${encodeURIComponent(dispatchId)}/roster`);
  },
  assignSupervisor(dispatchId, supervisorId) {
    return request(`/dispatch_cards/${encodeURIComponent(dispatchId)}/supervisor`, {
      method: "POST",
      body: JSON.stringify({ supervisor_id: supervisorId })
    });
  },
  createWorksheet(dispatchId, payload) {
    // Worksheets: hours (not hours_logged), activity, outcomes, etc.
    // client_request_id is generated once on the device and reused on every retry (including from the
    // offline outbox). It is sent in the body and as Idempotency-Key so the server can recognise a
    // repeated submission and return the original Timesheet instead of creating a second one.
    const headers = payload?.client_request_id ? { "Idempotency-Key": payload.client_request_id } : undefined;
    return request(`/dispatch_cards/${dispatchId}/worksheets`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });
  }
};

// Worksheet = the automatically generated monthly register. It is consolidated on the server
// from approved Timesheets; no call here sends or receives hours entered by hand, a rate, an
// amount or a cost.
// Phase 3: certified hours vs quoted / PO hours. The server removes money figures for roles that may not see them.
export const poVariance = {
  forRegister(registerId) { return request(`/worksheet_registers/${encodeURIComponent(registerId)}/po-variance`); },
  forDispatch(dispatchId) { return request(`/dispatch_cards/${encodeURIComponent(dispatchId)}/po-variance`); },
  attachEvidence(quoteId, payload) { return request(`/quotes/${encodeURIComponent(quoteId)}/po-scope-evidence`, { method: "POST", body: JSON.stringify(payload) }); }
};

export const worksheetRegisters = {
  list() { return request("/worksheet_registers"); },
  get(id) { return request(`/worksheet_registers/${encodeURIComponent(id)}`); },
  // Read-only roll-up preview: computes exactly what Consolidate will save and writes nothing.
  preview(payload) { return request("/worksheet_registers/preview", { method: "POST", body: JSON.stringify(payload) }); },
  create(payload) { return request("/worksheet_registers", { method: "POST", body: JSON.stringify(payload) }); },
  update(id, payload) { return request(`/worksheet_registers/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) }); },
  build(id) { return request(`/worksheet_registers/${encodeURIComponent(id)}/build`, { method: "POST", body: JSON.stringify({}) }); },
  acknowledge(id, keys, note) { return request(`/worksheet_registers/${encodeURIComponent(id)}/acknowledge`, { method: "POST", body: JSON.stringify({ keys, note }) }); },
  submit(id) { return request(`/worksheet_registers/${encodeURIComponent(id)}/submit`, { method: "POST", body: JSON.stringify({}) }); },
  review(id, decision, comment = "") { return request(`/worksheet_registers/${encodeURIComponent(id)}/review`, { method: "POST", body: JSON.stringify({ decision, comment }) }); },
  cancel(id, reason) { return request(`/worksheet_registers/${encodeURIComponent(id)}/cancel`, { method: "POST", body: JSON.stringify({ reason }) }); },
  reconcile(id) { return request(`/worksheet_registers/${encodeURIComponent(id)}/reconcile`, { method: "POST", body: JSON.stringify({ confirm: true }) }); }
};

// Read-only view of legacy records (Daily Time Sheets, Contractor Logs, Timesheets recorded
// before Normal / 1.5 / 2.0) in the one Timesheet shape. Never writes.
export const legacyTimesheets = {
  list() { return request("/legacy_timesheets"); }
};

export const worksheets = {
  submit(id, payload = {}) {
    return request(`/field_worksheets/${id}/submit`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  review(id, decision, comment = "") {
    return request(`/field_worksheets/${id}/review`, {
      method: "POST",
      body: JSON.stringify({ decision, comment })
    });
  },
  // Edit a Draft or Returned worksheet in place (server refuses anything else).
  update(id, payload) {
    return request(`/field_worksheets/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) });
  },
  // A correction after acknowledgement or approval is a new linked revision, never an in-place edit.
  revise(id, reason) {
    return request(`/field_worksheets/${encodeURIComponent(id)}/revise`, { method: "POST", body: JSON.stringify({ reason }) });
  },
  // Client Viewer only. The server takes identity from the signed-in account; only the
  // typed signer name, declared role and an explicit confirmation are sent.
  clientAcknowledge(id, { signer_name, signer_role }) {
    return request(`/field_worksheets/${encodeURIComponent(id)}/client-acknowledge`, {
      method: "POST",
      body: JSON.stringify({ signer_name, signer_role, acknowledgement: true })
    });
  },
  listOwnClient() {
    return request("/field_worksheets/mine/client");
  }
};

// Active Technician profiles (name, trade, national ID) for the Timesheet technician picker.
// Read-only. The server decides which roles may read it and returns only active Technicians.
export const technicianProfiles = {
  list() { return request("/technician-profiles"); }
};

export const dailyTimesheets = {
  list() { return request("/daily_timesheets"); },
  create(payload) { return request("/daily_timesheets", { method: "POST", body: JSON.stringify(payload) }); },
  update(id, payload) { return request(`/daily_timesheets/${id}`, { method: "PATCH", body: JSON.stringify(payload) }); },
  submit(id) { return request(`/daily_timesheets/${id}/submit`, { method: "POST", body: JSON.stringify({}) }); },
  review(id, decision, comment = "") { return request(`/daily_timesheets/${id}/review`, { method: "POST", body: JSON.stringify({ decision, comment }) }); }
};

// Monthly Timesheet: hours-only consolidation of Supervisor-approved Daily Time
// Sheets. No call here ever sends or receives a rate, amount or cost.
export const monthlyTimesheets = {
  list() { return request("/monthly_timesheets"); },
  get(id) { return request(`/monthly_timesheets/${encodeURIComponent(id)}`); },
  create(payload) { return request("/monthly_timesheets", { method: "POST", body: JSON.stringify(payload) }); },
  update(id, payload) { return request(`/monthly_timesheets/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) }); },
  build(id) { return request(`/monthly_timesheets/${encodeURIComponent(id)}/build`, { method: "POST", body: JSON.stringify({}) }); },
  acknowledge(id, keys, note) { return request(`/monthly_timesheets/${encodeURIComponent(id)}/acknowledge`, { method: "POST", body: JSON.stringify({ keys, note }) }); },
  submit(id) { return request(`/monthly_timesheets/${encodeURIComponent(id)}/submit`, { method: "POST", body: JSON.stringify({}) }); },
  review(id, decision, comment = "") { return request(`/monthly_timesheets/${encodeURIComponent(id)}/review`, { method: "POST", body: JSON.stringify({ decision, comment }) }); },
  cancel(id, reason) { return request(`/monthly_timesheets/${encodeURIComponent(id)}/cancel`, { method: "POST", body: JSON.stringify({ reason }) }); },
  reconcile(id) { return request(`/monthly_timesheets/${encodeURIComponent(id)}/reconcile`, { method: "POST", body: JSON.stringify({ confirm: true }) }); }
};

export const contractorLogs = {
  list() { return request("/contractor_log_sheets"); },
  create(payload) { return request("/contractor_log_sheets", { method: "POST", body: JSON.stringify(payload) }); },
  update(id, payload) { return request(`/contractor_log_sheets/${id}`, { method: "PATCH", body: JSON.stringify(payload) }); },
  submit(id) { return request(`/contractor_log_sheets/${id}/submit`, { method: "POST", body: JSON.stringify({}) }); },
  review(id, decision, comment = "") { return request(`/contractor_log_sheets/${id}/review`, { method: "POST", body: JSON.stringify({ decision, comment }) }); }
};

// BLOCKED ON THE CONTROLLED-RATES WORK. The kiosk endpoint still requires an
// hourly_rate on every entry. The value below is the pre-existing placeholder that
// used to be hard-coded in the Kiosk page. It is NOT an approved rate, policy or
// default, nothing displays it, and it is isolated here so the controlled-rates
// change can delete this one constant and the `hourly_rate` line in submit().
const UNAPPROVED_INTERIM_KIOSK_RATE = 45;

export const kiosk = {
  roster(dispatchId) { return request(`/kiosk/dispatch_cards/${dispatchId}/roster`); },
  submit(dispatchId, payload) {
    const entries = (payload.entries || []).map((entry) => ({ hourly_rate: UNAPPROVED_INTERIM_KIOSK_RATE, ...entry }));
    return request(`/kiosk/dispatch_cards/${dispatchId}/timesheets`, { method: "POST", body: JSON.stringify({ ...payload, entries }) });
  },
  // Supervisor review queue (Admin/Operations may read it, only a Supervisor can decide).
  reviewQueue(status = "pending_review") {
    return request(`/timesheets/kiosk-review?status=${encodeURIComponent(status)}`);
  },
  review(timesheetId, decision, comment = "") {
    return request(`/timesheets/${encodeURIComponent(timesheetId)}/review`, { method: "POST", body: JSON.stringify({ decision, comment }) });
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
    // payload: { stock_item_id, movement_type: "in"|"out"|"adjustment", quantity, reason, reference_type?, reference_id?,
    //            source_document_ref? (required with a supplier receipt), idempotency_key?, override_negative? }
    return request("/inventory/movements", { method: "POST", body: JSON.stringify(payload) });
  },
  lowStockReport() {
    return request("/inventory/reports/low-stock");
  },
  // Read-only: each item's stored balance vs what its ledger adds up to, plus
  // every rule-breaking movement. Never changes stock.
  reconciliation(stockItemId) {
    const query = stockItemId ? `?stock_item_id=${encodeURIComponent(stockItemId)}` : "";
    return request(`/inventory/reconciliation${query}`);
  },
  // Full ledger (optionally filtered) and one item's history, newest first.
  listMovements(stockItemId) {
    const query = stockItemId ? `?stock_item_id=${encodeURIComponent(stockItemId)}` : "";
    return request(`/inventory/movements${query}`);
  },
  itemMovements(id) {
    // Returns { stock_item, movements } — an object shape, not a bare array,
    // so this intentionally is not added to UAT_EMPTY_ARRAY_PATH_PREFIXES above.
    return request(`/inventory/stock_items/${id}/movements`);
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
  },
  // Finance payroll: certified Worksheet hours per technician for one YYYY-MM.
  technicianPayroll(month) {
    return request(`/reports/technician-payroll?month=${encodeURIComponent(month)}`);
  },
  // Sage Pastel Payroll batch CSV (EmployeeCode/ID,Date,PayCode,Hours,ProjectCode).
  downloadPastelPayroll(month) {
    return downloadCsv(`/exports/pastel-payroll.csv?month=${encodeURIComponent(month)}`);
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
  },
  createMineSite(payload) { return request("/admin/mine_sites", { method: "POST", body: JSON.stringify(payload) }); },
  updateMineSite(id, payload) { return request(`/admin/mine_sites/${id}`, { method: "PATCH", body: JSON.stringify(payload) }); },
  createPlant(payload) { return request("/admin/plants", { method: "POST", body: JSON.stringify(payload) }); },
  updatePlant(id, payload) { return request(`/admin/plants/${id}`, { method: "PATCH", body: JSON.stringify(payload) }); },
  createPlantSection(payload) { return request("/admin/plant_sections", { method: "POST", body: JSON.stringify(payload) }); },
  updatePlantSection(id, payload) { return request(`/admin/plant_sections/${id}`, { method: "PATCH", body: JSON.stringify(payload) }); },
  createEquipmentTag(payload) { return request("/admin/equipment_tags", { method: "POST", body: JSON.stringify(payload) }); },
  updateEquipmentTag(id, payload) { return request(`/admin/equipment_tags/${id}`, { method: "PATCH", body: JSON.stringify(payload) }); },
  createCatalogItem(payload) { return request("/admin/catalog_items", { method: "POST", body: JSON.stringify(payload) }); },
  updateCatalogItem(id, payload) { return request(`/admin/catalog_items/${id}`, { method: "PATCH", body: JSON.stringify(payload) }); },
  deactivateEntity(collection, id) { return request(`/admin/${collection}/${id}/deactivate`, { method: "POST" }); },
  reactivateEntity(collection, id) { return request(`/admin/${collection}/${id}/reactivate`, { method: "POST" }); }
};

// Attach to the existing `quotes` export rather than redefining it.
quotes.submitClientPo = (id, po_reference, po_amount, extra = {}) => {
  return request(`/quotes/${id}/client-po`, {
    method: "POST",
    body: JSON.stringify({ po_reference, po_amount, ...extra })
  });
};

// --- Phase 6 additions --------------------------------------------------
auth.requestPasswordReset = (email) => { return request('/auth/request-password-reset', { method: 'POST', body: JSON.stringify({ email }) }); };
auth.resetPassword = (email, token, new_password) => { return request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ email, token, new_password }) }); };
export const accessRequests = {
  submit(payload) { return request("/access-requests", { method: "POST", body: JSON.stringify(payload) }); },
  list() { return request("/access_requests"); },
  // approve(id, { role, client_id }). The Admin's chosen role is what the server uses.
  // The older positional form approve(id, role, client_id) is still accepted.
  approve(id, decision, legacyClientId) {
    const chosen = decision && typeof decision === "object" ? decision : { role: decision, client_id: legacyClientId };
    return request(`/access-requests/${id}/approve`, { method: "POST", body: JSON.stringify({ role: chosen.role, client_id: chosen.client_id }) });
  },
  reject(id, reason) { return request(`/access-requests/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }) }); },
  // One-time account setup handoff. The response is the only place the link exists.
  issueSetupLink(id) { return request(`/access-requests/${id}/setup-link`, { method: "POST" }); }
};

export const leads = {
  create(payload) {
    return request("/leads", { method: "POST", body: JSON.stringify(payload) });
  }
};

async function downloadCsv(path) {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${getToken()}` } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Export failed (${res.status})`);
  }
  const blob = await res.blob();
  const disposition = res.headers.get("content-disposition") || "";
  const filename = /filename=([^;]+)/i.exec(disposition)?.[1]?.replace(/["']/g, "") || "orac-export.csv";
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export const operationalData = {
  previewLeads(csv_content) {
    return request("/imports/leads/preview", { method: "POST", body: JSON.stringify({ csv_content }) });
  },
  commitLeads(csv_content) {
    return request("/imports/leads/commit", { method: "POST", body: JSON.stringify({ csv_content, confirmation: "IMPORT_LEADS" }) });
  },
  analytics(from, to) {
    return request(`/analytics/operational?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
  },
  exportPastelReviewQuotes() {
    return downloadCsv("/exports/pastel-review/quotes.csv");
  },
  exportPastelReviewInvoiceReady() {
    return downloadCsv("/exports/pastel-review/invoice-ready.csv");
  }
};

export const documents = {
  download(type, id) {
    const paths = {
      quotes: `/documents/quotes/${id}.pdf`,
      dispatch_cards: `/documents/job-cards/${id}.pdf`,
      field_worksheets: `/documents/worksheets/${id}.pdf`,
      invoices: `/documents/invoices/${id}.pdf`,
      purchase_orders: `/documents/purchase-orders/${id}.pdf`
    };
    if (!paths[type]) throw new Error("Unsupported document type.");
    return downloadFile(paths[type], `${type}-${id}.pdf`);
  },
  // Admin/Operations client period pack. Filters: client (required), from/to
  // (required), plus optional site, technician, task (dispatch) and kiosk time.
  periodPackPdf({ client_id, from, to, site, technician_id, dispatch_id, include_kiosk } = {}) {
    const params = new URLSearchParams();
    params.set("client_id", client_id || "");
    params.set("from", from || "");
    params.set("to", to || "");
    if (site) params.set("site", site);
    if (technician_id) params.set("technician_id", technician_id);
    if (dispatch_id) params.set("dispatch_id", dispatch_id);
    if (include_kiosk) params.set("include_kiosk", "true");
    return downloadFile(`/documents/timesheets/period-pack.pdf?${params.toString()}`, "period-pack.pdf");
  }
};

async function downloadFile(path, fallbackName) {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${getToken()}` } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Download failed (${res.status})`);
  }
  const blob = await res.blob();
  const filename = /filename=([^;]+)/i.exec(res.headers.get("content-disposition") || "")?.[1]?.replace(/["']/g, "") || fallbackName;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
}

// --- Client Service Requests -------------------------------------------------
// Client Viewer request -> Sales/Operations triage -> one explicit lead.
// The server derives client, creator, status, triager and lead linkage; none of
// those are ever sent from here. create() copies only the fields below.
export const serviceRequests = {
  create({ title, service_need, urgency, mine_site_id, equipment_tag_id, requested_date } = {}) {
    const body = { title, service_need, urgency };
    if (mine_site_id) body.mine_site_id = mine_site_id;
    if (equipment_tag_id) body.equipment_tag_id = equipment_tag_id;
    if (requested_date) body.requested_date = requested_date;
    return request("/service-requests", { method: "POST", body: JSON.stringify(body) });
  },
  mine() {
    return request("/service-requests/mine");
  },
  triage(status) {
    return request(`/service-requests/triage${status ? `?status=${encodeURIComponent(status)}` : ""}`);
  },
  triageDecision(id, decision, note) {
    const body = { decision };
    if (typeof note === "string" && note.trim()) body.note = note.trim();
    return request(`/service-requests/${encodeURIComponent(id)}/triage`, { method: "POST", body: JSON.stringify(body) });
  },
  convertToLead(id) {
    return request(`/service-requests/${encodeURIComponent(id)}/convert-lead`, { method: "POST", body: JSON.stringify({}) });
  }
};

// --- Internal Work Requests (staff to staff coordination) ---------------------
// Dedicated endpoints only. The server derives the sender, role, client, status,
// assignee, history and timestamps and validates every pairing and action; none
// of those are ever sent from here. Bodies are built from fixed whitelists
// because the server schemas are strict. request() unwraps { success, data }.
const internalRequestBase = "/internal-work-requests";
const internalRequestListPath = (name, status) =>
  `${internalRequestBase}/${name}${status ? `?status=${encodeURIComponent(status)}` : ""}`;

export const internalWorkRequests = {
  options() {
    return request(`${internalRequestBase}/options`);
  },
  outbox(status) {
    return request(internalRequestListPath("outbox", status));
  },
  inbox(status) {
    return request(internalRequestListPath("inbox", status));
  },
  detail(id) {
    return request(`${internalRequestBase}/${encodeURIComponent(id)}`);
  },
  create({ request_type, subject, description, priority, recipient_role, related_entity_type, related_entity_id, payload } = {}) {
    const body = { request_type, subject, description };
    if (payload) body.payload = payload;
    if (priority) body.priority = priority;
    if (recipient_role) body.recipient_role = recipient_role;
    if (related_entity_type && related_entity_id) {
      body.related_entity_type = related_entity_type;
      body.related_entity_id = related_entity_id;
    }
    return request(internalRequestBase, { method: "POST", body: JSON.stringify(body) });
  },
  acknowledge(id) {
    return request(`${internalRequestBase}/${encodeURIComponent(id)}/acknowledge`, { method: "POST", body: JSON.stringify({}) });
  },
  approveTechnician(id) {
    return request(`${internalRequestBase}/${encodeURIComponent(id)}/approve-technician`, { method: "POST", body: JSON.stringify({}) });
  },
  transition(id, action, note) {
    const body = { action };
    if (typeof note === "string" && note.trim()) body.note = note.trim();
    return request(`${internalRequestBase}/${encodeURIComponent(id)}/transition`, { method: "POST", body: JSON.stringify(body) });
  }
};

// --- Contracts & preventative maintenance (pilot) ----------------------------
// Explicit endpoints only: there is no delete and no generic collection route.
// request() already unwraps { success, data }, so these resolve to the record
// or array itself. Server-owned fields (id, contract_number, creator, timestamps)
// are never sent.
export const contracts = {
  list() {
    return request("/contracts");
  },
  create(payload) {
    return request("/contracts", { method: "POST", body: JSON.stringify(payload) });
  },
  update(id, payload) {
    return request(`/contracts/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) });
  }
};

export const maintenanceSchedules = {
  list() {
    return request("/maintenance-schedules");
  },
  create(payload) {
    return request("/maintenance-schedules", { method: "POST", body: JSON.stringify(payload) });
  },
  update(id, payload) {
    return request(`/maintenance-schedules/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) });
  }
};

// Timesheet workflow packet (contract steps 3-9). Every endpoint is flag-guarded on the server and
// answers 409 FEATURE_DISABLED until its flag is on. No rate field is ever sent or received here
// except hours in the variance read. Client identity always comes from the signed-in account.
export const timesheetWorkflow = {
  clientReturn(id, reason) { return request(`/field_worksheets/${encodeURIComponent(id)}/client-return`, { method: "POST", body: JSON.stringify({ reason }) }); },
  batchConfirm(ids, { signer_name, signer_role }) { return request("/field_worksheets/batch-confirm", { method: "POST", body: JSON.stringify({ ids, signer_name, signer_role, acknowledgement: true }) }); },
  getPolicy() { return request("/timesheet-policy"); },
  updatePolicy(patch) { return request("/timesheet-policy", { method: "PATCH", body: JSON.stringify(patch) }); },
  listAuthorities() { return request("/timesheet-authorities"); },
  createAuthority(body) { return request("/timesheet-authorities", { method: "POST", body: JSON.stringify(body) }); },
  revokeAuthority(id) { return request(`/timesheet-authorities/${encodeURIComponent(id)}/revoke`, { method: "POST", body: "{}" }); },
  setClientCutover(clientId, timesheet_cutover_date) { return request(`/clients/${encodeURIComponent(clientId)}/timesheet-cutover`, { method: "PATCH", body: JSON.stringify({ timesheet_cutover_date }) }); },
  capturePaper(body) { return request("/field_worksheets/paper-capture", { method: "POST", body: JSON.stringify(body) }); },
  logCustody(body) { return request("/timesheet-paper-custody", { method: "POST", body: JSON.stringify(body) }); },
  rateFreeList() { return request("/timesheets/rate-free"); },
  paperSampling(month) { return request(`/timesheets/paper-sampling?month=${encodeURIComponent(month)}`); },
  runReminders() { return request("/timesheets/reminders/run", { method: "POST", body: "{}" }); },
  variance(dispatchId) { return request(`/dispatch_cards/${encodeURIComponent(dispatchId)}/invoice-variance`); },
  requestOverride(dispatchId, body) { return request(`/dispatch_cards/${encodeURIComponent(dispatchId)}/variance-override`, { method: "POST", body: JSON.stringify(body) }); },
  approveOverride(id) { return request(`/variance-overrides/${encodeURIComponent(id)}/approve`, { method: "POST", body: "{}" }); },
  resolvePostInvoice(id, note) { return request(`/field_worksheets/${encodeURIComponent(id)}/resolve-post-invoice`, { method: "POST", body: JSON.stringify({ note }) }); }
};
