// Service worker: lets the app open and the Timesheet form work without a connection.
// - Static app files (same origin, GET, not /api/) are cached as they are fetched and
//   served from the cache when the network fails.
// - A page navigation that fails offline falls back to the cached app shell (/index.html),
//   so a deep link such as /worksheets still opens.
// - /api/ requests are NEVER cached or answered by the worker: data always comes from the
//   server, and offline Timesheets are held by the app's own outbox (offlineTimesheetOutbox.js).
// The first visit must be online so the app files can be cached.
const CACHE_NAME = "orac-ios-cache-v2";
const SHELL = ["/", "/index.html", "/manifest.json", "/images/orac-systems-logo.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting && self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
      .then(() => self.clients && self.clients.claim && self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.pathname === "/api") return;
  e.respondWith(
    fetch(req).then((res) => {
      if (res && res.ok && res.type === "basic") {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
      }
      return res;
    }).catch(async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      if (req.mode === "navigate") return caches.match("/index.html");
      return Response.error();
    })
  );
});
