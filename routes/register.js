// ==========================================================================
// SAMII OS — REGISTER V3 (parcours unifié : métier → compte → questionnaire)
// ==========================================================================
const express = require("express");
const axios   = require("axios");
const router  = express.Router();

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const TABLE_USERS      = process.env.TABLE_UTILISATEURS || "UTILISATEURS";

// ── GET /register — accepte ?metier=X depuis le Hub ───────────
router.get("/", (req, res) => {
    // ✅ Déjà connecté ? On saute direct à la création de workspace, pas de nouveau compte à créer
    if (req.session?.loggedIn) {
        const metier = req.query.metier || "";
        return res.redirect(`/workspace/create${metier ? `?metier=${metier}` : ""}`);
    }

    const metier = req.query.metier || "";
    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Créer un compte — SAMII</title>
    <style>
        *{ box-sizing:border-box; margin:0; padding:0; }
        body{ background:#0b0b0b; font-family:Arial; display:flex; justify-content:center; align-items:center; min-height:100vh; color:white; padding:20px; }
        .box{ width:100%; max-width:400px; background:#181818; padding:35px; border-radius:14px; border:1px solid #333; }
        h1{ text-align:center; color:#d4af37; margin-bottom:8px; font-size:1.5rem; }
        p.sub{ text-align:center; color:#888; font-size:.85rem; margin-bottom:20px; }
        input, select{ width:100%; padding:12px; margin-top:12px; border:1px solid #333; border-radius:8px; background:#111; color:white; font-size:.95rem; }
        input:focus, select:focus{ outline:none; border-color:#d4af37; }
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
    <h1>👑 Créer mon compte</h1>
    <p class="sub">${metier ? `Pour votre activité <b>${metier}</b>` : "Rejoignez OG Empire"}</p>
    <form id="form-register">
        <input name="nom"       placeholder="Nom"         required>
        <input name="prenom"    placeholder="Prénom"      required>
        <input name="email"     type="email" placeholder="Email" required>
        <input name="telephone" placeholder="Téléphone"   required>
        ${metier
            ? `<input type="hidden" name="metier" value="${metier}">`
            : `<select name="metier">
                <option value="ecommerce">E-commerçant</option>
                <option value="restaurant">Restaurateur</option>
                <option value="immobilier">Immobilier</option>
                <option value="livreur"     disabled>Livreur (bientôt)</option>
                <option value="fournisseur" disabled>Fournisseur (bientôt)</option>
              </select>`
        }
        <input name="password" type="password" placeholder="Mot de passe" required>
        <button type="submit">Créer mon compte</button>
    </form>
    <div class="msg" id="msg"></div>
    <small>Déjà un compte ? <a href="/login">Se connecter</a></small>
</div>
<script>
document.getElementById('form-register').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg  = document.getElementById('msg');
    const data = Object.fromEntries(new FormData(e.target));
    msg.textContent = '⏳ Création en cours...';
    msg.className   = 'msg';

    const res  = await fetch('/register', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify(data),
    });
    const json = await res.json();

    if (json.success) {
        msg.textContent = '✅ Compte créé ! SAMII vous accueille...';
        msg.className   = 'msg ok';
        setTimeout(() => window.location.href = json.redirect, 900);
    } else {
        msg.textContent = json.error || '❌ Erreur. Réessayez.';
    }
});
</script>
</body>
</html>`);
});

// ── POST /register — crée le compte ET connecte directement ──
router.post("/", async (req, res) => {
    const { nom, prenom, email, telephone, metier, password } = req.body;

    if (!nom || !prenom || !email || !telephone || !password) {
        return res.json({ success: false, error: "Tous les champs sont obligatoires." });
    }

    try {
        const headers = {
            Authorization : `Bearer ${AIRTABLE_API_KEY}`,
            "Content-Type": "application/json",
        };

        const check = await axios.get(
            `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_USERS}?filterByFormula={email}="${email}"`,
            { headers }
        );

        if (check.data.records.length > 0) {
            return res.json({ success: false, error: "Cet email est déjà utilisé." });
        }

        await axios.post(
            `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_USERS}`,
            { fields: {
                nom,
                prenom,
                email,
                telephone,
                metier        : metier || "ecommerce",
                password_hash : password,
                role          : "owner",
                statut_acces  : "actif",
                last_login    : new Date().toISOString().split("T")[0],
                actif         : true,
            }},
            { headers }
        );

        console.log(`✅ Nouveau compte : ${email}`);

        // ✅ Connexion immédiate — plus besoin de repasser par /login
        req.session.regenerate((err) => {
            if (err) return res.json({ success: false, error: "Erreur session." });

            req.session.loggedIn = true;
            req.session.email    = email;
            req.session.metier   = metier || "ecommerce";

            req.session.save((err) => {
                if (err) return res.json({ success: false, error: "Erreur session." });

                // ✅ Direction le questionnaire SAMII, métier déjà retenu
                const redirect = `/workspace/create?metier=${encodeURIComponent(metier || "ecommerce")}`;
                res.json({ success: true, redirect });
            });
        });

    } catch (err) {
        console.error("❌ Register :", err.response?.data || err.message);
        res.json({ success: false, error: "Erreur serveur. Réessayez." });
    }
});

module.exports = router;
