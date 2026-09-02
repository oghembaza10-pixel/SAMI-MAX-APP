// ==========================================================================
// LE CYCLE AUTOMATIQUE — CE QUI FAIT QUE « AUTO » VEUT DIRE QUELQUE CHOSE
// ==========================================================================
//
// ── LE TROU QUE CE FICHIER BOUCHE ─────────────────────────────────────────
//
// Avant lui, mettre SOCIAL_MODE=AUTO ne changeait presque rien : la chaîne
// des agents savait préparer et programmer, mais RIEN ne l'appelait toute
// seule, et `publisher.passer()` n'était branché sur aucun planificateur.
// SAMII attendait qu'un humain clique — c'est-à-dire exactement ce qu'on
// voulait arrêter de faire.
//
// Deux passages, deux rythmes différents, et c'est volontaire :
//
//   PRÉPARER   quelques fois par jour  — décide, écrit, programme
//   ENVOYER    toutes les 5 minutes    — expédie ce qui est dû
//
// Les séparer permet à un contenu programmé pour 14 h de partir à 14 h même
// si la préparation du matin a échoué, et permet de couper la préparation
// sans bloquer ce qui est déjà en file.
//
// ── LES GARDE-FOUS, ET POURQUOI ILS NE SONT PAS OPTIONNELS ────────────────
//
// En AUTO, une erreur ne s'affiche pas sur un écran : elle publie sur les
// comptes de vrais gens, plusieurs fois, sans que personne regarde. Trois
// protections, toutes réglables depuis Render sans déploiement :
//
//   SOCIAL_MAX_PAR_JOUR      combien de publications par plateforme et par
//                            jour (défaut 2 — au-delà on fatigue l'audience
//                            et on se fait limiter)
//   SOCIAL_HEURES            à quelles heures SAMII a le droit de préparer
//                            (défaut 9,14,19 — pas de post à 3 h du matin)
//   SOCIAL_AGENTS_COUPES     l'arrêt d'urgence, déjà en place
//
// Le plafond est compté sur ce qui est RÉELLEMENT parti (statut published,
// provider ≠ mock), pas sur ce qui a été programmé : une file qui gonfle
// parce que la publication échoue ne doit pas bloquer les tentatives.

const social = require("./index");
const vitrine = require("./vitrine");
const publisher = require("./agents/publisher");
const analytics = require("./agents/analytics");
const providers = require("./providers");
const plateformes = require("../../config/plateformes-sociales");
const formats = require("../../config/formats-sociaux");
const db = require("../../services/db");

// ── LES RÉGLAGES ──────────────────────────────────────────────────────────
//
// Lus à CHAQUE passage, jamais au chargement du module : baisser le plafond
// depuis Render doit agir au prochain passage, pas au prochain déploiement.
function maxParJour() {
    const n = Number(process.env.SOCIAL_MAX_PAR_JOUR);
    return Number.isFinite(n) && n >= 0 ? n : 2;
}

function heuresAutorisees() {
    const brut = String(process.env.SOCIAL_HEURES || "9,14,19").trim();
    return brut.split(",").map((s) => Number(s.trim()))
        .filter((n) => Number.isInteger(n) && n >= 0 && n <= 23);
}

function communaute() {
    return String(process.env.COMMUNAUTE_PAR_DEFAUT || "samii").trim() || "samii";
}

// Le workspace au nom duquel SAMII publie. Sans lui, le provider Meta ne
// sait pas quels connecteurs lire. Buffer n'en a pas besoin (ses comptes
// sont côté Buffer) — d'où le fait que ce ne soit pas bloquant.
function workspace() {
    return String(process.env.SOCIAL_WORKSPACE || "").trim() || null;
}

// ── COMBIEN EST DÉJÀ PARTI AUJOURD'HUI ────────────────────────────────────
async function partiesAujourdhui(plateforme) {
    try {
        const r = await db.query(
            `SELECT COUNT(*)::int AS n
               FROM social_publications
              WHERE plateforme = $1
                AND statut = 'published'
                AND COALESCE(provider,'') <> 'mock'
                AND publiee_le >= date_trunc('day', now())`,
            [plateforme]);
        return Number(r[0]?.n || 0);
    } catch (err) {
        // Compter est impossible → on considère le plafond atteint. Se
        // tromper dans ce sens ne publie rien ; se tromper dans l'autre
        // publie en boucle.
        console.warn(`⚠️ cycle social — comptage ${plateforme} impossible :`, err.message);
        return Number.MAX_SAFE_INTEGER;
    }
}

