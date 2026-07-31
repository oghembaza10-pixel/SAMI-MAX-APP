// ==========================================================================
// SAMII OS — MOT DE PASSE OUBLIÉ (même mécanique que la vérification email)
// ==========================================================================
const express = require("express");
const axios   = require("axios");
const crypto  = require("crypto");
const bcrypt  = require("bcrypt");
const router  = express.Router();
const gmail   = require("../services/gmail");
const CONFIG  = require("../config");

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const TABLE_USERS      = process.env.TABLE_UTILISATEURS || "UTILISATEURS";

const TOKEN_VALIDITE_HEURES = 1; // plus court que la vérif email, par sécurité

function headers() {
    return {
        Authorization : `Bearer ${AIRTABLE_API_KEY}`,
        "Content-Type": "application/json",
    };
}

// ── GET /password-reset — formulaire "entre ton email" ────────
router.get("/", (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Mot de passe oublié — SAMII</title>
    <style>
        *{ box-sizing:border-box; margin:0; padding:0; }
        body{ background:#0b0b0b; font-family:Arial; display:flex; justify-content:center; align-items:center; min-height:100vh; color:white; padding:20px; }
        .box{ width:100%; max-width:380px; background:#181818; padding:35px; border-radius:14px; border:1px solid #333; }
        h1{ text-align:center; color:#d4af37; margin-bottom:8px; font-size:1.4rem; }
        p.sub{ text-align:center; color:#888; font-size:.85rem; margin-bottom:20px; }
        input{ width:100%; padding:12px; margin-top:12px; border:1px solid #333; border-radius:8px; background:#111; color:white; font-size:.95rem; }
        input:focus{ outline:none; border-color:#d4af37; }
        button{ width:100%; padding:13px; margin-top:22px; background:#d4af37; border:none; border-radius:8px; font-weight:bold; font-size:1rem; cursor:pointer; color:#000; }
        .msg{ margin-top:14px; text-align:center; font-size:.88rem; color:#e55; min-height:20px; }
        .msg.ok{ color:#4caf50; }
        small{ display:block; margin-top:18px; text-align:center; color:#666; font-size:.8rem; }
        a{ color:#d4af37; text-decoration:none; }
    </style>
</head>
<body>
<div class="box">
    <h1>🔑 Mot de passe oublié</h1>
    <p class="sub">On t'envoie un lien pour en choisir un nouveau.</p>
    <form id="form-forgot">
        <input name="email" type="email" placeholder="Ton adresse email" required>
        <button type="submit">Envoyer le lien</button>
    </form>
    <div class="msg" id="msg"></div>
    <small><a href="/login">← Retour à la connexion</a></small>
</div>
<script>
document.getElementById('form-forgot').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg  = document.getElementById('msg');
    const data = Object.fromEntries(new FormData(e.target));
    msg.textContent = '⏳ Envoi en cours...';
    msg.className   = 'msg';

    const res  = await fetch('/password-reset/demande', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify(data),
    });
    const json = await res.json();

    msg.textContent = json.message || json.error || '';
    msg.className   = json.success ? 'msg ok' : 'msg';
});
</script>
</body>
</html>`);
});

// ── POST /password-reset/demande — génère le token, envoie l'email ──
router.post("/demande", async (req, res) => {
    const { email } = req.body;
    if (!email) return res.json({ success: false, error: "Email requis." });

    // Message toujours identique, qu'un compte existe ou pas — évite de révéler
    // quels emails sont inscrits (bonne pratique de sécurité).
    const messageGenerique = "✅ Si ce compte existe, un email a été envoyé.";

    try {
        const search = await axios.get(
            `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_USERS}?filterByFormula={email}="${email}"`,
            { headers: headers() }
        );

        const record = search.data.records[0];
        if (!record) {
            return res.json({ success: true, message: messageGenerique });
        }

        const token = crypto.randomBytes(32).toString("hex");
        const expireLe = new Date(Date.now() + TOKEN_VALIDITE_HEURES * 60 * 60 * 1000).toISOString();

        await axios.patch(
            `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_USERS}/${record.id}`,
            { fields: { token_reset_password: token, token_reset_expire_le: expireLe } },
            { headers: headers() }
        );

        const lienReset = `${CONFIG.APP_URL}/password-reset/nouveau?token=${token}`;

        await gmail.send({
            to: email,
            subject: "Réinitialise ton mot de passe SAMII OS",
            html: `
                <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">
                    <h2 style="color:#C5A059;">Réinitialisation du mot de passe</h2>
                    <p>Clique sur le bouton ci-dessous pour choisir un nouveau mot de passe.</p>
                    <a href="${lienReset}" style="display:inline-block;padding:12px 24px;background:#C5A059;color:#000;text-decoration:none;border-radius:8px;font-weight:bold;margin:16px 0;">
                        Choisir un nouveau mot de passe
                    </a>
                    <p style="color:#888;font-size:.85rem;">Ce lien expire dans ${TOKEN_VALIDITE_HEURES}h. Si tu n'es pas à l'origine de cette demande, ignore cet email — ton mot de passe actuel reste inchangé.</p>
                </div>
            `,
        });

        res.json({ success: true, message: messageGenerique });

    } catch (err) {
        console.error("❌ /password-reset/demande :", err.response?.data || err.message);
        res.json({ success: false, error: "Erreur serveur. Réessaie." });
    }
});

// ── GET /password-reset/nouveau?token=xxx — formulaire nouveau mdp ──
router.get("/nouveau", async (req, res) => {
    const { token } = req.query;
    if (!token) return res.redirect("/login?error=token_manquant");

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Nouveau mot de passe — SAMII</title>
    <style>
        *{ box-sizing:border-box; margin:0; padding:0; }
        body{ background:#0b0b0b; font-family:Arial; display:flex; justify-content:center; align-items:center; min-height:100vh; color:white; padding:20px; }
        .box{ width:100%; max-width:380px; background:#181818; padding:35px; border-radius:14px; border:1px solid #333; }
        h1{ text-align:center; color:#d4af37; margin-bottom:20px; font-size:1.4rem; }
        input{ width:100%; padding:12px; margin-top:12px; border:1px solid #333; border-radius:8px; background:#111; color:white; font-size:.95rem; }
        input:focus{ outline:none; border-color:#d4af37; }
        button{ width:100%; padding:13px; margin-top:22px; background:#d4af37; border:none; border-radius:8px; font-weight:bold; font-size:1rem; cursor:pointer; color:#000; }
        .msg{ margin-top:14px; text-align:center; font-size:.88rem; color:#e55; min-height:20px; }
        .msg.ok{ color:#4caf50; }
    </style>
</head>
<body>
<div class="box">
    <h1>🔑 Nouveau mot de passe</h1>
    <form id="form-reset">
        <input type="hidden" name="token" value="${token}">
        <input name="password" type="password" placeholder="Nouveau mot de passe" required minlength="6">
        <input name="confirm"  type="password" placeholder="Confirme le mot de passe" required minlength="6">
        <button type="submit">Valider</button>
    </form>
    <div class="msg" id="msg"></div>
</div>
<script>
document.getElementById('form-reset').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg  = document.getElementById('msg');
    const data = Object.fromEntries(new FormData(e.target));

    if (data.password !== data.confirm) {
        msg.textContent = '❌ Les mots de passe ne correspondent pas.';
        msg.className   = 'msg';
        return;
    }

    msg.textContent = '⏳ Enregistrement...';
    msg.className   = 'msg';

    const res  = await fetch('/password-reset/nouveau', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify(data),
    });
    const json = await res.json();

    if (json.success) {
        msg.textContent = '✅ Mot de passe changé ! Redirection...';
        msg.className   = 'msg ok';
        setTimeout(() => window.location.href = '/login', 1200);
    } else {
        msg.textContent = json.error || '❌ Erreur.';
        msg.className   = 'msg';
    }
});
</script>
</body>
</html>`);
});

// ── POST /password-reset/nouveau — enregistre le nouveau mdp ──
router.post("/nouveau", async (req, res) => {
    const { token, password } = req.body;

    if (!token || !password) {
        return res.json({ success: false, error: "Données manquantes." });
    }
    if (password.length < 6) {
        return res.json({ success: false, error: "Le mot de passe doit faire au moins 6 caractères." });
    }

    try {
        const search = await axios.get(
            `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_USERS}?filterByFormula={token_reset_password}="${token}"`,
            { headers: headers() }
        );

        const record = search.data.records[0];
        if (!record) return res.json({ success: false, error: "Lien invalide ou déjà utilisé." });

        const f = record.fields;
        const expireLe = f.token_reset_expire_le ? new Date(f.token_reset_expire_le) : null;

        if (!expireLe || Date.now() > expireLe.getTime()) {
            return res.json({ success: false, error: "Ce lien a expiré. Refais une demande." });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        await axios.patch(
            `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_USERS}/${record.id}`,
            { fields: { password_hash: passwordHash, token_reset_password: "", token_reset_expire_le: "" } },
            { headers: headers() }
        );

        console.log(`✅ Mot de passe réinitialisé pour : ${f.email}`);
        res.json({ success: true });

    } catch (err) {
        console.error("❌ /password-reset/nouveau :", err.response?.data || err.message);
        res.json({ success: false, error: "Erreur serveur." });
    }
});

module.exports = router;
