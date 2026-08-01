// --- SECTION INTÉGRÉE : MODULE COMPLET MARKETPLACE OG ---
const express = require('express');
const router = express.Router();

// Configuration globale des catégories (style Amazon & Services professionnels)
const CATEGORIES_AMAZON = [
    { id: 'tous', label: 'Toutes nos catégories' },
    { id: 'montres_luxe', label: 'Montres & Joaillerie de Luxe (The Sovereign)' },
    { id: 'services', label: 'Services à la personne & Urgences (Nounou, Livreur 24h)' },
    { id: 'tech', label: 'High-Tech, IA & Automatisation' },
    { id: 'mode', label: 'Mode & Accessoires Premium' },
    { id: 'maison', label: 'Maison & Design Minimaliste' },
    { id: 'cartes_cadeaux', label: 'Cartes Cadeaux & Ventes Flash' }
];

// Styles CSS partagés avec intégration du sélecteur de mode, sidebar rétractable, panier et pivot 4 langues (FR, EN, CN, AR avec RTL)
const SHARED_STYLES = `
    :root {
        --bg-deep: #030307;
        --bg-panel: rgba(10, 10, 15, 0.85);
        --gold-og: #D4AF37;
        --gold-hover: #E6C554;
        --gold-glow: 0 0 25px rgba(212, 175, 55, 0.35);
        --cyan-og: #00F0FF;
        --cyan-glow: 0 0 25px rgba(0, 240, 255, 0.35);
        --purple-og: #BD00FF;
        --purple-glow: 0 0 25px rgba(189, 0, 255, 0.35);
        --text-main: #F4F4F8;
        --text-muted: #9BA1A6;
        --font-display: 'Cinzel', serif;
        --font-body: 'Inter', sans-serif;
        --font-mono: 'JetBrains Mono', monospace;
        --ease-premium: cubic-bezier(0.16, 1, 0.3, 1);
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
        background-color: var(--bg-deep);
        color: var(--text-main);
        font-family: var(--font-body);
        min-height: 100vh;
        display: flex;
        overflow-x: hidden;
    }

    /* Gestion dynamique du RTL pour l'Arabe */
    body[dir="rtl"] {
        direction: rtl;
        text-align: right;
    }
    body[dir="rtl"] .og-sidebar { left: auto; right: 0; border-left: none; border-right: 1px solid rgba(212,175,55,0.2); }
    body[dir="rtl"] .og-main-wrapper { margin-left: 0; margin-right: 280px; }
    body[dir="rtl"] .og-cart-drawer { right: auto; left: -420px; border-left: none; border-right: 1px solid rgba(212,175,55,0.3); }
    body[dir="rtl"] .og-cart-drawer.open { right: auto; left: 0; }

    /* Effets de fond et grille cyberpunk / luxe */
    .og-bg-fx {
        position: fixed; inset: 0; pointer-events: none; z-index: 0;
        background: radial-gradient(circle at 50% 10%, rgba(212,175,55,0.06) 0%, transparent 60%),
                    radial-gradient(circle at 85% 90%, rgba(0,240,255,0.04) 0%, transparent 50%);
    }
    .og-bg-grid {
        position: absolute; inset: 0;
        background-image: linear-gradient(to right, rgba(255,255,255,0.02) 1px, transparent 1px),
                          linear-gradient(to bottom, rgba(255,255,255,0.02) 1px, transparent 1px);
        background-size: 40px 40px;
    }

    /* Sidebar Rétractable */
    .og-sidebar {
        width: 280px; height: 100vh; position: fixed; top: 0; left: 0;
        background: rgba(5, 5, 10, 0.95); border-right: 1px solid rgba(212, 175, 55, 0.2);
        backdrop-filter: blur(20px); z-index: 100; display: flex; flex-direction: column;
        justify-content: space-between; padding: 24px; transition: transform 0.3s var(--ease-premium);
    }
    .og-sidebar-brand {
        font-family: var(--font-display); font-size: 1.35rem; color: var(--gold-og);
        font-weight: 700; display: flex; align-items: center; gap: 10px; margin-bottom: 35px;
        letter-spacing: 1px; text-shadow: var(--gold-glow);
    }
    .og-sidebar-menu { display: flex; flex-direction: column; gap: 8px; }
    .og-sidebar-link {
        display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 12px;
        color: var(--text-muted); text-decoration: none; font-size: 0.9rem; font-weight: 500;
        transition: all 0.2s; border: 1px solid transparent;
    }
    .og-sidebar-link:hover, .og-sidebar-link.active {
        background: rgba(212, 175, 55, 0.08); color: var(--gold-og);
        border-color: rgba(212, 175, 55, 0.25); box-shadow: var(--gold-glow);
    }
    
    .og-samii-sphere {
        background: rgba(189, 0, 255, 0.05); border: 1px solid rgba(189, 0, 255, 0.2);
        border-radius: 16px; padding: 16px; font-size: 0.78rem; color: var(--text-muted);
    }
    .og-samii-title { color: var(--purple-og); font-weight: 700; margin-bottom: 6px; display: flex; align-items: center; gap: 6px; }

    /* Main Wrapper & Header */
    .og-main-wrapper { margin-left: 280px; flex: 1; display: flex; flex-direction: column; position: relative; z-index: 1; transition: margin 0.3s ease; }
    
    .og-top-promo-banner {
        background: linear-gradient(90deg, #12121a, #1f1a0d, #12121a); color: var(--gold-og);
        font-family: var(--font-mono); font-size: 0.75rem; text-align: center; padding: 8px;
        border-bottom: 1px solid rgba(212, 175, 55, 0.2); letter-spacing: 0.5px;
    }

    .og-header {
        background: rgba(5, 5, 10, 0.9); backdrop-filter: blur(20px);
        border-bottom: 1px solid rgba(255, 255, 255, 0.08); position: sticky; top: 0; z-index: 90;
    }
    .og-header__main-row { padding: 14px 24px; display: flex; align-items: center; gap: 20px; }
    .og-brand-title { font-family: var(--font-display); font-size: 1.4rem; color: #fff; font-weight: 700; text-decoration: none; text-shadow: 0 0 15px rgba(255,255,255,0.2); }
    
    /* Widget Livraison */
    .og-delivery-widget {
        display: flex; align-items: center; gap: 8px; padding: 6px 12px; background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; font-size: 0.78rem; color: var(--text-muted); cursor: pointer; transition: border-color 0.2s;
    }
    .og-delivery-widget:hover { border-color: var(--gold-og); }
    .og-delivery-widget .sub-txt { color: #fff; font-weight: 600; }

    /* Sélecteur Pays & Devise */
    .og-locale-selector {
        display: flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 6px 10px;
    }
    .og-locale-selector select { background: transparent; border: none; color: #fff; font-family: var(--font-mono); font-size: 0.8rem; outline: none; cursor: pointer; }
    .og-locale-selector select option { background: #08080f; color: #fff; }

    /* Barre de recherche style Amazon */
    .og-amazon-search {
        flex: 1; display: flex; background: rgba(0,0,0,0.6); border: 1px solid rgba(212,175,55,0.3);
        border-radius: 12px; overflow: hidden; transition: box-shadow 0.3s;
    }
    .og-amazon-search:focus-within { box-shadow: var(--gold-glow); border-color: var(--gold-og); }
    .og-category-select-wrapper { background: rgba(255,255,255,0.04); border-right: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; }
    .og-category-select-wrapper select { background: transparent; border: none; color: var(--text-muted); padding: 0 14px; font-size: 0.82rem; font-family: var(--font-body); outline: none; cursor: pointer; }
    .og-category-select-wrapper select option { background: #0a0a0f; color: #fff; }
    .og-search-input-box { flex: 1; display: flex; }
    .og-search-input-box input { width: 100%; background: transparent; border: none; padding: 12px 16px; color: #fff; font-size: 0.9rem; outline: none; }
    .og-search-submit { background: linear-gradient(135deg, var(--gold-og), var(--gold-hover)); border: none; padding: 0 22px; cursor: pointer; font-size: 1rem; transition: filter 0.2s; }
    .og-search-submit:hover { filter: brightness(1.15); }

    /* Actions Droite Header */
    .og-header-right { display: flex; align-items: center; gap: 15px; }
    .og-account-link { color: #fff; text-decoration: none; font-size: 0.78rem; line-height: 1.3; }
    .og-account-link .line-bold { display: block; font-weight: 700; color: var(--gold-og); font-size: 0.85rem; }
    
    .og-cart-btn {
        background: rgba(212,175,55,0.1); border: 1px solid rgba(212,175,55,0.4); color: var(--gold-og);
        padding: 8px 14px; border-radius: 10px; font-weight: 700; font-family: var(--font-mono);
        font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s;
    }
    .og-cart-btn:hover { background: var(--gold-og); color: #030307; box-shadow: var(--gold-glow); }

    .og-publish-cta {
        background: linear-gradient(135deg, var(--cyan-og), #0088ff); color: #030307; border: none;
        padding: 8px 16px; border-radius: 10px; font-weight: 800; font-family: var(--font-display);
        font-size: 0.82rem; text-decoration: none; box-shadow: var(--cyan-glow); transition: filter 0.2s;
    }
    .og-publish-cta:hover { filter: brightness(1.1); }

    /* Sous-ligne liens rapides */
    .og-header__sub-row { background: rgba(0,0,0,0.5); padding: 8px 24px; border-top: 1px solid rgba(255,255,255,0.05); }
    .og-sub-links { display: flex; list-style: none; gap: 20px; overflow-x: auto; white-space: nowrap; scrollbar-width: none; }
    .og-sub-links::-webkit-scrollbar { display: none; }
    .og-sub-links a { color: var(--text-muted); text-decoration: none; font-size: 0.82rem; font-weight: 500; transition: color 0.2s; }
    .og-sub-links a:hover { color: var(--gold-og); }

    /* Sélecteur de Langue Pivot 4 Langues (FR, EN, CN, AR) */
    .og-lang-pivot-container {
        position: fixed; bottom: 25px; right: 25px; z-index: 9999;
        display: flex; flex-direction: column; align-items: flex-end; gap: 8px;
    }
    .og-lang-main-btn {
        background: linear-gradient(135deg, var(--gold-og), var(--gold-hover)); color: #030307;
        width: 50px; height: 50px; border-radius: 50%; border: none; font-weight: 800;
        font-family: var(--font-mono); font-size: 0.9rem; cursor: pointer; box-shadow: var(--gold-glow);
        display: flex; align-items: center; justify-content: center; transition: transform 0.3s var(--ease-premium);
    }
    .og-lang-main-btn:hover { transform: scale(1.1); }
    .og-lang-options {
        display: flex; flex-direction: column; gap: 6px; background: rgba(5,5,10,0.95);
        border: 1px solid rgba(212,175,55,0.3); padding: 8px; border-radius: 16px;
        backdrop-filter: blur(15px); opacity: 0; transform: translateY(10px) scale(0.95);
        pointer-events: none; transition: all 0.25s var(--ease-premium); box-shadow: 0 10px 30px rgba(0,0,0,0.8);
    }
    .og-lang-pivot-container.open .og-lang-options { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }
    .og-lang-option-btn {
        background: transparent; border: none; color: var(--text-muted); padding: 8px 14px;
        border-radius: 8px; font-family: var(--font-body); font-size: 0.82rem; font-weight: 600;
        cursor: pointer; text-align: left; transition: all 0.2s; display: flex; align-items: center; gap: 8px;
    }
    body[dir="rtl"] .og-lang-option-btn { text-align: right; }
    .og-lang-option-btn:hover, .og-lang-option-btn.active { background: rgba(212,175,55,0.12); color: var(--gold-og); }

    /* Main Container Grid & Cards */
    .og-main-container { padding: 30px 24px; max-width: 1500px; margin: 0 auto; width: 100%; }
    .og-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 24px; }
    
    .og-card {
        background: var(--bg-panel); border-radius: 20px; overflow: hidden;
        border: 1px solid rgba(255,255,255,0.08); display: flex; flex-direction: column;
        transition: all 0.4s var(--ease-premium); position: relative; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    }
    .og-card.cyan-border { border: 1px solid rgba(0, 240, 255, 0.25); }
    .og-card.gold-border { border: 1px solid rgba(212, 175, 55, 0.25); }
    .og-card.purple-border { border: 1px solid rgba(189, 0, 255, 0.35); box-shadow: 0 0 20px rgba(189, 0, 255, 0.15); }
    
    .og-card:hover { transform: translateY(-8px) scale(1.02); box-shadow: 0 25px 60px rgba(0,0,0,0.8), var(--cyan-glow); }
    .og-card.gold-border:hover { box-shadow: 0 25px 60px rgba(0,0,0,0.8), var(--gold-glow); }
    .og-card.purple-border:hover { box-shadow: 0 25px 60px rgba(0,0,0,0.8), var(--purple-glow); }
    
    .og-card__media { position: relative; width: 100%; aspect-ratio: 4/3; background: #000; display: flex; align-items: center; justify-content: center; overflow: hidden; }
    .og-card__media img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.7s var(--ease-premium); }
    .og-card:hover .og-card__media img { transform: scale(1.12); }
    
    .og-ai-badge {
        position: absolute; top: 12px; right: 12px; z-index: 3; 
        font-size: 0.68rem; font-family: var(--font-mono); padding: 5px 10px; border-radius: 20px;
        background: rgba(189, 0, 255, 0.9); color: #fff; border: 1px solid rgba(255,255,255,0.2);
        box-shadow: 0 0 12px rgba(189,0,255,0.6); backdrop-filter: blur(8px);
    }
    .og-card__badge { 
        position: absolute; top: 12px; left: 12px; z-index: 3; 
        font-size: 0.7rem; font-family: var(--font-mono); padding: 6px 12px; border-radius: 20px; 
        background: rgba(5, 5, 10, 0.85); color: #fff; border: 1px solid rgba(255,255,255,0.12); backdrop-filter: blur(10px);
    }
    .og-card__price-tag { 
        position: absolute; bottom: 12px; right: 12px; z-index: 3; 
        background: linear-gradient(135deg, var(--gold-og), var(--gold-hover)); color: #030307; 
        font-family: var(--font-mono); font-weight: 800; font-size: 1rem; padding: 6px 14px; border-radius: 12px; 
        box-shadow: 0 4px 15px rgba(212,175,55,0.4);
    }
    
    .og-card__content { padding: 18px; display: flex; flex-direction: column; gap: 12px; flex: 1; background: linear-gradient(180deg, rgba(12,12,18,0.6), rgba(5,5,10,0.9)); }
    .og-card__title { font-size: 0.95rem; font-weight: 700; color: #fff; line-height: 1.4; margin: 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .og-card__meta-grid { display: flex; flex-direction: column; gap: 6px; font-size: 0.78rem; color: var(--text-muted); margin-top: auto; }
    
    .og-add-cart-btn {
        width: 100%; background: rgba(212,175,55,0.1); border: 1px solid rgba(212,175,55,0.4); color: var(--gold-og);
        padding: 10px; border-radius: 10px; font-weight: 700; font-size: 0.82rem; cursor: pointer; transition: all 0.2s;
        font-family: var(--font-mono);
    }
    .og-add-cart-btn:hover { background: var(--gold-og); color: #030307; box-shadow: var(--gold-glow); }

    /* Panier Coulissant (Slide-over Cart) */
    .og-cart-drawer-overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(8px); z-index: 999;
        display: none; opacity: 0; transition: opacity 0.3s ease;
    }
    .og-cart-drawer-overlay.open { display: block; opacity: 1; }
    
    .og-cart-drawer {
        position: fixed; top: 0; right: -420px; width: 400px; height: 100vh; background: #08080f;
        border-left: 1px solid rgba(212,175,55,0.3); z-index: 1000; box-shadow: -10px 0 50px rgba(0,0,0,0.8);
        display: flex; flex-direction: column; transition: right 0.4s cubic-bezier(0.16, 1, 0.3, 1); box-sizing: border-box; padding: 24px;
    }
    .og-cart-drawer.open { right: 0; }
    
    .og-cart-drawer-header { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 16px; margin-bottom: 16px; }
    .og-cart-drawer-title { font-family: var(--font-display); font-size: 1.2rem; color: #fff; font-weight: 700; }
    .og-cart-close-btn { background: transparent; border: none; color: var(--text-muted); font-size: 1.4rem; cursor: pointer; transition: color 0.2s; }
    .og-cart-close-btn:hover { color: #fff; }

    .og-cart-items-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }
    .og-cart-item-row { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 12px; display: flex; justify-content: space-between; align-items: center; }
    
    .og-cart-drawer-footer { border-top: 1px solid rgba(255,255,255,0.1); padding-top: 16px; margin-top: 16px; }
    .og-checkout-btn { width: 100%; background: linear-gradient(135deg, var(--gold-og), var(--gold-hover)); color: #030307; border: none; border-radius: 12px; padding: 14px; font-weight: 800; font-size: 1rem; font-family: var(--font-display); cursor: pointer; box-shadow: var(--gold-glow); transition: filter 0.2s; }
    .og-checkout-btn:hover { filter: brightness(1.1); }

    .og-empty-state { grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 90px 20px; text-align: center; color: var(--text-muted); background: var(--bg-panel); border-radius: 24px; border: 1px dashed rgba(212,175,55,0.3); }
`;

