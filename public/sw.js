// ==========================================================================
// SAMII OS — Service Worker (PWA)
// Ne met en cache QUE les fichiers statiques (css/js/images/polices).
// Ne touche JAMAIS aux pages HTML ni aux appels API : tout ce qui est
// dynamique (QG, commandes, sessions, données) part toujours au réseau,
// pour ne jamais servir de contenu périmé.
// ==========================================================================
const CACHE_NAME = "samii-static-v1";
const STATIC_EXTENSIONS = [".css", ".js", ".png", ".jpg", ".jpeg", ".svg", ".woff", ".woff2", ".ico"];

self.addEventListener("install", (event) => {
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((names) =>
            Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
        )
    );
    self.clients.claim();
});

function isStaticAsset(url) {
    return STATIC_EXTENSIONS.some((ext) => url.pathname.endsWith(ext));
}

self.addEventListener("fetch", (event) => {
    const req = event.request;
    if (req.method !== "GET") return;

    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;
    if (!isStaticAsset(url)) return; // pages, API, tout le dynamique -> réseau direct

    event.respondWith(
        caches.match(req).then((cached) => {
            if (cached) return cached;
            return fetch(req).then((res) => {
                if (res.ok) {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
                }
                return res;
            });
        })
    );
});
