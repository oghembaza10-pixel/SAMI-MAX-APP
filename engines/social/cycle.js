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
const campagnes = require("../../config/campagnes-sociales");
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

// ── DE QUOI A-T-ON DÉJÀ PARLÉ AUJOURD'HUI ─────────────────────────────────
//
// Le créateur écrit `cree_par = "cycle-auto:<campagne>"` sur chaque post.
// C'est cette trace qu'on relit — pas une variable en mémoire, qui serait
// remise à zéro au premier redémarrage de Render et laisserait SAMII
// republier trois fois « rejoignez-nous » dans la même journée.
async function campagnesDuJour() {
    try {
        const r = await db.query(
            `SELECT DISTINCT cree_par FROM social_posts
              WHERE cree_par LIKE 'cycle-auto:%'
                AND created_at >= date_trunc('day', now())`);
        return r.map((x) => String(x.cree_par).split(":")[1]).filter(Boolean);
    } catch (err) {
        // Illisible : on ne bloque pas la publication pour ça. Au pire un
        // sujet revient deux fois — c'est moins grave que ne rien publier.
        console.warn("⚠️ cycle social — campagnes du jour illisibles :", err.message);
        return [];
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
            // `partiesAujourdhui` rend MAX_SAFE_INTEGER quand la base est
            // injoignable — c'est volontaire (mieux vaut ne rien publier que
            // publier en boucle). Mais l'afficher tel quel donnait
            // « plafond atteint (9007199254740991/2) », qui envoie chercher
            // un problème de quota là où il y a un problème de base.
            ecartees.push(deja === Number.MAX_SAFE_INTEGER
                ? `${p.slug} : comptage impossible (base injoignable) — publication suspendue par sécurité`
                : `${p.slug} : plafond atteint (${deja}/${maxParJour()} aujourd'hui)`);
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

    // ── DE QUOI ON PARLE AUJOURD'HUI ─────────────────────────────────────
    //
    // Avant, le cycle ne savait raconter qu'UNE chose : un produit du
    // catalogue. Un compte qui ne publie que des fiches produit ne recrute
    // personne — or SAMII a d'abord besoin qu'on la rejoigne, pas qu'on lui
    // achète un casque.
    //
    // La rotation regarde ce qui est DÉJÀ parti aujourd'hui, lu en base :
    // sans ça, le tirage sortait deux fois « rejoignez-nous » de suite un
    // jour sur trois.
    const dejaFaites = await campagnesDuJour();
    const tirage = campagnes.choisir({ dejaFaites });
    if (!tirage.ok) return { fait: false, raison: tirage.raison, ecartees };
    const campagne = tirage.campagne;

    // ── SOUS QUELLE FORME ─────────────────────────────────────────────────
    //
    // Vidéo, image, ou rien du tout. Le tirage vit dans le registre des
    // campagnes — c'est la campagne qui sait si elle supporte le texte nu.
    // Avant, la réponse était « vidéo » à tous les coups, et un fil qui
    // n'est que de la vidéo n'a plus de voix.
    const { forme, parDefaut } = campagnes.choisirForme(campagne.slug);
    if (parDefaut) ecartees.push("toutes les formes de cette campagne sont à 0 ou coupées — repli sur image");

    // ── LE TEXTE SEUL ────────────────────────────────────────────────────
    //
    // On ne va PAS chercher de média : c'est tout l'intérêt. On économise
    // l'appel Pexels, et on ne garde que les plateformes qui acceptent un
    // post sans image — Instagram, lui, refuse, et le dire ici évite un
    // échec garanti plus loin.
    if (forme === "texte") {
        const sansMedia = retenues.filter((slug) => !plateformes.get(slug).mediaRequis);
        for (const slug of retenues) {
            if (plateformes.get(slug).mediaRequis) ecartees.push(`${slug} : exige un média, or ce passage est en texte seul`);
        }
        if (!sansMedia.length) {
            return { fait: false, campagne: campagne.slug, forme,
                     raison: "passage en texte seul, mais toutes les cibles exigent un média", ecartees };
        }
        return preparerEtProgrammer({ campagne, forme, cibles: sansMedia, media: null, mediaType: null,
                                      produit: null, ecartees });
    }

    // ── LE MÉDIA D'ABORD, LE TEXTE ENSUITE ───────────────────────────────
    //
    // Dans cet ordre, et pas l'inverse. Instagram REFUSE une publication
    // sans image : écrire un texte pour découvrir ensuite qu'on n'a rien à
    // montrer, c'est brûler un appel au modèle pour rien.
    //
    // Le catalogue n'a AUCUNE vidéo (vérifié : 0 sur 203 annonces), Pexels
    // si. C'est la campagne qui dit où chercher, pas ce code-ci.
    const choix = await vitrine.choisirPourCampagne({
        campagne: campagne.slug, communaute: communaute(), prefererVideo: forme === "video",
    });
    if (!choix.ok) {
        // Sans média, il reste les plateformes qui n'en exigent pas.
        const sansMedia = retenues.filter((slug) => !plateformes.get(slug).mediaRequis);
        if (!sansMedia.length) {
            return { fait: false, campagne: campagne.slug,
                     raison: `aucun média disponible (${choix.raison}) et toutes les cibles en exigent un`,
                     ecartees };
        }
        return preparerEtProgrammer({ campagne, forme, cibles: sansMedia, media: null, mediaType: null,
                                      produit: null, ecartees, noteMedia: choix.raison });
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
        campagne,
        forme,
        cibles: compatibles.map((c) => c.slug),
        formats: compatibles,
        media: choix.media,
        mediaType: choix.mediaType,
        produit: choix.produit,
        credit: choix.credit || null,
        source: choix.source,
        recherche: choix.recherche || null,
        noteMedia: choix.repli,
        ecartees,
    });
}

