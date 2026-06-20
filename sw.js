// Mon Verger — Service Worker
// Permet le fonctionnement hors-ligne complet (l'appli + ses données locales)

const CACHE_NAME = "mon-verger-v16";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
];

// Installation : met en cache l'appli
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activation : nettoie les anciens caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Stratégie : cache d'abord, puis réseau (pour mises à jour silencieuses)
// Les appels API externes (météo, QR, Claude) passent toujours par le réseau
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Ne jamais mettre en cache les appels API externes — toujours réseau direct
  const isExternalAPI =
    url.hostname.includes("open-meteo.com") ||
    url.hostname.includes("qrserver.com") ||
    url.hostname.includes("anthropic.com") ||
    url.hostname.includes("wikipedia.org") ||
    url.hostname.includes("googleapis.com") ||
    url.hostname.includes("cdnjs.cloudflare.com");

  if (isExternalAPI) {
    event.respondWith(
      fetch(event.request).catch(
        () =>
          new Response(
            JSON.stringify({ error: "Hors-ligne — fonctionnalité indisponible" }),
            { headers: { "Content-Type": "application/json" } }
          )
      )
    );
    return;
  }

  // Pour l'appli elle-même : cache d'abord, réseau en secours
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
