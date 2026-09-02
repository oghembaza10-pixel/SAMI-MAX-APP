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
// Une plateforme peut avoir PLUSIEURS providers réels — Facebook peut
// passer par Buffer ou par Meta en direct. On garde donc une liste, dans
// l'ordre d'enregistrement, et le premier qui se déclare prêt gagne.
const PROVIDERS = {};

function enregistrer(provider) {
    if (!provider || !provider.nom || typeof provider.publier !== "function") {
        throw new Error("Provider invalide : il faut au moins { nom, publier() }");
    }
    for (const slug of provider.plateformes || []) {
        if (!PROVIDERS[slug]) PROVIDERS[slug] = [];
        PROVIDERS[slug].push(provider);
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

    // ── QUAND DEUX PROVIDERS SAVENT FAIRE LA MÊME CHOSE ──────────────────
    //
    // Facebook et Instagram ont deux chemins : Buffer, et Meta en direct.
    //
    // Meta en direct EXIGE `pages_manage_posts`, qui n'est pas accordée —
    // il échouerait sur une erreur de permission. Buffer, lui, publie
    // aujourd'hui. Le premier provider PRÊT gagne donc, et l'ordre
    // d'enregistrement en bas de ce fichier place Buffer devant.
    //
    // « Prêt » se demande au provider lui-même (`configure()`), jamais
    // deviné ici : c'est lui qui sait s'il a son jeton.
    //
    // Le jour où Meta accorde la permission, on retire Buffer de la liste
    // ou on inverse l'ordre — sans toucher aux agents ni au publieur.
    const candidats = PROVIDERS[propre] || [];
    if (!candidats.length) return { provider: mock, raison: `aucun provider réel pour ${propre} — simulation` };

    const pret = candidats.find((p) => typeof p.configure !== "function" || p.configure());
    if (!pret) {
        return {
            provider: mock,
            raison: `aucun provider configuré pour ${propre} `
                  + `(${candidats.map((p) => p.nom).join(", ")}) — simulation`,
        };
    }
    // Quand un provider est écarté parce qu'il n'est pas configuré, on le
    // DIT : « Buffer non configuré, on passe par Meta » est une information
    // qui évite une heure de recherche.
    const ecartes = candidats.slice(0, candidats.indexOf(pret)).map((p) => p.nom);
    return {
        provider: pret,
        raison: ecartes.length ? `${ecartes.join(", ")} non configuré(s), ${pret.nom} prend la main` : null,
    };
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
                // Tous les candidats, dans l'ordre, avec celui qui est prêt.
                providersReels: (PROVIDERS[p.slug] || []).map((x) => ({
                    nom: x.nom,
                    configure: typeof x.configure !== "function" ? true : x.configure(),
                })),
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
// ── L'ORDRE COMPTE ────────────────────────────────────────────────────────
//
// Buffer EN PREMIER pour Facebook, Instagram, LinkedIn et TikTok : c'est le
// seul chemin qui publie réellement aujourd'hui, Meta n'ayant pas accordé
// `pages_manage_posts`.
//
// Meta ensuite, en second : il reprendra la main tout seul le jour où
// BUFFER_ACCESS_TOKEN est retirée, sans qu'on touche à une ligne de code.
enregistrer(require("./buffer"));
enregistrer(require("./meta"));
// Ces deux-là n'ont pas de concurrent : SAMII les fait elle-même, et Buffer
// ne les gère pas.
enregistrer(require("./telegram"));
enregistrer(require("./whatsapp"));

module.exports = { enregistrer, publier, pour, etat, publicationReelleAutorisee, PROVIDERS };
