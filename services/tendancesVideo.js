// ==========================================================================
// SAMII OS — LES TENDANCES VIDÉO
//
// CE QU'ON RÉPARE. L'Œil Concurrentiel et le Top Produits répondent
// aujourd'hui par un modèle de langage : ce ne sont pas des mesures, ce sont
// des estimations plausibles. Un marchand qui décide de sa vidéo du samedi sur
// une estimation prend un risque qu'il ne voit pas. Ici, les chiffres sont
// relevés — vues, likes, commentaires, date — chez la plateforme elle-même.
//
// POURQUOI DEUX SOURCES, ET PAS UN SCRAPER.
//
// La tentation est d'aspirer TikTok et Instagram par une voie non officielle :
// ça donne plus de données, tout de suite. Trois raisons de ne pas le faire
// dans le code de SAMII :
//   1. Ces plateformes coupent ces accès sans prévenir. Une fonctionnalité qui
//      s'éteint un mardi matin sans que personne ne l'ait touchée coûte plus
//      cher en confiance qu'elle n'a rapporté.
//   2. Nous demandons à Meta l'autorisation de publier sur Instagram. Aspirer
//      les données de Meta par la porte de derrière avec la même
//      infrastructure, c'est mettre en jeu cette autorisation.
//   3. Ce n'est pas une décision technique. C'est une décision d'entreprise,
//      et elle appartient au fondateur, pas à un fichier de service.
//
// Donc : YOUTUBE en officiel (API publique, gratuite, stable), et un
// FOURNISSEUR PERSONNALISÉ que le marchand — ou nous — configure par une URL,
// un en-tête et une correspondance de champs. N'importe quelle API tierce du
// marché s'y branche sans toucher à ce fichier, et sans que SAMII n'embarque
// de scraper. La porte reste ouverte, le risque reste dehors.
//
// LE CACHE N'EST PAS UNE OPTIMISATION, C'EST UNE CONDITION. L'API YouTube
// donne 10 000 unités par jour, et une recherche en coûte 100. Sans cache,
// soixante marchands qui cliquent le même matin éteignent la fonctionnalité
// pour tout le monde jusqu'à minuit. Les résultats sont donc partagés par
// (source, métier, pays, période) : les tendances d'un marché ne sont pas
// personnelles, deux restaurateurs d'Alger doivent voir la même chose.
// ==========================================================================
const axios = require("axios");
const db = require("./db");
const CONFIG = require("./../config");

const SOURCES = {
    youtube: { id: "youtube", label: "YouTube", officiel: true },
    // Rempli seulement si une configuration existe (voir fournisseurPersonnalise).
    personnalise: { id: "personnalise", label: "Source externe", officiel: false },
};

// Combien de temps une tendance reste vraie. Six heures : assez court pour que
// « cette semaine » veuille dire quelque chose, assez long pour qu'une journée
// de clics ne consomme qu'un seul appel par marché.
const FRAICHEUR_HEURES = 6;

const PERIODES = {
    jour:    { label: "Dernières 24 h", heures: 24 },
    semaine: { label: "Cette semaine",  heures: 24 * 7 },
    mois:    { label: "Ce mois-ci",     heures: 24 * 30 },
};

// ── Le cache ─────────────────────────────────────────────────────────────

function empreinte({ source, requete, pays, periode }) {
    return [source, String(requete || "").toLowerCase().trim(), pays || "", periode].join("|");
}

async function lireCache(cle) {
    try {
        const rows = await db.query(
            `SELECT resultats, created_at FROM tendances_video_cache
              WHERE cle = $1 AND created_at > NOW() - ($2 || ' hours')::interval
              ORDER BY created_at DESC LIMIT 1`,
            [cle, String(FRAICHEUR_HEURES)],
        );
        if (!rows[0]) return null;
        return { videos: rows[0].resultats, releveLe: rows[0].created_at, duCache: true };
    } catch (err) {
        // Un cache en panne ne doit jamais empêcher de répondre : on ira
        // simplement chercher la donnée à la source.
        console.warn("⚠️ tendancesVideo.lireCache :", err.message);
        return null;
    }
}

async function ecrireCache(cle, videos) {
    try {
        await db.query(
            `INSERT INTO tendances_video_cache (cle, resultats) VALUES ($1, $2)`,
            [cle, JSON.stringify(videos)],
        );
    } catch (err) {
        console.warn("⚠️ tendancesVideo.ecrireCache :", err.message);
    }
}

