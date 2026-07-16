// ==========================================================================
// SAMII OS — LOGIN V2
// ==========================================================================

const express = require("express");
const axios   = require("axios");
const router  = express.Router();

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const TABLE_USERS      = process.env.TABLE_USERS || "UTILISATEURS";

// ── GET /login ────────────────────────────────────────────────
router.get("/", (req, res) => {
    if (req.session?.loggedIn) return res.redirect("/qg/ecommerce");

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Connexion — SAMII</title>
    <style>
        *{ box-sizing:border-box; margin:0; padding:0; }
        body{ background:#0b0b0b; font-family:Arial; display:flex; justify-content:center; align-items:center; min-height:100vh; color:white; padding:20px; }
        .box{ width:100%; max-width:380px; background:#181818; padding:35px; border-radius:14px; border:1px solid #333; }
        h1{ text-align:center; color:#d4af37; margin-bottom:25px; font-size:1.5rem; }
        input{ width:100%; padding:12px; margin-top:12px; border:1px solid #333; border-radius:8px; background:#111; color:white; font-size:.95rem; }
        input:focus{ outline:none; border-color:#d4af37; }
        button{ width:100%; padding:13px; margin-top:22px; background:#d4af37; border:none; border-radius:8px; font-weight:bold; font-size:1rem; cursor:pointer; color:#000; }
        button:hover{ opacity:.9; }
        .msg{ margin-top:14px; text-align:center; font-size:.88rem; color:#e55; min-height:20px; }
        .msg.ok{ color:#4caf50; }
        small{ display:block; margin-top:18px; text-align:center; color:#666; font-size:.8rem; }
        a{ color:#d4af37; text-decoration:none; }
    </style>
</head>
<body>
<div class="box">
    <h1>👑 Connexion</h1>
    <form id="form-login">
        <input name="email"    type="email"    placeholder="Adresse e-mail" required>
        <input name="password" type="password" placeholder="Mot de passe"   required>
        <button type="submit">Se connecter</button>
    </form>
    <div class="msg" id="msg"></div>
    <small>Pas encore de compte ? <a href="/register">Créer un compte</a></small>
</div>
<script>
document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg  = document.getElementById('msg');
    const data = Object.fromEntries(new FormData(e.target));
    msg.textContent = '⏳ Connexion...';
    msg.className   = 'msg';

    const res  = await fetch('/login', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify(data),
    });
    const json = await res.json();

    if (json.success) {
        msg.textContent = '✅ Connecté ! Redirection...';
        msg.className   = 'msg ok';
        window.location.href = json.redirect || '/qg/ecommerce';
    } else {
        msg.textContent = json.error || '❌ Erreur. Réessayez.';
    }
});
</script>
</body>
</html>`);
});

// ── POST /login ───────────────────────────────────────────────
router.post("/", async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.json({ success: false, error: "Email et mot de passe requis." });
    }

    try {
        const headers = {
            Authorization : `Bearer ${AIRTABLE_API_KEY}`,
            "Content-Type": "application/json",
        };

        const search = await axios.get(
            `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_USERS}?filterByFormula={email}="${email}"`,
            { headers }
        );

        const record = search.data.records[0];

        // Utilisateur introuvable
        if (!record) {
            return res.json({ success: false, error: "Email ou mot de passe incorrect." });
        }

        const user = record.fields;

        // Mot de passe incorrect
        if (user.password_hash !== password) {
            return res.json({ success: false, error: "Email ou mot de passe incorrect." });
        }

        // Compte en attente
        if (user.statut_acces === "en attente") {
            return res.json({
                success : false,
                attente : true,
                error   : "⏳ Votre compte est en cours d'activation. SAMII vous préviendra dès que votre QG est prêt !",
            });
        }

        // Compte suspendu
        if (user.statut_acces === "suspendu") {
            return res.json({ success: false, error: "Compte suspendu. Contactez le support." });
        }

        // Mise à jour last_login
        await axios.patch(
            `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_USERS}/${record.id}`,
            { fields: { last_login: new Date().toISOString() }},
            { headers }
        );

        // Session
        req.session.regenerate((err) => {
            if (err) return res.json({ success: false, error: "Erreur session." });

            req.session.loggedIn   = true;
            req.session.shop       = user.shop_url  || "";
            req.session.boutiqueId = user.boutiqueId || "";
            req.session.userId     = record.id;
            req.session.metier     = user.metier    || "ecommerce";
            req.session.nom        = `${user.prenom || ""} ${user.nom || ""}`.trim();

            res.json({
                success : true,
                redirect: `/qg/${user.metier || "ecommerce"}`,
            });
        });

    } catch (err) {
        console.error("❌ Login :", err.response?.data || err.message);
        res.json({ success: false, error: "Erreur serveur. Réessayez." });
    }
});

module.exports = router;

