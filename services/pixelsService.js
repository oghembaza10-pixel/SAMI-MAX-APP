// ==========================================================================
// SAMII OS — PIXELS PUB (Meta/TikTok/Google) — attribution par vendeur
// Un marchand configure ses IDs de pixel dans Réglages > Ma boutique. Ce
// service génère les balises de tracking pour un événement donné (vue produit,
// achat...), avec les vraies valeurs (JSON.stringify gère l'échappement —
// jamais de concaténation manuelle de chaînes dans du JS inline, source
// classique de bugs et de failles XSS).
// ==========================================================================
const db = require("./db");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Un vendeur "réel" a un id UUID (utilisateurs.id) — les imports fournisseur
// (CJ, BigBuy...) utilisent un code fixe ("cj"...), jamais annoncés par un
// marchand précis, donc jamais de pixel à déclencher pour eux.
function estVendeurReel(vendeurId) {
    return !!vendeurId && UUID_RE.test(vendeurId);
}

async function getPixels(userId) {
    if (!estVendeurReel(userId)) return null;
    try {
        const rows = await db.query(
            `SELECT pixel_meta, pixel_tiktok, pixel_google FROM utilisateurs WHERE id = $1`,
            [userId]
        );
        const p = rows[0];
        if (!p || (!p.pixel_meta && !p.pixel_tiktok && !p.pixel_google)) return null;
        return p;
    } catch (err) {
        console.error("❌ pixelsService.getPixels :", err.message);
        return null;
    }
}

// event: "ViewContent" | "Purchase" (noms Meta, traduits pour TikTok/Google ci-dessous)
function pixelEventHtml(pixels, event, { value, currency, contentId, contentName, transactionId } = {}) {
    if (!pixels) return "";
    let html = "";

    if (pixels.pixel_meta) {
        const metaParams = { value: value || undefined, currency: currency || "EUR", content_ids: contentId ? [contentId] : undefined, content_name: contentName || undefined };
        html += `
<script>
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', ${JSON.stringify(pixels.pixel_meta)});
fbq('track', ${JSON.stringify(event)}, ${JSON.stringify(metaParams)});
</script>`;
    }

    if (pixels.pixel_tiktok) {
        const ttEvent = event === "Purchase" ? "CompletePayment" : "ViewContent";
        const ttParams = { value: value || undefined, currency: currency || "EUR", content_id: contentId || undefined };
        html += `
<script>
!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
ttq.load(${JSON.stringify(pixels.pixel_tiktok)});
ttq.page();
ttq.track(${JSON.stringify(ttEvent)}, ${JSON.stringify(ttParams)});
}(window,document,'ttq');
</script>`;
    }

    if (pixels.pixel_google) {
        const gEvent = event === "Purchase" ? "purchase" : "view_item";
        const gParams = {
            value: value || undefined,
            currency: currency || "EUR",
            transaction_id: transactionId || undefined,
            items: contentId ? [{ item_id: contentId, item_name: contentName || undefined }] : undefined,
        };
        html += `
<script async src="https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(pixels.pixel_google)}"></script>
<script>
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', ${JSON.stringify(pixels.pixel_google)});
gtag('event', ${JSON.stringify(gEvent)}, ${JSON.stringify(gParams)});
</script>`;
    }

    return html;
}

module.exports = { getPixels, pixelEventHtml, estVendeurReel };
