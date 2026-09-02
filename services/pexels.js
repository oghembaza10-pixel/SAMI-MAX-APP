// ==========================================================================
// PEXELS — LES VIDÉOS ET LES IMAGES QUE SAMII N'A PAS
// ==========================================================================
//
// ── LE PROBLÈME EXACT QUE CE FICHIER RÉSOUT ───────────────────────────────
//
// Vérifié en base : sur les 203 annonces du catalogue, **aucune n'a de
// vidéo**. CJ Dropshipping en fournit parfois, mais pas pour ces
// produits-là. Le support des reels était donc construit et inutilisable :
// un reel exige une vidéo, et il n'y en avait pas une seule.
//
// Et surtout, SAMII n'a pas que des produits à raconter. « Rejoignez-nous »,
// « laissez-moi piloter votre business », le développement personnel : ces
// sujets n'ont AUCUN produit derrière eux, donc aucune image dans `annonces`.
// Sans source d'images extérieure, SAMII ne pouvait littéralement rien
// publier sur elle-même.
//
// ── POURQUOI PEXELS ET PAS UNE GÉNÉRATION PAR IA ──────────────────────────
//
// Générer une vidéo coûte de l'argent à chaque appel. En automatique,
// plusieurs fois par jour, ça fait une facture qui monte sans que personne
// l'ait décidé — exactement le genre de mauvaise surprise qu'un mode
// automatique doit éviter.
//
// Pexels est gratuit, sans carte bancaire, et donne de la vraie vidéo
// verticale. Le quota dépend de la clé : la documentation annonce 200
// requêtes par heure et 20 000 par mois, mais l'en-tête renvoyé par la vraie
// clé d'OG Technology disait 24 997 restants au premier appel. On ne fige
// donc AUCUN chiffre ici — c'est `x-ratelimit-remaining` qui fait foi, et il
// est remonté jusqu'à l'écran. De toute façon le cycle en fait quelques-unes
// par jour.
//
// ── L'API ─────────────────────────────────────────────────────────────────
//
//     GET https://api.pexels.com/videos/search?query=…&orientation=portrait
//     GET https://api.pexels.com/v1/search?query=…&orientation=portrait
//     Authorization: <CLÉ>          ← la clé BRUTE, PAS « Bearer <clé> »
//
// C'est le piège de cette API : presque toutes les autres veulent
// « Bearer », celle-ci veut la clé nue. Se tromper donne un 401 qui ne dit
// pas pourquoi.
//
// ── LE CRÉDIT N'EST PAS DÉCORATIF ─────────────────────────────────────────
//
// Les règles de Pexels demandent de créditer l'auteur et de renvoyer vers
// Pexels — et c'est la condition pour dépasser les limites d'appels. Chaque
// média rendu ici porte donc son crédit, et l'appelant n'a pas le droit de
// l'oublier : `credit` est un champ du résultat, pas une option.
//
// ── NON VÉRIFIÉ CONTRE LE VRAI PEXELS ─────────────────────────────────────
//
// `api.pexels.com` est bloqué depuis l'environnement où ce fichier a été
// écrit. Le contrat (chemins, en-tête, forme de la réponse) vient de la
// documentation publique, et le comportement est éprouvé contre un faux
// serveur qui la respecte. Le premier appel réel reste à faire : si Pexels
// répond 401, c'est l'en-tête ; s'il répond 200 avec zéro vidéo, c'est la
// recherche. `etat()` sait dire lequel des deux.

const axios = require("axios");

// Surchargeable UNIQUEMENT pour éprouver ce client sans taper chez Pexels.
const ADRESSE = String(process.env.PEXELS_ADRESSE || "").trim() || "https://api.pexels.com";

// Une recherche d'illustration ne doit pas tenir la file de publication.
const DELAI_MS = 15000;

// Ce qu'on demande à Pexels. Volontairement large : une recherche trop
// étroite rend zéro résultat, et zéro résultat annule une publication.
const PAR_PAGE = 30;

// ── LA DURÉE D'UN REEL ────────────────────────────────────────────────────
//
// Trop court, la plateforme refuse ; trop long, personne ne regarde et
// l'algorithme le sait. On borne à la source plutôt que de filtrer après :
// Pexels sait le faire, autant lui demander.
const DUREE_MIN = 5;
const DUREE_MAX = 45;

