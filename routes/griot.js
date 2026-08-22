// ==========================================================================
// SAMII OS — GRIOT (T-026) — Storytelling automatique + pack de contenu + Runware
// ==========================================================================
const express = require("express");
const router  = express.Router();
const multer  = require("multer");
const gemini  = require("../services/geminiService");
const workspaceService = require("../services/workspaceService");
const connectorService = require("../services/connectorService");
const meta = require("../services/meta");
const db = require("../services/db");
const journalService = require("../services/journalService");
const CONFIG  = require("../config");
const griotCoutService = require("../services/griotCoutService");

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
});

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

async function getWorkspaceOrRedirect(req, res) {
    const workspaceId = req.session.workspaceId;
    if (!workspaceId) { res.redirect("/hub"); return null; }
    const workspace = await workspaceService.getById(workspaceId);
    if (!workspace) { res.redirect("/hub"); return null; }
    return workspace;
}

function extractJson(text) {
    try {
        const match = text.match(/\{[\s\S]*\}/);
        if (!match) return null;
        return JSON.parse(match[0]);
    } catch {
        return null;
    }
}

// ── GET : Interface Griot ──────────────────────────────────────────────
router.get("/", requireAuth, async (req, res) => {
    const workspace = await getWorkspaceOrRedirect(req, res);
    if (!workspace) return;

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Griot — SAMII</title>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/css/qg-style.css">
    <style>
        .griot-shell { max-width: 780px; margin: 0 auto; padding: 40px 24px 80px; }
        .griot-back { display: inline-flex; align-items: center; gap: 6px; color: var(--text-muted); text-decoration: none; font-size: .82rem; margin-bottom: 24px; }
        .griot-back:hover { color: var(--cyan-tech); }

        .griot-title { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
        .griot-icon-box {
            width: 44px; height: 44px; border-radius: 12px;
            background: radial-gradient(circle, rgba(197,160,89,0.22), rgba(95,212,255,0.06));
            border: 1px solid rgba(197,160,89,0.4);
            display: flex; align-items: center; justify-content: center;
            font-size: 1.3rem; flex-shrink: 0;
            box-shadow: 0 0 20px rgba(197,160,89,0.18);
        }
        .griot-shell h1 { font-family: var(--font-display); color: #fff; font-size: 1.5rem; }
        .griot-shell p.sub { color: var(--text-muted); font-size: .85rem; margin: 8px 0 20px; line-height: 1.6; }

        .griot-card { background: var(--bg-glass); backdrop-filter: blur(12px); border: var(--border-soft); border-radius: 16px; padding: 24px; }
        label { display: block; font-family: var(--font-mono); font-size: .7rem; text-transform: uppercase; letter-spacing: .05em; color: var(--text-muted); margin: 14px 0 6px; }
        input, textarea, select {
            width: 100%; padding: 11px 13px; border-radius: 9px;
            border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.3);
            color: var(--text-main); font-size: .88rem; font-family: var(--font-body);
            transition: border-color .25s ease, box-shadow .25s ease, background .25s ease;
        }
        select { cursor: pointer; }
        select option { background: #0a0d14; color: #F1F0EC; }
        textarea { resize: vertical; min-height: 70px; }
        input:focus, textarea:focus, select:focus {
            outline: none;
            border-color: var(--cyan-tech);
            box-shadow: 0 0 0 3px rgba(95,212,255,0.15), 0 0 20px rgba(95,212,255,0.25);
            background: rgba(95,212,255,0.04);
        }
        .griot-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }

        input[type="file"] { padding: 8px; cursor: pointer; font-size: .8rem; color: var(--text-muted); }
        input[type="file"]::file-selector-button {
            background: rgba(197,160,89,0.15); border: 1px solid rgba(197,160,89,0.3);
            color: var(--gold-og); padding: 6px 12px; border-radius: 6px; cursor: pointer;
            font-weight: 600; margin-right: 10px; transition: background .2s ease;
        }
        input[type="file"]::file-selector-button:hover { background: rgba(197,160,89,0.25); }

        button.griot-submit {
            width: 100%; padding: 14px; margin-top: 18px;
            background: linear-gradient(135deg, var(--gold-og), var(--gold-hover));
            border: none; border-radius: 10px; font-weight: 700; cursor: pointer; color: #000; font-size: .95rem;
            transition: transform .2s ease, box-shadow .2s ease;
        }
        button.griot-submit:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(197,160,89,0.25); }
        button.griot-submit:disabled { opacity: .6; cursor: not-allowed; transform: none; }

        .griot-msg { text-align: center; margin-top: 14px; font-size: .85rem; color: #e55; min-height: 20px; }

        .griot-pack { margin-top: 28px; display: none; flex-direction: column; gap: 16px; }
        .griot-pack-title {
            display: flex; align-items: center; gap: 8px;
            font-family: var(--font-mono); font-size: .72rem; text-transform: uppercase; letter-spacing: .1em;
            color: var(--gold-og); margin-bottom: 4px;
        }
        .griot-pack-title::before, .griot-pack-title::after {
            content: ''; flex: 1; height: 1px; background: linear-gradient(to right, transparent, rgba(197,160,89,0.35), transparent);
        }

        .griot-block {
            position: relative;
            background: radial-gradient(circle at 100% 0%, rgba(197,160,89,0.06), transparent 60%), var(--bg-panel);
            border: 1px solid rgba(197,160,89,0.15);
            border-radius: 16px;
            padding: 18px 20px;
            animation: griot-fade-in .5s ease both;
        }
        @keyframes griot-fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

        .griot-block__header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
        .griot-block__title { display: flex; align-items: center; gap: 8px; font-size: .85rem; font-weight: 700; color: #fff; }
        .griot-block__title i { color: var(--gold-og); }
        .griot-copy-btn {
            background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
            color: var(--text-muted); font-size: .7rem; padding: 5px 11px; border-radius: 20px;
            cursor: pointer; font-family: var(--font-mono); transition: all .2s ease;
        }
        .griot-copy-btn:hover { color: var(--cyan-tech); border-color: var(--cyan-tech); }
        .griot-copy-btn.copied { color: #3ddc84; border-color: #3ddc84; }
        .griot-publish-btn {
            display: block; width: 100%; margin-top: 8px; padding: 9px 12px;
            background: rgba(197,160,89,0.12); border: 1px solid var(--gold-og);
            color: var(--gold-og); font-size: .78rem; font-weight: 700; border-radius: 8px;
            cursor: pointer; font-family: var(--font-mono); transition: all .2s ease;
        }
        .griot-publish-btn:hover { background: var(--gold-og); color: #000; }

        .griot-block__body { color: var(--text-main); font-size: .85rem; line-height: 1.65; white-space: pre-wrap; }

        .griot-hooks { display: flex; flex-direction: column; gap: 8px; }
        .griot-hook-item {
            display: flex; align-items: center; gap: 10px;
            padding: 10px 12px; border-radius: 10px;
            background: rgba(95,212,255,0.05); border: 1px solid rgba(95,212,255,0.15);
            font-size: .84rem; color: var(--text-main);
        }
        .griot-hook-num {
            width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0;
            background: rgba(95,212,255,0.15); color: var(--cyan-tech);
            display: flex; align-items: center; justify-content: center;
            font-family: var(--font-mono); font-size: .72rem; font-weight: 700;
        }

        .griot-tags { display: flex; flex-wrap: wrap; gap: 8px; }
        .griot-tag {
            font-family: var(--font-mono); font-size: .78rem; color: var(--cyan-tech);
            background: rgba(95,212,255,0.08); border: 1px solid rgba(95,212,255,0.2);
            padding: 5px 12px; border-radius: 20px;
        }

        .griot-cta-list { display: flex; flex-direction: column; gap: 8px; }
        .griot-cta-item {
            padding: 10px 12px; border-radius: 10px;
            background: rgba(197,160,89,0.06); border: 1px solid rgba(197,160,89,0.2);
            font-size: .84rem; color: var(--text-main); font-weight: 500;
        }

        .griot-timing {
            display: inline-flex; align-items: center; gap: 8px;
            padding: 8px 16px; border-radius: 20px;
            background: rgba(61,220,132,0.08); border: 1px solid rgba(61,220,132,0.25);
            color: #3ddc84; font-size: .82rem; font-weight: 600;
        }

        @media (max-width: 560px) { .griot-row { grid-template-columns: 1fr; } }
    </style>
</head>
<body data-theme="og">
<div class="griot-shell">
    <a href="/samii" class="griot-back">← Retour à SAMII</a>

    <div class="griot-title">
        <div class="griot-icon-box">🪶</div>
        <h1>Griot</h1>
    </div>
    <p class="sub">Décris ce que tu veux promouvoir, ajoute la photo du produit — SAMII te livre ton pack de contenu et pilote Runware.</p>

    <div class="griot-card">
        <form id="form-griot" enctype="multipart/form-data">
            <label>Réseau</label>
            <select name="reseau" id="select-reseau">
                <option value="youtube">YouTube</option>
                <option value="tiktok">TikTok</option>
                <option value="instagram">Instagram</option>
                <option value="facebook">Facebook</option>
                <option value="linkedin">LinkedIn (post écrit)</option>
                <option value="email">Email / Gmail (message écrit)</option>
            </select>

            <div class="griot-row">
                <div>
                    <label>Format</label>
                    <select name="format" id="select-format">
                        <option value="short">Vidéo courte / Short</option>
                        <option value="long">Vidéo longue</option>
                    </select>
                </div>
                <div>
                    <label>Objectif</label>
                    <select name="objectif">
                        <option value="vendre">Vendre un produit</option>
                        <option value="notoriete">Faire connaître ma marque</option>
                        <option value="promo">Annoncer une promo</option>
                        <option value="fideliser">Fidéliser mes clients</option>
                    </select>
                </div>
            </div>

            <div class="griot-row">
                <div>
                    <label>Type de création</label>
                    <select name="type_creation">
                        <option value="video">Vidéo</option>
                        <option value="image">Image</option>
                    </select>
                </div>
                <div>
                    <label>Durée / Rendu</label>
                    <select name="duree">
                        <option value="15s">15 secondes / Rapide</option>
                        <option value="30s">30 secondes / Standard</option>
                        <option value="60s">60 secondes / Long</option>
                    </select>
                </div>
            </div>

            <label>Moteur de génération</label>
            <select name="moteur" id="select-moteur">
                <option value="runware">Runware — standard (0,20$/s)</option>
                <option value="wan">WAN 2.6 (Alibaba) — rapide, sans son (0,48$/s)</option>
                <option value="h3">H3 (MiniMax) — vidéo + son natif (0,78$/s)</option>
            </select>

            <label>De quoi parle le contenu ?</label>
            <textarea name="sujet" placeholder="Ex : ma nouvelle collection de vestes d'hiver..." required></textarea>

            <label>Ton souhaité (optionnel)</label>
            <input name="ton" placeholder="Ex : dynamique et jeune, élégant et sobre...">

            <label>Photo du produit (optionnel — utilisée par Runware)</label>
            <input type="file" name="client_image" accept="image/*">

            <button type="submit" class="griot-submit">🪶 Générer le pack &amp; média</button>
        </form>
        <div class="griot-msg" id="msg"></div>
    </div>

    <div class="griot-pack" id="pack">
        <div class="griot-pack-title">Pack de contenu &amp; médias</div>
        <div id="pack-content"></div>
    </div>
</div>

<script>
const selectReseau = document.getElementById('select-reseau');
const selectFormat = document.getElementById('select-format');
const formatWrapper = selectFormat.closest('div');

function updateFormatOptions() {
    const reseau = selectReseau.value;
    const isEcrit = reseau === 'linkedin' || reseau === 'email';
    if (isEcrit) {
        formatWrapper.style.display = 'none';
    } else {
        formatWrapper.style.display = 'block';
        const isYoutube = reseau === 'youtube';
        selectFormat.querySelector('option[value="long"]').disabled = !isYoutube;
        if (!isYoutube) selectFormat.value = 'short';
    }
}
selectReseau.addEventListener('change', updateFormatOptions);
updateFormatOptions();

function copyText(text, btn) {
    navigator.clipboard.writeText(text).then(() => {
        const original = btn.textContent;
        btn.textContent = '✅ Copié';
        btn.classList.add('copied');
        setTimeout(() => { btn.textContent = original; btn.classList.remove('copied'); }, 1800);
    });
}

function block(icon, title, bodyHtml, copyValue) {
    const copyBtn = copyValue
        ? '<button type="button" class="griot-copy-btn" onclick=\\'copyText(' + JSON.stringify(copyValue) + ', this)\\'>Copier</button>'
        : '';
    return '<div class="griot-block"><div class="griot-block__header">'
        + '<div class="griot-block__title"><i data-lucide="' + icon + '"></i> ' + title + '</div>'
        + copyBtn + '</div><div class="griot-block__body">' + bodyHtml + '</div></div>';
}

let dernierPack = null;

async function publierSurReseau(url, reseauOverride) {
    const reseau = reseauOverride || selectReseau.value;
    const label = reseau === 'instagram' ? 'Instagram' : (reseau === 'youtube' ? 'YouTube' : 'Facebook');
    if (!confirm('Publier ce visuel maintenant sur ' + label + ' ?')) return;
    try {
        const res = await fetch('/samii/griot/publier', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reseau, legende: dernierPack?.legende || '', imageUrl: url }),
        });
        const json = await res.json();
        alert(json.success ? '✅ Publié sur ' + label + ' !' : '❌ ' + (json.error || 'Erreur lors de la publication.'));
    } catch (err) {
        alert('❌ Erreur réseau.');
    }
}

function renderPack(data) {
    dernierPack = data;
    const container = document.getElementById('pack-content');
    let html = '';

    if (data.hooks?.length) {
        const hooksHtml = '<div class="griot-hooks">' + data.hooks.map((h, i) =>
            '<div class="griot-hook-item"><span class="griot-hook-num">' + (i + 1) + '</span>' + h + '</div>'
        ).join('') + '</div>';
        html += block('zap', 'Accroches', hooksHtml, data.hooks.join('\\n\\n'));
    }

    if (data.script) {
        html += block('film', 'Contenu principal', data.script, data.script);
    }

    if (data.legende) {
        html += block('message-circle', 'Version courte / légende', data.legende, data.legende);
    }

    if (data.medias && data.medias.length > 0) {
        const reseauActuel = selectReseau.value;
        const peutPublier = reseauActuel === 'facebook' || reseauActuel === 'instagram';
        let mediaHtml = '<div style="display:flex;flex-direction:column;gap:12px;">';
        data.medias.forEach((url, idx) => {
            if (url.endsWith('.mp4') || url.includes('video')) {
                mediaHtml += '<div><p style="font-size:.75rem;color:var(--gold-og);margin-bottom:4px;">Variante vidéo #' + (idx + 1) + '</p>'
                    + '<video controls style="width:100%;border-radius:8px;"><source src="' + url + '" type="video/mp4">Ton navigateur ne supporte pas la vidéo.</video>'
                    + '<button type="button" class="griot-publish-btn" onclick=\\'publierSurReseau(' + JSON.stringify(url) + ', ' + JSON.stringify('youtube') + ')\\'>📤 Publier maintenant sur YouTube</button></div>';
            } else {
                const publierBtn = peutPublier
                    ? '<button type="button" class="griot-publish-btn" onclick="publierSurReseau(' + JSON.stringify(url) + ')">📤 Publier maintenant sur ' + (reseauActuel === 'instagram' ? 'Instagram' : 'Facebook') + '</button>'
                    : '';
                mediaHtml += '<div><p style="font-size:.75rem;color:var(--gold-og);margin-bottom:4px;">Variante image #' + (idx + 1) + '</p>'
                    + '<img src="' + url + '" style="width:100%;border-radius:8px;" alt="Généré par Runware">' + publierBtn + '</div>';
            }
        });
        mediaHtml += '</div>';
        html += block('sparkles', 'Médias générés (Runware)', mediaHtml);
    }

    if (data.erreur_media) {
        html += '<div style="background:rgba(220,53,69,.12);border:1px solid rgba(220,53,69,.4);border-radius:8px;padding:12px;color:#ff8a8a;font-size:.85rem;margin-bottom:12px;">⚠️ ' + data.erreur_media + '</div>';
    }

    if (data.hashtags?.length) {
        const tagsHtml = '<div class="griot-tags">' + data.hashtags.map(t => '<span class="griot-tag">' + (t.startsWith('#') ? t : '#' + t) + '</span>').join('') + '</div>';
        html += block('hash', 'Hashtags', tagsHtml, data.hashtags.map(t => t.startsWith('#') ? t : '#' + t).join(' '));
    }

    if (data.miniature) {
        html += block('image', 'Concept de miniature', data.miniature, data.miniature);
    }

    if (data.cta?.length) {
        const ctaHtml = '<div class="griot-cta-list">' + data.cta.map(c => '<div class="griot-cta-item">' + c + '</div>').join('') + '</div>';
        html += block('megaphone', "Appels à l'action", ctaHtml, data.cta.join('\\n'));
    }

    if (data.meilleur_moment) {
        html += '<div><span class="griot-timing"><i data-lucide="clock"></i> Meilleur moment : ' + data.meilleur_moment + '</span></div>';
    }

    container.innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

document.getElementById('form-griot').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg  = document.getElementById('msg');
    const pack = document.getElementById('pack');
    const btn  = e.target.querySelector('button');
    const formData = new FormData(e.target);

    btn.disabled = true;
    msg.textContent = "🪶 SAMII rédige et pilote Runware...";
    pack.style.display = 'none';

    try {
        const res  = await fetch('/samii/griot', { method: 'POST', body: formData });
        const json = await res.json();

        if (json.success && json.pack) {
            msg.textContent = '';
            renderPack(json.pack);
            pack.style.display = 'flex';
        } else {
            msg.textContent = json.error || "❌ SAMII n'a pas pu générer le contenu. Réessaie.";
        }
    } catch (err) {
        msg.textContent = '❌ Erreur réseau. Réessaie.';
    } finally {
        btn.disabled = false;
    }
});
</script>
<script src="https://unpkg.com/lucide@latest"></script>
</body>
</html>`);
});

// ── POST : Traitement Gemini + génération média (Runware / WAN / H3) ────
router.post("/", requireAuth, upload.single("client_image"), async (req, res) => {
    try {
        const { reseau, format, objectif, sujet, ton, type_creation, duree, nombre_variantes, moteur } = req.body;
        const moteurChoisi = ["wan", "h3"].includes(moteur) ? moteur : "runware";

        if (!sujet || !sujet.trim()) {
            return res.json({ success: false, error: "Décris ton produit ou ton sujet." });
        }

        const objectifsLabel = {
            vendre: "vendre un produit",
            notoriete: "faire connaître la marque",
            promo: "annoncer une promotion",
            fideliser: "fidéliser les clients existants",
        };

        const formatLabel = format === "long" ? "vidéo longue (2-5 minutes)" : "vidéo courte / short (15-45 secondes)";

        let prompt;

        if (reseau === "linkedin") {
            prompt = "Tu es SAMII, storyteller de marque pour OG Technology. Un marchand a besoin d'un post LinkedIn professionnel complet.\n\n"
                + `Objectif : ${objectifsLabel[objectif] || objectif}\n`
                + `Sujet : ${sujet}\n`
                + (ton ? `Ton souhaité : ${ton}\n` : "Ton : professionnel, crédible, engageant.\n")
                + "\nRéponds UNIQUEMENT avec un objet JSON valide, sans texte autour, sans balises markdown, dans ce format exact :\n"
                + '{\n  "hooks": ["accroche 1", "accroche 2", "accroche 3"],\n  "script": "le corps complet du post LinkedIn",\n  "legende": "une version courte alternative",\n  "hashtags": ["motcle1", "motcle2", "motcle3"],\n  "cta": ["cta 1", "cta 2", "cta 3"],\n  "meilleur_moment": "jour et heure recommandés"\n}';

        } else if (reseau === "email") {
            prompt = "Tu es SAMII, storyteller de marque pour OG Technology. Un marchand a besoin d'un email marketing complet.\n\n"
                + `Objectif : ${objectifsLabel[objectif] || objectif}\n`
                + `Sujet : ${sujet}\n`
                + (ton ? `Ton souhaité : ${ton}\n` : "Ton : clair, persuasif, chaleureux.\n")
                + "\nRéponds UNIQUEMENT avec un objet JSON valide, sans texte autour, sans balises markdown, dans ce format exact :\n"
                + '{\n  "hooks": ["objet d\'email 1", "objet 2", "objet 3"],\n  "script": "le corps complet de l\'email",\n  "legende": "aperçu pré-header",\n  "hashtags": [],\n  "cta": ["cta 1", "cta 2", "cta 3"],\n  "meilleur_moment": "jour et heure recommandés"\n}';

        } else {
            prompt = `Tu es SAMII, storyteller de marque pour OG Technology. Un marchand a besoin d'un pack de contenu ${type_creation || 'vidéo'} complet.\n\n`
                + `Réseau : ${reseau}\n`
                + `Format : ${formatLabel}\n`
                + `Durée ciblée : ${duree || '30s'}\n`
                + `Objectif : ${objectifsLabel[objectif] || objectif}\n`
                + `Sujet / produit : ${sujet}\n`
                + (ton ? `Ton souhaité : ${ton}\n` : "Ton : adapté au réseau, orienté conversion.\n")
                + "\nGénère aussi une description visuelle précise du plan principal (pour piloter une génération d'image/vidéo IA), dans le champ \"prompt_visuel\".\n\n"
                + "Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, sans balises markdown, dans ce format exact :\n"
                + '{\n  "hooks": ["accroche 1", "accroche 2", "accroche 3"],\n  "script": "le script complet",\n  "legende": "la légende prête à publier",\n  "hashtags": ["motcle1", "motcle2", "motcle3", "motcle4", "motcle5"],\n  "miniature": "description pour la miniature",\n  "cta": ["cta 1", "cta 2", "cta 3"],\n  "meilleur_moment": "jour et heure recommandés",\n  "prompt_visuel": "description visuelle détaillée du produit/scène, style photo pro"\n}';
        }

        const result = await gemini.chat({
            message: prompt,
            context: { source: "griot", workspaceId: req.session.workspaceId },
            useTools: false,
        });

        const rawText = result.type === "text" ? result.text : "";
        const pack = extractJson(rawText);

        if (!pack) {
            return res.json({ success: false, error: "SAMII n'a pas pu structurer sa réponse. Réessaie." });
        }
       console.log("🔍 DEBUG pack complet reçu de Gemini :", JSON.stringify(pack, null, 2)); 

        pack.medias = [];

        // ── WAN 2.6 / H3 (OpenRouter) — génération vidéo asynchrone, facturée
        // au temps réel mesuré (6x le prix fournisseur, services/griotCoutService.js) ──
        if ((moteurChoisi === "wan" || moteurChoisi === "h3") && pack.prompt_visuel) {
            const openrouterVideo = require("../services/openrouterVideo");
            let imageBase64 = null;
            if (req.file && req.file.buffer) {
                imageBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
            }
            const dureeSecondes = parseInt(duree, 10) || 15;
            const resultat = await openrouterVideo.genererVideo({
                moteur: moteurChoisi,
                prompt: pack.prompt_visuel,
                dureeSecondes,
                imageBase64,
            });

            if (resultat.dureeMs) {
                griotCoutService.enregistrerGeneration(req.session.workspaceId, resultat.dureeMs, moteurChoisi).catch(() => {});
            }

            if (resultat.success) {
                // Le lien direct OpenRouter exige un header Authorization qu'un
                // <video src="..."> ne peut pas envoyer — on sert le fichier via
                // notre propre route, qui elle porte la clé côté serveur.
                pack.medias.push(`/samii/griot/media/${resultat.jobId}`);
            } else {
                console.error(`⚠️ Erreur génération ${moteurChoisi} (OpenRouter) :`, resultat.error);
                pack.erreur_media = `Génération vidéo échouée (${moteurChoisi.toUpperCase()}) : ${resultat.error}`;
            }
        }

        // ── Runware — uniquement si une clé est configurée, sinon on ignore silencieusement ──
        const runwareApiKey = CONFIG.RUNWARE?.API_KEY;
if (moteurChoisi === "runware" && runwareApiKey && pack.prompt_visuel) {
            console.log("🔑 DEBUG Runware — clé présente ?", !!runwareApiKey, "| prompt_visuel présent ?", !!pack.prompt_visuel);
            try {
                const runwareTask = {
                    taskType: type_creation === "video" ? "videoInference" : "imageInference",
                    taskUUID: crypto.randomUUID(),
                    positivePrompt: pack.prompt_visuel,
                    numberResults: parseInt(nombre_variantes, 10) || 1,
                    width: 1024,
                    height: 1024,
                };

                if (req.file && req.file.buffer) {
                    const b64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
                    runwareTask.inputImage = b64Image;
                    runwareTask.strength = 0.75;
                }

                const debutGeneration = Date.now();
                const runwareRes = await fetch("https://api.runware.ai/v1", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${runwareApiKey}`,
                    },
                    body: JSON.stringify([runwareTask]),
                });
const runwareData = await runwareRes.json();
console.log("📸 DEBUG Runware — statut HTTP :", runwareRes.status, "| réponse complète :", JSON.stringify(runwareData));
                // Facturé au temps réel de génération (0,20$/seconde, voir
                // services/griotCoutService.js) — jamais bloquant, accumulé pour
                // le prochain renouvellement, que la génération réussisse ou non
                // (Runware facture le calcul GPU même en cas d'échec côté rendu).
                griotCoutService.enregistrerGeneration(req.session.workspaceId, Date.now() - debutGeneration).catch(() => {});

if (runwareData && Array.isArray(runwareData.data)) {

                    runwareData.data.forEach(item => {
                        if (item.imageURL) pack.medias.push(item.imageURL);
                        if (item.videoURL) pack.medias.push(item.videoURL);
                    });
                }
                if (pack.medias.length === 0) {
                    const raisonRunware = runwareData?.errors?.[0]?.message || runwareData?.error?.message || `statut HTTP ${runwareRes.status}`;
                    console.error("⚠️ Runware n'a renvoyé aucun média :", raisonRunware);
                    pack.erreur_media = `Génération média échouée (Runware) : ${raisonRunware}`;
                }
           } catch (runwareErr) {
    console.error("⚠️ Erreur appel Runware :", runwareErr.message, runwareErr.stack);
    pack.erreur_media = `Génération média échouée (Runware) : ${runwareErr.message}`;
}
        } else if (moteurChoisi === "runware" && !runwareApiKey) {
            pack.erreur_media = "Génération média indisponible : clé Runware non configurée côté serveur.";
        }

        if (pack.medias.length === 0 && !pack.erreur_media && !pack.prompt_visuel) {
            pack.erreur_media = "SAMII n'a pas généré de description visuelle (prompt_visuel manquant) — aucun média n'a pu être créé.";
        }

        res.json({ success: true, pack });

    } catch (err) {
        console.error("❌ POST /samii/griot :", err.message);
        res.json({ success: false, error: "Erreur lors de la génération. Réessaie." });
    }
});

// ── Sert une vidéo générée par OpenRouter (WAN/H3) — le lien OpenRouter
// exige un header Authorization que le navigateur ne peut pas envoyer via
// une simple balise <video>, donc on relaie ici avec la clé côté serveur.
router.get("/media/:jobId", requireAuth, async (req, res) => {
    try {
        const upstream = await fetch(
            `https://openrouter.ai/api/v1/videos/${req.params.jobId}/content?index=0`,
            { headers: { Authorization: `Bearer ${CONFIG.OPENROUTER.API_KEY}` } }
        );
        if (!upstream.ok || !upstream.body) {
            return res.status(upstream.status || 502).send("Vidéo indisponible.");
        }
        res.setHeader("Content-Type", upstream.headers.get("content-type") || "video/mp4");
        const { Readable } = require("stream");
        Readable.fromWeb(upstream.body).pipe(res);
    } catch (err) {
        console.error("❌ GET /samii/griot/media/:jobId :", err.message);
        res.status(502).send("Erreur de relais vidéo.");
    }
});

