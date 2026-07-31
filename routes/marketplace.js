// ==========================================================================
// SAMII OS — MARKETPLACE — Accueil & Publication d'annonces
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
    { id: "tous",        icon: "layout-grid",   label: "Tout" },
    { id: "electronique",    icon: "smartphone",    label: "Électronique" },
    { id: "mode",            icon: "shirt",         label: "Mode" },
    { id: "beaute",          icon: "sparkles",      label: "Beauté" },
    { id: "maison",          icon: "home",          label: "Maison" },
    { id: "electromenager", icon: "washing-machine", label: "Électro." },
    { id: "sport",           icon: "dumbbell",      label: "Sport" },
    { id: "loisirs",         icon: "gamepad-2",     label: "Loisirs" },
    { id: "livres",          icon: "book-open",     label: "Livres" },
    { id: "vehicules",       icon: "car",           label: "Véhicules" },
    { id: "immobilier",      icon: "building-2",    label: "Immobilier" },
    { id: "animaux",         icon: "paw-print",     label: "Animaux" },
    { id: "alimentation",    icon: "utensils",      label: "Alimentation" },
    { id: "services",        icon: "concierge-bell",label: "Services" },
    { id: "artisanat",       icon: "palette",       label: "Artisanat" },
    { id: "bebe",            icon: "baby",          label: "Bébé" },
    { id: "bureau",          icon: "briefcase",     label: "Bureau" },
    { id: "autre",           icon: "package",       label: "Autre" },
];