// ── La forme commune ─────────────────────────────────────────────────────
// Toute source, officielle ou non, rend exactement ces champs. Le reste du
// code — la page, le Griot — n'a jamais à savoir d'où vient une vidéo.
function video({ titre, chaine, lien, vignette, vues, likes, commentaires, publieeLe, source }) {
    const v = Number(vues) || 0;
    const l = Number(likes) || 0;
    return {
        titre: String(titre || "").slice(0, 200),
        chaine: String(chaine || "").slice(0, 120),
        lien: lien || "",
        vignette: vignette || "",
        vues: v,
        likes: l,
        commentaires: Number(commentaires) || 0,
        publieeLe: publieeLe || null,
        source: source || "youtube",
        // Le taux d'engagement dit ce que le nombre de vues cache : une vidéo
        // à 50 000 vues et 200 likes marche moins bien qu'une à 5 000 vues et
        // 600 likes. C'est la seconde qu'un marchand doit copier.
        engagement: v > 0 ? Math.round((l / v) * 1000) / 10 : 0,
    };
}

// ── Source 1 : YouTube, par l'API officielle ─────────────────────────────
// Deux appels : search.list donne les identifiants, videos.list donne les
// compteurs. search.list seul ne renvoie AUCUN chiffre — c'est le piège
// classique de cette API, et sans le second appel toute la page afficherait
// des zéros.
async function chercherYouTube({ requete, pays = "", periode = "semaine", limite = 12 }) {
    const cle = CONFIG.YOUTUBE?.API_KEY || CONFIG.GOOGLE?.API_KEY;
    if (!cle) {
        const err = new Error("La source YouTube n'est pas configurée (clé d'API Google manquante).");
        err.code = "SOURCE_NON_CONFIGUREE";
        throw err;
    }

    const depuis = new Date(Date.now() - (PERIODES[periode] || PERIODES.semaine).heures * 3600e3);

    const recherche = await axios.get("https://www.googleapis.com/youtube/v3/search", {
        params: {
            key: cle,
            part: "snippet",
            q: requete,
            type: "video",
            order: "viewCount",
            maxResults: Math.min(Number(limite) || 12, 25),
            publishedAfter: depuis.toISOString(),
            ...(pays ? { regionCode: pays } : {}),
        },
        timeout: 12000,
    });

    const ids = (recherche.data.items || []).map((i) => i.id?.videoId).filter(Boolean);
    if (!ids.length) return [];

    const details = await axios.get("https://www.googleapis.com/youtube/v3/videos", {
        params: { key: cle, part: "snippet,statistics", id: ids.join(",") },
        timeout: 12000,
    });

    return (details.data.items || []).map((it) => video({
        titre: it.snippet?.title,
        chaine: it.snippet?.channelTitle,
        lien: `https://www.youtube.com/watch?v=${it.id}`,
        vignette: it.snippet?.thumbnails?.medium?.url || it.snippet?.thumbnails?.default?.url,
        vues: it.statistics?.viewCount,
        likes: it.statistics?.likeCount,
        commentaires: it.statistics?.commentCount,
        publieeLe: it.snippet?.publishedAt,
        source: "youtube",
    }));
}

