// Enregistre le service worker PWA — sans bloquer le chargement de la page.
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js").catch((err) => {
            console.warn("⚠️ Service worker non enregistré :", err.message);
        });
    });
}
