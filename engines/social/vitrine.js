// ==========================================================================
// LA VITRINE — CE QUE SAMII A RÉELLEMENT À MONTRER
// ==========================================================================
//
// ── LE PROBLÈME QUE CE FICHIER RÉSOUT ─────────────────────────────────────
//
// Pour publier toute seule, SAMII a besoin d'un visuel. Instagram REFUSE
// une publication sans image, et un reel sans vidéo n'est pas un reel.
//
// Or, avant ce fichier, `media` arrivait uniquement de l'extérieur : une
// URL qu'un humain fournissait à la main. En mode automatique, il n'y a
// plus d'humain — donc plus de média, donc plus de publication Instagram.
// Le mode AUTO se serait arrêté là, sans que ce soit visible.
//
// ── D'OÙ VIENT LE MÉDIA, ET POURQUOI CELUI-LÀ ─────────────────────────────
//
// De la table `annonces` : les produits réels de la communauté, avec leurs
// vraies photos (`photo_url`, `photos_urls`) et, quand le fournisseur en
// donne, leurs vraies vidéos (`videos`, alimentée par l'import CJ).
//
// C'est la seule source qui coche les quatre cases :
//
//   • elle est RÉELLE          — un vrai produit, pas une image d'illustration
//   • elle nous APPARTIENT     — aucune permission à demander à personne
//   • elle est GRATUITE        — pas de génération d'image ni de vidéo payante
//   • elle a un SENS COMMERCIAL — publier un produit qu'on vend, pas du vide
//
// Générer une image ou une vidéo par IA aurait coûté de l'argent à chaque
// passage automatique, silencieusement, plusieurs fois par jour. Une facture
// qui grimpe sans que personne l'ait décidé est exactement le genre de
// mauvaise surprise qu'un mode automatique doit éviter.
//
// ── CE QUE CE FICHIER NE FAIT PAS ─────────────────────────────────────────
//
// Il n'écrit aucun texte : c'est le travail du créateur. Il ne choisit pas
// la plateforme ni le format : c'est le registre des formats. Il rend un
// produit et ses médias, rien d'autre.

const db = require("../../services/db");
const formats = require("../../config/formats-sociaux");

// Combien de produits on regarde avant de choisir. Assez pour varier, pas
// au point de ramener tout le catalogue à chaque passage.
const FENETRE = 40;

// ── LIRE LES MÉDIAS D'UNE ANNONCE ─────────────────────────────────────────
//
// `photos_urls` est du TEXT contenant du JSON, `videos` est du JSONB : deux
// formes différentes pour la même idée, héritées de deux imports écrits à
// des moments différents. On absorbe les deux ici plutôt que de laisser
// chaque appelant se débrouiller — et une valeur illisible ne doit jamais
// faire tomber une publication.
function lireListe(valeur) {
    if (!valeur) return [];
    if (Array.isArray(valeur)) return valeur.filter((x) => typeof x === "string" && x.trim());
    if (typeof valeur === "string") {
        const brut = valeur.trim();
        if (!brut) return [];
        // Du JSON, ou une simple URL posée telle quelle. On teste les deux
        // ouvertures : un `{` mal formé rendu tel quel se retrouverait
        // ensuite dans une liste d'images, où il n'a rien à faire.
        if (brut.startsWith("[") || brut.startsWith("{")) {
            try {
                const j = JSON.parse(brut);
                return Array.isArray(j) ? j.filter((x) => typeof x === "string" && x.trim()) : [];
            } catch {
                return [];
            }
        }
        return [brut];
    }
    return [];
}

// Une URL de média doit être publiquement joignable : Buffer et Meta vont
// la télécharger depuis LEURS serveurs, pas depuis le nôtre. Une URL
// relative ou en http:// échouera chez eux, pas ici — autant le voir tout
// de suite.
function urlPubliable(u) {
    return typeof u === "string" && /^https:\/\/\S+$/i.test(u.trim());
}

function mediasDe(annonce) {
    const images = [
        ...lireListe(annonce.photo_url),
        ...lireListe(annonce.photos_urls),
    ].filter(urlPubliable);

    const videos = lireListe(annonce.videos).filter(urlPubliable);

    // Dédoublonnage : `photo_url` est souvent la première de `photos_urls`,
    // et publier deux fois la même image dans un carrousel est visible.
    return {
        images: [...new Set(images)],
        videos: [...new Set(videos)],
    };
}

