// ==========================================================================
// SAMII OS — REGISTER V6 — PostgreSQL (remplace Airtable)
// ==========================================================================
const express = require("express");
const crypto  = require("crypto");
const bcrypt  = require("bcrypt");
const router  = express.Router();
const gmail   = require("../services/gmail");
const CONFIG  = require("../config");
const db      = require("../services/db");

const TOKEN_VALIDITE_HEURES = 24;

// ── GET /register ──────────────────────────────────────────────
router.get("/", (req, res) => {
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
        .type-choice{ display:flex; gap:10px; margin-top:8px; }
        .type-choice label{ flex:1; display:flex; align-items:center; gap:8px; padding:12px; border:1px solid #333; border-radius:8px; cursor:pointer; font-size:.85rem; }
        .type-choice input{ width:auto; margin:0; }
        .type-label{ display:block; margin-top:14px; font-size:.78rem; color:#888; }
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

        <label class="type-label">Je m'inscris en tant que :</label>
        <div class="type-choice">
            <label>
                <input type="radio" name="type_compte" value="client" checked>
                <span>👤 Particulier</span>
            </label>
            <label>
                <input type="radio" name="type_compte" value="marchand">
                <span>🏪 Marchand</span>
            </label>
        </div>

        <div id="bloc-metier" style="display:none;">
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
        </div>

        <input name="password" type="password" placeholder="Mot de passe" required minlength="6">
        <button type="submit">Créer mon compte</button>
    </form>
    <div class="msg" id="msg"></div>
    <small>Déjà un compte ? <a href="/login">Se connecter</a></small>
</div>
<script>
document.querySelectorAll('input[name="type_compte"]').forEach(radio => {
    radio.addEventListener('change', () => {
        document.getElementById('bloc-metier').style.display =
            radio.value === 'marchand' && radio.checked ? 'block' : 'none';
    });
});
document.querySelector('input[name="type_compte"][value="marchand"]').dispatchEvent(new Event('change'));

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
        msg.textContent = json.message || '✅ Compte créé !';
        msg.className   = 'msg ok';
        if (json.redirect) setTimeout(() => window.location.href = json.redirect, 1200);
    } else {
        msg.textContent = json.error || '❌ Erreur. Réessayez.';
    }
});
</script>
</body>
</html>`);
});

// ── PAGE : compte en attente ────────────────────────────────────
router.get("/en-attente", (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Confirme ton email — SAMII</title>
    <style>
        *{ box-sizing:border-box; margin:0; padding:0; }
        body{ background:#0b0b0b; font-family:Arial; display:flex; justify-content:center; align-items:center; min-height:100vh; color:white; padding:20px; }
        .box{ width:100%; max-width:420px; background:#181818; padding:40px; border-radius:14px; border:1px solid #333; text-align:center; }
        .icon{ font-size:3rem; margin-bottom:16px; }
        h1{ color:#d4af37; font-size:1.3rem; margin-bottom:10px; }
        p{ color:#999; font-size:.88rem; line-height:1.6; }
    </style>
</head>
<body>
<div class="box">
    <div class="icon">📬</div>
    <h1>Vérifie ta boîte mail</h1>
    <p>On t'a envoyé un lien de confirmation. Clique dessus pour activer ton compte.<br><br>Le lien expire dans ${TOKEN_VALIDITE_HEURES}h — si tu ne le vois pas, regarde tes spams.</p>
</div>
</body>
</html>`);
});

// ── GET /register/confirmer?token=xxx ───────────────────────────
router.get("/confirmer", async (req, res) => {
    const { token } = req.query;
    if (!token) return res.redirect("/login?error=token_manquant");

    try {
        const rows = await db.query(
            `SELECT * FROM utilisateurs WHERE token_verification = $1`,
            [token]
        );
        const user = rows[0];
        if (!user) return res.redirect("/login?error=token_invalide");

        if (!user.token_expire_le || new Date() > new Date(user.token_expire_le)) {
            return res.redirect("/login?error=token_expire");
        }

        await db.query(
            `UPDATE utilisateurs SET email_verifie = true, token_verification = NULL, token_expire_le = NULL WHERE id = $1`,
            [user.id]
        );

        console.log(`✅ Email vérifié (PostgreSQL) : ${user.email}`);
        res.redirect("/login?verified=1");

    } catch (err) {
        console.error("❌ /register/confirmer :", err.message);
        res.redirect("/login?error=erreur_serveur");
    }
});

