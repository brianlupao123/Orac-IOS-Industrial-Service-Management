
const CACHE_NAME = "orac-ios-cache-v1";
const ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/images/orac-systems-logo.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener("fetch", (e) => {
  // Only cache GET requests, bypass API
  if (e.request.method !== "GET" || e.request.url.includes("/api/")) return;
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
