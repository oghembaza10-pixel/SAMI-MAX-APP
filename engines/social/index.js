// ==========================================================================
// LA CHAÎNE DES AGENTS SOCIAUX
// ==========================================================================
//
//   SAMII CORE
//      ↓
//   STRATÈGE        quoi dire, où, quand
//      ↓
//   CRÉATEUR        le contenu source, une fois
//      ↓
//   ADAPTATEUR      une version par plateforme
//      ↓
//   RELECTEUR       approuve ou refuse, variante par variante
//      ↓
//   PUBLIEUR        programme et envoie
//      ↓
//   PROVIDER        parle à la plateforme
//
// ── LES TROIS MODES ───────────────────────────────────────────────────────
//
//   MANUAL      SAMII prépare, s'arrête, attend une validation humaine.
//   SEMI_AUTO   SAMII prépare et PROGRAMME. Rien ne part avant l'heure dite,
//               et on peut tout annuler d'ici là.
//   AUTO        SAMII prépare, programme, publie et analyse.
//
// Par défaut MANUAL, et AUTO n'est PAS activé — comme demandé. Le mode se
// lit dans `SOCIAL_MODE`, mais AUTO exige EN PLUS `SOCIAL_AUTO_CONFIRME=oui`.
// Deux verrous, parce qu'une variable qu'on peut changer d'un clic finit
// changée par erreur, et qu'ici l'erreur publie sur les comptes de vrais
// gens.

const strategist = require("./agents/strategist");
const creator = require("./agents/creator");
const adapter = require("./agents/adapter");
const reviewer = require("./agents/reviewer");
const publisher = require("./agents/publisher");
const analytics = require("./agents/analytics");
const learning = require("./agents/learning");
const providers = require("./providers");
const store = require("../../services/socialStore");
const plateformes = require("../../config/plateformes-sociales");

// ── LES COLLECTEURS, BRANCHÉS AU CHARGEMENT ───────────────────────────────
//
// `analytics.COLLECTEURS` était vide, donc `social_analytics` restait vide,
// donc l'agent d'apprentissage restait sous son seuil de 5 relevés et
// refusait éternellement de conclure. Il était honnête et définitivement
// muet. Cette ligne est ce qui lui donne de quoi apprendre.
require("./collecteurs").brancher(analytics);

const AGENTS = { strategist, creator, adapter, reviewer, publisher, analytics, learning };

// ── LE MODE ───────────────────────────────────────────────────────────────
function mode() {
    const demande = String(process.env.SOCIAL_MODE || "MANUAL").trim().toUpperCase();
    if (!store.MODES.includes(demande)) return "MANUAL";
    // Le deuxième verrou. Sans lui, AUTO retombe sur SEMI_AUTO : SAMII
    // prépare et programme, mais rien ne part tout seul.
    if (demande === "AUTO" && String(process.env.SOCIAL_AUTO_CONFIRME || "").toLowerCase() !== "oui") {
        return "SEMI_AUTO";
    }
    return demande;
}