// ── POST /register ───────────────────────────────────────────────
router.post("/", async (req, res) => {
    const { nom, prenom, email, telephone, metier, password, type_compte } = req.body;
    const typeCompte = type_compte === "marchand" ? "marchand" : "client";

    if (!nom || !prenom || !email || !telephone || !password) {
        return res.json({ success: false, error: "Tous les champs sont obligatoires." });
    }
    if (password.length < 6) {
        return res.json({ success: false, error: "Le mot de passe doit faire au moins 6 caractères." });
    }

    try {
        const existing = await db.query(`SELECT id, email_verifie FROM utilisateurs WHERE email = $1`, [email]);

        if (existing.length > 0) {
    const user = existing[0];
    if (user.email_verifie === true) {
        return res.json({ success: false, error: "Cet email est déjà utilisé." });
    }

    // Compte existant non confirmé → réutilise le token existant s'il est encore valide
    const rows = await db.query(`SELECT token_verification, token_expire_le FROM utilisateurs WHERE id = $1`, [user.id]);
    const existingUser = rows[0];
    const tokenEncoreValide = existingUser.token_verification && existingUser.token_expire_le && new Date() < new Date(existingUser.token_expire_le);

    let tokenAUtiliser;

    if (tokenEncoreValide) {
        tokenAUtiliser = existingUser.token_verification;
    } else {
        tokenAUtiliser = crypto.randomBytes(32).toString("hex");
        const newExpire = new Date(Date.now() + TOKEN_VALIDITE_HEURES * 60 * 60 * 1000);

        await db.query(
            `UPDATE utilisateurs SET token_verification = $1, token_expire_le = $2 WHERE id = $3`,
            [tokenAUtiliser, newExpire, user.id]
        );
    }

    const lienRenvoi = `${CONFIG.APP_URL}/register/confirmer?token=${tokenAUtiliser}`;
            await gmail.send({
                to: email,
                subject: "Confirme ton compte SAMII OS",
                html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">
                    <h2 style="color:#C5A059;">Nouveau lien de confirmation</h2>
                    <p>Clique ci-dessous pour confirmer ton adresse email.</p>
                    <a href="${lienRenvoi}" style="display:inline-block;padding:12px 24px;background:#C5A059;color:#000;text-decoration:none;border-radius:8px;font-weight:bold;margin:16px 0;">Confirmer mon email</a>
                </div>`,
            });

            return res.json({
                success: true,
                message: "✅ Un nouveau lien de confirmation a été envoyé.",
                redirect: "/register/en-attente",
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const token = crypto.randomBytes(32).toString("hex");
        const expireLe = new Date(Date.now() + TOKEN_VALIDITE_HEURES * 60 * 60 * 1000);

        await db.query(
            `INSERT INTO utilisateurs
                (nom, prenom, email, telephone, metier, type_compte, password_hash, role, statut_acces, last_login, actif, email_verifie, token_verification, token_expire_le)
             VALUES
                ($1, $2, $3, $4, $5, $6, $7, 'owner', 'actif', CURRENT_DATE, true, false, $8, $9)`,
            [
                nom, prenom, email, telephone,
                typeCompte === "marchand" ? (metier || "ecommerce") : "",
                typeCompte, passwordHash, token, expireLe,
            ]
        );

        const lienConfirmation = `${CONFIG.APP_URL}/register/confirmer?token=${token}`;

        await gmail.send({
            to: email,
            subject: "Confirme ton compte SAMII OS",
            html: `
                <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">
                    <h2 style="color:#C5A059;">Bienvenue chez OG Empire, ${prenom} 👑</h2>
                    <p>Clique sur le bouton ci-dessous pour confirmer ton adresse email et activer ton compte.</p>
                    <a href="${lienConfirmation}" style="display:inline-block;padding:12px 24px;background:#C5A059;color:#000;text-decoration:none;border-radius:8px;font-weight:bold;margin:16px 0;">
                        Confirmer mon email
                    </a>
                    <p style="color:#888;font-size:.85rem;">Ce lien expire dans ${TOKEN_VALIDITE_HEURES} heures.</p>
                </div>
            `,
        });

        console.log(`✅ Nouveau compte PostgreSQL (${typeCompte}) : ${email}`);

        res.json({
            success: true,
            message: "✅ Compte créé ! Vérifie ta boîte mail.",
            redirect: "/register/en-attente",
        });

    } catch (err) {
        console.error("❌ Register (PostgreSQL) :", err.message);
        res.json({ success: false, error: "Erreur serveur. Réessayez." });
    }
});

module.exports = router;
