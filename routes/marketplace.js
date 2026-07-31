// ==========================================================================
// SAMII OS — MARKETPLACE — Page d'accueil, catégories, annonces, upload photo
// ==========================================================================
const express = require("express");
const router  = express.Router();
const airtable = require("../services/airtable");
const workspaceService = require("../services/workspaceService");

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

const CLOUDINARY_CLOUD_NAME = "ojwx5hft";
const CLOUDINARY_PRESET = "MARKETPLACE OG";

const CATEGORIES = [
    { id: "tous",           icon: "layout-grid",   label: "Tout" },
    { id: "electronique",   icon: "smartphone",    label: "Électronique" },
    { id: "mode",           icon: "shirt",         label: "Mode" },
    { id: "beaute",         icon: "sparkles",      label: "Beauté" },
    { id: "maison",         icon: "home",          label: "Maison" },
    { id: "electromenager", icon: "washing-machine", label: "Électro." },
    { id: "sport",          icon: "dumbbell",      label: "Sport" },
    { id: "loisirs",        icon: "gamepad-2",     label: "Loisirs" },
    { id: "livres",         icon: "book-open",     label: "Livres" },
    { id: "vehicules",      icon: "car",           label: "Véhicules" },
    { id: "immobilier",     icon: "building-2",    label: "Immobilier" },
    { id: "animaux",        icon: "paw-print",     label: "Animaux" },
    { id: "alimentation",   icon: "utensils",      label: "Alimentation" },
    { id: "services",       icon: "concierge-bell",label: "Services" },
    { id: "artisanat",      icon: "palette",       label: "Artisanat" },
    { id: "bebe",           icon: "baby",          label: "Bébé" },
    { id: "bureau",         icon: "briefcase",     label: "Bureau" },
    { id: "autre",          icon: "package",       label: "Autre" },
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

    const catInfo = (id) => CATEGORIES.find(c => c.id === id) || { icon: "package", label: id };

    const cardsHtml = annonces.map(a => {
        const f = a.fields;
        const cat = catInfo(f.categorie);
        return `
        <a href="/vitrine/${f.vendeur_id}" class="og-card">
            <div class="og-card__media">
                <span class="og-card__badge"><i data-lucide="${cat.icon}"></i> ${cat.label}</span>
                ${f.photo_url ? `<img src="${f.photo_url}" alt="${f.titre}" loading="lazy">` : '<i data-lucide="image" class="og-card__placeholder-icon"></i>'}
                <div class="og-card__price-tag">${f.prix || '—'}</div>
            </div>
            <div class="og-card__content">
                <h3 class="og-card__title">${f.titre}</h3>
                <div class="og-card__meta-grid">
                    <span><i data-lucide="map-pin"></i> ${f.ville || '—'}</span>
                    <span><i data-lucide="${f.type_vendeur === 'marchand' ? 'store' : 'user'}"></i> ${f.vendeur_nom || 'Vendeur'}</span>
                </div>
            </div>
        </a>`;
    }).join("");

    const categoriesHtml = CATEGORIES.map(c => `
        <a href="/marketplace?categorie=${c.id}${recherche ? `&recherche=${encodeURIComponent(recherche)}` : ''}${ville ? `&ville=${encodeURIComponent(ville)}` : ''}"
            class="og-cat-chip ${categorie === c.id || (!categorie && c.id === 'tous') ? 'active' : ''}">
            <i data-lucide="${c.icon}"></i><span>${c.label}</span>
        </a>
    `).join("");

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Marketplace — OG Empire</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700;800&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
    <style>
        /* ==========================================================================
           OG EMPIRE — MARKETPLACE SUPREME HYBRID EDITION (PIXEL BY PIXEL)
           NOIR PROFOND & OR LUXE x BLEU TECH FUTURISTE
           ========================================================================== */
        :root {
            --bg-deep: #030305;
            --bg-panel: rgba(10, 10, 14, 0.82);
            --bg-panel-hover: rgba(16, 16, 22, 0.92);
            --gold-og: #d4af37;
            --gold-hover: #f3e5ab;
            --gold-dim: rgba(212, 175, 55, 0.15);
            --gold-glow: 0 0 30px rgba(212, 175, 55, 0.22);
            --cyan-tech: #00f0ff;
            --cyan-dim: rgba(0, 240, 255, 0.12);
            --cyan-glow: 0 0 25px rgba(0, 240, 255, 0.22);
            --border-gold: 1px solid rgba(212, 175, 55, 0.28);
            --border-cyan: 1px solid rgba(0, 240, 255, 0.32);
            --text-main: #f5f5f7;
            --text-muted: #8e8e93;
            --font-display: 'Cinzel', serif;
            --font-body: 'Inter', sans-serif;
            --font-mono: 'JetBrains Mono', monospace;
            --ease-premium: cubic-bezier(0.16, 1, 0.3, 1);
        }

        body {
            background-color: var(--bg-deep);
            color: var(--text-main);
            font-family: var(--font-body);
            margin: 0; padding: 0;
            overflow-x: hidden;
        }

        /* ── FOND IMMERSIF NÉON & OR ── */
        .og-bg-fx {
            position: fixed; inset: 0; z-index: -1; pointer-events: none; overflow: hidden;
        }
        .og-bg-grid {
            position: absolute; inset: 0;
            background-image: 
                linear-gradient(rgba(212, 175, 55, 0.03) 1px, transparent 1px),
                linear-gradient(90deg, rgba(0, 240, 255, 0.03) 1px, transparent 1px);
            background-size: 60px 60px;
            animation: ogGridMove 35s linear infinite;
            mask-image: radial-gradient(ellipse 80% 60% at 50% 0%, black 30%, transparent 90%);
        }
        @keyframes ogGridMove { from { background-position: 0 0; } to { background-position: 60px 60px; } }

        .og-ambient-glow {
            position: absolute; width: 600px; height: 600px; border-radius: 50%;
            filter: blur(150px); opacity: .14; z-index: -1;
            animation: ogGlowFloat 18s ease-in-out infinite;
        }
        .og-ambient-glow.gold { background: var(--gold-og); left: -150px; top: -100px; }
        .og-ambient-glow.cyan { background: var(--cyan-tech); right: -150px; top: 25%; animation-delay: 6s; }
        @keyframes ogGlowFloat {
            0%, 100% { transform: translateY(0) scale(1); }
            50% { transform: translateY(-30px) scale(1.05); }
        }

        /* ── HEADER STICKY & MEGA NAVIGATION ── */
        .og-header {
            position: sticky; top: 0; z-index: 100;
            background: rgba(3, 3, 5, 0.88);
            backdrop-filter: blur(20px);
            border-bottom: 1px solid rgba(255, 255, 255, 0.06);
            padding: 16px 24px;
            display: flex; flex-direction: column; gap: 16px;
        }
        .og-header__top {
            display: flex; justify-content: space-between; align-items: center; max-width: 1400px; margin: 0 auto; width: 100%;
        }
        .og-back-link {
            display: inline-flex; align-items: center; gap: 8px;
            color: var(--text-muted); text-decoration: none; font-size: 0.85rem;
            transition: color 0.25s var(--ease-premium);
        }
        .og-back-link i { width: 16px; height: 16px; color: var(--cyan-tech); }
        .og-back-link:hover { color: var(--cyan-tech); }

        .og-brand-title {
            font-family: var(--font-display); color: #fff; font-size: 1.6rem; font-weight: 700;
            display: flex; align-items: center; gap: 12px; letter-spacing: 0.03em;
            margin: 0; text-shadow: 0 0 35px rgba(212,175,55,0.3);
        }
        .og-brand-title i { color: var(--gold-og); width: 28px; height: 28px; }

        .og-publish-cta {
            display: inline-flex; align-items: center; gap: 10px;
            padding: 12px 22px; border-radius: 14px; text-decoration: none;
            background: linear-gradient(135deg, var(--gold-og), var(--gold-hover));
            color: #000; font-weight: 700; font-size: 0.88rem; font-family: var(--font-display);
            box-shadow: 0 8px 25px rgba(212,175,55,0.25);
            transition: transform 0.3s var(--ease-premium), box-shadow 0.3s var(--ease-premium);
            letter-spacing: 0.03em;
        }
        .og-publish-cta:hover { transform: translateY(-2px); box-shadow: 0 12px 30px rgba(212,175,55,0.45); }
        .og-publish-cta i { width: 18px; height: 18px; }

        /* ── BARRE DE RECHERCHE CENTRALE MASSIVE (TYPE AMAZON / LEBONCOIN) ── */
        .og-search-bar {
            max-width: 1400px; margin: 0 auto; width: 100%;
            display: flex; gap: 10px; background: var(--bg-panel);
            border: var(--border-gold); border-radius: 18px; padding: 8px;
            box-shadow: 0 15px 35px rgba(0,0,0,0.6), var(--gold-glow);
            backdrop-filter: blur(15px);
        }
        .og-search-field {
            flex: 1; display: flex; align-items: center; gap: 12px; padding: 0 16px;
            background: rgba(0, 0, 0, 0.45); border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.05);
            transition: border-color 0.25s ease, box-shadow 0.25s ease;
        }
        .og-search-field:focus-within { border-color: var(--cyan-tech); box-shadow: var(--cyan-glow); }
        .og-search-field i { width: 18px; height: 18px; color: var(--gold-og); flex-shrink: 0; }
        .og-search-field input {
            width: 100%; background: transparent; border: none; color: #fff;
            font-size: 0.9rem; font-family: var(--font-body); padding: 13px 0; outline: none;
        }
        .og-search-field input::placeholder { color: var(--text-muted); }
        
        .og-search-submit {
            background: linear-gradient(135deg, var(--cyan-tech), #0099ff);
            color: #000; border: none; border-radius: 12px; padding: 0 28px;
            font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center;
            box-shadow: var(--cyan-glow); transition: transform 0.2s var(--ease-premium); flex-shrink: 0;
        }
        .og-search-submit:hover { transform: scale(1.03); }
        .og-search-submit i { width: 18px; height: 18px; color: #000; }

        /* ── PILLS DE CATÉGORIES (STYLE VINTED / APP MOBILE) ── */
        .og-categories-container {
            max-width: 1400px; margin: 0 auto; width: 100%;
            display: flex; gap: 10px; overflow-x: auto; padding: 4px 0 6px;
            scrollbar-width: none; -ms-overflow-style: none;
        }
        .og-categories-container::-webkit-scrollbar { display: none; }
        
        .og-cat-chip {
            display: flex; align-items: center; gap: 8px; padding: 12px 18px;
            background: var(--bg-panel); border: 1px solid rgba(255, 255, 255, 0.07);
            border-radius: 30px; color: var(--text-muted); text-decoration: none;
            font-size: 0.78rem; font-weight: 500; white-space: nowrap; flex-shrink: 0;
            backdrop-filter: blur(10px);
            transition: all 0.3s var(--ease-premium);
        }
        .og-cat-chip i { width: 16px; height: 16px; color: var(--text-muted); transition: color 0.3s ease; }
        .og-cat-chip:hover { border-color: rgba(212,175,55,0.4); color: #fff; background: var(--bg-panel-hover); }
        .og-cat-chip:hover i { color: var(--gold-og); }
        
        .og-cat-chip.active {
            background: linear-gradient(135deg, rgba(212,175,55,0.2), rgba(12,12,14,0.9));
            border-color: var(--gold-og); color: var(--gold-hover); font-weight: 700;
            box-shadow: var(--gold-glow);
        }
        .og-cat-chip.active i { color: var(--gold-og); }

        /* ── SECTION RÉSULTATS & STATS ── */
        .og-main-container { max-width: 1400px; margin: 24px auto; padding: 0 24px 80px; }
        
        .og-results-bar {
            display: flex; justify-content: space-between; align-items: center; margin-bottom: 22px;
        }
        .og-results-count {
            display: inline-flex; align-items: center; gap: 8px; font-family: var(--font-mono);
            font-size: 0.78rem; color: var(--cyan-tech); background: var(--cyan-dim);
            padding: 6px 14px; border-radius: 20px; border: var(--border-cyan);
            box-shadow: var(--cyan-glow);
        }
        .og-results-count .dot { width: 6px; height: 6px; background: var(--cyan-tech); border-radius: 50%; box-shadow: 0 0 8px var(--cyan-tech); }

        /* ── GRILLE PRODUITS LUXE & PERFORMANCE ── */
        .og-grid {
            display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;
        }

        .og-card {
            position: relative; background: var(--bg-panel); border-radius: 20px; overflow: hidden;
            border: 1px solid rgba(255,255,255,0.07); text-decoration: none; display: flex; flex-direction: column;
            backdrop-filter: blur(12px);
            transition: transform 0.35s var(--ease-premium), border-color 0.35s var(--ease-premium), box-shadow 0.35s var(--ease-premium);
        }
        .og-card:hover {
            transform: translateY(-6px);
            border-color: rgba(212, 175, 55, 0.6);
            box-shadow: 0 20px 45px rgba(0,0,0,0.75), var(--gold-glow);
        }

        .og-card__media {
            position: relative; width: 100%; aspect-ratio: 1/1; background: #000; overflow: hidden;
            display: flex; align-items: center; justify-content: center;
        }
        .og-card__media img {
            width: 100%; height: 100%; object-fit: cover;
            transition: transform 0.6s var(--ease-premium);
        }
        .og-card:hover .og-card__media img { transform: scale(1.08); }
        .og-card__placeholder-icon { width: 42px; height: 42px; color: rgba(255,255,255,0.15); }

        .og-card__badge {
            position: absolute; top: 10px; left: 10px; z-index: 2;
            display: flex; align-items: center; gap: 5px; font-size: 0.65rem; font-family: var(--font-mono);
            padding: 5px 10px; border-radius: 20px; background: rgba(5, 5, 5, 0.8);
            backdrop-filter: blur(8px); color: #fff; border: 1px solid rgba(255,255,255,0.08);
        }
        .og-card__badge i { width: 12px; height: 12px; color: var(--gold-og); }

        .og-card__price-tag {
            position: absolute; bottom: 10px; right: 10px; z-index: 2;
            background: linear-gradient(135deg, var(--gold-og), var(--gold-hover)); color: #000;
            font-family: var(--font-mono); font-weight: 700; font-size: 0.95rem;
            padding: 6px 12px; border-radius: 12px; box-shadow: 0 4px 15px rgba(212,175,55,0.35);
        }

        .og-card__content { padding: 14px; display: flex; flex-direction: column; gap: 8px; flex: 1; }
        .og-card__title {
            font-size: 0.88rem; font-weight: 600; color: #fff; line-height: 1.35; margin: 0;
            display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
            min-height: 2.4em;
        }
        .og-card__meta-grid {
            display: flex; flex-direction: column; gap: 5px; font-size: 0.72rem; color: var(--text-muted); margin-top: auto;
        }
        .og-card__meta-grid span {
            display: flex; align-items: center; gap: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .og-card__meta-grid i { width: 13px; height: 13px; color: var(--cyan-tech); flex-shrink: 0; }

        /* ── ÉTAT VIDE ── */
        .og-empty-state {
            grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center;
            padding: 80px 20px; text-align: center; color: var(--text-muted); background: var(--bg-panel);
            border-radius: 20px; border: 1px dashed rgba(255,255,255,0.1); backdrop-filter: blur(10px);
        }
        .og-empty-state i { width: 48px; height: 48px; color: var(--gold-og); margin-bottom: 16px; opacity: 0.6; }

        /* ── RESPONSIVE ADAPTATIF ── */
        @media (min-width: 640px) {
            .og-header, .og-main-container { padding-left: 32px; padding-right: 32px; }
            .og-grid { grid-template-columns: repeat(3, 1fr); gap: 18px; }
        }
        @media (min-width: 900px) {
            .og-header, .og-main-container { padding-left: 48px; padding-right: 48px; }
            .og-grid { grid-template-columns: repeat(4, 1fr); gap: 20px; }
        }
        @media (min-width: 1200px) {
            .og-grid { grid-template-columns: repeat(5, 1fr); }
        }
        @media (max-width: 768px) {
            .og-header { padding: 12px 16px; }
            .og-search-bar { flex-direction: column; background: transparent; border: none; box-shadow: none; padding: 0; gap: 8px; }
            .og-search-field { background: var(--bg-panel); border: var(--border-gold); }
            .og-search-submit { width: 100%; padding: 14px; }
            .og-main-container { padding: 16px; }
            .og-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
        }
    </style>
</head>
<body>
    <div class="og-bg-fx">
        <div class="og-bg-grid"></div>
        <div class="og-ambient-glow gold"></div>
        <div class="og-ambient-glow cyan"></div>
    </div>

    <header class="og-header">
        <div class="og-header__top">
            <a href="${isClient ? '/client-qg' : '/qg'}" class="og-back-link">
                <i data-lucide="arrow-left"></i> Retour au QG
            </a>
            <h1 class="og-brand-title"><i data-lucide="store"></i> Marketplace</h1>
            <a href="/marketplace/publier" class="og-publish-cta">
                <i data-lucide="plus-circle"></i> Publier
            </a>
        </div>

        <form class="og-search-bar" method="GET">
            <input type="hidden" name="categorie" value="${categorie || 'tous'}">
            <div class="og-search-field" style="flex: 2;">
                <i data-lucide="search"></i>
                <input type="text" name="recherche" placeholder="Que recherchez-vous dans l'écosystème ?" value="${recherche || ''}">
            </div>
            <div class="og-search-field" style="flex: 1;">
                <i data-lucide="map-pin"></i>
                <input type="text" name="ville" placeholder="Ville ou zone" value="${ville || ''}">
            </div>
            <button type="submit" class="og-search-submit">
                <i data-lucide="search"></i>
            </button>
        </form>

        <div class="og-categories-container">
            ${categoriesHtml}
        </div>
    </header>

    <main class="og-main-container">
        <div class="og-results-bar">
            <div class="og-results-count">
                <span class="dot"></span> ${annonces.length} annonce${annonces.length !== 1 ? 's' : ''} active${annonces.length !== 1 ? 's' : ''}
            </div>
        </div>

        <div class="og-grid">
            ${annonces.length ? cardsHtml : `
                <div class="og-empty-state">
                    <i data-lucide="shopping-bag"></i>
                    <div>Aucune annonce trouvée dans cette catégorie.<br>Soyez le premier à publier votre offre !</div>
                </div>
            `}
        </div>
    </main>

   <script src="https://unpkg.com/lucide@latest"></script>
    <script>if (typeof lucide !== "undefined") lucide.createIcons();</script>
</body>
</html>`);
});

// ── EXPORTATION DU ROUTEUR EXPRESS (OBLIGATOIRE) ─────
module.exports = router;
