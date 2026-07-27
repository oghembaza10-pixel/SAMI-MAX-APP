// ======================================================
// SAMII OS — Workspace Routes (fix : plus de vue externe manquante)
// ======================================================
const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const workspaceService = require("../services/workspaceService");

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

function generateWorkspaceId() {
    return `WS-${crypto.randomUUID()}`;
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

router.get("/create", requireAuth, async (req, res) => {
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
        body{ background:#050505; font-family:Arial,sans-serif; display:flex; justify-content:center; align-items:center; min-height:100vh; color:white; padding:20px; }
        .box{ width:100%; max-width:440px; background:#12121a; padding:32px; border-radius:16px; border:1px solid rgba(197,160,89,.25); }
        .samii-line{ display:flex; gap:10px; align-items:flex-start; margin-bottom:18px; }
        .samii-avatar{ width:36px; height:36px; border-radius:50%; flex-shrink:0; background:linear-gradient(145deg,#7d5cff,#5a3fe0); display:flex; align-items:center; justify-content:center; font-size:16px; }
        .samii-bubble{ background:#1a1a24; border-radius:12px; padding:12px 14px; font-size:.88rem; line-height:1.5; color:#e8e4d8; }
        input, select{ width:100%; padding:12px; margin-top:8px; margin-bottom:16px; border:1px solid #333; border-radius:8px; background:#0d0d12; color:white; font-size:.95rem; }
        input:focus, select:focus{ outline:none; border-color:#C5A059; }
        label{ font-size:.78rem; color:#86807A; letter-spacing:.03em; }
        button{ width:100%; padding:13px; margin-top:10px; background:#C5A059; border:none; border-radius:8px; font-weight:bold; font-size:1rem; cursor:pointer; color:#000; }
        button:hover{ opacity:.9; }
        .msg{ margin-top:14px; text-align:center; font-size:.88rem; color:#e55; min-height:20px; }
        .msg.ok{ color:#4caf50; }
        #custom-metier-wrap{ display:none; }
    </style>
</head>
<body>
<div class="box">
    <div class="samii-line">
        <div class="samii-avatar">🤖</div>
        <div class="samii-bubble">
            Bonjour Général ! Je suis <b>SAMII</b>. Avant de construire votre QG${metier ? ` <b>${metier}</b>` : ""}, j'ai besoin de quelques infos pour bien l'adapter à votre réalité.
        </div>
    </div>
    <form id="form-workspace">
        <label>Nom de votre boutique / entreprise</label>
        <input name="nom" placeholder="Ex : Le Souverain Store" required>

        <input type="hidden" name="metier" id="metier-hidden" value="${metier}">
        ${!metier ? `
        <label>Votre métier</label>
        <select name="metierSelect" id="metier-select">
            <option value="ecommerce">E-commerce</option>
            <option value="restaurant">Restaurant</option>
            <option value="autre">Autre</option>
        </select>
        <div id="custom-metier-wrap">
            <label>Précisez votre métier</label>
            <input name="metierCustom" id="metier-custom" placeholder="Ex : Coiffeur">
        </div>` : ''}

        <label>Description (optionnel)</label>
        <input name="description" placeholder="Décrivez votre activité en une phrase">

        <label>Votre pays</label>
        <select name="pays" id="select-pays">
            <option value="">Choisissez votre pays</option>
            ${paysOptions}
        </select>

        <label>Devise</label>
        <input name="devise" id="input-devise" placeholder="Sera pré-remplie selon le pays" readonly>

        <button type="submit">Créer mon QG</button>
    </form>
    <div class="msg" id="msg"></div>
</div>
<script>
document.getElementById('select-pays').addEventListener('change', (e) => {
    const opt = e.target.selectedOptions[0];
    document.getElementById('input-devise').value = opt?.dataset.devise || "";
});

const metierSelect = document.getElementById('metier-select');
if (metierSelect) {
    metierSelect.addEventListener('change', (e) => {
        document.getElementById('custom-metier-wrap').style.display = e.target.value === 'autre' ? 'block' : 'none';
        document.getElementById('metier-hidden').value = e.target.value;
    });
    document.getElementById('metier-hidden').value = metierSelect.value;
}

document.getElementById('form-workspace').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg  = document.getElementById('msg');
    const data = Object.fromEntries(new FormData(e.target));
    msg.textContent = '⏳ SAMII prépare votre QG...';
    msg.className   = 'msg';

    const res  = await fetch('/workspace/create', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify(data),
    });
    const json = await res.json();

    if (json.success) {
        msg.textContent = '✅ QG créé ! Redirection...';
        msg.className   = 'msg ok';
        window.location.href = '/qg';
    } else {
        msg.textContent = json.error || '❌ Erreur. Réessayez.';
    }
});
</script>
</body>
</html>`);
});

router.post("/create", requireAuth, async (req, res) => {
    try {
        const { nom, metier, metierCustom, description, pays, devise } = req.body;
        const email = req.session?.email || "";

        if (!nom || !nom.trim()) {
            return res.json({ success: false, error: "Le nom du workspace est obligatoire." });
        }
        if (!metier || !metier.trim()) {
            return res.json({ success: false, error: "Le métier est obligatoire." });
        }
        if (!pays) {
            return res.json({ success: false, error: "Le pays est requis." });
        }

        let metierFinal = metier.trim();
        if (metierFinal === "autre") {
            const custom = metierCustom?.trim() || "";
            if (!custom) {
                return res.json({ success: false, error: "Précisez votre métier." });
            }
            metierFinal = custom.toLowerCase();
        }

        const workspaceId = generateWorkspaceId();

        const workspace = await workspaceService.create({
            workspaceId,
            owner      : email,
            nom        : nom.trim(),
            metier     : metierFinal,
            description: description?.trim() || "",
            pays,
            devise: devise || "",
            langue: "fr",
            logo  : "",
        });

        if (!workspace) {
            return res.json({ success: false, error: "Erreur lors de la création. Réessayez." });
        }

        req.session.workspaceId   = workspace.workspaceId;
        req.session.metier        = workspace.metier;
        req.session.lastWorkspace = workspace.workspaceId;
        // ── Email de bienvenue (ne bloque jamais la création si ça échoue) ──
try {
    const notificationEngine = require("../engines/notificationEngine");
    await notificationEngine.send({
        channel: "email",
        to: email,
       message: `Bienvenue dans OG Empire, Soldat !\n\nVotre QG "${workspace.nom}" est prêt. SAMII est déjà à votre poste pour vous accompagner.\n\nAllez jeter un œil : https://samii.souverain-store.com/qg\n\nÀ votre conquête 👑`,
    });
} catch (mailErr) {
    console.warn("⚠️ Email de bienvenue non envoyé :", mailErr.message);
}

        req.session.save((err) => {
            if (err) return res.json({ success: false, error: "Erreur de session." });
            res.json({ success: true, redirect: "/qg" });
        });

    } catch (err) {
        console.error("❌ POST /workspace/create :", err.message);
        res.json({ success: false, error: "Erreur interne. Réessayez." });
    }
});

module.exports = router;