async function preparerEtProgrammer({ campagne, forme, cibles, formats: choisis, media, mediaType,
                                      produit, credit, source, recherche, ecartees, noteMedia }) {
    // Le thème vient d'un vrai produit quand il y en a un : SAMII parle de
    // ce qu'elle vend, pas d'un sujet abstrait tiré au sort. Sinon c'est la
    // campagne qui donne le sujet.
    // Le prix vient déjà formaté de la vitrine (`prixAffiche`) : recoller la
    // devise ici produisait « 12.94 EUR EUR », parce que `annonces.prix` est
    // du texte qui la contient déjà. La règle est chez la vitrine, qui
    // connaît la colonne ; ici on se contente de l'afficher.
    const etiquette = produit?.prixAffiche
        || (produit ? vitrine.etiquettePrix(produit.prix, produit.devise) : null);
    const theme = produit
        ? `${produit.titre}${etiquette ? ` — ${etiquette}` : ""}`
        : campagne?.nom || null;

    const prepare = await social.preparer({
        workspaceId: workspace(),
        communaute: communaute(),
        theme,
        objectif: campagne?.objectif || "faire découvrir un produit disponible maintenant",
        angle: produit?.description || campagne?.angle || null,
        // L'appel à l'action est écrit dans la campagne : « Crée ton QG
        // gratuitement » n'est pas au modèle de l'inventer à chaque passage.
        cta: campagne?.cta || null,
        ctaImpose: campagne?.cta || null,
        cibles,
        media, mediaType, credit,
        creePar: `cycle-auto:${campagne?.slug || "produit"}`,
        // La forme voyage jusqu'au créateur : un texte seul ne s'écrit pas
        // comme une légende sous une vidéo.
        forme: forme || null,
    });

    if (!prepare.ok) {
        return { fait: false, forme: forme || null, etape: prepare.etape,
                 raison: prepare.erreur, doublon: prepare.doublon, ecartees };
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
        campagne: campagne?.slug || null,
        forme: forme || null,
        source: source || null,
        recherche: recherche || null,
        credit: credit?.ligne || null,
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
            // ── LE NOM DU PARAMÈTRE NE CORRESPONDAIT PAS ─────────────────
            //
            // On passait `{ publication: pub }`, l'agent attend
            // `{ publicationId }`. JavaScript ne dit rien : l'agent recevait
            // `undefined` et refusait poliment —
            //
            //     analytics / erreur : « publication undefined introuvable »
            //
            // Six fois toutes les six heures, depuis la mise en service.
            // Résultat : la boucle d'apprentissage n'a JAMAIS relevé une
            // seule statistique. La fonctionnalité entière était morte, et
            // le seul symptôme était une ligne d'erreur que personne ne
            // relisait — le mot « undefined » au milieu d'une phrase
            // française aurait dû sauter aux yeux.
            const r = await analytics.collecter({ publicationId: pub.id });
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
        // De quoi SAMII parle, et de quoi elle a déjà parlé aujourd'hui.
        campagnes: campagnes.listeActives().map((c) => ({
            slug: c.slug, nom: c.nom, source: c.source, poids: c.poids,
        })),
        campagnesDuJour: await campagnesDuJour().catch(() => []),
        pexels: await require("../../services/pexels").etat().catch((e) => ({ erreur: e.message })),
        catalogue: await vitrine.couverture({ communaute: communaute() }),
    };
}

module.exports = {
    preparer, envoyer, mesurer, etat, campagnesDuJour,
    ciblesDisponibles, partiesAujourdhui,
    maxParJour, heuresAutorisees, communaute, workspace,
};