// ── CHOISIR UN PRODUIT À METTRE EN AVANT ──────────────────────────────────
//
// `prefererVideo` sert au mode automatique : quand il veut un reel, il
// demande d'abord un produit qui a une vidéo, et se rabat sur une image
// si le catalogue n'en a pas. Le rabattement est DIT dans le résultat, pas
// silencieux — « pourquoi ce n'est pas un reel » doit avoir une réponse.
async function choisir({ communaute, prefererVideo = false, exclureIds = [] } = {}) {
    let lignes;
    try {
        lignes = await db.query(
            `SELECT id, titre, description, prix, devise, categorie,
                    photo_url, photos_urls, videos
               FROM annonces
              WHERE actif = TRUE
                AND COALESCE(titre,'') <> ''
                AND ($1::text IS NULL OR communaute = $1)
                AND ($2::int[] IS NULL OR NOT (id = ANY($2)))
              ORDER BY created_at DESC
              LIMIT ${FENETRE}`,
            [communaute || null, exclureIds.length ? exclureIds : null]);
    } catch (err) {
        // Le catalogue injoignable ne doit pas faire tomber le cycle : il
        // reste les plateformes qui n'exigent pas de média.
        return { ok: false, raison: `catalogue illisible : ${err.message}` };
    }

    if (!lignes.length) {
        return { ok: false, raison: "aucun produit actif dans le catalogue de cette communauté" };
    }

    // On enrichit d'abord, on choisit ensuite : le tri se fait sur ce que
    // le produit a VRAIMENT, pas sur ce que la colonne laissait espérer.
    const avecMedias = lignes.map((a) => ({ annonce: a, medias: mediasDe(a) }));

    const avecVideo = avecMedias.filter((x) => x.medias.videos.length);
    const avecImage = avecMedias.filter((x) => x.medias.images.length);

    let retenu = null;
    let repli = null;

    if (prefererVideo && avecVideo.length) {
        retenu = tirer(avecVideo);
    } else if (prefererVideo && avecImage.length) {
        retenu = tirer(avecImage);
        repli = "aucun produit du catalogue n'a de vidéo — un visuel fixe a été retenu";
    } else if (avecImage.length) {
        retenu = tirer(avecImage);
    } else if (avecVideo.length) {
        retenu = tirer(avecVideo);
    }

    if (!retenu) {
        return {
            ok: false,
            raison: `${lignes.length} produit(s) trouvé(s), aucun avec un média publiable `
                  + `(une URL https:// est nécessaire : Buffer et Meta téléchargent depuis chez eux)`,
        };
    }

    const { annonce, medias } = retenu;
    // La vidéo l'emporte quand on en voulait une ET qu'il y en a une.
    const video = prefererVideo && medias.videos.length ? medias.videos[0] : null;

    return {
        ok: true,
        repli,
        produit: {
            id: annonce.id,
            titre: annonce.titre,
            description: String(annonce.description || "").slice(0, 600),
            prix: annonce.prix || null,
            devise: annonce.devise || null,
            categorie: annonce.categorie || null,
        },
        media: video || medias.images[0],
        mediaType: video ? "video" : "image",
        // Tout ce qu'on a, pour le jour où un carrousel devient
        // transportable — il faudra alors plusieurs images, pas une.
        images: medias.images,
        videos: medias.videos,
    };
}

// Un tirage au hasard dans la fenêtre, plutôt que « toujours le plus
// récent » : sinon SAMII publierait le même produit tous les jours jusqu'à
// ce que quelqu'un en ajoute un.
function tirer(liste) {
    return liste[Math.floor(Math.random() * liste.length)];
}

// ── CE QUE LE CATALOGUE PERMET, AUJOURD'HUI ───────────────────────────────
//
// Pour l'écran du fondateur. « Pourquoi SAMII ne publie pas de reel » ne
// doit pas se répondre en lisant du SQL.
async function couverture({ communaute } = {}) {
    try {
        const r = await db.query(
            `SELECT COUNT(*)::int AS total,
                    COUNT(*) FILTER (WHERE COALESCE(photo_url,'') LIKE 'https://%'
                                        OR COALESCE(photos_urls,'') LIKE '%https://%')::int AS avec_image,
                    COUNT(*) FILTER (WHERE videos IS NOT NULL
                                        AND jsonb_array_length(videos) > 0)::int AS avec_video
               FROM annonces
              WHERE actif = TRUE AND ($1::text IS NULL OR communaute = $1)`,
            [communaute || null]);
        const c = r[0] || {};
        return {
            ok: true,
            produits: Number(c.total || 0),
            avecImage: Number(c.avec_image || 0),
            avecVideo: Number(c.avec_video || 0),
            // La conclusion, écrite une fois ici plutôt que redéduite par
            // chaque écran.
            peutPublierPhoto: Number(c.avec_image || 0) > 0,
            peutPublierReel: Number(c.avec_video || 0) > 0,
            formatsTransportables: formats.TRANSPORTABLES,
        };
    } catch (err) {
        return { ok: false, raison: err.message };
    }
}

module.exports = { choisir, couverture, mediasDe, lireListe, urlPubliable, FENETRE };
