// ======================================================
// SAMII OS — Hub Route
// ======================================================
// Le Hub sélectionne le Workspace.
// Il ne contient aucune logique métier.
// Toute la logique est déléguée aux services.
// ======================================================

const express = require("express");
const router = express.Router();

const workspaceService = require("../services/workspaceService");
const communautes = require("../config/communautes");
// LA SOURCE UNIQUE DES MÉTIERS. Elle était déjà consommée par l'onboarding,
// l'agence et l'API ; le Hub est le dernier à la rejoindre.
const metiers = require("../services/metiers");

// ──────────────────────────────────────────────────────
// Constantes Hub
// ──────────────────────────────────────────────────────

// LA LISTE QUI VIVAIT ICI A ÉTÉ RETIRÉE, PAS DÉPLACÉE.
//
// C'étaient onze chaînes écrites à la main — « Finance », « Industrie »,
// « Agriculture », « Technologie »… — passées à la vue sous le nom `metiers`.
// Deux choses à son sujet :
//
//   1. LA VUE NE LA LISAIT PAS. views/hub.ejs construit sa grille depuis son
//      propre dictionnaire HUB_METIERS. Cette variable traversait donc le
//      serveur pour être ignorée à l'arrivée.
//   2. ELLE CONTREDISAIT LA SOURCE UNIQUE. services/metiers.js dit en toutes
//      lettres avoir retiré « agriculture, industrie, technologie, finance —
//      aucune de ces activités ne correspond au marché réellement visé ».
//      La consolidation avait vu routes/workspace.js et routes/agence.js, et
//      manqué ce fichier : les quatre secteurs abandonnés survivaient ici.
//
// On ne la remplace par rien : le Hub sert à CHOISIR un espace de travail
// existant, pas à présenter des métiers. Les métiers ont leur maison, et
// c'est services/metiers.js, servi publiquement par routes/metiers.js.

const HUB_ACTIONS = [
    {
        id: "create",
        title: "Créer mon QG",
        icon: "plus-circle",
    },
    {
        id: "collaborator",
        title: "Ajouter un collaborateur",
        icon: "users",
    },
    {
        id: "search",
        title: "Rechercher un QG",
        icon: "search",
    },
];

// ──────────────────────────────────────────────────────
// Auth middleware
// ──────────────────────────────────────────────────────

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) {
        return res.redirect("/login");
    }
    next();
}

// ──────────────────────────────────────────────────────
// GET /hub
// ──────────────────────────────────────────────────────
// ── CONSULTER LE HUB ≠ AGIR DANS LE HUB ─────────────────────────────────
//
// `requireAuth` couvrait toute la page. MESURÉ : un visiteur recevait 302
// vers /login. Or la grille des métiers ne lit AUCUNE donnée de compte —
// elle vient du registre, la même pour tout le monde. La seule chose qui
// demandait une session ici, c'est la liste des QG du visiteur.
//
// On sépare donc ce qui était confondu :
//
//     CONSULTER les métiers   → rien de personnel   → ouvert
//     LISTER ses QG           → getByOwner(email)   → vide sans session
//     SÉLECTIONNER un QG      → POST, requireAuth   → inchangé
//     CRÉER un QG             → POST, requireAuth   → inchangé
//
// Ce n'est pas un affaiblissement : aucune donnée qui était protégée ne
// devient visible. Un visiteur voit la grille et rien d'autre — `workspaces`
// reste un tableau vide, et les deux POST gardent leur garde ET leur
// contrôle de propriété (`belongsToOwner`, 403).
//
// Ça permet à quelqu'un qui n'a pas de compte de découvrir les métiers AVANT
// qu'on lui demande d'en créer un, ce qui est l'ordre naturel.
function metiersPourLAffichage(L) {
    // Le registre porte les IDENTITÉS (id, groupe, icône, parcours) ; il est
    // en français. `L` porte les TRADUCTIONS. On les marie ici plutôt que
    // d'ajouter des langues au registre : deux sources, deux rôles, aucune
    // taxonomie parallèle.
    const traduire = typeof L === "function" ? L : (t) => t;
    return metiers.parGroupe().map((g) => ({
        nom: traduire(g.nom),
        metiers: g.metiers.map((m) => ({
            id: m.id,
            label: traduire(m.label),
            groupe: traduire(g.nom),
            icone: m.icone,
        })),
    }));
}

router.get("/", async (req, res) => {
    // Un compte Client n'a rien à faire sur le Hub marchand. La règle ne
    // s'applique qu'à quelqu'un de CONNECTÉ : un visiteur n'a pas de type.
    if (req.session?.loggedIn && req.session?.typeCompte === "client") {
        return res.redirect(communautes.accueilClient(res.locals.COM));
    }

    const email = req.session?.loggedIn ? (req.session.email || "") : "";
    let workspaces = [];
    let error = null;

    try {
        workspaces = email ? await workspaceService.getByOwner(email) : [];
    } catch (err) {
        // La liste des QG est illisible : on le dit, mais on rend quand même
        // la page. Les métiers ne dépendent pas de la base — les cacher pour
        // une panne qui ne les concerne pas priverait un visiteur de la seule
        // chose qu'il venait voir.
        console.error("❌ GET /hub (workspaces) :", err.message);
        error = "Impossible de charger vos QG.";
    }

    res.render("hub", {
        workspaces,
        workspaceId: req.session?.workspaceId || "",
        lastWorkspace: req.session?.lastWorkspace || "",
        hasWorkspace: workspaces.length > 0,
        connecte: !!req.session?.loggedIn,

        // ── LES MÉTIERS VIENNENT DU REGISTRE, PLUS DE LA VUE ────────────
        //
        // `views/hub.ejs` en portait douze, écrits en dur, répétés en QUATRE
        // langues — et quatre d'entre eux (finance, technologie, agriculture,
        // industrie) étaient ceux que services/metiers.js documente avoir
        // retirés comme ne correspondant pas au marché visé. Ils survivaient
        // là parce que personne ne relit un dictionnaire de vue.
        metiersParGroupe: metiersPourLAffichage(res.locals.L),
        // Les pays du questionnaire viennent de routes/workspace.js, là où
        // la création les valide déjà. Deux listes de pays finiraient par
        // proposer un pays que la création refuse.
        pays: Object.entries(require("./workspace").PAYS_DEVISE)
            .map(([code, p]) => ({ code, label: p.label, devise: p.devise })),
        actions: HUB_ACTIONS,
        modules: [],
        error,
    });
});

// ──────────────────────────────────────────────────────
// POST /hub/select-workspace
// ──────────────────────────────────────────────────────

router.post("/select-workspace", requireAuth, async (req, res) => {

    try {

        const { workspaceId } = req.body;
        const email = req.session?.email || "";

        if (
            typeof workspaceId !== "string" ||
            workspaceId.trim() === "" ||
            !email
        ) {
            return res.status(400).json({
                success: false,
                error: "Données manquantes.",
            });
        }

        const id = workspaceId.trim();

        const isOwner = await workspaceService.belongsToOwner(id, email);

        if (!isOwner) {
            return res.status(403).json({
                success: false,
                error: "Accès refusé.",
            });
        }

        req.session.workspaceId = id;
        req.session.lastWorkspace = id;

        req.session.save(() => {
            res.json({
                success: true,
                redirect: "/qg",
            });
        });

    } catch (err) {

        console.error("❌ POST /hub/select-workspace :", err.message);

        res.status(500).json({
            success: false,
            error: "Erreur interne.",
        });

    }

});

module.exports = router;
