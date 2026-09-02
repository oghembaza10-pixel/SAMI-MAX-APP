// ==========================================================================
// L'INTERFACE PROVIDER — LE SEUL ENDROIT QUI SAIT PARLER AUX PLATEFORMES
// ==========================================================================
//
// ── LA RÈGLE, ET ELLE EST LA RAISON D'ÊTRE DE CE FICHIER ─────────────────
//
// « Ne couple PAS SAMII directement à Buffer. »
//
// Le Publisher ne connaît AUCUNE plateforme. Il connaît un contrat :
//
//     publier({ plateforme, texte, media, workspaceId }) → { ok, id, url, erreur }
//
// C'est tout. Le jour où Buffer arrive, il devient un provider de plus dans
// ce fichier, et RIEN d'autre ne bouge : ni les agents, ni le publieur, ni
// la base, ni l'interface. C'est le test à faire passer à toute
// modification ici — « est-ce que Buffer resterait un simple ajout ? »
//
// ── CE QU'ON NE REFAIT PAS ────────────────────────────────────────────────
//
// SAMII sait DÉJÀ publier sur Facebook, Instagram, Telegram et WhatsApp.
// Ce code existe, il tourne en production, il a été débogué. Les providers
// ci-dessous l'APPELLENT — ils ne réécrivent pas un client HTTP vers Meta.
//
//     engines/pageEngine.js      nos pages Facebook / Instagram
//     engines/autopostEngine.js  les pages d'un marchand
//     engines/canalEngine.js     le canal Telegram SAMII
//     services/telegramService   l'envoi Telegram
//     services/whatsapp          l'envoi WhatsApp (Green API)
//     services/facebook          Messenger (message, PAS un post)
//
// Réécrire tout ça aurait créé une deuxième version de chaque appel — et
// une deuxième version diverge toujours de la première.
//
// ── AUCUNE PUBLICATION RÉELLE POUR L'INSTANT ──────────────────────────────
//
// « Pour l'instant utiliser des MOCKS. AUCUNE publication réelle. »
//
// Tant que SOCIAL_PUBLICATION_REELLE n'est pas explicitement à "oui", TOUT
// passe par le provider `mock` — y compris pour les plateformes réellement
// branchées. La bascule est une variable d'environnement, pas une
// modification de code : on ne publie pas par accident parce qu'un
// déploiement est parti.

const plateformes = require("../../../config/plateformes-sociales");

// ── LE REGISTRE ───────────────────────────────────────────────────────────
//
// `plateforme → provider`. Un provider peut servir plusieurs plateformes
// (Meta couvre Facebook, Instagram et Messenger) : c'est exactement ce que
// fera Buffer, qui les couvrira presque toutes.
const PROVIDERS = {};

function enregistrer(provider) {
    if (!provider || !provider.nom || typeof provider.publier !== "function") {
        throw new Error("Provider invalide : il faut au moins { nom, publier() }");
    }
    for (const slug of provider.plateformes || []) {
        PROVIDERS[slug] = provider;
    }
    return provider;
}

// ── LA BASCULE ────────────────────────────────────────────────────────────
//
// Volontairement lue à CHAQUE appel, pas au chargement du module : couper
// les publications réelles depuis Render doit prendre effet au prochain
// redémarrage, pas au prochain déploiement de code.
function publicationReelleAutorisee() {
    return String(process.env.SOCIAL_PUBLICATION_REELLE || "").trim().toLowerCase() === "oui";
}

// Quel provider va réellement traiter cette plateforme, ici et maintenant.
// Cette fonction est la seule à décider — les agents ne doivent jamais
// deviner s'ils sont en simulation.
function pour(slug) {
    const propre = String(slug || "").toLowerCase();
    const mock = require("./mock");

    if (!plateformes.existe(propre)) return { provider: null, raison: `plateforme inconnue : ${propre}` };
    if (plateformes.estCoupee(propre)) return { provider: null, raison: `${propre} est coupée (SOCIAL_PLATEFORMES_COUPEES)` };
    if (!publicationReelleAutorisee()) return { provider: mock, raison: "simulation (SOCIAL_PUBLICATION_REELLE ≠ oui)" };

    const reel = PROVIDERS[propre];
    if (!reel) return { provider: mock, raison: `aucun provider réel pour ${propre} — simulation` };
    return { provider: reel, raison: null };
}

// ── PUBLIER ───────────────────────────────────────────────────────────────
//
// Le contrat, dans les deux sens. Un provider ne LÈVE JAMAIS : il rend
// `{ ok: false, erreur }`. Une exception qui remonte ici ferait tomber le
// planificateur, et une plateforme en panne arrêterait la publication sur
// toutes les autres.
async function publier({ plateforme, texte, media, mediaType, workspaceId, variantId }) {
    const { provider, raison } = pour(plateforme);
    if (!provider) return { ok: false, provider: null, erreur: raison };

    const debut = Date.now();
    try {
        const resultat = await provider.publier({
            plateforme, texte, media, mediaType, workspaceId, variantId,
        });
        return {
            ok: !!resultat?.ok,
            provider: provider.nom,
            simulation: provider.nom === "mock",
            note: raison,
            id: resultat?.id || null,
            url: resultat?.url || null,
            erreur: resultat?.ok ? null : (resultat?.erreur || "échec sans motif"),
            dureeMs: Date.now() - debut,
        };
    } catch (err) {
        // Un provider qui lève est un provider mal écrit — mais ce n'est pas
        // une raison pour que la publication des six autres plateformes
        // s'arrête. On note et on continue.
        console.error(`❌ Provider ${provider.nom} a levé :`, err.message);
        return {
            ok: false, provider: provider.nom, simulation: provider.nom === "mock",
            erreur: err.message, dureeMs: Date.now() - debut,
        };
    }
}

// Ce que l'interface montre au fondateur : qui est branché, qui ne l'est
// pas, et si on est en simulation. Sans cette page, « pourquoi ça n'a pas
// publié » ne se répond qu'en lisant le code.
function etat() {
    return {
        publicationReelle: publicationReelleAutorisee(),
        plateformes: plateformes.liste().map((p) => {
            const { provider, raison } = pour(p.slug);
            return {
                slug: p.slug,
                nom: p.nom,
                genre: p.genre,
                coupee: plateformes.estCoupee(p.slug),
                providerReel: PROVIDERS[p.slug]?.nom || null,
                providerUtilise: provider?.nom || null,
                note: raison,
            };
        }),
    };
}

// ── LES PROVIDERS LIVRÉS ──────────────────────────────────────────────────
//
// L'ordre n'a pas d'importance : chacun déclare les plateformes qu'il
// couvre. TikTok et LinkedIn n'en ont pas — c'est volontaire et visible :
// `etat()` les montrera sans provider réel, ce qui est la vérité.
enregistrer(require("./meta"));
enregistrer(require("./telegram"));
enregistrer(require("./whatsapp"));

module.exports = { enregistrer, publier, pour, etat, publicationReelleAutorisee, PROVIDERS };
