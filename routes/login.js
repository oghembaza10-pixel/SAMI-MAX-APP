// ==========================================================================
// SAMII OS — LOGIN V6 — PostgreSQL (remplace Airtable)
// ==========================================================================
const express = require("express");
const bcrypt  = require("bcrypt");
const router  = express.Router();
const db      = require("../services/db");

// ── GET /login ────────────────────────────────────────────────
router.get("/", (req, res) => {
    if (req.session?.loggedIn) return res.redirect("/hub");

    const { error, verified } = req.query;

    const messages = {
        token_manquant : "❌ Lien de confirmation invalide.",
        token_invalide  : "❌ Ce lien de confirmation n'est plus valide.",
        token_expire    : "⌛ Ce lien a expiré. Réinscris-toi ou contacte le support.",
        erreur_serveur  : "❌ Une erreur est survenue. Réessaie.",
    };
    const preMsg = error ? messages[error] || "" : (verified ? "✅ Email confirmé ! Tu peux te connecter." : "");
    const preMsgClass = verified ? "ok" : "";

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
        .forgot{ display:block; text-align:right; margin-top:8px; font-size:.8rem; }
    </style>
</head>
<body>
<div class="box">
    <h1>👑 Connexion</h1>
    <form id="form-login">
        <input name="email"    type="email"    placeholder="Adresse e-mail" required>
        <input name="password" type="password" placeholder="Mot de passe"   required>
        <a href="/password-reset" class="forgot">Mot de passe oublié ?</a>
        <button type="submit">Se connecter</button>
    </form>
    <div class="msg ${preMsgClass}" id="msg">${preMsg}</div>
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
        window.location.href = json.redirect || '/hub';
    } else {
        msg.textContent = json.error || '❌ Erreur. Réessayez.';
        msg.className   = 'msg';
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
        const rows = await db.query(`SELECT * FROM utilisateurs WHERE email = $1`, [email]);
        const user = rows[0];

        if (!user) {
            return res.json({ success: false, error: "Email ou mot de passe incorrect." });
        }

        if (user.email_verifie !== true) {
            return res.json({ success: false, error: "Confirme ton email avant de te connecter (vérifie ta boîte mail)." });
        }

        const passwordOk = await bcrypt.compare(password, user.password_hash || "");
        if (!passwordOk) {
            return res.json({ success: false, error: "Email ou mot de passe incorrect." });
        }

        if (user.statut_acces === "suspendu") {
            return res.json({ success: false, error: "Compte suspendu. Contactez le support." });
        }

        await db.query(`UPDATE utilisateurs SET last_login = CURRENT_DATE WHERE id = $1`, [user.id]);

        const typeCompte = user.type_compte === "marchand" ? "marchand" : "client";

        // ── Compte Client : direction QG Client, pas de workspace ──
        if (typeCompte === "client") {
            req.session.regenerate((err) => {
                if (err) return res.json({ success: false, error: "Erreur session." });

                req.session.loggedIn   = true;
                req.session.email      = email;
                req.session.userId     = user.id;
                req.session.nom        = `${user.prenom || ""} ${user.nom || ""}`.trim();
                req.session.typeCompte = "client";
                req.session.workspaceId = null;

                res.json({ success: true, redirect: "/client-qg" });
            });
            return;
        }

        // ── Compte Marchand : chercher son workspace ──
        const workspaces = await db.query(`SELECT * FROM workspaces WHERE owner_email = $1`, [email]);
        const workspace = workspaces[0] || null;

        req.session.regenerate((err) => {
            if (err) return res.json({ success: false, error: "Erreur session." });

            req.session.loggedIn   = true;
            req.session.email      = email;
            req.session.userId     = user.id;
            req.session.nom        = `${user.prenom || ""} ${user.nom || ""}`.trim();
            req.session.typeCompte = "marchand";

            if (workspace) {
                req.session.workspaceId = workspace.id;
                req.session.metier      = workspace.metier;
            } else {
                req.session.workspaceId = null;
            }

            res.json({
                success : true,
                redirect: workspace ? "/qg" : "/hub",
            });
        });

    } catch (err) {
        console.error("❌ Login (PostgreSQL) :", err.message);
        res.json({ success: false, error: "Erreur serveur. Réessayez." });
    }
});

module.exports = router;
