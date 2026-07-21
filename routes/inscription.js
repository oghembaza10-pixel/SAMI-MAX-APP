// ==========================================================================
// SAMII OS — INSCRIPTION V2
// ==========================================================================
// Parcours : clic métier (Hub) → cette page → SAMII pose les questions
// essentielles (boutique, pays, devise) → création réelle du workspace →
// redirection vers /qg.
//
// Si la personne a déjà un workspace, on ne repasse pas par ce formulaire :
// redirection directe vers /qg.
// ==========================================================================

const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const workspaceService = require("../services/workspaceService");

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

const PAYS_DEVISE = {
    DZ: { label: "Algérie",  devise: "DZD" },
    FR: { label: "France",   devise: "EUR" },
    MA: { label: "Maroc",    devise: "MAD" },
    TN: { label: "Tunisie",  devise: "TND" },
    US: { label: "États-Unis", devise: "USD" },
    CA: { label: "Canada",   devise: "CAD" },
    SA: { label: "Arabie Saoudite", devise: "SAR" },
    AE: { label: "Émirats arabes unis", devise: "AED" },
    autre: { label: "Autre", devise: "" },
};

router.get("/", requireAuth, async (req, res) => {
    const existing = await workspaceService.getByOwner(req.session.email);
    if (existing.length > 0) {
        req.session.workspaceId = existing[0].workspaceId;
        req.session.metier      = existing[0].metier;
        return req.session.save(() => res.redirect("/qg"));
    }

    const metier = req.query.metier || "";
    const paysOptions = Object.entries(PAYS_DEVISE)
        .map(([code, p]) => `<option value="${code}" data-devise="${p.devise}">${p.label}</option>`)
        .join("");

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>SAMII vous accueille</title>
    <style>
        *{ box-sizing:border-box; margin:0; padding:0; }
        body{
            background:#050505; font-family:Arial,sans-serif;
            display:flex; justify-content:center; align-items:center;
            min-height:100vh; color:white; padding:20px;
        }
        .box{
            width:100%; max-width:440px; background:#12121a;
            padding:32px; border-radius:16px; border:1px solid rgba(197,160,89,.25);
        }
        .samii-line{ display:flex; gap:10px; align-items:flex-start; margin-bottom:18px; }
        .samii-avatar{
            width:36px; height:36px; border-radius:50%; flex-shrink:0;
            background:linear-gradient(145deg,#7d5cff,#5a3fe0);
            display:flex; align-items:center; justify-content:center; font-size:16px;
        }
        .samii-bubble{
            background:#1a1a24; border-radius:12px; padding:12px 14px;
            font-size:.88rem; line-height:1.5; color:#e8e4d8;
        }
        input, select{
            width:100%; padding:12px; margin-top:8px; margin-bottom:16px;
            border:1px solid #333; border-radius:8px; background:#0d0d12; color:white;
            font-size:.95rem;
        }
        input:focus, select:focus{ outline:none; border-color:#C5A059; }
        label{ font-size:.78rem; color:#86807A; letter-spacing:.03em; }
        button{
            width:100%; padding:13px; margin-top:10px;
            background:#C5A059; border:none; border-radius:8px;
            font-weight:bold; font-size:1rem; cursor:pointer; color:#000;
        }
        button:hover{ opacity:.9; }
        .msg{ margin-top:14px; text-align:center; font-size:.88rem; color:#e55; min-height:20px; }
        .msg.ok{ color:#4caf50; }
    </style>
</head>
<body>
<div class="box">
    <div class="samii-line">
        <div class="samii-avatar">🤖</div>
        <div class="samii-bubble">
            Bonjour Général ! Je suis <b>SAMII</b>. Avant de construire votre QG${metier ? ` <b>${metier}</b>` : ""},
            j'ai besoin de quelques infos pour bien l'adapter à votre réalité.
        </div>
    </div>

    <form id="form-inscription">
        <label>Nom de votre boutique / entreprise</label>
        <input name="boutique" placeholder="Ex : Le Souverain Store" required>

        <label>Votre nom</label>
        <input name="nom" placeholder="Votre nom" required>

        <label>Numéro WhatsApp</label>
        <input name="whatsapp" placeholder="+213..." required>

        <label>Votre pays</label>
        <select name="pays" id="select-pays">
            <option value="">Choisissez votre pays</option>
            ${paysOptions}
        </select>

        <label>Devise</label>
        <input name="devise" id="input-devise" placeholder="Sera pré-remplie selon le pays" readonly>

        <input type="hidden" name="metier" value="${metier}">

        <button type="submit">Créer mon QG</button>
    </form>
    <div class="msg" id="msg"></div>
</div>
<script>
document.getElementById('select-pays').addEventListener('change', (e) => {
    const opt = e.target.selectedOptions[0];
    document.getElementById('input-devise').value = opt?.dataset.devise || "";
});

document.getElementById('form-inscription').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg  = document.getElementById('msg');
    const data = Object.fromEntries(new FormData(e.target));
    msg.textContent = '⏳ SAMII prépare votre QG...';
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

router.post("/", requireAuth, async (req, res) => {
    try {
        const { nom, whatsapp, boutique, pays, devise, metier } = req.body;

        if (!boutique || !boutique.trim()) {
            return res.json({ success: false, error: "Le nom de la boutique est requis." });
        }
        if (!pays) {
            return res.json({ success: false, error: "Le pays est requis." });
        }

        const workspaceId = crypto.randomUUID();

        const workspace = await workspaceService.create({
            workspaceId,
            owner : req.session.email,
            nom   : boutique.trim(),
            metier: metier || req.session.metier || "ecommerce",
            logo  : "",
            pays,
            devise: devise || "",
            langue: req.session.langue || "fr",
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