// ── PRÉPARER UN POST DE BOUT EN BOUT ──────────────────────────────────────
//
// Ne publie JAMAIS, quel que soit le mode. Publier est une décision
// distincte, prise par `publier()` ou par le planificateur — c'est ce qui
// permet de faire tourner toute la chaîne sans risque.
async function preparer({ workspaceId, communaute, theme, objectif, angle, cibles, media, mediaType, credit, cta, ctaImpose, creePar } = {}) {
    const etapes = [];

    // 1. CRÉER
    const contenu = await creator.creer({ workspaceId, theme, objectif, angle });
    etapes.push({ agent: "creator", ok: contenu.ok, erreur: contenu.erreur });
    if (!contenu.ok) return { ok: false, etape: "creator", erreur: contenu.erreur, etapes };

    // 2. ENREGISTRER — avant l'adaptation, pour que le travail du créateur
    //    survive à un échec plus loin dans la chaîne.
    const cree = await store.creerPost({
        workspaceId, communaute, titre: contenu.titre, contenu: contenu.contenu,
        objectif, theme, mode: mode(), creePar,
    });
    if (!cree.ok) return { ok: false, etape: "enregistrement", erreur: cree.erreur, doublon: cree.doublon, etapes };
    const post = cree.post;

    // 3. ADAPTER
    const adapte = await adapter.adapter({
        workspaceId, postId: post.id,
        contenu: contenu.contenu, hook: contenu.hook, cta: contenu.cta,
        hashtags: contenu.hashtags, cibles, media, mediaType,
        // L'appel à l'action vient de la campagne quand elle en impose un :
        // « Crée ton QG gratuitement » n'est pas au modèle de l'inventer.
        cta: cta || contenu.cta,
        // Imposé par la campagne : l'adaptateur ne le laissera pas réécrire.
        ctaImpose,
        // Le crédit du média voyage jusqu'à l'adaptateur, qui le pose dans
        // CHAQUE variante avant la relecture.
        credit,
    });
    etapes.push({ agent: "adapter", ok: adapte.ok, erreur: adapte.erreur, alertes: adapte.alertes });
    if (!adapte.ok) {
        await store.majStatutPost(post.id, "failed");
        return { ok: false, etape: "adapter", erreur: adapte.erreur, postId: post.id, etapes };
    }

    // 4. RELIRE — chaque variante indépendamment. Une variante refusée sur
    //    Instagram ne doit pas empêcher celle de LinkedIn de partir.
    const variantes = await store.listerVariantes(post.id);
    const revues = [];
    for (const v of variantes) {
        const r = await reviewer.relire({ workspaceId, postId: post.id, variante: v });
        const approuve = r.ok && r.approuve;
        await store.majVariante(v.id, {
            statut: approuve ? "approved" : "review",
            revue: { verdict: r.verdict, bloquants: r.bloquants, remarques: r.remarques, avisIA: r.avisIA },
        });
        revues.push({
            variantId: v.id, plateforme: v.plateforme, approuve,
            bloquants: r.bloquants || [], remarques: r.remarques || [],
        });
    }
    etapes.push({ agent: "reviewer", ok: true, approuvees: revues.filter((r) => r.approuve).length, sur: revues.length });

    const approuvees = revues.filter((r) => r.approuve);
    await store.majStatutPost(post.id, approuvees.length ? "approved" : "review");

    return {
        ok: true, postId: post.id, mode: mode(),
        titre: post.titre, contenu: contenu.contenu,
        variantes: revues,
        approuvees: approuvees.length,
        // Ce que le mode implique pour la suite, dit explicitement : c'est ce
        // que l'écran affichera à celui qui vient de lancer la préparation.
        suite: mode() === "MANUAL"
            ? "MANUAL : rien ne partira sans validation humaine."
            : "SEMI_AUTO/AUTO : les variantes approuvées peuvent être programmées.",
        etapes,
    };
}

// ── PROGRAMMER CE QUI EST APPROUVÉ ────────────────────────────────────────
//
// En MANUAL, refuse : c'est tout l'intérêt du mode.
async function programmer({ postId, quand, workspaceId, force = false } = {}) {
    if (mode() === "MANUAL" && !force) {
        return {
            ok: false,
            erreur: "mode MANUAL : la programmation demande une validation humaine explicite",
        };
    }
    const variantes = await store.listerVariantes(postId);
    const approuvees = variantes.filter((v) => v.statut === "approved");
    if (!approuvees.length) return { ok: false, erreur: "aucune variante approuvée sur ce post" };

    const programmees = [];
    for (const v of approuvees) {
        const r = await publisher.programmer({
            workspaceId, variantId: v.id, plateforme: v.plateforme, quand,
        });
        programmees.push({ plateforme: v.plateforme, ok: r.ok, publicationId: r.publicationId, erreur: r.erreur });
    }
    await store.majStatutPost(postId, "scheduled");
    return { ok: true, programmees, mode: mode() };
}

// ── LE PASSAGE PÉRIODIQUE ─────────────────────────────────────────────────
//
// À brancher sur le planificateur du noyau quand on le décidera. Il n'est
// PAS branché aujourd'hui : rien ne tourne tout seul tant que personne ne
// l'a demandé.
async function passer() {
    return publisher.passer({ limite: 20 });
}

// ── L'ÉTAT, POUR L'ÉCRAN ──────────────────────────────────────────────────
function etat() {
    const base = require("./agents/base");
    return {
        mode: mode(),
        modeDemande: String(process.env.SOCIAL_MODE || "MANUAL").toUpperCase(),
        autoConfirme: String(process.env.SOCIAL_AUTO_CONFIRME || "").toLowerCase() === "oui",
        agents: Object.keys(AGENTS).map((nom) => ({ nom, coupe: base.estCoupe(nom) })),
        plateformes: plateformes.liste().map((p) => ({
            slug: p.slug, nom: p.nom, genre: p.genre, coupee: plateformes.estCoupee(p.slug),
        })),
        publication: providers.etat(),
        statuts: store.STATUTS,
    };
}

module.exports = {
    AGENTS, strategist, creator, adapter, reviewer, publisher, analytics, learning,
    preparer, programmer, passer, mode, etat,
};
