// Sales Quotations - pure UI helpers (no React, no network).
// These only shape what the UI shows and sends. The lifecycle, permissions and
// tenancy are enforced by the server (see backend/src/stateMachine.js and
// backend/src/schemas.js); nothing here is a security control. Anything this
// file cannot safely resolve on its own (catalog pricing, equipment labels)
// is left out rather than guessed - see ROLE_OWNER_DECISIONS in the delivery
// packet for why.

// Mirrors backend/src/stateMachine.js `allowedTransitions`. Kept here only so
// the UI can decide which buttons to show; the server is the sole authority
// and re-validates every one of these on receipt.
export const QUOTE_STATUSES = Object.freeze([
  "Draft", "Sent", "Approved_Pending_PO", "PO_Verified", "Field_Dispatch", "Invoiced", "Cancelled"
]);

export const APPROVED_UNITS_OF_MEASURE = Object.freeze([
  "hours", "days", "metres", "m2", "m²", "m3", "m³", "kg", "tonnes", "each", "lot", "set"
]);

export const CANONICAL_UNITS_OF_MEASURE = Object.freeze([
  "hours", "days", "metres", "m²", "m³", "kg", "tonnes", "each", "lot", "set"
]);

export const COST_TYPES = Object.freeze([
  "labour", "material", "equipment", "transport"
]);

export const ITEM_TYPES = Object.freeze([
  "standard", "optional", "provisional_sum"
]);

export const TAX_STATUSES = Object.freeze([
  "taxable", "zero-rated", "exempt", "unconfigured", "provisional"
]);

export const DEFAULT_PROVISIONAL_VAT_RATE = 0.15;
export const PROVISIONAL_VAT_NOTICE = "Provisional — accountant confirmation required";
export const APPROVAL_THRESHOLD_USD = 5000;
export const CLIENT_VISIBLE_QUOTE_STATUSES = Object.freeze([
  "Sent", "Approved_Pending_PO", "PO_Verified", "Field_Dispatch", "Invoiced"
]);


const STATUS_LABELS = Object.freeze({
  Draft: "Draft",
  Sent: "Sent",
  Approved_Pending_PO: "Approved, pending PO",
  PO_Verified: "PO verified",
  Field_Dispatch: "Dispatched",
  Invoiced: "Invoiced",
  Cancelled: "Cancelled"
});

export const quoteStatusLabel = (status) => STATUS_LABELS[status] || String(status || "\u2014");

// A quote can only be edited or cancelled while it is still Draft (see
// quoteController.updateQuote / cancelQuote). Sending requires a client and
// at least one priced line (stateMachine.js validateTransition "Sent").
export function quoteActionsFor(quote) {
  const isDraft = quote?.status === "Draft";
  return {
    canEdit: isDraft,
    canCancel: isDraft,
    canSend: isDraft
  };
}

// Mirrors the server's separation-of-duties check in stateMachine.js
// (validateTransition, target "Approved_Pending_PO") for UI purposes only:
// a Sales actor cannot approve the quote they personally sent. The server
// re-checks this independently and is the sole authority - this only decides
// whether to show the button. Admin/Operations approving is never blocked
// here; a quote with no recorded sent_by (sent before this field existed)
// is treated as approvable, matching the server's fail-safe-for-legacy-data
// behaviour.
export function canApproveQuote(quote, actor) {
  if (quote?.status !== "Sent") return false;
  if (!actor) return false;
  if (actor.role === "Sales" && quote.sent_by && quote.sent_by === actor.id) return false;
  const totalCents = Number.isInteger(quote.grand_total_cents)
    ? quote.grand_total_cents
    : Math.round(Number(quote.total_amount || 0) * 100);
  const isAboveThreshold = totalCents > 500000;
  const hasDiscount = Number(quote.discount_percent || 0) > 0;
  if ((isAboveThreshold || hasDiscount) && !["Management", "Admin"].includes(actor.role)) {
    return false;
  }
  return true;
}


