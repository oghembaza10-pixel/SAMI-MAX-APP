// ==========================================================================
// SAMII OS — META DATA DELETION CALLBACK
// Exigence obligatoire de Meta pour toute app en App Review : une URL que
// Meta appelle quand un utilisateur demande la suppression de ses données
// via son compte Facebook/Instagram. Distinct du webhook Shopify
// (routes/webhook-compliance.js), qui répond à la même obligation mais côté
// Shopify — deux plateformes, deux contrats de suppression séparés.
// Doc : https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback
// ==========================================================================
const express = require("express");
const crypto  = require("crypto");
const router  = express.Router();
const db      = require("../services/db");
const CONFIG  = require("../config");

function base64UrlDecode(str) {
    return Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

// Vérifie et décode le signed_request envoyé par Meta (algorithme documenté
// par Meta) — sans ça, n'importe qui pourrait déclencher une "suppression"
// au nom d'un autre utilisateur.
function parseSignedRequest(signedRequest, secret) {
    const [encodedSig, encodedPayload] = (signedRequest || "").split(".");
    if (!encodedSig || !encodedPayload) return null;

    const sig = base64UrlDecode(encodedSig);
    const expectedSig = crypto.createHmac("sha256", secret).update(encodedPayload).digest();
    if (sig.length !== expectedSig.length || !crypto.timingSafeEqual(sig, expectedSig)) return null;

    try {
        return JSON.parse(base64UrlDecode(encodedPayload).toString("utf8"));
    } catch {
        return null;
    }
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

router.post("/data-deletion", async (req, res) => {
    try {
        const data = parseSignedRequest(req.body?.signed_request, CONFIG.META.APP_SECRET);
        if (!data?.user_id) return res.status(400).json({ error: "signed_request invalide ou manquant." });

        const confirmationCode = crypto.randomBytes(8).toString("hex");

        // Suppression best-effort : SAMII ne conserve pas de profil durable
        // par utilisateur Meta (les échanges Messenger/Instagram passent par
        // une mémoire de session éphémère, brain/memory.js) — seule trace
        // écrite est le journal d'activité, purgée ici pour cet identifiant.
        await db.query(`DELETE FROM journal WHERE details LIKE $1`, [`%${data.user_id}%`]).catch(err => {
            console.error("❌ Meta data-deletion, purge journal :", err.message);
        });

        console.log(`🗑️ Demande de suppression Meta traitée — user_id=${data.user_id}, code=${confirmationCode}`);

        res.json({
            url: `${CONFIG.APP_URL}/webhook/meta/deletion-status?id=${confirmationCode}`,
            confirmation_code: confirmationCode,
        });
    } catch (err) {
        console.error("❌ POST /webhook/meta/data-deletion :", err.message);
        res.status(500).json({ error: "Erreur serveur." });
    }
});

router.get("/deletion-status", (req, res) => {
    res.send(`<!DOCTYPE html><html><body style="background:#050505;color:#fff;font-family:Arial,sans-serif;text-align:center;padding:60px 20px;">
        <h2 style="color:#3ddc84;">✅ Données supprimées</h2>
        <p>Code de confirmation : <b>${escapeHtml(req.query.id || "")}</b></p>
    </body></html>`);
});

module.exports = router;
