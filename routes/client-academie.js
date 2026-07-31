// ==========================================================================
// SAMII OS — CLIENT : ACADÉMIE — Apprendre l'e-commerce, devenir marchand
// ==========================================================================
const express = require("express");
const router  = express.Router();
const gemini  = require("../services/geminiService");
const axios   = require("axios");

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const TABLE_USERS      = process.env.TABLE_UTILISATEURS || "UTILISATEURS";

const LECONS = [
    { id: 1, icon: "🎯", titre: "Choisir sa niche", sujet: "comment bien choisir sa niche produit pour se lancer en e-commerce, avec des critères concrets" },
    { id: 2, icon: "📦", titre: "Trouver ses produits", sujet: "comment trouver des produits à vendre (fournisseurs, dropshipping, stock) et évaluer leur potentiel" },
    { id: 3, icon: "💰", titre: "Fixer ses prix", sujet: "comment calculer un prix de vente rentable (coût, marge, prix psychologique)" },
    { id: 4, icon: "📸", titre: "Présenter ses produits", sujet: "comment prendre de bonnes photos produits et écrire des descriptions qui vendent, sans matériel pro" },
    { id: 5, icon: "📢", titre: "Se faire connaître", sujet: "comment attirer ses premiers clients sans budget pub (réseaux sociaux, bouche-à-oreille, communauté)" },
    { id: 6, icon: "🚚", titre: "Gérer les commandes", sujet: "comment organiser la réception, confirmation et livraison des commandes efficacement au début" },
    { id: 7, icon: "💬", titre: "Fidéliser ses clients", sujet: "comment transformer un client one-shot en client fidèle qui revient et recommande" },
    { id: 8, icon: "📈", titre: "Faire grandir son activité", sujet: "comment savoir quand et comment investir pour faire grossir son activité e-commerce" },
];

