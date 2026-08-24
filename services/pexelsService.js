// ==========================================================================
// SAMII OS — PEXELS (photos libres de droit, usage commercial)
//
// Rôle : donner à Griot un moteur visuel GRATUIT à côté des moteurs IA
// payants (Runware, WAN). Un marchand sans budget ne doit jamais rester
// bloqué sur "crédits insuffisants" — il publie avec une vraie photo
// professionnelle, ce qui suffit dans l'immense majorité des cas.
//
// CONDITIONS D'UTILISATION (imposées par Pexels, non négociables) :
//   1. un lien visible vers Pexels partout où ces photos sont affichées ;
//   2. le nom du photographe, lié à la photo d'origine sur Pexels.
// Ces deux éléments sont renvoyés avec chaque résultat (champs
// `photographe`, `photographeUrl`, `pageUrl`) — l'appelant DOIT les
// afficher. Les respecter donne aussi droit aux requêtes illimitées.
// ==========================================================================
const axios = require("axios");
const CONFIG = require("../config");

const API_URL   = "https://api.pexels.com/v1/search";
const VIDEO_URL = "https://api.pexels.com/videos/search";

// Cache mémoire : la même recherche ("café", "montre") revient souvent d'un
// marchand à l'autre. Ça garde le volume de requêtes bas, comme annoncé à
// Pexels, et rend l'affichage instantané au 2ᵉ appel.
const cache = new Map();
const CACHE_MS = 30 * 60 * 1000;
const CACHE_MAX = 200;

function estConfigure() {
    return Boolean(CONFIG.PEXELS?.API_KEY);
}

function cleCache(requete, nb, orientation) {
    return `${requete.toLowerCase().trim()}|${nb}|${orientation}`;
}

/**
 * Cherche des photos libres de droit.
 * @returns {Promise<{success:boolean, photos:Array, error?:string}>}
 *   Chaque photo : { url, apercu, largeur, hauteur, photographe, photographeUrl, pageUrl, alt }
 */
async function chercher(requete, { nb = 6, orientation = "square" } = {}) {
    if (!estConfigure()) {
        return { success: false, photos: [], error: "Clé Pexels non configurée côté serveur." };
    }
    const texte = String(requete || "").trim();
    if (!texte) {
        return { success: false, photos: [], error: "Aucun mot-clé de recherche." };
    }

    const cle = cleCache(texte, nb, orientation);
    const enCache = cache.get(cle);
    if (enCache && Date.now() - enCache.at < CACHE_MS) {
        return { success: true, photos: enCache.photos };
    }

    try {
        const res = await axios.get(API_URL, {
            headers: { Authorization: CONFIG.PEXELS.API_KEY },
            params: { query: texte, per_page: Math.min(nb, 20), orientation },
            timeout: 10000,
        });

        const photos = (res.data?.photos || []).map(p => ({
            // "large" : assez net pour une publication réseau sans peser
            // plusieurs Mo à chaque affichage de la page.
            url            : p.src?.large || p.src?.original || "",
            apercu         : p.src?.medium || p.src?.small || "",
            largeur        : p.width,
            hauteur        : p.height,
            photographe    : p.photographer || "",
            photographeUrl : p.photographer_url || "",
            pageUrl        : p.url || "",
            alt            : p.alt || texte,
        })).filter(p => p.url);

        if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
        cache.set(cle, { at: Date.now(), photos });

        return { success: true, photos };
    } catch (err) {
        const statut = err.response?.status;
        // 429 = quota horaire atteint. Ce n'est pas une panne : on le dit
        // clairement pour que l'appelant propose autre chose plutôt que
        // d'afficher une erreur technique au marchand.
        const message = statut === 429
            ? "Limite horaire de recherche d'images atteinte. Réessaie dans quelques minutes."
            : statut === 401
                ? "Clé Pexels refusée — vérifie PEXELS_API_KEY côté serveur."
                : err.message;
        console.error("❌ pexelsService.chercher :", statut || "", message);
        return { success: false, photos: [], error: message };
    }
}

/**
 * Cherche des VIDÉOS libres de droit (même clé, même compte que les photos).
 * Permet un palier vidéo réellement gratuit : la génération vidéo par IA est
 * facturée à la seconde chez tous les fournisseurs, et l'auto-héberger exige
 * une carte graphique qui coûte plus cher que de la payer à l'usage.
 * @returns {Promise<{success:boolean, videos:Array, error?:string}>}
 *   Chaque vidéo : { url, apercu, duree, largeur, hauteur, photographe, photographeUrl, pageUrl }
 */
async function chercherVideos(requete, { nb = 4 } = {}) {
    if (!estConfigure()) {
        return { success: false, videos: [], error: "Clé Pexels non configurée côté serveur." };
    }
    const texte = String(requete || "").trim();
    if (!texte) return { success: false, videos: [], error: "Aucun mot-clé de recherche." };

    const cle = `video|${cleCache(texte, nb, "any")}`;
    const enCache = cache.get(cle);
    if (enCache && Date.now() - enCache.at < CACHE_MS) {
        return { success: true, videos: enCache.photos };
    }

    try {
        const res = await axios.get(VIDEO_URL, {
            headers: { Authorization: CONFIG.PEXELS.API_KEY },
            params: { query: texte, per_page: Math.min(nb, 15), orientation: "portrait" },
            timeout: 12000,
        });

        const videos = (res.data?.videos || []).map(v => {
            // On vise ~720p : au-delà le fichier est trop lourd pour une
            // publication réseau, en dessous ça pique à l'écran.
            const fichiers = (v.video_files || []).filter(f => f.link);
            const choisi = fichiers.find(f => f.height >= 700 && f.height <= 1100)
                || fichiers.sort((a, b) => (b.height || 0) - (a.height || 0))[0];
            return {
                url            : choisi?.link || "",
                apercu         : v.image || "",
                duree          : v.duration || 0,
                largeur        : choisi?.width || v.width,
                hauteur        : choisi?.height || v.height,
                photographe    : v.user?.name || "",
                photographeUrl : v.user?.url || "",
                pageUrl        : v.url || "",
            };
        }).filter(v => v.url);

        if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
        cache.set(cle, { at: Date.now(), photos: videos });

        return { success: true, videos };
    } catch (err) {
        const statut = err.response?.status;
        const message = statut === 429
            ? "Limite horaire de recherche atteinte. Réessaie dans quelques minutes."
            : statut === 401
                ? "Clé Pexels refusée — vérifie PEXELS_API_KEY côté serveur."
                : err.message;
        console.error("❌ pexelsService.chercherVideos :", statut || "", message);
        return { success: false, videos: [], error: message };
    }
}

module.exports = { chercher, chercherVideos, estConfigure };