function cle() {
    return String(process.env.PEXELS_API_KEY || "").trim();
}

function configure() {
    return !!cle();
}

// ── L'APPEL ───────────────────────────────────────────────────────────────
//
// Ne lève jamais. Une panne de Pexels ne doit pas arrêter la publication sur
// les sujets qui, eux, ont une image.
async function appeler(chemin, parametres) {
    if (!configure()) return { ok: false, erreur: "PEXELS_API_KEY n'est pas posée" };
    try {
        const r = await axios.get(`${ADRESSE}${chemin}`, {
            // La clé BRUTE. Pas de « Bearer ». Voir l'en-tête de ce fichier.
            headers: { Authorization: cle() },
            params: parametres,
            timeout: DELAI_MS,
        });
        return { ok: true, donnees: r.data, restant: r.headers?.["x-ratelimit-remaining"] ?? null };
    } catch (err) {
        const code = err.response?.status;
        const detail = err.response?.data?.error || err.response?.data?.code || err.message;
        // 401 et 429 méritent d'être nommés : ce sont les deux seules pannes
        // qu'on répare soi-même, et « erreur Pexels » n'aide personne.
        if (code === 401) {
            return { ok: false, erreur: "Pexels refuse la clé (401) — PEXELS_API_KEY invalide, "
                                      + "ou envoyée avec « Bearer » alors qu'elle se pose nue" };
        }
        if (code === 429) {
            // Pas de chiffre inventé dans ce message : il varie selon la
            // clé, et une valeur fausse envoie chercher au mauvais endroit.
            const reste = err.response?.headers?.["x-ratelimit-remaining"];
            return { ok: false, erreur: "Pexels limite les appels (429)"
                              + (reste !== undefined ? ` — ${reste} restants` : "")
                              + " — le quota se lit sur /social" };
        }
        return { ok: false, erreur: code ? `HTTP ${code} — ${detail}` : detail };
    }
}

// ── CHOISIR UN FICHIER VIDÉO ──────────────────────────────────────────────
//
// Pexels rend plusieurs résolutions pour la même vidéo. On veut la plus
// grande qui reste raisonnable : une 4K de 80 Mo est refusée ou met dix
// minutes à téléverser chez Buffer, une 640×360 est laide en plein écran.
//
// On préfère aussi le VERTICAL : un reel horizontal est recadré par la
// plateforme, souvent au mauvais endroit.
const LARGEUR_MAX = 1080;

function meilleurFichier(video) {
    const fichiers = (video?.video_files || [])
        .filter((f) => f?.link && /mp4/i.test(f.file_type || "") && f.width && f.height)
        // Rien au-dessus de 1080 de large : au-delà, c'est du poids sans gain.
        .filter((f) => f.width <= LARGEUR_MAX);
    if (!fichiers.length) return null;

    const vertical = fichiers.filter((f) => f.height > f.width);
    const retenus = vertical.length ? vertical : fichiers;
    // La plus grande des restantes.
    return retenus.sort((a, b) => (b.width * b.height) - (a.width * a.height))[0];
}

// Le crédit, formé une seule fois. Utilisé dans la légende ET gardé en base :
// « d'où vient cette vidéo » doit avoir une réponse six mois plus tard.
function credit({ auteur, lienAuteur, lienMedia }) {
    return {
        auteur: auteur || "Pexels",
        lienAuteur: lienAuteur || "https://www.pexels.com",
        lienMedia: lienMedia || "https://www.pexels.com",
        source: "pexels",
        // La ligne prête à coller sous une publication.
        ligne: `Vidéo : ${auteur || "Pexels"} · Pexels`,
    };
}

