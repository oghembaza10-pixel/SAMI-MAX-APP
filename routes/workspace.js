// ======================================================
// SAMII OS — Workspace Routes
// ======================================================
// Création et gestion des Workspaces.
// Séparé de hub.js — responsabilité unique.
// ======================================================

const express          = require("express");
const router           = express.Router();
const crypto           = require("crypto");
const workspaceService = require("../services/workspaceService");

// ── Auth middleware ───────────────────────────────────
function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

// ── Générer un workspace_id unique ────────────────────
function generateWorkspaceId() {
    return `WS-${crypto.randomUUID()}`;
}

// ── GET /workspace/create ─────────────────────────────
router.get("/create", requireAuth, (req, res) => {
    res.render("workspace-create", {
        metier : req.query.metier || "",
        error  : null,
    });
});

// ── POST /workspace/create ────────────────────────────
router.post("/create", requireAuth, async (req, res) => {
    try {
        const { nom, metier, metierCustom, pays, langue } = req.body;
        const email = req.session?.email || "";

        // ✅ Validation nom
        if (!nom || !nom.trim()) {
            return res.render("workspace-create", {
                metier : metier || "",
                error  : "Le nom du workspace est obligatoire.",
            });
        }

        // ✅ Validation métier
        if (!metier || !metier.trim()) {
            return res.render("workspace-create", {
                metier : "",
                error  : "Le métier est obligatoire.",
            });
        }

        // ✅ Résoudre le métier final
        let metierFinal = metier.trim();

        if (metierFinal === "autre") {
            const custom = metierCustom?.trim() || "";
            if (!custom) {
                return res.render("workspace-create", {
                    metier : "autre",
                    error  : "Précisez votre métier.",
                });
            }
            metierFinal = custom.toLowerCase();
        }

        // ✅ Générer un ID unique
        const workspaceId = generateWorkspaceId();

        // ✅ Créer via workspaceService
        const workspace = await workspaceService.create({
            workspaceId,
            owner       : email,
            nom         : nom.trim(),
            metier      : metierFinal,
            pays        : pays   || "DZ",
            langue      : langue || "fr",
            logo        : "",
            connecteurs : [],
            samii       : {
                mode    : "auto",
                version : "soldat-v1",
                profile : null,
            },
        });

        if (!workspace) {
            return res.render("workspace-create", {
                metier : metier || "",
                error  : "Erreur lors de la création. Réessayez.",
            });
        }

        // ✅ Session légère
        req.session.workspaceId   = workspace.workspaceId;
        req.session.lastWorkspace = workspace.workspaceId;

        // ✅ Sauvegarder avant redirect
        req.session.save(() => res.redirect("/qg"));

    } catch (err) {
        console.error("❌ POST /workspace/create :", err);
        res.render("workspace-create", {
            metier : req.body?.metier || "",
            error  : "Erreur interne. Réessayez.",
        });
    }
});

module.exports = router;
