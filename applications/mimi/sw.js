const CACHE = "mimi-fly-responsive-v1";
const CORE = [
  "/applications/mimi/",
  "/applications/mimi/manifest.webmanifest",
  "/applications/mimi/assets/mimi-flight-cycle-8f.webp",
  "/applications/mimi/assets/mimi-waddle-cycle-8f.webp",
  "/applications/mimi/assets/mimi-world-parallax-background.webp"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).then((response) => {
      const copy = response.clone(); caches.open(CACHE).then((cache) => cache.put("/applications/mimi/", copy)); return response;
    }).catch(() => caches.match("/applications/mimi/")));
    return;
  }
  event.respondWith(caches.match(event.request).then((cached) => cached ?? fetch(event.request).then((response) => {
    const copy = response.clone(); caches.open(CACHE).then((cache) => cache.put(event.request, copy)); return response;
  })));
});