// ── CHERCHER UNE VIDÉO VERTICALE ──────────────────────────────────────────
async function video({ recherche, aleatoire = true } = {}) {
    const r = await appeler("/videos/search", {
        query: recherche,
        orientation: "portrait",
        size: "medium",
        per_page: PAR_PAGE,
        min_duration: DUREE_MIN,
        max_duration: DUREE_MAX,
    });
    if (!r.ok) return { ok: false, erreur: r.erreur };

    const videos = (r.donnees?.videos || []).filter(meilleurFichier);
    if (!videos.length) {
        return { ok: false, erreur: `aucune vidéo verticale exploitable pour « ${recherche} »` };
    }

    // Au hasard plutôt que la première : sinon SAMII publie la même vidéo
    // chaque fois qu'un sujet revient, et ça se voit très vite.
    const v = aleatoire ? videos[Math.floor(Math.random() * videos.length)] : videos[0];
    const f = meilleurFichier(v);

    return {
        ok: true,
        media: f.link,
        mediaType: "video",
        largeur: f.width,
        hauteur: f.height,
        duree: v.duration || null,
        recherche,
        credit: credit({
            auteur: v.user?.name,
            lienAuteur: v.user?.url,
            lienMedia: v.url,
        }),
        restant: r.restant,
    };
}

// ── CHERCHER UNE IMAGE VERTICALE ──────────────────────────────────────────
//
// Le repli quand aucune vidéo ne convient : mieux vaut un post en image
// qu'aucune publication.
async function image({ recherche, aleatoire = true } = {}) {
    const r = await appeler("/v1/search", {
        query: recherche,
        orientation: "portrait",
        per_page: PAR_PAGE,
    });
    if (!r.ok) return { ok: false, erreur: r.erreur };

    const photos = (r.donnees?.photos || []).filter((p) => p?.src?.large2x || p?.src?.large);
    if (!photos.length) return { ok: false, erreur: `aucune image pour « ${recherche} »` };

    const p = aleatoire ? photos[Math.floor(Math.random() * photos.length)] : photos[0];
    const c = credit({ auteur: p.photographer, lienAuteur: p.photographer_url, lienMedia: p.url });

    return {
        ok: true,
        media: p.src.large2x || p.src.large,
        mediaType: "image",
        largeur: p.width,
        hauteur: p.height,
        description: p.alt || null,
        recherche,
        credit: { ...c, ligne: `Photo : ${c.auteur} · Pexels` },
        restant: r.restant,
    };
}

// ── UNE VIDÉO, SINON UNE IMAGE ────────────────────────────────────────────
//
// Ce que le cycle appelle. Il veut « quelque chose à montrer sur ce
// sujet-là » ; savoir si c'est une vidéo ou une image est le travail d'ici,
// pas le sien. Le repli est DIT dans le résultat — « pourquoi ce n'est pas
// un reel » doit avoir une réponse.
async function chercher({ recherche, prefererVideo = true } = {}) {
    if (!recherche) return { ok: false, erreur: "aucun sujet de recherche" };

    if (prefererVideo) {
        const v = await video({ recherche });
        if (v.ok) return v;
        const i = await image({ recherche });
        if (i.ok) return { ...i, repli: `aucune vidéo exploitable (${v.erreur}) — une image a été retenue` };
        return { ok: false, erreur: `${v.erreur} · ${i.erreur}` };
    }

    const i = await image({ recherche });
    if (i.ok) return i;
    return video({ recherche });
}

// ── L'ÉTAT, POUR L'ÉCRAN ──────────────────────────────────────────────────
//
// Distingue les deux pannes qu'on répare soi-même : la clé refusée, et la
// recherche qui ne rend rien. « Pexels ne marche pas » n'est pas une
// information.
async function etat({ recherche = "technology" } = {}) {
    if (!configure()) return { configure: false, raison: "PEXELS_API_KEY n'est pas posée" };
    const v = await video({ recherche, aleatoire: false });
    return {
        configure: true,
        joignable: v.ok || !/HTTP|refuse|limite/.test(v.erreur || ""),
        // Aucune clé ici : des noms d'auteurs et des URL publiques.
        exemple: v.ok ? { media: v.media, duree: v.duree, credit: v.credit.ligne } : null,
        raison: v.ok ? null : v.erreur,
        appelsRestants: v.restant ?? null,
    };
}

module.exports = {
    chercher, video, image, etat, configure, credit, meilleurFichier,
    ADRESSE, DUREE_MIN, DUREE_MAX, LARGEUR_MAX, PAR_PAGE,
};
