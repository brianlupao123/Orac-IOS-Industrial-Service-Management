// Offline / interrupted-connection drafts (Task 03).
//
// What this is: a small, per-user, expiring copy of an unsent form so a crew
// leader does not lose entered hours when the connection drops.
// What this is NOT: a queue. A draft never submits itself. Nothing is replayed
// automatically; the user presses Submit again and the server applies every
// check (authorization, roster, duplicate, review gate) at that moment.
//
// Safety rules enforced here:
//  - keyed by user id and the draft also records it, so another user on the same
//    device never sees it;
//  - expires (default 72 hours);
//  - rates, costs, tokens, passwords and signatures are stripped before storing;
//  - cleared on explicit logout (not on session expiry, which is exactly when a
//    draft is most useful);
//  - the storage object is injected, and every access is guarded, so private
//    mode or a full disk degrades to "no draft" and never breaks the page.

export const DRAFT_PREFIX = "orac-draft:v1:";
export const DRAFT_TTL_MS = 72 * 60 * 60 * 1000;
const MAX_STRING = 2000;
const MAX_DEPTH = 5;
const FORBIDDEN_KEY = /(^|_)(rate|hourly_rate|cost|price|token|password|secret|signature|authorization)(_|$)/i;

export function sanitizeDraft(value, depth = 0) {
  if (depth > MAX_DEPTH) return undefined;
  if (value === null) return null;
  if (typeof value === "string") return value.slice(0, MAX_STRING);
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map((item) => sanitizeDraft(item, depth + 1)).filter((item) => item !== undefined);
  if (typeof value === "object") {
    const out = {};
    for (const [key, inner] of Object.entries(value)) {
      if (FORBIDDEN_KEY.test(key)) continue;
      const clean = sanitizeDraft(inner, depth + 1);
      if (clean !== undefined) out[key] = clean;
    }
    return out;
  }
  return undefined;
}

export function draftKey(userId, kind, scope) {
  return `${DRAFT_PREFIX}${userId}:${kind}:${scope}`;
}

function safe(fn, fallback) {
  try { return fn(); } catch { return fallback; }
}

export function saveDraft(storage, userId, kind, scope, data, now = Date.now()) {
  if (!storage || !userId || !kind || !scope) return false;
  const payload = { v: 1, user_id: userId, kind, scope, saved_at: now, data: sanitizeDraft(data) };
  return safe(() => { storage.setItem(draftKey(userId, kind, scope), JSON.stringify(payload)); return true; }, false);
}

export function loadDraft(storage, userId, kind, scope, now = Date.now()) {
  if (!storage || !userId) return null;
  const key = draftKey(userId, kind, scope);
  const raw = safe(() => storage.getItem(key), null);
  if (!raw) return null;
  let parsed;
  try { parsed = JSON.parse(raw); } catch { safe(() => storage.removeItem(key)); return null; }
  const valid = parsed && parsed.v === 1 && parsed.user_id === userId && parsed.kind === kind && parsed.scope === scope &&
    Number.isFinite(parsed.saved_at) && now - parsed.saved_at <= DRAFT_TTL_MS && parsed.data && typeof parsed.data === "object";
  if (!valid) { safe(() => storage.removeItem(key)); return null; }
  return { data: parsed.data, saved_at: parsed.saved_at };
}

export function clearDraft(storage, userId, kind, scope) {
  if (!storage || !userId) return;
  safe(() => storage.removeItem(draftKey(userId, kind, scope)));
}

function draftKeys(storage) {
  return safe(() => {
    const keys = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (key && key.startsWith(DRAFT_PREFIX)) keys.push(key);
    }
    return keys;
  }, []);
}

export function clearAllDrafts(storage) {
  if (!storage) return 0;
  const keys = draftKeys(storage);
  keys.forEach((key) => safe(() => storage.removeItem(key)));
  return keys.length;
}

// Drops expired or malformed drafts for everyone (housekeeping on page load).
export function purgeExpiredDrafts(storage, now = Date.now()) {
  if (!storage) return 0;
  let removed = 0;
  for (const key of draftKeys(storage)) {
    const raw = safe(() => storage.getItem(key), null);
    let ok = false;
    try { const p = JSON.parse(raw); ok = p && p.v === 1 && Number.isFinite(p.saved_at) && now - p.saved_at <= DRAFT_TTL_MS; } catch { ok = false; }
    if (!ok) { safe(() => storage.removeItem(key)); removed += 1; }
  }
  return removed;
}

export function newBatchKey() {
  const c = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (c && typeof c.randomUUID === "function") return `kb-${c.randomUUID()}`;
  return `kb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

// True when the failure was "could not reach the server" rather than a server answer.
export function isNetworkFailure(error) {
  return Boolean(error && (error.network === true || error.name === "TypeError"));
}
