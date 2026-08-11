// ==========================================================================
// SAMII OS — PARTENARIAT
// Formulaire public (investisseur, créateur, développeur, ...). Le tableau
// de bord privé vit désormais dans routes/admin.js (/admin).
// ==========================================================================
const express = require("express");
const router = express.Router();
const db = require("../services/db");
const gmail = require("../services/gmail");
const socketService = require("../services/socketService");

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "ghembazao@gmail.com";
const ROOM_ADMIN = "partenariat-admin";

const CATEGORIES = {
    investisseur: "💰 Investisseur",
    createur: "🎥 Créateur de contenu",
    developpeur: "💻 Développeur",
    fournisseur: "📦 Fournisseur / Logistique",
    marketing: "📣 Affilié / Marketing",
    autre: "✍️ Autre",
};

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

router.post("/", async (req, res) => {
    try {
        const { categorie, email, telephone, description } = req.body;

        if (!CATEGORIES[categorie]) return res.json({ success: false, error: "Catégorie invalide." });
        if (!email || !/^\S+@\S+\.\S+$/.test(email)) return res.json({ success: false, error: "Email invalide." });
        if (!description || !description.trim()) return res.json({ success: false, error: "Décris ta proposition en quelques mots." });

        const inserted = await db.query(
            `INSERT INTO candidatures_partenariat (categorie, email, telephone, description)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [categorie, email.trim(), (telephone || "").trim(), description.trim()]
        );

        const candidature = inserted[0];
        socketService.emitToShop(ROOM_ADMIN, "partenariat:nouvelle", candidature);

        gmail.send({
            to: ADMIN_EMAIL,
            subject: `🤝 Nouvelle candidature partenariat — ${CATEGORIES[categorie]}`,
            html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">
                <h2 style="color:#C5A059;">${CATEGORIES[categorie]}</h2>
                <p><b>Email :</b> ${escapeHtml(email)}</p>
                <p><b>Téléphone :</b> ${escapeHtml(telephone || "—")}</p>
                <p><b>Message :</b><br>${escapeHtml(description)}</p>
            </div>`,
        }).catch(() => {});

        res.json({ success: true });
    } catch (err) {
        console.error("❌ POST /partenariat :", err.message);
        res.json({ success: false, error: "Erreur serveur." });
    }
});

module.exports = router;
