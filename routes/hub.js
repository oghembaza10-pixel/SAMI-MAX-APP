// ======================================================
// SAMII OS — Hub Route
// ======================================================
// Le Hub sélectionne le Workspace.
// Il ne connaît pas Shopify, Telegram, ou tout autre
// connecteur. Il utilise uniquement workspaceService.
// ======================================================

const express = require("express");
const router = express.Router();
const workspaceService = require("../services/workspaceService");

// ── Auth middleware ───────────────────────────────────
function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

// ── GET /hub ──────────────────────────────────────────
router.get("/", requireAuth, async (req, res) => {
    try {
        const email = req.session?.email || "";

        const workspaces = email
            ? await workspaceService.getByOwner(email)
            : [];

        res.render("hub", {
            workspaces,
            workspaceId: req.session?.workspaceId || "",
            modules: [],
            error: null,
        });

    } catch (err) {
        console.error("❌ GET /hub :", err.message);

        res.status(500).render("hub", {
            workspaces: [],
            workspaceId: req.session?.workspaceId || "",
            modules: [],
            error: "Impossible de charger vos workspaces.",
        });
    }
});

// ── POST /hub/select-workspace ────────────────────────
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

        // Vérifie que le workspace appartient bien à l'utilisateur
        const isOwner = await workspaceService.belongsToOwner(id, email);

        if (!isOwner) {
            return res.status(403).json({
                success: false,
                error: "Accès refusé.",
            });
        }

        // Sauvegarde du workspace dans la session
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