export function canDispatchQuote(quote, actor) {
  if (quote?.status !== "PO_Verified") return false;
  if (!actor) return false;
  return ["Admin", "Operations"].includes(actor.role);
}

export const canSendQuote = (quote, lineCount) => quote?.status === "Draft" && Boolean(quote?.client_id) && lineCount > 0;

export const EMPTY_QUOTE_LINE = Object.freeze({
  description: "",
  quantity: 1,
  unit_price: 0,
  unit_of_measure: "each",
  cost_type: "material",
  resource_role: "",
  work_package_id: "wp_01",
  item_type: "standard"
});

export function lineTotal(line) {
  const quantity = Number(line?.quantity);
  const unitPrice = Number(line?.unit_price);
  if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice)) return 0;
  return quantity * unitPrice;
}

export function quoteTotal(lines) {
  return (Array.isArray(lines) ? lines : []).reduce((sum, line) => sum + lineTotal(line), 0);
}

// Returns a message for the first problem found, or "" when the form is
// ready to send to the server. This is a convenience check only - the
// server (CreateQuoteSchema / UpdateQuoteSchema) is authoritative and
// re-validates independently.
export function validateQuoteForm(form) {
  if (!form?.client_id) return "Choose the client this quotation is for.";
  const lines = Array.isArray(form.lines) ? form.lines : [];
  if (lines.length === 0) return "Add at least one line item.";
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const description = String(line?.description ?? "").trim();
    if (!description) return `Line ${index + 1}: enter a description.`;
    const quantity = Number(line?.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) return `Line ${index + 1}: quantity must be greater than zero.`;
    const unitPrice = Number(line?.unit_price);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) return `Line ${index + 1}: unit price cannot be negative.`;
  }
  return "";
}

// Builds a CreateQuoteSchema-shaped body from a fixed whitelist. Anything
// else on `form` (id, status, sent_by, created_by, quote_number, totals,
// timestamps...) is never copied - those fields are server-owned.
export function buildCreateQuotePayload(form = {}) {
  const payload = { client_id: String(form.client_id || ""), lines: buildLinesPayload(form.lines) };
  const equipmentTagId = String(form.equipment_tag_id || "").trim();
  if (equipmentTagId) payload.equipment_tag_id = equipmentTagId;
  if (form.currency) payload.currency = form.currency;
  else if (form.tax_status || form.work_packages || form.scope_summary) payload.currency = "USD";
  if (form.tax_status) payload.tax_status = form.tax_status;
  if (form.applied_tax_rate !== undefined && form.applied_tax_rate !== null) payload.applied_tax_rate = Number(form.applied_tax_rate);
  if (form.discount_percent !== undefined && Number(form.discount_percent) > 0) payload.discount_percent = Number(form.discount_percent);
  if (form.validity_days !== undefined && form.validity_days !== 30) payload.validity_days = Number(form.validity_days);
  if (form.scope_summary) payload.scope_summary = String(form.scope_summary).trim();
  if (form.assumptions) payload.assumptions = String(form.assumptions).trim();
  if (form.work_packages && form.work_packages.length > 0) {
    payload.work_packages = form.work_packages.map((wp, idx) => ({
      id: wp.id || `wp_${String(idx + 1).padStart(2, "0")}`,
      title: wp.title || wp.name || `Work Package ${idx + 1}`,
      name: wp.name || wp.title || `Work Package ${idx + 1}`,
      code: wp.code || `WP-${String(idx + 1).padStart(2, "0")}`,
      sequence: Number(wp.sequence) || (idx + 1)
    }));
  }
  return payload;
}