// ── Source 2 : le fournisseur externe, branché sans code ─────────────────
//
// C'est ici que se branche n'importe quelle API vidéo du marché — TikTok,
// Instagram, Twitch — le jour où le fondateur en choisit une. Rien n'est
// codé en dur : une URL, un en-tête d'authentification, et une CORRESPONDANCE
// qui dit quel champ de leur réponse correspond à quel champ chez nous.
//
// Trois raisons d'avoir fait ça plutôt que d'écrire un connecteur par
// fournisseur :
//   • Ces API changent de nom et de propriétaire tous les six mois. Un
//     connecteur écrit en dur meurt avec elles ; une correspondance se
//     modifie sans redéploiement.
//   • Le choix du fournisseur est une décision commerciale et juridique.
//     Elle ne doit pas être enterrée dans un fichier de service.
//   • Aucun scraper n'entre dans le dépôt de SAMII. Ce que le fondateur
//     branche, il le branche en connaissance de cause.
//
// Configuration attendue (table tendances_video_sources) :
//   url        https://exemple.tld/search?q={requete}&country={pays}
//   entete     { "X-API-Key": "…" }
//   chemin     "data.videos"          où trouver le tableau dans leur réponse
//   champs     { "titre": "title", "vues": "play_count", … }
async function chercherPersonnalise(config, { requete, pays = "", limite = 12 }) {
    const url = String(config.url || "")
        .replace("{requete}", encodeURIComponent(requete))
        .replace("{pays}", encodeURIComponent(pays))
        .replace("{limite}", String(limite));

    const reponse = await axios.get(url, {
        headers: config.entete || {},
        timeout: 15000,
    });

    // Le tableau peut être n'importe où dans leur réponse : "data.videos",
    // "result.items", ou la racine. On suit le chemin déclaré.
    const chemin = String(config.chemin || "").split(".").filter(Boolean);
    let brut = reponse.data;
    for (const pas of chemin) brut = brut?.[pas];
    if (!Array.isArray(brut)) return [];

    const c = config.champs || {};
    const prendre = (obj, cle) => (cle ? String(cle).split(".").reduce((o, p) => o?.[p], obj) : undefined);

    return brut.slice(0, limite).map((it) => video({
        titre: prendre(it, c.titre) ?? it.title,
        chaine: prendre(it, c.chaine) ?? it.author,
        lien: prendre(it, c.lien) ?? it.url,
        vignette: prendre(it, c.vignette) ?? it.thumbnail,
        vues: prendre(it, c.vues) ?? it.views,
        likes: prendre(it, c.likes) ?? it.likes,
        commentaires: prendre(it, c.commentaires) ?? it.comments,
        publieeLe: prendre(it, c.publieeLe) ?? it.created_at,
        source: config.nom || "personnalise",
    }));
}

async function fournisseurPersonnalise(workspaceId) {
    try {
        const rows = await db.query(
            `SELECT * FROM tendances_video_sources
              WHERE actif = TRUE AND (workspace_id = $1 OR workspace_id IS NULL)
              ORDER BY workspace_id NULLS LAST LIMIT 1`,
            [workspaceId || null],
        );
        return rows[0] || null;
    } catch { return null; }
}

// ── L'entrée unique ──────────────────────────────────────────────────────

async function tendances({ requete, source = "youtube", pays = "", periode = "semaine", limite = 12, workspaceId = null } = {}) {
    const q = String(requete || "").trim();
    if (q.length < 2) throw new Error("Dis en quelques mots ce que tu veux voir marcher.");
    if (!PERIODES[periode]) periode = "semaine";

    const cle = empreinte({ source, requete: q, pays, periode });
    const enCache = await lireCache(cle);
    if (enCache) return { ...enCache, source, periode, requete: q };

    let videos;
    if (source === "personnalise") {
        const config = await fournisseurPersonnalise(workspaceId);
        if (!config) {
            const err = new Error("Aucune source externe n'est branchée pour l'instant.");
            err.code = "SOURCE_NON_CONFIGUREE";
            throw err;
        }
        videos = await chercherPersonnalise(config, { requete: q, pays, limite });
    } else {
        videos = await chercherYouTube({ requete: q, pays, periode, limite });
    }

    // Classées par engagement, pas par vues : voir le commentaire de video().
    videos.sort((a, b) => b.engagement - a.engagement || b.vues - a.vues);

    await ecrireCache(cle, videos);
    return { videos, releveLe: new Date(), duCache: false, source, periode, requete: q };
}

// Ce qu'un marchand doit retenir, en une phrase, pour ne pas avoir à lire
// douze lignes de chiffres. Rien d'inventé : uniquement ce que le relevé dit.
function lecture(videos) {
    if (!videos.length) return "";
    const medianeVues = [...videos].sort((a, b) => a.vues - b.vues)[Math.floor(videos.length / 2)].vues;
    const meilleure = videos[0];
    const courtes = videos.filter((v) => /#shorts|\bshort\b/i.test(v.titre)).length;

    const bouts = [
        `La plus engageante fait ${meilleure.engagement} % (${meilleure.vues.toLocaleString("fr-FR")} vues)`,
        `médiane à ${medianeVues.toLocaleString("fr-FR")} vues`,
    ];
    if (courtes >= Math.ceil(videos.length / 3)) {
        bouts.push(courtes === 1
            ? `1 des ${videos.length} est un format court`
            : `${courtes} des ${videos.length} sont des formats courts`);
    }
    return bouts.join(" · ") + ".";
}

module.exports = { SOURCES, PERIODES, tendances, lecture, video };