// --- 1. PAGE D'ACCUEIL MARKETPLACE ---
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

    const categoriesHtml = CATEGORIES.filter(c => c.id !== 'tous').map(c => `
        <a href="/marketplace?categorie=${c.id}${recherche ? `&recherche=${encodeURIComponent(recherche)}` : ''}${ville ? `&ville=${encodeURIComponent(ville)}` : ''}"
            class="og-cat-chip ${categorie === c.id ? 'active' : ''}">
            <i data-lucide="${c.icon}"></i><span>${c.label}</span>
        </a>
    `).join("");

    const allCatHtml = `
        <a href="/marketplace?${recherche ? `recherche=${encodeURIComponent(recherche)}` : ''}${ville ? `&ville=${encodeURIComponent(ville)}` : ''}"
            class="og-cat-chip ${!categorie || categorie === 'tous' ? 'active' : ''}">
            <i data-lucide="layout-grid"></i><span>Tout</span>
        </a> ${categoriesHtml}`;

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Marketplace — OG Empire</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700;800&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-deep: #030305; --bg-panel: rgba(10, 10, 14, 0.82); --bg-panel-hover: rgba(16, 16, 22, 0.92);
            --gold-og: #d4af37; --gold-hover: #f3e5ab; --gold-glow: 0 0 30px rgba(212, 175, 55, 0.22);
            --cyan-tech: #00f0ff; --cyan-dim: rgba(0, 240, 255, 0.12); --cyan-glow: 0 0 25px rgba(0, 240, 255, 0.22);
            --border-gold: 1px solid rgba(212, 175, 55, 0.28); --border-cyan: 1px solid rgba(0, 240, 255, 0.32);
            --text-main: #f5f5f7; --text-muted: #8e8e93;
            --font-display: 'Cinzel', serif; --font-body: 'Inter', sans-serif; --font-mono: 'JetBrains Mono', monospace;
            --ease-premium: cubic-bezier(0.16, 1, 0.3, 1);
        }
        body { background-color: var(--bg-deep); color: var(--text-main); font-family: var(--font-body); margin: 0; padding: 0; overflow-x: hidden; }
        .og-bg-fx { position: fixed; inset: 0; z-index: -1; pointer-events: none; overflow: hidden; }
        .og-bg-grid { position: absolute; inset: 0; background-image: linear-gradient(rgba(212, 175, 55, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 240, 255, 0.03) 1px, transparent 1px); background-size: 60px 60px; }
        .og-ambient-glow { position: absolute; width: 600px; height: 600px; border-radius: 50%; filter: blur(150px); opacity: .14; z-index: -1; }
        .og-ambient-glow.gold { background: var(--gold-og); left: -150px; top: -100px; }
        .og-ambient-glow.cyan { background: var(--cyan-tech); right: -150px; top: 25%; }
        .og-header { position: sticky; top: 0; z-index: 100; background: rgba(3, 3, 5, 0.88); backdrop-filter: blur(20px); border-bottom: 1px solid rgba(255, 255, 255, 0.06); padding: 16px 24px; display: flex; flex-direction: column; gap: 16px; }
        .og-header__top { display: flex; justify-content: space-between; align-items: center; max-width: 1400px; margin: 0 auto; width: 100%; }
        .og-back-link { display: inline-flex; align-items: center; gap: 8px; color: var(--text-muted); text-decoration: none; font-size: 0.85rem; }
        .og-back-link i { width: 16px; height: 16px; color: var(--cyan-tech); }
        .og-brand-title { font-family: var(--font-display); color: #fff; font-size: 1.6rem; font-weight: 700; display: flex; align-items: center; gap: 12px; margin: 0; }
        .og-brand-title i { color: var(--gold-og); width: 28px; height: 28px; }
        .og-publish-cta { display: inline-flex; align-items: center; gap: 10px; padding: 12px 22px; border-radius: 14px; text-decoration: none; background: linear-gradient(135deg, var(--gold-og), var(--gold-hover)); color: #000; font-weight: 700; font-size: 0.88rem; font-family: var(--font-display); box-shadow: 0 8px 25px rgba(212,175,55,0.25); }
        .og-search-bar { max-width: 1400px; margin: 0 auto; width: 100%; display: flex; gap: 10px; background: var(--bg-panel); border: var(--border-gold); border-radius: 18px; padding: 8px; backdrop-filter: blur(15px); }
        .og-search-field { flex: 1; display: flex; align-items: center; gap: 12px; padding: 0 16px; background: rgba(0, 0, 0, 0.45); border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.05); }
        .og-search-field i { width: 18px; height: 18px; color: var(--gold-og); flex-shrink: 0; }
        .og-search-field input { width: 100%; background: transparent; border: none; color: #fff; font-size: 0.9rem; font-family: var(--font-body); padding: 13px 0; outline: none; }
        .og-search-submit { background: linear-gradient(135deg, var(--cyan-tech), #0099ff); color: #000; border: none; border-radius: 12px; padding: 0 28px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: var(--cyan-glow); }
        .og-categories-container { max-width: 1400px; margin: 0 auto; width: 100%; display: flex; gap: 10px; overflow-x: auto; padding: 6px 2px 10px; scroll-behavior: smooth; }
        .og-categories-container::-webkit-scrollbar { height: 6px; }
        .og-categories-container::-webkit-scrollbar-thumb { background: rgba(212,175,55,0.3); border-radius: 10px; }
        .og-cat-chip { display: flex; align-items: center; gap: 8px; padding: 10px 18px; background: var(--bg-panel); border: 1px solid rgba(255, 255, 255, 0.07); border-radius: 30px; color: var(--text-muted); text-decoration: none; font-size: 0.8rem; font-weight: 500; white-space: nowrap; flex-shrink: 0; }
        .og-cat-chip.active { background: linear-gradient(135deg, rgba(212,175,55,0.2), rgba(12,12,14,0.9)); border-color: var(--gold-og); color: var(--gold-hover); font-weight: 700; box-shadow: var(--gold-glow); }
        .og-main-container { max-width: 1400px; margin: 24px auto; padding: 0 32px 80px; }
        .og-results-count { display: inline-flex; align-items: center; gap: 8px; font-family: var(--font-mono); font-size: 0.78rem; color: var(--cyan-tech); background: var(--cyan-dim); padding: 6px 14px; border-radius: 20px; border: var(--border-cyan); }
        .og-results-count .dot { width: 6px; height: 6px; background: var(--cyan-tech); border-radius: 50%; }
        .og-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 20px; margin-top: 20px; }
        .og-card { position: relative; background: var(--bg-panel); border-radius: 20px; overflow: hidden; border: 1px solid rgba(255,255,255,0.07); text-decoration: none; display: flex; flex-direction: column; transition: transform 0.35s var(--ease-premium), border-color 0.35s var(--ease-premium); }
        .og-card:hover { transform: translateY(-6px); border-color: rgba(212, 175, 55, 0.6); box-shadow: 0 20px 45px rgba(0,0,0,0.75), var(--gold-glow); }
        .og-card__media { position: relative; width: 100%; aspect-ratio: 1/1; background: #000; display: flex; align-items: center; justify-content: center; overflow: hidden; }
        .og-card__media img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.6s ease; }
        .og-card:hover .og-card__media img { transform: scale(1.08); }
        .og-card__badge { position: absolute; top: 10px; left: 10px; z-index: 2; display: flex; align-items: center; gap: 5px; font-size: 0.65rem; font-family: var(--font-mono); padding: 5px 10px; border-radius: 20px; background: rgba(5, 5, 5, 0.8); color: #fff; border: 1px solid rgba(255,255,255,0.08); }
        .og-card__price-tag { position: absolute; bottom: 10px; right: 10px; z-index: 2; background: linear-gradient(135deg, var(--gold-og), var(--gold-hover)); color: #000; font-family: var(--font-mono); font-weight: 700; font-size: 0.95rem; padding: 6px 12px; border-radius: 12px; }
        .og-card__content { padding: 14px; display: flex; flex-direction: column; gap: 8px; flex: 1; }
        .og-card__title { font-size: 0.88rem; font-weight: 600; color: #fff; line-height: 1.35; margin: 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .og-card__meta-grid { display: flex; flex-direction: column; gap: 5px; font-size: 0.72rem; color: var(--text-muted); margin-top: auto; }
        .og-card__meta-grid span { display: flex; align-items: center; gap: 6px; }
        .og-empty-state { grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 20px; text-align: center; color: var(--text-muted); background: var(--bg-panel); border-radius: 20px; border: 1px dashed rgba(255,255,255,0.1); }
        @media(max-width: 768px) {
            .og-search-bar { flex-direction: column; background: transparent; border: none; padding: 0; }
            .og-search-field { background: var(--bg-panel); border: var(--border-gold); }
            .og-search-submit { width: 100%; padding: 14px; }
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
            <a href="${isClient ? '/client-qg' : '/qg'}" class="og-back-link"><i data-lucide="arrow-left"></i> Retour au QG</a>
            <h1 class="og-brand-title"><i data-lucide="store"></i> Marketplace</h1>
            <a href="/marketplace/publier" class="og-publish-cta"><i data-lucide="plus-circle"></i> Publier</a>
        </div>
        <form class="og-search-bar" method="GET">
            <input type="hidden" name="categorie" value="${categorie || 'tous'}">
            <div class="og-search-field" style="flex: 2;">
                <i data-lucide="search"></i>
                <input type="text" name="recherche" placeholder="Que recherchez-vous ?" value="${recherche || ''}">
            </div>
            <div class="og-search-field" style="flex: 1;">
                <i data-lucide="map-pin"></i>
                <input type="text" name="ville" placeholder="Ville ou zone" value="${ville || ''}">
            </div>
            <button type="submit" class="og-search-submit"><i data-lucide="search"></i></button>
        </form>
        <div class="og-categories-container">${allCatHtml}</div>
    </header>

    <main class="og-main-container">
        <div class="og-results-bar">
            <div class="og-results-count"><span class="dot"></span> ${annonces.length} annonce${annonces.length !== 1 ? 's' : ''} active${annonces.length !== 1 ? 's' : ''}</div>
        </div>
        <div class="og-grid">
            ${annonces.length ? cardsHtml : `
                <div class="og-empty-state">
                    <i data-lucide="shopping-bag" style="width:48px;height:48px;color:var(--gold-og);margin-bottom:16px;"></i>
                    <div>Aucune annonce trouvée.<br>Soyez le premier à publier votre offre !</div>
                </div>
            `}
        </div>
    </main>
    <script src="https://unpkg.com/lucide@latest"></script>
    <script>if (typeof lucide !== "undefined") lucide.createIcons();</script>
</body>
</html>`);
});

// --- 2. PAGE DE PUBLICATION D'UNE ANNONCE (Formulaire Complet) ---
router.get("/publier", requireAuth, async (req, res) => {
    const isClient = req.session?.typeCompte === "client";
    
    const optionsCategories = CATEGORIES.filter(c => c.id !== 'tous').map(c => 
        `<option value="${c.id}">${c.label}</option>`
    ).join("");

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Publier une annonce — OG Empire</title>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-deep: #030305; --bg-panel: rgba(10, 10, 14, 0.88);
            --gold-og: #d4af37; --gold-hover: #f3e5ab; --gold-glow: 0 0 30px rgba(212, 175, 55, 0.22);
            --cyan-tech: #00f0ff; --cyan-dim: rgba(0, 240, 255, 0.12); --cyan-glow: 0 0 25px rgba(0, 240, 255, 0.22);
            --border-gold: 1px solid rgba(212, 175, 55, 0.28); --text-main: #f5f5f7; --text-muted: #8e8e93;
            --font-display: 'Cinzel', serif; --font-body: 'Inter', sans-serif; --font-mono: 'JetBrains Mono', monospace;
        }
        body { background-color: var(--bg-deep); color: var(--text-main); font-family: var(--font-body); margin: 0; padding: 20px; }
        .og-form-container { max-width: 700px; margin: 40px auto; background: var(--bg-panel); border: var(--border-gold); border-radius: 24px; padding: 40px; box-shadow: 0 20px 50px rgba(0,0,0,0.8), var(--gold-glow); backdrop-filter: blur(20px); }
        .og-form-title { font-family: var(--font-display); color: #fff; font-size: 1.8rem; margin-bottom: 24px; display: flex; align-items: center; gap: 12px; }
        .og-form-title i { color: var(--gold-og); }
        .og-form-group { margin-bottom: 20px; display: flex; flex-direction: column; gap: 8px; }
        .og-form-group label { font-size: 0.85rem; font-weight: 600; color: var(--text-muted); font-family: var(--font-mono); }
        .og-form-control { background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 14px; color: #fff; font-size: 0.95rem; font-family: var(--font-body); outline: none; transition: border-color 0.25s; }
        .og-form-control:focus { border-color: var(--cyan-tech); box-shadow: var(--cyan-glow); }
        select.og-form-control { cursor: pointer; }
        .og-submit-btn { width: 100%; background: linear-gradient(135deg, var(--gold-og), var(--gold-hover)); color: #000; border: none; border-radius: 14px; padding: 16px; font-weight: 700; font-size: 1rem; font-family: var(--font-display); cursor: pointer; margin-top: 10px; box-shadow: 0 8px 25px rgba(212,175,55,0.3); transition: transform 0.2s; }
        .og-submit-btn:hover { transform: translateY(-2px); }
        .og-back { display: inline-flex; align-items: center; gap: 8px; color: var(--text-muted); text-decoration: none; font-size: 0.85rem; margin-bottom: 20px; }
        .og-back:hover { color: var(--cyan-tech); }
    </style>
</head>
<body>
    <div class="og-form-container">
        <a href="/marketplace" class="og-back"><i data-lucide="arrow-left"></i> Retour à la Marketplace</a>
        <h1 class="og-form-title"><i data-lucide="plus-circle"></i> Publier une annonce</h1>
        
        <form action="/marketplace/publier" method="POST" enctype="multipart/form-data">
            <div class="og-form-group">
                <label>Titre de l'annonce</label>
                <input type="text" name="titre" class="og-form-control" required placeholder="Ex: iPhone 13 Pro Max 256Go">
            </div>
            
            <div class="og-form-group">
                <label>Catégorie</label>
                <select name="categorie" class="og-form-control" required>
                    <option value="">Sélectionner une catégorie...</option>
                    ${optionsCategories}
                </select>
            </div>

            <div class="og-form-group">
                <label>Prix (€ ou devise)</label>
                <input type="text" name="prix" class="og-form-control" required placeholder="Ex: 450 € ou 7777">
            </div>

            <div class="og-form-group">
                <label>Ville / Localisation</label>
                <input type="text" name="ville" class="og-form-control" required placeholder="Ex: Paris">
            </div>

            <div class="og-form-group">
                <label>Matricule / Référence interne (Optionnel)</label>
                <input type="text" name="matricule" class="og-form-control" placeholder="Ex: MAT-9921">
            </div>

            <div class="og-form-group">
                <label>Photo de l'annonce</label>
                <input type="file" name="photo" class="og-form-control" accept="image/*">
            </div>

            <button type="submit" class="og-submit-btn">Mettre en ligne</button>
        </form>
    </div>
    <script src="https://unpkg.com/lucide@latest"></script>
    <script>if (typeof lucide !== "undefined") lucide.createIcons();</script>
</body>
</html>`);
});

// --- 3. TRAITEMENT DE LA PUBLICATION (POST) ---
router.post("/publier", requireAuth, async (req, res) => {
    try {
        const { titre, categorie, prix, ville, matricule } = req.body;
        
        // Enregistrement de l'annonce dans Airtable
        await airtable.create("ANNONCES", {
            titre,
            categorie,
            prix,
            ville,
            matricule: matricule || '',
            vendeur_id: req.session.userId || 'admin_og',
            vendeur_nom: req.session.nom || 'Mohamed',
            type_vendeur: req.session.typeCompte === 'client' ? 'particulier' : 'marchand',
            actif: 1
        });

        res.redirect("/marketplace");
    } catch (err) {
        console.error("Erreur publication annonce :", err);
        res.redirect("/marketplace/publier?erreur=1");
    }
});

module.exports = router;
