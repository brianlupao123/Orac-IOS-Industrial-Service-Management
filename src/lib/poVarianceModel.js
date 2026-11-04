// Pure display + gating logic for the PO / quoted-scope variance banner. No React, no fetch.
// The server decides everything (status, label, whether invoicing is blocked); this file only maps that
// payload to a tone, a one-line explanation, and whether an invoice-issue control must be disabled.
// Anything the server did not send is treated as "unknown", never guessed.

export const EVIDENCE_KINDS = [
  { value: "amendment_note", label: "Amendment note" },
  { value: "revised_po", label: "Revised PO reference" }
];
export const MIN_NOTE_LENGTH = 10; // mirrors the server rule; the server is the authority

// Tones map to theme tokens in the component (no raw palette colours: dark mode).
export function bannerTone(v) {
  if (!v) return "neutral";
  if (v.status === "within_budget") return "success";
  if (v.status === "overrun") return v.blocks_invoicing ? "danger" : "warning";
  return "neutral";
}

const fmt = (n) => String(Math.round((Number(n) + Number.EPSILON) * 100) / 100);

// One line of supporting figures. Money appears only if the server included it (Finance/Admin).
export function figuresLine(v) {
  if (!v?.hours) return v?.reason || "";
  const h = v.hours;
  const parts = [];
  if (h.available) parts.push(`Certified ${fmt(h.certified)} h of ${fmt(h.quoted)} h quoted`);
  else parts.push(`Certified ${fmt(h.certified)} h (no quoted hours to compare)`);
  if (h.this_period !== undefined) parts.push(`${fmt(h.this_period)} h on this Worksheet`);
  if (v.amount?.available && v.amount.restricted !== true) parts.push(`Approved work ${fmt(v.amount.actual)} vs PO ${fmt(v.amount.quoted)}`);
  else if (v.amount?.overrun) parts.push("PO value exceeded");
  return parts.join(" · ");
}

// Disable any 1-click issue/prepare control while the server says invoicing is blocked.
// Fails safe: if the variance has not loaded or could not be read, a control that depends on it stays disabled.
export function issueControl(v, { loaded = true, failed = false } = {}) {
  if (failed) return { disabled: true, reason: "The PO budget check could not be loaded. Reload before invoicing." };
  if (!loaded || !v) return { disabled: true, reason: "Checking the PO budget…" };
  if (v.blocks_invoicing) return { disabled: true, reason: v.issue_disabled_reason || "Attach an amendment note or revised PO reference first." };
  return { disabled: false, reason: "" };
}

export const canAttachEvidence = (role) => ["Sales", "Admin"].includes(role);
export const needsEvidence = (v) => Boolean(v?.status === "overrun" && v.evidence_required && !v.evidence);

export function validateEvidenceForm(form, variance) {
  if (!EVIDENCE_KINDS.some((k) => k.value === form.kind)) return "Choose an amendment note or a revised PO reference.";
  const note = String(form.note || "").trim();
  if (form.kind === "amendment_note" && note.length < MIN_NOTE_LENGTH) return `Enter an amendment note of at least ${MIN_NOTE_LENGTH} characters.`;
  if (note.length > 1000) return "The note cannot exceed 1000 characters.";
  if (form.kind === "revised_po") {
    const ref = String(form.revised_po_reference || "").trim();
    if (!/^[A-Za-z0-9._:/-]{3,100}$/.test(ref)) return "Enter the revised PO reference (3 to 100 letters, numbers or . _ : / -).";
    const current = variance?.scope?.po_reference;
    if (current && ref.toLowerCase() === String(current).toLowerCase()) return "The revised PO reference must differ from the current PO reference.";
  }
  return "";
}

export function buildEvidencePayload(form, variance) {
  return {
    kind: form.kind,
    note: String(form.note || "").trim() || undefined,
    revised_po_reference: form.kind === "revised_po" ? String(form.revised_po_reference || "").trim() : undefined,
    variance_hash: variance.hash, // proves Sales reviewed the figures that are on screen
    purchase_order_id: variance.scope?.purchase_order_id || undefined
  };
}

// Friendlier text for the two refusals a user can actually fix.
export function evidenceErrorMessage(err) {
  if (err?.code === "STALE_VARIANCE") return "The hours changed while you were working. The figures have been reloaded: review them and submit again.";
  if (err?.code === "V5_AMENDMENT_PATH_REQUIRED") return "This quotation uses the V5 amendment workflow. Resolve the overrun with an approved amendment.";
  return err?.message || "Could not attach the evidence.";
}
