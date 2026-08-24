// ==========================================================================
// SAMII OS — Service Worker (PWA)
// Ne met en cache QUE les fichiers statiques (css/js/images/polices) + la
// page hors-ligne. Ne touche JAMAIS aux pages HTML normales ni aux appels
// API : tout ce qui est dynamique (QG, commandes, sessions, données) part
// toujours au réseau, pour ne jamais servir de contenu périmé. Seule
// exception : si le réseau échoue en pleine navigation, on sert la page
// hors-ligne au lieu de l'erreur brute du navigateur.
// ==========================================================================
const CACHE_NAME = "samii-static-v6";
const OFFLINE_URL = "/offline.html";
const STATIC_EXTENSIONS = [".css", ".js", ".png", ".jpg", ".jpeg", ".svg", ".woff", ".woff2", ".ico"];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL))
    );
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

    // Navigation (chargement d'une page) : réseau d'abord, page hors-ligne
    // seulement si le réseau échoue vraiment — jamais de contenu périmé servi.
    if (req.mode === "navigate") {
        event.respondWith(
            fetch(req).catch(() => caches.match(OFFLINE_URL))
        );
        return;
    }

    if (!isStaticAsset(url)) return; // API, tout le reste du dynamique -> réseau direct

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

// ── NOTIFICATIONS PUSH ─────────────────────────────────────────────────
self.addEventListener("push", (event) => {
    if (!event.data) return;
    let payload = {};
    try { payload = event.data.json(); } catch { payload = { title: "SAMII", body: event.data.text() }; }

    const title = payload.title || "SAMII";
    const options = {
        body: payload.body || "",
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        data: { url: payload.url || "/qg" },
    };
    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const url = event.notification.data?.url || "/qg";
    event.waitUntil(
        self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsList) => {
            for (const client of clientsList) {
                if (client.url.includes(url) && "focus" in client) return client.focus();
            }
            if (self.clients.openWindow) return self.clients.openWindow(url);
        })
    );
});