// Builds an UpdateQuoteSchema-shaped body. client_id is deliberately omitted:
// the server's UpdateQuoteSchema does not accept it, and a quote's client is
// not editable after creation.
export function buildUpdateQuotePayload(form = {}) {
  const payload = { lines: buildLinesPayload(form.lines) };
  const equipmentTagId = String(form.equipment_tag_id || "").trim();
  if (equipmentTagId) payload.equipment_tag_id = equipmentTagId;
  if (form.tax_status) payload.tax_status = form.tax_status;
  if (form.applied_tax_rate !== undefined && form.applied_tax_rate !== null) payload.applied_tax_rate = Number(form.applied_tax_rate);
  if (form.discount_percent !== undefined && Number(form.discount_percent) > 0) payload.discount_percent = Number(form.discount_percent);
  if (form.validity_days !== undefined && form.validity_days !== 30) payload.validity_days = Number(form.validity_days);
  if (form.scope_summary) payload.scope_summary = String(form.scope_summary).trim();
  if (form.assumptions) payload.assumptions = String(form.assumptions).trim();
  if (form.work_packages && form.work_packages.length > 0) {
    payload.work_packages = form.work_packages.map((wp, idx) => ({
      id: wp.id || `wp_${String(idx + 1).padStart(2, "0")}`,
      title: wp.title || wp.name || `Work Package ${idx + 1}`,
      name: wp.name || wp.title || `Work Package ${idx + 1}`,
      code: wp.code || `WP-${String(idx + 1).padStart(2, "0")}`,
      sequence: Number(wp.sequence) || (idx + 1)
    }));
  }
  return payload;
}

// Whitelists exactly the fields QuoteLineSchema accepts. catalog_item_id is
// intentionally always null from this UI: Sales cannot read the catalog
// collection (see ROLE_OWNER_DECISIONS #C-1), so every line here is a plain,
// manually-priced line rather than a linked catalog item.
function buildLinesPayload(lines) {
  return (Array.isArray(lines) ? lines : []).map((line) => {
    const item = {
      catalog_item_id: null,
      description: String(line?.description ?? "").trim(),
      quantity: Number(line?.quantity) || 0,
      unit_price: Number(line?.unit_price) || 0
    };
    if (line?.unit_of_measure) item.unit_of_measure = line.unit_of_measure;
    if (line?.cost_type) item.cost_type = line.cost_type;
    if (line?.resource_role && line.resource_role !== "-") item.resource_role = String(line.resource_role).trim();
    if (line?.work_package_id) item.work_package_id = line.work_package_id;
    if (line?.item_type) item.item_type = line.item_type;
    return item;
  });
}

export function prefillFromLead(lead) {
  return {
    client_id: lead?.client_id || "",
    equipment_tag_id: lead?.equipment_tag_id || "",
    lines: [{ ...EMPTY_QUOTE_LINE, description: lead?.service_need ? String(lead.service_need).slice(0, 200) : "" }]
  };
}

// Plain 2-decimal amount with no currency symbol. The codebase does not
// declare a single currency (ClientPortalPage prefixes "R"), so no symbol is
// invented here - see ROLE_OWNER_DECISIONS #C-5.
export function formatAmount(value) {
  const n = Number(value);
  return (Number.isFinite(n) ? n : 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatUSD(value) {
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  return '$' + safe.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function calculateQuoteBreakdown(lines = [], discountPercent = 0, taxStatus = "provisional", appliedTaxRate = 0.15) {
  let preTax = 0;
  for (const line of lines) {
    if ((line?.item_type || "standard") === "standard") {
      preTax += (Number(line?.quantity) || 0) * (Number(line?.unit_price) || 0);
    }
  }
  const discount = preTax * ((Number(discountPercent) || 0) / 100);
  const netSubtotal = Math.max(0, preTax - discount);
  let taxRate = 0;
  if (taxStatus === "taxable" || taxStatus === "provisional") {
    taxRate = appliedTaxRate != null ? Number(appliedTaxRate) : DEFAULT_PROVISIONAL_VAT_RATE;
  }
  const tax = netSubtotal * taxRate;
  const grandTotal = netSubtotal + tax;
  return { preTax, discount, netSubtotal, taxRate, tax, grandTotal };
}
