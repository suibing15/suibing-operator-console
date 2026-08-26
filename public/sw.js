// SUIBING Operator Console — service worker
// Caches only the static app shell (for fast repeat loads and offline
// installability). Never caches Supabase API calls, RPCs, or the
// /api/generate-contract route — operator data must always be fresh.

const CACHE_NAME = "suibing-console-shell-v1";
const SHELL_ASSETS = [
  "/",
  "/manifest.json",
  "/logo.png",
  "/icon-192.png",
  "/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never intercept anything other than same-origin GET requests.
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;

  // Never cache Supabase calls, our own API routes, or Next.js data/RSC payloads.
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.includes("supabase") ||
    url.searchParams.has("_rsc")
  ) {
    return;
  }

  // Static assets and pages: cache-first with background refresh.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
