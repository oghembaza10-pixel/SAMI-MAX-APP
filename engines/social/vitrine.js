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
// ── CE QUE LE CATALOGUE CONTIENT VRAIMENT ─────────────────────────────────
//
// Les fiches importées de CJ ne sont pas du texte : ce sont des fragments de
// page HTML, en anglais, avec `<p>`, `<span style="…">`, `<br/>`, `&nbsp;`.
// La description partait telle quelle dans l'invite du créateur comme
// « Angle imposé » — 600 caractères de balises. Relevé en base le 3
// septembre : `entree->angle` commençait par
// `<p><span style="font-weight: bold;">Overview:<br/>`.
//
// On demandait donc à SAMII d'écrire un post français en s'appuyant sur du
// balisage anglais. Le nettoyage n'est pas cosmétique : c'est la différence
// entre une consigne et du bruit.
function enTexte(brut) {
    return String(brut || "")
        .replace(/<br\s*\/?>/gi, " ")
        .replace(/<\/(p|div|li|tr|h[1-6])>/gi, " ")
        .replace(/<[^>]*>/g, "")
        // Les entités que CJ sème le plus : espace insécable et compagnie.
        .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 600);
}

// ── LE PRIX, ÉCRIT UNE FOIS ───────────────────────────────────────────────
//
// `annonces.prix` est une colonne TEXTE, et CJ y écrit déjà la devise :
// la valeur en base vaut « 12.94 EUR », pas « 12.94 ». Le cycle recollait
// `devise` derrière — d'où le thème réellement envoyé au modèle le
// 3 septembre : « … — 12.94 EUR EUR ».
//
// La règle vit ici, à côté de la colonne qu'elle connaît, et pas chez
// chaque appelant qui devrait la redécouvrir.
function etiquettePrix(prix, devise) {
    const p = String(prix ?? "").trim();
    if (!p) return null;
    const d = String(devise ?? "").trim();
    if (!d) return p;
    // Déjà présente (en fin de chaîne ou comme mot) : on ne la répète pas.
    return new RegExp(`(^|\\s)${d.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`, "i").test(p)
        ? p
        : `${p} ${d}`;
}

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
            description: enTexte(annonce.description),
            prix: annonce.prix || null,
            devise: annonce.devise || null,
            // Le prix DÉJÀ écrit tel qu'on doit l'afficher. Voir `etiquettePrix`.
            prixAffiche: etiquettePrix(annonce.prix, annonce.devise),
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

// ── LE MÉDIA D'UNE CAMPAGNE ───────────────────────────────────────────────
//
// Le point d'entrée du cycle automatique. Il ne dit pas OÙ chercher — il dit
// de quoi il veut parler, et c'est la campagne qui porte la réponse
// (`source: "catalogue"` ou `source: "pexels"`).
//
// Pourquoi ici et pas dans le cycle : la vitrine est déjà « d'où vient ce
// qu'on montre ». Laisser le cycle choisir entre deux sources aurait mis
// cette décision à un deuxième endroit, et le prochain appelant l'aurait
// recopiée.
//
// ── LE REPLI, ET POURQUOI IL COMPTE ───────────────────────────────────────
//
// Vérifié en base : sur 203 annonces, AUCUNE n'a de vidéo. Une campagne
// produit ne peut donc pas faire de reel aujourd'hui. Plutôt que d'annuler,
// on retombe sur l'image du produit — et on le DIT dans `repli`, pour que
// « pourquoi ce n'est pas un reel » ait une réponse à l'écran.
async function choisirPourCampagne({ campagne, communaute, prefererVideo = true } = {}) {
    const campagnes = require("../../config/campagnes-sociales");
    const c = campagnes.get(campagne);
    if (!c) return { ok: false, raison: `campagne inconnue : ${campagne}` };

    if (c.source === "catalogue") {
        const r = await choisir({ communaute, prefererVideo });
        return r.ok ? { ...r, campagne: c.slug, source: "catalogue" } : r;
    }

    // ── PEXELS ───────────────────────────────────────────────────────────
    const pexels = require("../../services/pexels");
    if (!pexels.configure()) {
        return {
            ok: false,
            raison: "PEXELS_API_KEY n'est pas posée — les campagnes qui ne parlent pas "
                  + "d'un produit n'ont aucune image à montrer",
        };
    }

    const sujet = campagnes.recherche(c.slug);
    const r = await pexels.chercher({ recherche: sujet, prefererVideo });
    if (!r.ok) return { ok: false, raison: `Pexels : ${r.erreur}`, campagne: c.slug };

    return {
        ok: true,
        campagne: c.slug,
        source: "pexels",
        repli: r.repli || null,
        // Pas de produit : cette campagne ne vend rien.
        produit: null,
        media: r.media,
        mediaType: r.mediaType,
        // Le crédit voyage AVEC le média. Les règles de Pexels demandent de
        // créditer l'auteur, et c'est la condition pour dépasser les limites
        // d'appels — ce n'est donc pas une option qu'un appelant peut oublier.
        credit: r.credit,
        recherche: sujet,
        duree: r.duree || null,
    };
}

module.exports = {
    choisir, choisirPourCampagne, couverture,
    mediasDe, lireListe, urlPubliable, FENETRE,
    enTexte, etiquettePrix,
};
