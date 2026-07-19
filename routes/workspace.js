// ======================================================
// SAMII OS — Workspace Routes
// ======================================================
// Création et gestion des Workspaces.
// Séparé de hub.js — responsabilité unique.
// ======================================================

const express          = require("express");
const router           = express.Router();
const workspaceService = require("../services/workspaceService");

// ── Auth middleware ───────────────────────────────────
function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

// ── Générer un workspace_id unique ────────────────────
function generateWorkspaceId() {
    const ts     = Math.floor(Date.now() / 1000);
    const random = Math.random().toString(36).substring(2, 6);
    return `WS-${ts}-${random}`;
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
        const { nom, metier, pays, langue } = req.body;
        const email                         = req.session?.email || "";

        // ✅ Validation
        if (!nom || !nom.trim())    {
            return res.render("workspace-create", {
                metier : metier || "",
                error  : "Le nom du workspace est obligatoire.",
            });
        }
        if (!metier || !metier.trim())