// --- 1. ROUTE INDEX MARKETPLACE ---
router.get("/", async (req, res) => {
    const { categorie, recherche } = req.query;
    
    // Récupération des annonces depuis Airtable (ou tableau vide de secours)
    let toutesAnnonces = [];
    try {
        const records = await airtable.select("ANNONCES", { filterByFormula: "{actif} = 1" });
        toutesAnnonces = records.map(r => ({ id: r.id, ...r.fields }));
    } catch (e) {
        console.warn("Airtable fetch warning, fallback mode actif.");
    }

    // Filtrage dynamique par catégorie et recherche textuelle
    let annoncesFiltrees = toutesAnnonces.filter(item => {
        const matchCat = !categorie || categorie === 'tous' || item.categorie === categorie;
        const matchSearch = !recherche || 
            (item.titre && item.titre.toLowerCase().includes(recherche.toLowerCase())) ||
            (item.pays && item.pays.toLowerCase().includes(recherche.toLowerCase())) ||
            (item.ville && item.ville.toLowerCase().includes(recherche.toLowerCase()));
        return matchCat && matchSearch;
    });

    const categoryOptionsHtml = CATEGORIES_AMAZON.map(cat => 
        `<option value="${cat.id}" ${categorie === cat.id ? 'selected' : ''}>${cat.label}</option>`
    ).join("");

    const cardsHtml = annoncesFiltrees.map((item, idx) => {
        const borderClass = idx % 3 === 0 ? 'gold-border' : (idx % 3 === 1 ? 'cyan-border' : 'purple-border');
        const imgUrl = item.photo_url || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80';
        return `
            <div class="og-card ${borderClass}">
                <div class="og-card__media">
                    <div class="og-card__badge">📍 ${item.pays || 'International'}${item.ville ? ' — ' + item.ville : ''}</div>
                    <div class="og-ai-badge"><i data-lucide="sparkles" style="width:10px;height:10px;"></i> Samii OS</div>
                    <img src="${imgUrl}" alt="${item.titre}" loading="lazy">
                    <div class="og-card__price-tag">${item.prix || 'Sur devis'}</div>
                </div>
                <div class="og-card__content">
                    <h3 class="og-card__title">${item.titre}</h3>
                    <div class="og-card__meta-grid">
                        <div>Vendeur : <strong>${item.vendeur_nom || 'Boutique Partenaire'}</strong></div>
                        <div>Disponibilité : <span style="color: var(--cyan-og)">Expédition rapide 24/48h</span></div>
                    </div>
                    <button class="og-add-cart-btn" onclick="ajouterAuPanier('${item.titre.replace(/'/g, "\\'")}', '${item.prix || '0 €'}')">
                        + Ajouter au Panier OG
                    </button>
                </div>
            </div>
        `;
    }).join("");

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Marketplace Internationale OG — Samii OS</title>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <style>${SHARED_STYLES}</style>
</head>
<body>
    <aside class="og-sidebar">
        <div>
            <div class="og-sidebar-brand"><i data-lucide="crown"></i> OG EMPIRE</div>
            <nav class="og-sidebar-menu">
                <a href="/qg" class="og-sidebar-link"><i data-lucide="layout-dashboard"></i> QG Central</a>
                <a href="/marketplace" class="og-sidebar-link active"><i data-lucide="store"></i> Marketplace</a>
                <a href="/academy" class="og-sidebar-link"><i data-lucide="graduation-cap"></i> Academy</a>
                <a href="/community" class="og-sidebar-link"><i data-lucide="users"></i> Community</a>
                <a href="/arsenal" class="og-sidebar-link"><i data-lucide="shield-check"></i> Arsenal</a>
            </nav>
        </div>
        
        <div class="og-samii-sphere">
            <div class="og-samii-title"><i data-lucide="sparkles" style="width:14px;height:14px;"></i> Sphère Samii</div>
            <div class="og-samii-text">Marketplace internationale active (EUR, USD, GBP). Synchronisée en temps réel.</div>
        </div>
    </aside>

    <div class="og-main-wrapper">
        <div class="og-bg-fx">
            <div class="og-bg-grid"></div>
        </div>

        <div class="og-top-promo-banner">
            ⚡ MARKETPLACE INTERNATIONALE OG — VENTES FLASH & SERVICES D'URGENCE DISPONIBLES EN CONTINU
        </div>

        <header class="og-header">
            <div class="og-header__main-row">
                <a href="/marketplace" class="og-brand-title">MARKETPLACE OG</a>
                
                <div class="og-delivery-widget" title="Définir votre adresse de livraison">
                    <span>📍</span>
                    <div>
                        <div style="font-size: 0.7rem;">Adresse de livraison :</div>
                        <div class="sub-txt">Définir l'adresse</div>
                    </div>
                </div>

                <div class="og-locale-selector">
                    <span>🌐</span>
                    <select id="deviseSelect">
                        <option value="EUR">EUR (€)</option>
                        <option value="USD">USD ($)</option>
                        <option value="GBP">GBP (£)</option>
                    </select>
                </div>
                
                <form class="og-amazon-search" method="GET">
                    <div class="og-category-select-wrapper">
                        <select name="categorie">
                            ${categoryOptionsHtml}
                        </select>
                    </div>
                    <div class="og-search-input-box">
                        <input type="text" name="recherche" placeholder="Rechercher sur Marketplace OG..." value="${recherche || ''}">
                    </div>
                    <button type="submit" class="og-search-submit">🔍</button>
                </form>

                <div class="og-header-right">
                    <a href="/login" class="og-account-link">
                        <span>Bonjour, Connectez-vous</span>
                        <span class="line-bold">Compte & QG</span>
                    </a>

                    <button onclick="toggleCart()" class="og-cart-btn">
                        🛒 <span id="cartCountBadge">0</span> art.
                    </button>

                    <a href="/marketplace/publier" class="og-publish-cta">+ Publier</a>
                </div>
            </div>

            <div class="og-header__sub-row">
                <ul class="og-sub-links">
                    <li><a href="/marketplace?recherche=top+vente">Top Ventes</a></li>
                    <li><a href="/marketplace?recherche=livreur+24h">Livreur en moins de 24h</a></li>
                    <li><a href="/marketplace?categorie=services&recherche=nounou">Nounou disponible</a></li>
                    <li><a href="/marketplace?recherche=services+rapides">Services d'urgence</a></li>
                    <li><a href="/marketplace?recherche=exclusivites">Nouveautés & Exclusivités</a></li>
                    <li><a href="/marketplace?recherche=cartes+cadeaux">Cartes Cadeaux</a></li>
                    <li><a href="/marketplace?recherche=ventes+flash">Ventes Flash</a></li>
                </ul>
            </div>
        </header>

        <main class="og-main-container">
            <div style="font-family: var(--font-mono); font-size: 0.82rem; color: var(--gold-og); margin-bottom: 20px; display: flex; align-items: center; gap: 8px;">
                <span style="width: 8px; height: 8px; background: var(--gold-og); border-radius: 50%; box-shadow: var(--gold-glow); display: inline-block;"></span>
                ${toutesAnnonces.length} annonce${toutesAnnonces.length !== 1 ? 's' : ''} disponible${toutesAnnonces.length !== 1 ? 's' : ''} (Marchands EU, UK & US)
            </div>
            <div class="og-grid">
                ${toutesAnnonces.length ? cardsHtml : `
                    <div class="og-empty-state">
                        <div style="font-size: 1.1rem; font-weight: 600; color: #fff; margin-bottom: 8px;">Aucune annonce active</div>
                        <div style="font-size: 0.85rem;">Publiez un article pour alimenter le catalogue international.</div>
                    </div>
                `}
            </div>
        </main>
    </div>

    <!-- Panier Latéral Coulissant -->
    <div id="cartOverlay" class="og-cart-drawer-overlay" onclick="toggleCart()"></div>
    <div id="cartDrawer" class="og-cart-drawer">
        <div class="og-cart-drawer-header">
            <div class="og-cart-drawer-title">Mon Panier OG</div>
            <button class="og-cart-close-btn" onclick="toggleCart()">&times;</button>
        </div>
        <div class="og-cart-items-list" id="cartItemsContainer">
            <div style="color: var(--text-muted); font-size: 0.85rem; text-align: center; margin-top: 40px;">Votre panier est vide pour l'instant.</div>
        </div>
        <div class="og-cart-drawer-footer">
            <div style="display: flex; justify-content: space-between; margin-bottom: 14px; font-family: var(--font-mono); font-size: 0.9rem;">
                <span style="color: var(--text-muted);">Total estimé :</span>
                <span id="cartTotalPrice" style="color: var(--gold-og); font-weight: 700;">0 €</span>
            </div>
            <button class="og-checkout-btn" onclick="alert('Redirection sécurisée vers la passerelle de paiement Samii OS...')">Passer la commande</button>
        </div>
    </div>

    <!-- Bouton Pivot 4 Langues (Français, Anglais, Chinois, Arabe avec RTL dynamique) -->
    <div class="og-lang-pivot-container" id="langPivotContainer">
        <div class="og-lang-options">
            <button class="og-lang-option-btn active" onclick="setLanguage('fr')">🇫🇷 Français</button>
            <button class="og-lang-option-btn" onclick="setLanguage('en')">🇬🇧 English</button>
            <button class="og-lang-option-btn" onclick="setLanguage('cn')">🇨🇳 中文</button>
            <button class="og-lang-option-btn" onclick="setLanguage('ar')">🇸🇦 العربية</button>
        </div>
        <button class="og-lang-main-btn" onclick="toggleLangMenu()" title="Changer de langue">🌐</button>
    </div>

    <script src="https://unpkg.com/lucide@latest"></script>
    <script>
        if (typeof lucide !== "undefined") lucide.createIcons();

        let panier = [];

        function toggleCart() {
            document.getElementById('cartDrawer').classList.toggle('open');
            document.getElementById('cartOverlay').classList.toggle('open');
        }

        function ajouterAuPanier(titre, prix) {
            panier.push({ titre, prix });
            mettreAJourPanierUI();
            toggleCart();
        }

        function retirerDuPanier(index) {
            panier.splice(index, 1);
            mettreAJourPanierUI();
        }

        function mettreAJourPanierUI() {
            document.getElementById('cartCountBadge').innerText = panier.length;
            const container = document.getElementById('cartItemsContainer');
            
            if (panier.length === 0) {
                container.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem; text-align: center; margin-top: 40px;">Votre panier est vide pour l\\'instant.</div>';
                document.getElementById('cartTotalPrice').innerText = '0 €';
                return;
            }

            let html = '';
            panier.forEach((item, idx) => {
                html += \`
                <div class="og-cart-item-row">
                    <div>
                        <div style="font-size: 0.85rem; font-weight: 600; color: #fff; margin-bottom: 4px;">\${item.titre}</div>
                        <div style="font-size: 0.78rem; color: var(--gold-og); font-family: var(--font-mono);">\${item.prix}</div>
                    </div>
                    <button onclick="retirerDuPanier(\${idx})" style="background:transparent; border:none; color:#ff4d4d; cursor:pointer; font-size:1rem;">&times;</button>
                </div>\`;
            });
            container.innerHTML = html;
            document.getElementById('cartTotalPrice').innerText = panier.length > 0 ? panier[0].prix : '0 €';
        }

        // Logique du Bouton Pivot 4 Langues & Gestion RTL
        function toggleLangMenu() {
            document.getElementById('langPivotContainer').classList.toggle('open');
        }

        function setLanguage(lang) {
            document.querySelectorAll('.og-lang-option-btn').forEach(btn => btn.classList.remove('active'));
            event.currentTarget.classList.add('active');
            toggleLangMenu();

            if (lang === 'ar') {
                document.documentElement.setAttribute('dir', 'rtl');
                document.body.setAttribute('dir', 'rtl');
            } else {
                document.documentElement.setAttribute('dir', 'ltr');
                document.body.setAttribute('dir', 'ltr');
            }
            // Synchronisation locale ou rechargement ciblé si besoin
        }
    </script>
</body>
</html>`);
});

// --- 2. ROUTE FORMULAIRE DE PUBLICATION ---
router.get("/publier", async (req, res) => {
    const optionsCategories = CATEGORIES_AMAZON.filter(c => c.id !== 'tous').map(c => 
        `<option value="${c.id}">${c.label}</option>`
    ).join("");

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Publier — MARKETPLACE OG</title>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <style>
        ${SHARED_STYLES}
        body { padding: 40px 20px; justify-content: center; align-items: center; }
        .og-form-container { width: 100%; max-width: 750px; margin: auto; background: var(--bg-panel); border: 1px solid rgba(212, 175, 55, 0.35); border-radius: 24px; padding: 45px; box-shadow: 0 25px 60px rgba(0,0,0,0.8), var(--gold-glow); backdrop-filter: blur(25px); box-sizing: border-box; }
        .og-form-title { font-family: var(--font-display); color: #fff; font-size: 1.8rem; margin-bottom: 24px; display: flex; align-items: center; gap: 14px; text-shadow: 0 0 20px rgba(212,175,55,0.4); }
        .og-form-title i { color: var(--gold-og); }
        .og-form-group { margin-bottom: 22px; display: flex; flex-direction: column; gap: 8px; }
        .og-form-group label { font-size: 0.85rem; font-weight: 600; color: var(--text-muted); font-family: var(--font-mono); }
        .og-form-control { background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.12); border-radius: 14px; padding: 14px 16px; color: #fff; font-size: 0.95rem; font-family: var(--font-body); outline: none; transition: all 0.3s; }
        .og-form-control:focus { border-color: var(--gold-og); box-shadow: var(--gold-glow); background: rgba(212,175,55,0.03); }
        select.og-form-control { cursor: pointer; }
        .og-submit-btn { width: 100%; background: linear-gradient(135deg, var(--gold-og), var(--gold-hover)); color: #030307; border: none; border-radius: 14px; padding: 16px; font-weight: 800; font-size: 1.05rem; font-family: var(--font-display); cursor: pointer; margin-top: 15px; box-shadow: 0 10px 35px rgba(212,175,55,0.4); transition: all 0.3s; }
        .og-submit-btn:hover { transform: translateY(-3px); box-shadow: 0 15px 45px rgba(0,240,255,0.5); }
        .og-back { display: inline-flex; align-items: center; gap: 8px; color: var(--text-muted); text-decoration: none; font-size: 0.88rem; margin-bottom: 24px; transition: color 0.2s; }
        .og-back:hover { color: var(--gold-og); }
    </style>
</head>
<body>
    <div class="og-bg-fx">
        <div class="og-bg-grid"></div>
    </div>

    <div class="og-form-container">
        <a href="/marketplace" class="og-back"><i data-lucide="arrow-left"></i> Retour à la Marketplace</a>
        <h1 class="og-form-title"><i data-lucide="plus-circle"></i> Publier une annonce internationale</h1>
        
        <form action="/marketplace/publier" method="POST">
            <div class="og-form-group">
                <label>Titre de l'annonce</label>
                <input type="text" name="titre" class="og-form-control" required placeholder="Ex: Rolex Submariner / Nounou / Livreur 24h">
            </div>
            
            <div class="og-form-group">
                <label>Catégorie (Façon Amazon)</label>
                <select name="categorie" class="og-form-control" required>
                    <option value="">Sélectionner une catégorie...</option>
                    ${optionsCategories}
                </select>
            </div>

            <div class="og-form-group">
                <label>Prix (Devise au choix: €, $, £...)</label>
                <input type="text" name="prix" class="og-form-control" required placeholder="Ex: 12 500 € ou 3 490 $ ou 950 £">
            </div>

            <div class="og-form-group">
                <label>Pays / Zone</label>
                <input type="text" name="pays" class="og-form-control" required placeholder="Ex: Royaume-Uni, France, Suisse, États-Unis...">
            </div>

            <div class="og-form-group">
                <label>Ville</label>
                <input type="text" name="ville" class="og-form-control" placeholder="Ex: Londres, Paris, Genève, New York...">
            </div>

            <div class="og-form-group">
                <label>Lien Photo (URL directe)</label>
                <input type="url" name="photo_url" class="og-form-control" placeholder="https://images.unsplash.com/...">
            </div>

            <button type="submit" class="og-submit-btn">Mettre en ligne immédiatement</button>
        </form>
    </div>
    <script src="https://unpkg.com/lucide@latest"></script>
    <script>if (typeof lucide !== "undefined") lucide.createIcons();</script>
</body>
</html>`);
});

// --- 3. TRAITEMENT POST PUBLICATION ---
router.post("/publier", async (req, res) => {
    try {
        const { titre, categorie, prix, pays, ville, photo_url } = req.body;

        await airtable.create("ANNONCES", {
            titre,
            categorie,
            prix,
            pays: pays || 'International',
            ville: ville || '',
            photo_url: photo_url || '',
            vendeur_id: 'marchand_verified_' + Date.now(),
            vendeur_nom: 'Boutique Partenaire Vérifiée',
            type_vendeur: 'marchand',
            actif: 1
        });

        res.redirect("/marketplace");
    } catch (err) {
        console.error("Erreur publication annonce Marketplace OG :", err);
        res.redirect("/marketplace/publier?erreur=1");
    }
});

module.exports = router;
