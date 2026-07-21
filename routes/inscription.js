// ==========================================================================
// SAMII OS — INSCRIPTION (création réelle d'un workspace)
// ==========================================================================
// Corrige le bug : l'ancienne version recevait le formulaire mais ne créait
// jamais de workspace. Ici, on crée un vrai enregistrement dans la table
// WORKSPACES via workspaceService, et on stocke le bon workspaceId en session.
// ==========================================================================

const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const workspaceService = require("../services/workspaceService");

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

// ── GET /inscription?metier=xxx ───────────────────────
router.get("/", requireAuth, (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Créer mon QG — SAMII</title>
    <style>
        *{ box-sizing:border-box; margin:0; padding:0; }
        body{ background:#0b0b0b; font-family:Arial; display:flex; justify-content:center; align-items:center; min-height:100vh; color:white; padding:20px; }
        .box{ width:100%; max-width:400px; background:#181818; padding:35px; border-radius:14px; border:1px solid #333; }
        h1{ text-align:center; color:#d4af37; margin-bottom:8px; font-size:1.4rem; }
        p.sub{ text-align:center; color:#888; font-size:.85rem; margin-bottom:20px; }
        input, select{ width:100%; padding:12px; margin-top:12px; border:1px solid #333; border-radius:8px; background:#111; color:white; font-size:.95rem; }
        input:focus, select:focus{ outline:none; border-color:#d4af37; }
        button{ width:100%; padding:13px; margin-top:22px; background:#d4af37; border:none; border-radius:8px; font-weight:bold; font-size:1rem; cursor:pointer; color:#000; }
        button:hover{ opacity:.9; }
        .msg{ margin-top:14px; text-align:center; font-size:.88rem; color:#e55; min-height:20px; }
        .msg.ok{ color:#4caf50; }
    </style>
</head>
<body>
<div class="box">
    <h1>👑 Créer mon QG</h1>
    <p class="sub">Dernière étape avant d'entrer dans votre centre de commandement.</p>
    <form id="form-inscription">
        <input name="boutique" placeholder="Nom de votre boutique/entreprise" required>
        <input name="nom" placeholder="Votre nom" required>
        <input name="whatsapp" placeholder="Numéro WhatsApp" required>
        <select name="pays">
            <option value="DZ">Algérie</option>
            <option value="FR">France</option>
            <option value="autre">Autre</option>
        </select>
        <input type="hidden" name="metier" value="${req.query.metier || ""}">
        <button type="submit">Créer mon QG</button>
    </form>
    <div class="msg" id="msg"></div>
</div>
<script>
document.getElementById('form-inscription').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg  = document.getElementById('msg');
    const data = Object.fromEntries(new FormData(e.target));
    msg.textContent = '⏳ Création de votre QG...';
    msg.className   = 'msg';

    const res  = await fetch('/inscription', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify(data),
    });
    const json = await res.json();

    if (json.success) {
        msg.textContent = '✅ QG créé ! Redirection...';
        msg.className   = 'msg ok';
        window.location.href = json.redirect || '/qg';
    } else {
        msg.textContent = json.error || '❌ Erreur. Réessayez.';
    }
});
</script>
</body>
</html>`);
});

// ── POST /inscription ─────────────────────────────────
router.post("/", requireAuth, async (req, res) => {
    try {
        const { nom, whatsapp, boutique, pays, metier } = req.body;

        if (!boutique || !boutique.trim()) {
            return res.json({ success: false, error: "Le nom de la boutique est requis." });
        }

        const workspaceId = crypto.randomUUID();

        const workspace = await workspaceService.create({
            workspaceId,
            owner : req.session.email,
            nom   : boutique.trim(),
            metier: metier || req.session.metier || "ecommerce",
            logo  : "",
        });

        if (!workspace) {
            return res.json({ success: false, error: "Erreur lors de la création du QG. Réessayez." });
        }

        req.session.workspaceId = workspaceId;
        req.session.metier      = workspace.metier;

        req.session.save((err) => {
            if (err) return res.json({ success: false, error: "Erreur de session." });
            res.json({ success: true, redirect: "/qg" });
        });

    } catch (err) {
        console.error("❌ POST /inscription :", err.message);
        res.json({ success: false, error: "Erreur serveur. Réessayez." });
    }
});

module.exports = router;