router.get("/", requireAuth, async (req, res) => {
    let leconsFaites = 0;
    try {
        const search = await axios.get(
            `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_USERS}?filterByFormula={email}="${req.session.email}"`,
            { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` } }
        );
        leconsFaites = search.data.records[0]?.fields?.lecons_ecommerce_faites || 0;
    } catch (err) {
        console.warn("⚠️ Lecture progression académie :", err.message);
    }

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Académie — SAMII</title>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/css/client-style.css">
    <style>
        .ac-shell { max-width: 700px; margin: 0 auto; padding: 40px 24px 80px; text-align: center; }
        .ac-back { display: inline-flex; align-items: center; gap: 6px; color: var(--text-muted); text-decoration: none; font-size: .82rem; margin-bottom: 24px; float: left; }
        .ac-back:hover { color: var(--cyan-tech); }

        .ac-title { display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 6px; margin-top: 50px; }
        .ac-icon-box {
            width: 50px; height: 50px; border-radius: 15px;
            background: radial-gradient(circle, rgba(197,160,89,0.3), rgba(157,92,255,0.1));
            border: 1px solid rgba(197,160,89,0.5);
            display: flex; align-items: center; justify-content: center;
            font-size: 1.5rem; flex-shrink: 0;
            box-shadow: 0 0 30px rgba(197,160,89,0.2);
        }
        .ac-shell h1 { font-family: var(--font-display); color: #fff; font-size: 1.6rem; }
        .ac-shell p.sub { color: var(--text-muted); font-size: .88rem; margin: 10px 0 24px; line-height: 1.6; }

        /* ── Barre de progression ── */
        .ac-progress-wrap { max-width: 400px; margin: 0 auto 30px; }
        .ac-progress-label { display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: .72rem; color: var(--text-muted); margin-bottom: 6px; }
        .ac-progress-bar { height: 8px; border-radius: 4px; background: rgba(255,255,255,0.06); overflow: hidden; }
        .ac-progress-fill { height: 100%; background: linear-gradient(90deg, #C5A059, #9d5cff); border-radius: 4px; transition: width .6s ease; }

        /* ── Bouton mystère, thème or/violet pour différencier de Plans ── */
        .ac-mystery-btn {
            width: 200px; height: 200px; border-radius: 50%; margin: 0 auto 30px;
            background: radial-gradient(circle at 30% 30%, rgba(197,160,89,0.35), rgba(10,10,20,0.9));
            border: 2px solid rgba(197,160,89,0.5);
            display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
            cursor: pointer; position: relative;
            box-shadow: 0 0 50px rgba(197,160,89,0.3), inset 0 0 30px rgba(197,160,89,0.1);
            transition: transform .25s ease;
        }
        .ac-mystery-btn:hover { transform: scale(1.04); }
        .ac-mystery-btn:active { transform: scale(0.97); }
        .ac-mystery-btn .emoji { font-size: 2.8rem; animation: ac-float 3s ease-in-out infinite; }
        .ac-mystery-btn .text { font-family: var(--font-mono); font-size: .75rem; color: var(--text-muted); letter-spacing: .1em; text-transform: uppercase; }
        @keyframes ac-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        .ac-mystery-btn.spinning { animation: ac-spin 1.2s linear infinite; }
        @keyframes ac-spin { from { filter: hue-rotate(0deg); } to { filter: hue-rotate(360deg); } }

        .ac-msg { font-size: .85rem; color: #e55; min-height: 24px; }

        .ac-result {
            display: none; text-align: left; margin-top: 30px;
            background: radial-gradient(circle at 0% 0%, rgba(197,160,89,0.1), transparent 60%), var(--bg-panel);
            border: 1px solid rgba(197,160,89,0.3); border-radius: 20px; padding: 28px;
            animation: ac-reveal .6s cubic-bezier(0.22,1,0.36,1) both;
        }
        @keyframes ac-reveal { from { opacity: 0; transform: translateY(20px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }

        .ac-result-header { display: flex; align-items: center; gap: 12px; margin-bottom: 4px; }
        .ac-result-icon { font-size: 2rem; }
        .ac-result-header h2 { color: #fff; font-size: 1.15rem; font-family: var(--font-display); }
        .ac-result-lecon { color: #C5A059; font-size: .78rem; font-family: var(--font-mono); margin-bottom: 16px; }
        .ac-result-body { color: var(--text-main); font-size: .9rem; line-height: 1.75; white-space: pre-wrap; }

        .ac-again-btn {
            display: inline-block; margin-top: 20px; padding: 11px 22px;
            background: rgba(197,160,89,0.15); border: 1px solid rgba(197,160,89,0.4);
            color: #C5A059; border-radius: 30px; cursor: pointer; font-weight: 700; font-size: .82rem;
            font-family: var(--font-body);
        }
        .ac-again-btn:hover { background: rgba(197,160,89,0.25); }

        /* ── Bandeau de conversion, apparaît quand tout est fait ── */
        .ac-cta-marchand {
            display: none; margin-top: 30px; padding: 28px;
            background: linear-gradient(135deg, rgba(197,160,89,0.15), rgba(157,92,255,0.1));
            border: 1px solid rgba(197,160,89,0.4); border-radius: 20px;
            animation: ac-reveal .6s cubic-bezier(0.22,1,0.36,1) both;
        }
        .ac-cta-marchand h2 { font-family: var(--font-display); color: #fff; font-size: 1.3rem; margin-bottom: 10px; }
        .ac-cta-marchand p { color: var(--text-muted); font-size: .88rem; margin-bottom: 18px; line-height: 1.6; }
        .ac-cta-btn {
            display: inline-block; padding: 14px 30px;
            background: linear-gradient(135deg, #C5A059, #E8C27A);
            color: #000; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: .95rem;
            box-shadow: 0 8px 24px rgba(197,160,89,0.35);
        }
    </style>
</head>
<body>
<div class="ac-shell">
    <a href="/client-qg" class="ac-back">← Retour à mon espace</a>

    <div class="ac-title">
        <div class="ac-icon-box">🎓</div>
        <h1>Académie</h1>
    </div>
    <p class="sub">Apprends l'e-commerce, une leçon à la fois — jusqu'à devenir marchand toi-même.</p>

    <div class="ac-progress-wrap">
        <div class="ac-progress-label">
            <span>Progression</span>
            <span id="progress-text">${leconsFaites} / ${LECONS.length} leçons</span>
        </div>
        <div class="ac-progress-bar">
            <div class="ac-progress-fill" id="progress-fill" style="width:${Math.round((leconsFaites / LECONS.length) * 100)}%"></div>
        </div>
    </div>

    <div class="ac-mystery-btn" id="btn-mystery">
        <div class="emoji" id="mystery-emoji">📖</div>
        <div class="text" id="mystery-text">Prochaine leçon</div>
    </div>
    <div class="ac-msg" id="msg"></div>

    <div class="ac-result" id="result">
        <div class="ac-result-header">
            <span class="ac-result-icon" id="result-icon">📖</span>
            <h2 id="result-titre"></h2>
        </div>
        <div class="ac-result-lecon" id="result-num"></div>
        <div class="ac-result-body" id="result-body"></div>
        <button type="button" class="ac-again-btn" id="btn-again" style="display:none;">📖 Leçon suivante</button>
    </div>

    <div class="ac-cta-marchand" id="cta-marchand">
        <h2>🏆 Tu es prêt.</h2>
        <p>Tu as terminé les bases de l'e-commerce. C'est le moment de passer à l'action et de créer ton propre QG marchand — tu seras agréablement surpris par ce qui t'attend.</p>
        <a href="/register?metier=ecommerce" class="ac-cta-btn">👑 Devenir Marchand →</a>
    </div>
</div>

<script>
let leconsFaites = ${leconsFaites};
const totalLecons = ${LECONS.length};

const mysteryBtn   = document.getElementById('btn-mystery');
const mysteryEmoji = document.getElementById('mystery-emoji');
const mysteryText  = document.getElementById('mystery-text');
const msgEl        = document.getElementById('msg');
const resultEl     = document.getElementById('result');
const btnAgain     = document.getElementById('btn-again');
const ctaMarchand  = document.getElementById('cta-marchand');

async function prochaineLecon() {
    if (leconsFaites >= totalLecons) {
        ctaMarchand.style.display = 'block';
        mysteryBtn.style.display = 'none';
        return;
    }

    mysteryBtn.classList.add('spinning');
    mysteryEmoji.textContent = '✨';
    mysteryText.textContent = 'Préparation...';
    msgEl.textContent = '';
    resultEl.style.display = 'none';

    try {
        const res  = await fetch('/client-qg/academie/lecon', { method: 'POST' });
        const json = await res.json();

        mysteryBtn.classList.remove('spinning');
        mysteryEmoji.textContent = '📖';
        mysteryText.textContent = 'Prochaine leçon';

        if (json.success) {
            document.getElementById('result-icon').textContent = json.icon;
            document.getElementById('result-titre').textContent = json.titre;
            document.getElementById('result-num').textContent = \`Leçon \${json.numero} / \${totalLecons}\`;
            document.getElementById('result-body').textContent = json.contenu;
            resultEl.style.display = 'block';

            leconsFaites = json.progression;
            document.getElementById('progress-text').textContent = leconsFaites + ' / ' + totalLecons + ' leçons';
            document.getElementById('progress-fill').style.width = Math.round((leconsFaites / totalLecons) * 100) + '%';

            if (leconsFaites >= totalLecons) {
                btnAgain.style.display = 'none';
                setTimeout(() => {
                    mysteryBtn.style.display = 'none';
                    ctaMarchand.style.display = 'block';
                }, 800);
            } else {
                btnAgain.style.display = 'inline-block';
            }
        } else {
            msgEl.textContent = json.error || '❌ Erreur. Réessaie.';
        }
    } catch (err) {
        mysteryBtn.classList.remove('spinning');
        mysteryEmoji.textContent = '📖';
        mysteryText.textContent = 'Prochaine leçon';
        msgEl.textContent = '❌ Erreur réseau.';
    }
}

mysteryBtn.addEventListener('click', prochaineLecon);
btnAgain.addEventListener('click', prochaineLecon);

if (leconsFaites >= totalLecons) {
    mysteryBtn.style.display = 'none';
    ctaMarchand.style.display = 'block';
}
</script>
</body>
</html>`);
});

router.post("/lecon", requireAuth, async (req, res) => {
    try {
        const search = await axios.get(
            `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_USERS}?filterByFormula={email}="${req.session.email}"`,
            { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` } }
        );
        const record = search.data.records[0];
        if (!record) return res.json({ success: false, error: "Utilisateur introuvable." });

        const dejaFaites = record.fields.lecons_ecommerce_faites || 0;

        if (dejaFaites >= LECONS.length) {
            return res.json({ success: false, error: "Tu as déjà terminé toutes les leçons !" });
        }

        const lecon = LECONS[dejaFaites];

        const prompt = `Tu es SAMII, formateur en e-commerce. Enseigne cette leçon à un débutant complet : ${lecon.sujet}.\n\n`
            + "Sois concret, pédagogique, avec des exemples pratiques. 6-8 lignes, direct, sans jargon inutile, sans JSON ni markdown.";

        const result = await gemini.chat({
            message: prompt,
            context: { source: "client_academie" },
            useTools: false,
        });

        const nouvelleProgression = dejaFaites + 1;

        await axios.patch(
            `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_USERS}/${record.id}`,
            { fields: { lecons_ecommerce_faites: nouvelleProgression } },
            { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}`, "Content-Type": "application/json" } }
        );

        res.json({
            success: true,
            icon: lecon.icon,
            titre: lecon.titre,
            numero: lecon.id,
            contenu: result.type === "text" ? result.text : "Erreur de génération.",
            progression: nouvelleProgression,
        });

    } catch (err) {
        console.error("❌ POST /client-qg/academie/lecon :", err.message);
        res.json({ success: false, error: "Erreur lors de la préparation de la leçon." });
    }
});

module.exports = router;
