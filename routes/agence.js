// ==========================================================================
// SAMII OS — ESPACE AGENCE
// Un compte agence (utilisateurs.est_agence = true) crée lui-même ses
// clients — même mécanisme que le parrainage (parraine_par), juste sans
// passer par le lien public /register?ref=. Le workspace du client reste
// créé par le client lui-même à sa première connexion (/workspace/create) :
// on ne duplique pas ce flux ici.
// ==========================================================================
const express = require("express");
const crypto  = require("crypto");
const bcrypt  = require("bcrypt");
const router  = express.Router();
const db      = require("../services/db");
const gmail   = require("../services/gmail");
const CONFIG  = require("../config");

const TOKEN_VALIDITE_HEURES = 24;

function requireAgence(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    if (!req.session.estAgence) return res.status(403).json({ success: false, error: "Réservé aux comptes agence." });
    next();
}

// ── POST /agence/clients — l'agence crée un compte client ──────
router.post("/clients", requireAgence, async (req, res) => {
    const { nom, prenom, email, telephone, metier } = req.body;

    if (!nom || !prenom || !email || !/^\S+@\S+\.\S+$/.test(email)) {
        return res.json({ success: false, error: "Nom, prénom et email valide sont obligatoires." });
    }

    try {
        const existing = await db.query(`SELECT id FROM utilisateurs WHERE email = $1`, [email.trim()]);
        if (existing.length > 0) {
            return res.json({ success: false, error: "Cet email est déjà utilisé par un compte existant." });
        }

        const passwordHash = await bcrypt.hash(crypto.randomBytes(16).toString("hex"), 10);
        const token = crypto.randomBytes(32).toString("hex");
        const expireLe = new Date(Date.now() + TOKEN_VALIDITE_HEURES * 60 * 60 * 1000);

        const inserted = await db.query(
            `INSERT INTO utilisateurs
                (nom, prenom, email, telephone, metier, type_compte, password_hash, role, statut_acces,
                 actif, email_verifie, token_reset_password, token_reset_expire_le, parraine_par, parrainage_le)
             VALUES
                ($1, $2, $3, $4, $5, 'marchand', $6, 'owner', 'actif', true, false, $7, $8, $9, NOW())
             RETURNING id`,
            [
                nom.trim(), prenom.trim(), email.trim(), (telephone || "").trim(), (metier || "").trim(),
                passwordHash, token, expireLe, req.session.userId,
            ]
        );

        const lienDefinition = `${CONFIG.APP_URL}/password-reset/nouveau?token=${token}`;
        const agenceNom = req.session.nom || "votre agence";

        gmail.send({
            to: email.trim(),
            subject: `${agenceNom} vous invite sur SAMII OS`,
            html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">
                <h2 style="color:#C5A059;">Bienvenue ${escapeHtml(prenom)} 👑</h2>
                <p><b>${escapeHtml(agenceNom)}</b> vous a créé un compte sur SAMII OS. Choisissez votre mot de passe pour y accéder :</p>
                <a href="${lienDefinition}" target="_blank" rel="noopener" style="display:inline-block;padding:14px 28px;background:#C5A059;color:#000;text-decoration:none;border-radius:8px;font-weight:bold;margin:16px 0;">
                    👉 Choisir mon mot de passe
                </a>
                <p style="color:#888;font-size:.8rem;">Ce lien expire dans ${TOKEN_VALIDITE_HEURES} heures.</p>
            </div>`,
        }).catch((err) => console.warn("⚠️ Email invitation client agence :", err.message));

        res.json({ success: true, clientId: inserted[0].id });
    } catch (err) {
        console.error("❌ POST /agence/clients :", err.message);
        res.json({ success: false, error: "Erreur serveur." });
    }
});

// ── POST /agence/clients/:id/abandon — signale un client parti ─
router.post("/clients/:id/abandon", requireAgence, async (req, res) => {
    try {
        const rows = await db.query(
            `UPDATE utilisateurs SET abandon_signale_par_agence = true, abandon_signale_le = NOW()
             WHERE id = $1 AND parraine_par = $2
             RETURNING id`,
            [req.params.id, req.session.userId]
        );
        if (!rows.length) return res.json({ success: false, error: "Client introuvable." });
        res.json({ success: true });
    } catch (err) {
        console.error("❌ POST /agence/clients/:id/abandon :", err.message);
        res.json({ success: false, error: "Erreur serveur." });
    }
});

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

module.exports = router;
