import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// Runs public/sw.js in a sandbox with a fake worker scope, Cache API and fetch, so the offline
// behaviour is proven without a browser. (A real device still needs the UAT step.)
function boot({ online = true, seeded = {} } = {}) {
  const listeners = {}; const store = new Map(Object.entries(seeded)); let net = online;
  const cacheApi = {
    open: async () => ({ addAll: async (urls) => urls.forEach((u) => store.set(new URL(u, "https://app.test").href, { ok: true, from: "shell" })), put: async (req, res) => { store.set(req.url, res); } }),
    keys: async () => ["orac-ios-cache-v1", "orac-ios-cache-v2"], delete: async (n) => { store.set(`deleted:${n}`, true); return true; },
    match: async (req) => store.get(typeof req === "string" ? new URL(req, "https://app.test").href : req.url)
  };
  const fetched = [];
  const ctx = {
    self: { addEventListener: (t, f) => { listeners[t] = f; }, location: { origin: "https://app.test" }, skipWaiting: () => {}, clients: { claim: () => {} } },
    caches: cacheApi, URL, Response: { error: () => ({ error: true }) },
    fetch: async (req) => { fetched.push(req.url); if (!net) throw new TypeError("offline"); return { ok: true, type: "basic", clone() { return this; }, body: req.url }; }
  };
  vm.runInNewContext(readFileSync(new URL("../public/sw.js", import.meta.url), "utf8"), ctx);
  const run = async (t, ev) => { let p; ev.waitUntil = (x) => { p = x; }; ev.respondWith = (x) => { p = x; }; listeners[t](ev); return p; };
  return { run, store, fetched, setOnline: (v) => { net = v; } };
}
const get = (url, mode = "same-origin") => ({ request: { method: "GET", url: `https://app.test${url}`, mode } });

test("install caches the app shell; activate removes the old cache version", async () => {
  const w = boot();
  await w.run("install", {});
  assert.ok(w.store.has("https://app.test/index.html"));
  await w.run("activate", {});
  assert.equal(w.store.get("deleted:orac-ios-cache-v1"), true);
  assert.equal(w.store.has("deleted:orac-ios-cache-v2"), false);
});

test("app files fetched online are cached, then served when the connection drops", async () => {
  const w = boot();
  await w.run("install", {});
  const online = await w.run("fetch", get("/assets/index-abc123.js"));
  assert.equal(online.ok, true);
  await new Promise((r) => setTimeout(r, 0));
  assert.ok(w.store.has("https://app.test/assets/index-abc123.js"), "cached after the first online load");
  w.setOnline(false);
  const offline = await w.run("fetch", get("/assets/index-abc123.js"));
  assert.equal(offline.ok, true, "served from the cache with no network");
});

test("a deep link opened offline falls back to the cached app shell", async () => {
  const w = boot();
  await w.run("install", {});
  w.setOnline(false);
  const page = await w.run("fetch", get("/worksheets", "navigate"));
  assert.equal(page.from, "shell");
});

test("API requests, non-GET requests and other origins are never intercepted or cached", async () => {
  const w = boot();
  await w.run("install", {});
  for (const request of [{ method: "GET", url: "https://app.test/api/field_worksheets" }, { method: "POST", url: "https://app.test/assets/x.js" }, { method: "GET", url: "https://other.test/x.js" }]) {
    let responded = false;
    await w.run("fetch", { request, waitUntil() {}, respondWith() { responded = true; } }).catch(() => {});
    assert.equal(responded, false, `${request.method} ${request.url}`);
  }
  assert.ok(![...w.store.keys()].some((k) => k.includes("/api/")), "no API response is ever stored");
});
