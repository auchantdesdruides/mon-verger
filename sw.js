// Mon Verger — Service Worker
// Permet le fonctionnement hors-ligne complet (l'appli + ses données locales)
// + Vérification automatique des mises à jour à chaque ouverture

const CACHE_NAME = "mon-verger-v24"; // ⚠️ Incrémenter ce numéro à chaque nouvelle version pour forcer la mise à jour
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
  self.skipWaiting(); // active immédiatement la nouvelle version sans attendre
});

// Activation : nettoie les anciens caches ET prévient l'appli qu'une MAJ a eu lieu
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      const oldCaches = keys.filter((k) => k !== CACHE_NAME);
      await Promise.all(oldCaches.map((k) => caches.delete(k)));
      await self.clients.claim();

      // Si une ancienne version existait, on informe les pages ouvertes
      if (oldCaches.length > 0) {
        const clients = await self.clients.matchAll({ type: "window" });
        clients.forEach((client) => client.postMessage({ type: "SW_UPDATED" }));
      }
    })()
  );
});

// Stratégie : réseau d'abord pour l'appli (toujours la dernière version si en ligne),
// cache en secours si hors-ligne
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

  // Pour l'appli elle-même : réseau d'abord (pour toujours avoir la dernière version),
  // cache uniquement si le réseau échoue (mode hors-ligne réel)
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Permet à la page de forcer l'activation immédiate d'une nouvelle version
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

