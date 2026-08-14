// ==========================================================================
// SAMII OS — EXTRACTION PRODUIT DEPUIS UN LIEN EXTERNE (Amazon, AliExpress...)
// Best-effort : lit les balises og:*/JSON-LD publiques de la page. Beaucoup
// de sites bloquent le scraping ou ne fournissent pas ces balises — dans ce
// cas on renvoie ce qu'on a trouvé (souvent rien) et le client complète
// manuellement le formulaire. Jamais bloquant.
// ==========================================================================
const axios = require("axios");

function decodeEntites(str) {
    return String(str || "")
        .replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/&#0?39;/g, "'")
        .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
        .trim();
}

function matchMeta(html, property) {
    // L'ordre attribut property/content varie selon les sites — on couvre les deux sens.
    const re1 = new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']*)["']`, "i");
    const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${property}["']`, "i");
    const m = html.match(re1) || html.match(re2);
    return m ? decodeEntites(m[1]) : null;
}

function matchTitreBalise(html) {
    const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return m ? decodeEntites(m[1]) : null;
}

function extraireJsonLd(html) {
    const blocs = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
    for (const bloc of blocs) {
        try {
            let data = JSON.parse(bloc[1]);
            if (Array.isArray(data)) data = data.find(d => d["@type"] === "Product") || data[0];
            if (data?.["@graph"]) data = data["@graph"].find(d => d["@type"] === "Product") || data;
            if (!data) continue;
            const offer = Array.isArray(data.offers) ? data.offers[0] : data.offers;
            return {
                titre: data.name || null,
                image: Array.isArray(data.image) ? data.image[0] : data.image || null,
                prix: offer?.price ? Number(offer.price) : null,
                devise: offer?.priceCurrency || null,
            };
        } catch {
            continue;
        }
    }
    return null;
}

async function extraireProduit(url) {
    try {
        const parsed = new URL(url);
        if (!["http:", "https:"].includes(parsed.protocol)) {
            return { success: false, error: "Lien invalide." };
        }

        const { data: html } = await axios.get(url, {
            timeout: 8000,
            maxContentLength: 3 * 1024 * 1024,
            headers: { "User-Agent": "Mozilla/5.0 (compatible; SAMIIBot/1.0; +https://samii.souverain-store.com)" },
        });

        const jsonLd = extraireJsonLd(html);

        const titre = matchMeta(html, "og:title") || jsonLd?.titre || matchTitreBalise(html) || "";
        const image = matchMeta(html, "og:image") || jsonLd?.image || "";
        const prixMeta = matchMeta(html, "product:price:amount") || matchMeta(html, "og:price:amount");
        const deviseMeta = matchMeta(html, "product:price:currency") || matchMeta(html, "og:price:currency");

        const prix = prixMeta ? Number(prixMeta) : (jsonLd?.prix ?? null);
        const devise = (deviseMeta || jsonLd?.devise || "EUR").toUpperCase();

        return { success: true, titre, image, prix: Number.isFinite(prix) ? prix : null, devise };
    } catch (err) {
        console.warn("⚠️ extraireProduit :", err.message);
        return { success: false, error: "Impossible de lire cette page automatiquement — remplis les infos toi-même ci-dessous." };
    }
}

module.exports = { extraireProduit };
