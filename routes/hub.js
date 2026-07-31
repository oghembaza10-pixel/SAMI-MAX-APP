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

// ──────────────────────────────────────────────────────
// Constantes Hub
// ──────────────────────────────────────────────────────

const METIERS = [
    "E-commerce",
    "Restaurant",
    "Immobilier",
    "Santé",
    "Éducation",
    "Finance",
    "Industrie",
    "Agriculture",
    "Tourisme",
    "Services",
    "Technologie"
];

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
            return res.redirect("/client-qg");
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

            metiers: METIERS,
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

            metiers: METIERS,
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