// Les plateformes qui peuvent encore recevoir quelque chose maintenant.
async function ciblesDisponibles() {
    const retenues = [];
    const ecartees = [];

    for (const p of plateformes.listeActives()) {
        // Une messagerie n'est pas un fil : on n'envoie pas une promo
        // automatique dans la boîte privée des gens sans qu'ils l'aient
        // demandé. WhatsApp et Messenger restent déclenchés à la main.
        if (p.genre !== "fil") { ecartees.push(`${p.slug} : messagerie, pas de promo automatique`); continue; }

        const { provider, raison } = providers.pour(p.slug);
        if (!provider) { ecartees.push(`${p.slug} : ${raison}`); continue; }

        const deja = await partiesAujourdhui(p.slug);
        if (deja >= maxParJour()) {
            ecartees.push(`${p.slug} : plafond atteint (${deja}/${maxParJour()} aujourd'hui)`);
            continue;
        }
        retenues.push(p.slug);
    }
    return { retenues, ecartees };
}

// ── LE PASSAGE DE PRÉPARATION ─────────────────────────────────────────────
//
// Décide, écrit, relit, programme. Ne publie jamais lui-même : c'est
// `envoyer()` qui expédie, et c'est ce qui rend le tout annulable.
async function preparer({ forcer = false } = {}) {
    const mode = social.mode();
    if (mode === "MANUAL" && !forcer) {
        return { fait: false, raison: "mode MANUAL — SAMII ne prépare rien toute seule" };
    }

    const heure = new Date().getHours();
    if (!forcer && !heuresAutorisees().includes(heure)) {
        return { fait: false, raison: `${heure} h n'est pas une heure de publication (SOCIAL_HEURES=${heuresAutorisees().join(",")})` };
    }

    const { retenues, ecartees } = await ciblesDisponibles();
    if (!retenues.length) {
        return { fait: false, raison: "aucune plateforme disponible", ecartees };
    }

    // ── LE MÉDIA D'ABORD, LE TEXTE ENSUITE ───────────────────────────────
    //
    // Dans cet ordre, et pas l'inverse. Instagram REFUSE une publication
    // sans image : écrire un texte pour découvrir ensuite qu'on n'a rien à
    // montrer, c'est brûler un appel au modèle pour rien.
    //
    // On demande une vidéo en priorité — c'est ce qui permet un reel. La
    // vitrine dit elle-même si elle a dû se rabattre sur une image.
    const choix = await vitrine.choisir({ communaute: communaute(), prefererVideo: true });
    if (!choix.ok) {
        // Sans média, il reste les plateformes qui n'en exigent pas.
        const sansMedia = retenues.filter((slug) => !plateformes.get(slug).mediaRequis);
        if (!sansMedia.length) {
            return { fait: false, raison: `aucun média disponible (${choix.raison}) et toutes les cibles en exigent un`, ecartees };
        }
        return preparerEtProgrammer({ cibles: sansMedia, media: null, mediaType: null, produit: null, ecartees, noteMedia: choix.raison });
    }

    // On ne garde que les cibles dont un format transportable accepte ce
    // média. Envoyer une vidéo à une plateforme qui n'en veut pas est un
    // échec garanti, et un échec garanti ne mérite pas d'être tenté.
    const compatibles = [];
    for (const slug of retenues) {
        const f = formats.choisir({ plateforme: slug, mediaType: choix.mediaType });
        if (f.ok) compatibles.push({ slug, format: f.format });
        else ecartees.push(`${slug} : ${f.raison}`);
    }
    if (!compatibles.length) {
        return { fait: false, raison: "aucune cible ne peut recevoir ce média", ecartees };
    }

    return preparerEtProgrammer({
        cibles: compatibles.map((c) => c.slug),
        formats: compatibles,
        media: choix.media,
        mediaType: choix.mediaType,
        produit: choix.produit,
        noteMedia: choix.repli,
        ecartees,
    });
}

