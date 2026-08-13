// ==========================================================================
// SAMII OS — CLIENT QG — Grille de routes centralisée
// ==========================================================================
const express = require("express");
const router  = express.Router();
const db = require("../services/db");
const referralService = require("../services/referralService");
const samiiQuota = require("../services/samiiQuota");

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

// ── PAGE PRINCIPALE ────────────────────────────────────
router.get("/", requireAuth, async (req, res) => {
    let telephone = "";
    let commandes = [];
    let codeParrainage = "";
    try {
        const rows = await db.query(`SELECT telephone FROM utilisateurs WHERE id = $1`, [req.session.userId]);
        telephone = rows[0]?.telephone || "";
        codeParrainage = await referralService.assurerCodeParrainage(req.session.userId);
        if (telephone) {
            commandes = await db.query(
                `SELECT id, produit, statut, numero_suivi, transporteur, dernier_statut_suivi, date_commande
                 FROM commandes WHERE telephone = $1 ORDER BY date_commande DESC LIMIT 20`,
                [telephone]
            );
        }
    } catch (err) {
        console.error("❌ GET /client-qg (commandes) :", err.message);
    }

    res.render("client-qg", {
        nom: req.session.nom || "",
        codeParrainage,
        telephone,
        commandes,
    });
});

router.get("/quota", requireAuth, async (req, res) => {
    try {
        const quota = await samiiQuota.getEtatQuota(req.session.userId);
        res.json({ success: true, ...quota });
    } catch (err) {
        console.error("❌ GET /client-qg/quota :", err.message);
        res.json({ success: false, illimite: false, restant: samiiQuota.QUOTA_GRATUIT_PAR_JOUR, total: samiiQuota.QUOTA_GRATUIT_PAR_JOUR });
    }
});

// ── SOUS-ROUTES (chaque carte a son propre fichier) ────
router.use("/transport", require("./client-transport"));
router.use("/traducteur", require("./client-traducteur"));
router.use("/services", require("./client-services"));
router.use("/plans", require("./client-plans"));
router.use("/academie", require("./client-academie"));
router.use("/emploi", require("./client-emploi"));
router.use("/premium", require("./client-premium"));
router.use("/connect", require("./client-connect"));
module.exports = router;
