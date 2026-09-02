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
    // ── DEUX QUESTIONS, PAS UNE ──────────────────────────────────────────
    //
    // `configure()` : « as-tu ton jeton ? »
    // `sert(slug)`  : « vas-tu traiter CETTE plateforme-là ? »
    //
    // Buffer a son jeton mais peut être volontairement écarté de Facebook
    // (BUFFER_PLATEFORMES). Sans la seconde question, l'écran du fondateur
    // annonçait « facebook → buffer » alors que Facebook partait chez Meta.
    // Un écran qui ment sur le chemin coûte une heure de recherche le jour
    // où une publication manque.
    const pretEtSert = (p, slug) =>
        (typeof p.configure !== "function" || p.configure())
        && (typeof p.sert !== "function" || p.sert(slug));

    // « Pas de jeton » et « écarté exprès » sont deux situations
    // différentes : la première se répare, la seconde a été décidée. Les
    // confondre enverrait chercher un jeton qui est déjà là.
    const pourquoiEcarte = (p, slug) => {
        if (typeof p.configure === "function" && !p.configure()) return `${p.nom} non configuré`;
        if (typeof p.sert === "function" && !p.sert(slug)) {
            // Le provider explique lui-même, s'il sait — « BUFFER_PLATEFORMES=
            // instagram » se corrige, « écarté exprès » laisse chercher.
            return typeof p.motifEcart === "function"
                ? `${p.nom} : ${p.motifEcart(slug)}`
                : `${p.nom} écarté de ${slug} exprès`;
        }
        return p.nom;
    };

    // ── ICI, SIMULER SERAIT UN MENSONGE ──────────────────────────────────
    //
    // À ce point, SOCIAL_PUBLICATION_REELLE vaut « oui » : quelqu'un a
    // explicitement demandé que ça parte. Retomber sur le mock écrivait
    // alors `social_publications.statut = 'published'` pour un contenu qui
    // n'a jamais quitté le serveur.
    //
    // Trouvé en restreignant Buffer à Instagram : LinkedIn n'avait plus
    // aucun chemin, et se déclarait publié. On REFUSE, en nommant la raison.
    // Une publication manquante qui le dit se répare ; une publication
    // fantôme se découvre des semaines plus tard.
    const candidats = PROVIDERS[propre] || [];
    if (!candidats.length) {
        return { provider: null, raison: `aucun provider réel pour ${propre} — rien n'a été publié` };
    }

    const pret = candidats.find((p) => pretEtSert(p, propre));
    if (!pret) {
        return {
            provider: null,
            raison: `aucun provider ne prend ${propre} `
                  + `(${candidats.map((p) => pourquoiEcarte(p, propre)).join(", ")}) — rien n'a été publié`,
        };
    }
    // Quand un provider est écarté parce qu'il n'est pas configuré, on le
    // DIT : « Buffer non configuré, on passe par Meta » est une information
    // qui évite une heure de recherche.
    const ecartes = candidats.slice(0, candidats.indexOf(pret)).map((p) => pourquoiEcarte(p, propre));
    return {
        provider: pret,
        // Tous ceux qui sont prêts ET qui servent cette plateforme, dans
        // l'ordre. `publier()` s'en sert pour essayer le suivant quand le
        // premier dit « je ne sers pas cette plateforme-là » — voir plus bas.
        candidats: candidats.filter((p) => pretEtSert(p, propre)),
        raison: ecartes.length ? `${ecartes.join(", ")} — ${pret.nom} prend la main` : null,
    };
}

// ── PUBLIER ───────────────────────────────────────────────────────────────
//
// Le contrat, dans les deux sens. Un provider ne LÈVE JAMAIS : il rend
// `{ ok: false, erreur }`. Une exception qui remonte ici ferait tomber le
// planificateur, et une plateforme en panne arrêterait la publication sur
// toutes les autres.
// ── « JE NE SERS PAS CETTE PLATEFORME-LÀ » N'EST PAS UN ÉCHEC ────────────
//
// Vu sur le compte Buffer réel d'OG Technology : trois chaînes connectées
// (LinkedIn page, LinkedIn profil, Instagram) et AUCUN Facebook — le plan
// gratuit est plafonné à trois.
//
// Buffer est donc « configuré » (il a son jeton) mais incapable de servir
// Facebook. Sans ce qui suit, il échouait et Meta — le second candidat —
// n'avait jamais sa chance. On ne voyait qu'une moitié du problème.
//
// Un provider peut maintenant rendre `passeLaMain: true` pour dire « ce
// n'est pas un échec de publication, c'est que je ne couvre pas cette
// plateforme ». Le suivant est alors essayé, et si tous refusent, l'erreur
// finale les nomme TOUS — parce que « pourquoi Facebook ne part pas » a
// deux raisons aujourd'hui, pas une.
async function publier({ plateforme, texte, media, mediaType, workspaceId, variantId }) {
    const { provider, candidats, raison } = pour(plateforme);
    if (!provider) return { ok: false, provider: null, erreur: raison };

    // La simulation et les plateformes à un seul provider ne bouclent pas.
    const aEssayer = (candidats && candidats.length) ? candidats : [provider];
    const debut = Date.now();
    const refus = [];

    for (const p of aEssayer) {
        try {
            const resultat = await p.publier({
                plateforme, texte, media, mediaType, workspaceId, variantId,
            });
            if (resultat?.ok) {
                return {
                    ok: true, provider: p.nom, simulation: p.nom === "mock", note: raison,
                    id: resultat.id || null, url: resultat.url || null,
                    erreur: null, dureeMs: Date.now() - debut,
                };
            }
            refus.push(`${p.nom} : ${resultat?.erreur || "échec sans motif"}`);
            // Un vrai échec de publication s'arrête là : réessayer chez le
            // voisin publierait peut-être DEUX FOIS le même contenu.
            if (!resultat?.passeLaMain) break;
        } catch (err) {
            // Un provider qui lève est mal écrit — ce n'est pas une raison
            // pour que les six autres plateformes s'arrêtent.
            console.error(`❌ Provider ${p.nom} a levé :`, err.message);
            refus.push(`${p.nom} : ${err.message}`);
            break;
        }
    }

    return {
        ok: false,
        provider: aEssayer[0]?.nom || null,
        simulation: aEssayer[0]?.nom === "mock",
        note: raison,
        erreur: refus.join(" · ") || "échec sans motif",
        dureeMs: Date.now() - debut,
    };
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
                    // Configuré mais écarté exprès de cette plateforme-là :
                    // sans ce champ, l'écran montre « buffer ✅ » en face de
                    // Facebook alors que Facebook part chez Meta.
                    sert: typeof x.sert !== "function" ? true : x.sert(p.slug),
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
