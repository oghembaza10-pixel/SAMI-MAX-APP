// ==========================================================================
// SAMII OS — MARKETPLACE — Page d'accueil, catégories, annonces
// ==========================================================================
const express = require("express");
const router  = express.Router();
const airtable = require("../services/airtable");
const workspaceService = require("../services/workspaceService");

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

const CATEGORIES = [
    { id: "tous", icon: "🛍️", label: "Tout" },
    { id: "electronique", icon: "📱", label: "Électronique" },
    { id: "mode", icon: "👕", label: "Mode" },
    { id: "maison", icon: "🏠", label: "Maison" },
    { id: "services", icon: "🛎️", label: "Services" },
    { id: "vehicules", icon: "🚗", label: "Véhicules" },
    { id: "loisirs", icon: "🎮", label: "Loisirs" },
    { id: "autre", icon: "📦", label: "Autre" },
];

router.get("/", requireAuth, async (req, res) => {
    const { categorie, recherche, ville } = req.query;
    const isClient = req.session?.typeCompte === "client";

    let filtres = ['{actif}=1'];
    if (categorie && categorie !== "tous") filtres.push(`{categorie}="${categorie}"`);
    if (recherche) filtres.push(`SEARCH(LOWER("${recherche}"), LOWER({titre}))`);
    if (ville) filtres.push(`SEARCH(LOWER("${ville}"), LOWER({ville}))`);

    let annonces = [];
    try {
        annonces = await airtable.find("ANNONCES", `AND(${filtres.join(",")})`, 60);
    } catch (err) {
        console.warn("⚠️ Marketplace annonces :", err.message);
    }

    const cardsHtml = annonces.map(a => {
        const f = a.fields;
        return `
        <a href="/vitrine/${f.vendeur_id}" class="mp-card">
            <div class="mp-card__image" ${f.photo_url ? `style="background-image:url('${f.photo_url}')"` : ''}>
                ${!f.photo_url ? '<i data-lucide="image"></i>' : ''}
            </div>
            <div class="mp-card__body">
                <h3>${f.titre}</h3>
                <div class="mp-card__price">${f.prix || '—'}</div>
                <div class="mp-card__meta">
                    <span>📍 ${f.ville || '—'}</span>
                    <span>${f.type_vendeur === 'marchand' ? '🏪' : '👤'} ${f.vendeur_nom || 'Vendeur'}</span>
                </div>
            </div>
        </a>`;
    }).join("");

    const categoriesHtml = CATEGORIES.map(c => `
        <a href="/marketplace?categorie=${c.id}${recherche ? `&recherche=${recherche}` : ''}"
           class="mp-cat-btn ${categorie === c.id || (!categorie && c.id === 'tous') ? 'active' : ''}">
            <span class="icon">${c.icon}</span><span class="label">${c.label}</span>
        </a>
    `).join("");

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Marketplace — OG Empire</title>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="${isClient ? '/css/client-style.css' : '/css/qg-style.css'}">
    <style>
        .mp-back { display: inline-flex; align-items: center; gap: 6px; color: var(--text-muted); text-decoration: none; font-size: .82rem; padding: 24px 36px 0; }
        .mp-back:hover { color: var(--cyan-tech); }

        .mp-hero { padding: 26px 36px 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; }
        .mp-hero h1 { font-family: var(--font-display); color: #fff; font-size: 1.6rem; }
        .mp-hero p { color: var(--text-muted); font-size: .85rem; margin-top: 6px; }
        .mp-publish-btn {
            padding: 12px 22px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: .88rem;
            background: linear-gradient(135deg, #9d5cff, #b47fff); color: #fff;
        }

        .mp-search { display: flex; gap: 10px; padding: 0 36px 20px; flex-wrap: wrap; }
        .mp-search input {
            flex: 1; min-width: 180px; padding: 12px 14px; border-radius: 10px;
            border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.3);
            color: var(--text-main); font-size: .88rem;
        }
        .mp-search button { padding: 12px 24px; border-radius: 10px; border: none; font-weight: 700; cursor: pointer; background: var(--gold-og, #9d5cff); color: #000; }

        .mp-cats { display: flex; gap: 8px; padding: 0 36px 26px; overflow-x: auto; }
        .mp-cat-btn {
            display: flex; align-items: center; gap: 6px; padding: 9px 16px; border-radius: 20px;
            background: var(--bg-panel, var(--bg-glass)); border: 1px solid rgba(255,255,255,0.08);
            color: var(--text-muted); text-decoration: none; font-size: .82rem; white-space: nowrap; flex-shrink: 0;
        }
        .mp-cat-btn.active { border-color: rgba(157,92,255,0.5); background: rgba(157,92,255,0.12); color: #fff; }

        .mp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; padding: 0 36px 60px; max-width: 1300px; }
        .mp-card {
            display: block; text-decoration: none;
            background: var(--bg-panel, var(--bg-glass)); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px;
            overflow: hidden; transition: transform .25s ease, border-color .25s ease;
        }
        .mp-card:hover { transform: translateY(-4px); border-color: rgba(157,92,255,0.4); }
        .mp-card__image {
            height: 140px; background: rgba(157,92,255,0.06) center/cover;
            display: flex; align-items: center; justify-content: center; color: var(--text-muted);
        }
        .mp-card__body { padding: 14px; }
        .mp-card__body h3 { color: #fff; font-size: .88rem; margin-bottom: 6px; }
        .mp-card__price { color: #3ddc84; font-weight: 700; font-size: .95rem; margin-bottom: 8px; }
        .mp-card__meta { display: flex; flex-direction: column; gap: 3px; font-size: .72rem; color: var(--text-muted); }
        .mp-empty { color: var(--text-muted); text-align: center; padding: 50px; grid-column: 1/-1; }

        @media (max-width: 700px) {
            .mp-back, .mp-hero, .mp-search, .mp-cats, .mp-grid { padding-left: 20px; padding-right: 20px; }
        }
    </style>
</head>
<body>
    <a href="${isClient ? '/client-qg' : '/qg'}" class="mp-back">← Retour</a>

    <div class="mp-hero">
        <div>
            <h1>🏪 Marketplace</h1>
            <p>Produits, services, offres — tout l'écosystème OG Empire.</p>
        </div>
        <a href="/marketplace/publier" class="mp-publish-btn">➕ Publier une annonce</a>
    </div>

    <form class="mp-search" method="GET">
        <input type="hidden" name="categorie" value="${categorie || 'tous'}">
        <input type="text" name="recherche" placeholder="Rechercher un produit, un service..." value="${recherche || ''}">
        <input type="text" name="ville" placeholder="Ville" value="${ville || ''}">
        <button type="submit">🔍 Chercher</button>
    </form>

    <div class="mp-cats">${categoriesHtml}</div>

    <div class="mp-grid">
        ${annonces.length ? cardsHtml : '<div class="mp-empty">Aucune annonce pour l\\'instant. Sois le premier à publier !</div>'}
    </div>

<script src="https://unpkg.com/lucide@latest"></script>
<script>if (typeof lucide !== "undefined") lucide.createIcons();</script>
</body>
</html>`);
});

router.get("/publier", requireAuth, async (req, res) => {
    const isClient = req.session?.typeCompte === "client";
    const categoriesOptions = CATEGORIES.filter(c => c.id !== "tous")
        .map(c => `<option value="${c.id}">${c.icon} ${c.label}</option>`).join("");

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Publier une annonce — Marketplace</title>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="${isClient ? '/css/client-style.css' : '/css/qg-style.css'}">
    <style>
        .pb-shell { max-width: 560px; margin: 0 auto; padding: 40px 24px 80px; }
        .pb-back { display: inline-flex; align-items: center; gap: 6px; color: var(--text-muted); text-decoration: none; font-size: .82rem; margin-bottom: 24px; }
        .pb-shell h1 { font-family: var(--font-display); color: #fff; font-size: 1.5rem; margin-bottom: 24px; }
        .pb-card { background: var(--bg-glass); backdrop-filter: blur(12px); border: var(--border-soft); border-radius: 16px; padding: 24px; }
        label { display: block; font-family: var(--font-mono); font-size: .7rem; text-transform: uppercase; letter-spacing: .05em; color: var(--text-muted); margin: 14px 0 6px; }
        input, textarea, select {
            width: 100%; padding: 11px 13px; border-radius: 9px;
            border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.3);
            color: var(--text-main); font-size: .88rem; font-family: var(--font-body);
        }
        textarea { resize: vertical; min-height: 80px; }
        .pb-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        button { width: 100%; padding: 14px; margin-top: 18px; background: var(--gold-og, #9d5cff); border: none; border-radius: 10px; font-weight: 700; cursor: pointer; color: #000; }
        .pb-msg { text-align: center; margin-top: 14px; font-size: .85rem; color: #e55; min-height: 20px; }
        .pb-msg.ok { color: #3ddc84; }
        @media (max-width: 560px) { .pb-row { grid-template-columns: 1fr; } }
    </style>
</head>
<body>
<div class="pb-shell">
    <a href="/marketplace" class="pb-back">← Retour à la Marketplace</a>
    <h1>➕ Publier une annonce</h1>
    <div class="pb-card">
        <form id="form-publier">
            <label>Titre</label>
            <input name="titre" placeholder="Ex : iPhone 12 comme neuf" required>

            <div class="pb-row">
                <div>
                    <label>Catégorie</label>
                    <select name="categorie" required>${categoriesOptions}</select>
                </div>
                <div>
                    <label>Prix</label>
                    <input name="prix" placeholder="Ex : 45000 DZD" required>
                </div>
            </div>

            <label>Description</label>
            <textarea name="description" placeholder="Décris ton produit ou service..."></textarea>

            <label>Photo (lien vers une image, optionnel)</label>
            <input name="photo_url" placeholder="https://...">

            <div class="pb-row">
                <div>
                    <label>Ville</label>
                    <input name="ville" placeholder="Ex : Alger" required>
                </div>
                <div>
                    <label>Pays</label>
                    <input name="pays" placeholder="Ex : Algérie" required>
                </div>
            </div>

            <button type="submit">Publier</button>
        </form>
        <div class="pb-msg" id="msg"></div>
    </div>
</div>
<script>
document.getElementById('form-publier').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('msg');
    const btn = e.target.querySelector('button');
    const data = Object.fromEntries(new FormData(e.target));

    btn.disabled = true;
    msg.textContent = '⏳ Publication...';
    msg.className = 'pb-msg';

    const res = await fetch('/marketplace/publier', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    const json = await res.json();
    if (json.success) {
        msg.textContent = '✅ Annonce publiée !';
        msg.className = 'pb-msg ok';
        setTimeout(() => window.location.href = '/marketplace', 1000);
    } else {
        msg.textContent = json.error || '❌ Erreur.';
        btn.disabled = false;
    }
});
</script>
</body>
</html>`);
});

router.post("/publier", requireAuth, async (req, res) => {
    try {
        const { titre, categorie, prix, description, photo_url, ville, pays } = req.body;
        if (!titre || !categorie || !prix || !ville || !pays) {
            return res.json({ success: false, error: "Tous les champs obligatoires doivent être remplis." });
        }

        const isClient = req.session?.typeCompte === "client";
        let vendeurNom = req.session.nom || "Vendeur";

        if (!isClient && req.session.workspaceId) {
            const ws = await workspaceService.getById(req.session.workspaceId);
            if (ws) vendeurNom = ws.nom;
        }

        await airtable.create("ANNONCES", {
            titre,
            categorie,
            prix,
            description: description || "",
            photo_url: photo_url || "",
            ville,
            pays,
            type_vendeur: isClient ? "client" : "marchand",
            vendeur_id: req.session.userId,
            vendeur_nom: vendeurNom,
            actif: true,
            date_creation: new Date().toISOString(),
        });

        res.json({ success: true });
    } catch (err) {
        console.error("❌ POST /marketplace/publier :", err.message);
        res.json({ success: false, error: "Erreur lors de la publication." });
    }
});

module.exports = router;
