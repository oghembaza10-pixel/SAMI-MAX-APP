// Abonne le compte connecté aux notifications push — jamais de blocage du
// chargement, jamais d'erreur visible si le navigateur ne supporte pas
// ou si l'utilisateur refuse la permission.
(async function () {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    try {
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (existing) return; // déjà abonné sur cet appareil

        const keyRes = await fetch("/api/push/public-key");
        const { publicKey } = await keyRes.json();
        if (!publicKey) return; // notifications pas encore configurées côté serveur

        if (Notification.permission === "denied") return;
        const permission = Notification.permission === "granted"
            ? "granted"
            : await Notification.requestPermission();
        if (permission !== "granted") return;

        const subscription = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
        });

        await fetch("/api/push/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(subscription),
        });
    } catch (err) {
        console.warn("⚠️ Notifications push non activées :", err.message);
    }
})();

function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}
