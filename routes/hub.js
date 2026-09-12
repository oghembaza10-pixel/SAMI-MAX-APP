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
router.get("/", requireAuth, async (req, res) => {
    try {
        // ✅ Un compte Client n'a rien à faire sur le Hub marchand — redirection directe
        if (req.session?.typeCompte === "client") {
            return res.redirect(communautes.accueilClient(res.locals.COM));
        }

        const email = req.session?.email || "";

        const workspaces = email
            ? await workspaceService.getByOwner(email)
            : [];


        res.render("hub", {
            workspaces,
            workspaceId: req.session?.workspaceId || "",
            lastWorkspace: req.session?.lastWorkspace || "",
            hasWorkspace: workspaces.length > 0,

            // `metiers` n'est plus passée : la vue ne l'a jamais lue (voir en-tête).
            actions: HUB_ACTIONS,

            modules: [],
            error: null,
        });

    } catch (err) {

        console.error("❌ GET /hub :", err.message);

        res.status(500).render("hub", {
            workspaces: [],
            workspaceId: "",
            lastWorkspace: "",
            hasWorkspace: false,

            // `metiers` n'est plus passée : la vue ne l'a jamais lue (voir en-tête).
            actions: HUB_ACTIONS,

            modules: [],
            error: "Impossible de charger vos QG.",
        });
    }
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