// ── Publie directement un visuel généré sur la page Facebook/Instagram
// connectée du workspace (au lieu de laisser le marchand copier-coller).
router.post("/publier", requireAuth, async (req, res) => {
    try {
        const { reseau, legende, imageUrl } = req.body;
        if (!["facebook", "instagram", "youtube"].includes(reseau)) {
            return res.json({ success: false, error: "Publication directe disponible pour Facebook, Instagram et YouTube." });
        }
        if (!imageUrl) return res.json({ success: false, error: "Choisis un visuel généré à publier." });

        const workspaceId = req.session.workspaceId;

        // ── YouTube : imageUrl porte ici l'URL de la vidéo générée (Runware
        // ou notre relais OpenRouter) — le média doit être un fichier vidéo,
        // pas une image (voir services/google.js).
        if (reseau === "youtube") {
            const google = require("../services/google");
            const axios = require("axios");
            const videoRes = await axios.get(
                imageUrl.startsWith("/") ? `${CONFIG.APP_URL}${imageUrl}` : imageUrl,
                {
                    responseType: "arraybuffer",
                    timeout: 90000,
                    headers: imageUrl.startsWith("/samii/griot/media/") ? { Cookie: req.headers.cookie || "" } : {},
                }
            );
            const buffer = Buffer.from(videoRes.data);
            const mimeType = videoRes.headers["content-type"] || "video/mp4";
            const resultat = await google.uploadYoutubeVideo(workspaceId, {
                buffer, mimeType,
                title: (legende || "Vidéo SAMII").slice(0, 90),
                description: legende || "",
            });
            if (!resultat.success) return res.json({ success: false, error: resultat.error });

            await journalService.log({ action: "youtube.publication", details: `Vidéo publiée via Griot — ${resultat.link}`, workspaceId });
            return res.json({ success: true, link: resultat.link });
        }

        const connecteur = await connectorService.getOne(workspaceId, reseau);
        if (!connecteur?.actif || !connecteur.config?.pageAccessToken) {
            const label = reseau === "instagram" ? "Instagram" : "Facebook";
            return res.json({ success: false, error: `Connecte d'abord ta page ${label} via /auth/meta.` });
        }

        if (reseau === "facebook") {
            await meta.publishPagePost(
                { pageId: connecteur.config.pageId, accessToken: connecteur.config.pageAccessToken },
                { message: legende || "", imageUrl }
            );
        } else {
            await meta.publishInstagramPost(
                { igAccountId: connecteur.config.igAccountId, accessToken: connecteur.config.pageAccessToken },
                { imageUrl, caption: legende || "" }
            );
        }

        await journalService.log({ action: `${reseau}.publication`, details: "Post publié via Griot", workspaceId });

        res.json({ success: true });
    } catch (err) {
        console.error("❌ POST /samii/griot/publier :", err.response?.data || err.message);
        res.json({ success: false, error: err.response?.data?.error?.message || "Erreur lors de la publication." });
    }
});

module.exports = router;