async function preparerEtProgrammer({ cibles, formats: choisis, media, mediaType, produit, ecartees, noteMedia }) {
    // Le thème vient d'un vrai produit quand il y en a un : SAMII parle de
    // ce qu'elle vend, pas d'un sujet abstrait tiré au sort.
    const theme = produit
        ? `${produit.titre}${produit.prix ? ` — ${produit.prix} ${produit.devise || ""}`.trim() : ""}`
        : null;

    const prepare = await social.preparer({
        workspaceId: workspace(),
        communaute: communaute(),
        theme,
        objectif: "faire découvrir un produit disponible maintenant",
        angle: produit?.description || null,
        cibles,
        media, mediaType,
        creePar: "cycle-auto",
    });

    if (!prepare.ok) {
        return { fait: false, etape: prepare.etape, raison: prepare.erreur, doublon: prepare.doublon, ecartees };
    }
    if (!prepare.approuvees) {
        // Le relecteur a tout refusé. C'est son travail — on ne force pas.
        return {
            fait: false, postId: prepare.postId,
            raison: "le relecteur n'a approuvé aucune variante",
            variantes: prepare.variantes, ecartees,
        };
    }

    const prog = await social.programmer({ postId: prepare.postId, workspaceId: workspace() });
    return {
        fait: true,
        postId: prepare.postId,
        mode: social.mode(),
        produit: produit ? { id: produit.id, titre: produit.titre } : null,
        media, mediaType,
        formats: choisis || null,
        noteMedia: noteMedia || null,
        approuvees: prepare.approuvees,
        programmees: prog.programmees || [],
        ecartees,
    };
}

// ── LE PASSAGE D'ENVOI ────────────────────────────────────────────────────
//
// Ce que le planificateur appelle toutes les 5 minutes. En MANUAL il ne
// fait rien : une publication programmée à la main reste programmée jusqu'à
// ce que quelqu'un bascule le mode, ce qui est le sens de MANUAL.
async function envoyer() {
    if (social.mode() === "MANUAL") return { traitees: 0, raison: "mode MANUAL" };
    return publisher.passer({ limite: 20 });
}

// ── LE PASSAGE DE MESURE ──────────────────────────────────────────────────
//
// Il ne mesurera rien tant qu'aucun collecteur n'est enregistré — et il
// n'y en a aucun aujourd'hui (ni Buffer gratuit, ni Meta sans la permission
// `instagram_manage_insights`). Le brancher quand même n'est pas inutile :
// le jour où un collecteur arrive, il tourne sans qu'on y repense, et en
// attendant `couverture()` dit la vérité à l'écran.
async function mesurer({ limite = 30 } = {}) {
    try {
        const dues = await db.query(
            `SELECT id, plateforme, externe_id, workspace_id
               FROM social_publications
              WHERE statut = 'published' AND COALESCE(provider,'') <> 'mock'
                AND publiee_le > now() - interval '30 days'
              ORDER BY publiee_le DESC LIMIT $1`, [limite]);

        const faites = [];
        for (const pub of dues) {
            const r = await analytics.collecter({ publication: pub });
            if (r?.disponible) faites.push(pub.id);
        }
        return { examinees: dues.length, relevees: faites.length, couverture: analytics.couverture() };
    } catch (err) {
        return { erreur: err.message };
    }
}

// ── L'ÉTAT, POUR L'ÉCRAN ──────────────────────────────────────────────────
async function etat() {
    const { retenues, ecartees } = await ciblesDisponibles().catch(() => ({ retenues: [], ecartees: [] }));
    return {
        mode: social.mode(),
        communaute: communaute(),
        workspace: workspace(),
        maxParJour: maxParJour(),
        heures: heuresAutorisees(),
        prochainesCibles: retenues,
        ecartees,
        catalogue: await vitrine.couverture({ communaute: communaute() }),
    };
}

module.exports = {
    preparer, envoyer, mesurer, etat,
    ciblesDisponibles, partiesAujourdhui,
    maxParJour, heuresAutorisees, communaute, workspace,
};
