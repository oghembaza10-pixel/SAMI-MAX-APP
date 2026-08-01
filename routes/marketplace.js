// ==========================================================================
// SAMII OS — MARKETPLACE OG — Version Header Pro & Liens Rapides Façon Amazon
// ==========================================================================
const express = require("express");
const router  = express.Router();
const airtable = require("../services/airtable");

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

const CATEGORIES_AMAZON = [
    { id: "tous",            label: "Toutes nos catégories" },
    { id: "alexa",           label: "Alexa Skills" },
    { id: "global",          label: "Amazon Global Store" },
    { id: "haul",            label: "Amazon Haul" },
    { id: "seconde_main",    label: "Amazon Seconde main" },
    { id: "animalerie",      label: "Animalerie" },
    { id: "appareils",       label: "Appareils Amazon" },
    { id: "applis",          label: "Applis & Jeux" },
    { id: "auto",            label: "Auto et Moto" },
    { id: "bagages",         label: "Bagages et accessoires de voyage" },
    { id: "beaute",          label: "Beauté et Parfum" },
    { id: "beaute_premium",  label: "Beauté Premium" },
    { id: "cheques",         label: "Boutique chèques-cadeaux" },
    { id: "kindle",          label: "Boutique Kindle" },
    { id: "bricolage",       label: "Bricolage" },
    { id: "bebe",            label: "Bébés & Puériculture" },
    { id: "cuisine",         label: "Cuisine & Maison" },
    { id: "dvd",             label: "DVD & Blu-ray" },
    { id: "epicerie",        label: "Épicerie" },
    { id: "bureau",          label: "Fournitures de bureau" },
    { id: "electronique",    label: "High-Tech & Électronique" },
    { id: "jardin",          label: "Jardin & Plein air" },
    { id: "jeux",            label: "Jeux et Jouets" },
    { id: "livres",          label: "Livres" },
    { id: "luxe",            label: "Luxe & Joaillerie" },
    { id: "mode",            label: "Mode & Vêtements" },
    { id: "musique",         label: "Musique, Instruments & Vinyles" },
    { id: "sante",           label: "Santé et Soins du corps" },
    { id: "services",        label: "Services & Prestations" },
    { id: "sport",           label: "Sports et Loisirs" },
    { id: "logiciels",       label: "Logiciels" },
    { id: "autre",           label: "Autre" }
];

const ANNONCES_VIRTUELLES = [
    {
        id: "v_1",
        fields: {
            titre: "💎 Rolex Submariner Date — Édition Collector Or & Noir",
            categorie: "luxe",
            prix: "12 500 €",
            pays: "Suisse",
            ville: "Genève",
            photo_url: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80",
            vendeur_id: "ai_agent_samii",
            vendeur_nom: "🤖 Samii Core (Agent IA)",
            type_vendeur: "ia_marchand",
            actif: 1
        }
    },
    {
        id: "v_2",
        fields: {
            titre: "⚡ MacBook Pro M3 Max — 64Go RAM / 2To SSD (Pack Studio)",
            categorie: "electronique",
            prix: "3 490 $",
            pays: "États-Unis",
            ville: "New York",
            photo_url: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=80",
            vendeur_id: "ai_agent_vaulta",
            vendeur_nom: "🤖 Vaulta Automation (Bot)",
            type_vendeur: "ia_marchand",
            actif: 1
        }
    },
    {
        id: "v_3",
        fields: {
            titre: "🚀 Workflow n8n & Make — Automatisation e-commerce clés en main",
            categorie: "services",
            prix: "950 £",
            pays: "Royaume-Uni",
            ville: "Londres",
            photo_url: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=800&q=80",
            vendeur_id: "marchand_verified_1",
            vendeur_nom: "Boutique Partenaire Vérifiée",
            type_vendeur: "marchand",
            actif: 1
        }
    },
    {
        id: "v_4",
        fields: {
            titre: "🌿 Coffret Parfum Privé & Essence d'Oud Souverain",
            categorie: "beaute_premium",
            prix: "280 €",
            pays: "France",
            ville: "Paris",
            photo_url: "https://images.unsplash.com/photo-1523293182086-7651a899d37f?auto=format&fit=crop&w=800&q=80",
            vendeur_id: "ai_agent_samii",
            vendeur_nom: "🤖 Samii Core (Agent IA)",
            type_vendeur: "ia_marchand",
            actif: 1
        }
    }
];

const SHARED_STYLES = `
    :root {
        --bg-deep: #030307; 
        --bg-panel: rgba(12, 12, 18, 0.92); 
        --gold-og: #d4af37; 
        --gold-hover: #f3e5ab; 
        --gold-glow: 0 0 35px rgba(212, 175, 55, 0.28);
        --cyan-tech: #00f0ff; 
        --cyan-glow: 0 0 30px rgba(0, 240, 255, 0.3);
        --purple-vibe: #bd00ff;
        --purple-glow: 0 0 30px rgba(189, 0, 255, 0.25);
        --text-main: #f8f8f2; 
        --text-muted: #9494a0;
        --font-display: 'Cinzel', serif; 
        --font-body: 'Inter', sans-serif; 
        --font-mono: 'JetBrains Mono', monospace;
        --ease-premium: cubic-bezier(0.16, 1, 0.3, 1);
    }
    
    body { 
        background-color: var(--bg-deep); color: var(--text-main); font-family: var(--font-body); 
        margin: 0; padding: 0; overflow-x: hidden; display: flex; 
        background-image: 
            radial-gradient(circle at 10% 20%, rgba(189, 0, 255, 0.08) 0%, transparent 40%),
            radial-gradient(circle at 90% 80%, rgba(0, 240, 255, 0.08) 0%, transparent 40%),
            radial-gradient(circle at 50% 50%, rgba(212, 175, 55, 0.05) 0%, transparent 60%);
    }
    
    .og-sidebar {
        width: 280px; height: 100vh; position: fixed; top: 0; left: 0; background: rgba(5, 5, 10, 0.95);
        border-right: 1px solid rgba(255,255,255,0.08); backdrop-filter: blur(25px); display: flex; flex-direction: column; z-index: 200;
        padding: 24px; box-sizing: border-box; justify-content: space-between;
    }
    .og-sidebar-brand { font-family: var(--font-display); font-size: 1.25rem; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 10px; margin-bottom: 30px; text-shadow: var(--gold-glow); }
    .og-sidebar-brand i { color: var(--gold-og); }
    .og-sidebar-menu { display: flex; flex-direction: column; gap: 8px; flex: 1; }
    .og-sidebar-link {
        display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 12px;
        color: var(--text-muted); text-decoration: none; font-size: 0.9rem; font-weight: 500;
        transition: all 0.3s var(--ease-premium); border: 1px solid transparent;
    }
    .og-sidebar-link i { width: 18px; height: 18px; color: var(--text-muted); transition: color 0.3s; }
    .og-sidebar-link:hover, .og-sidebar-link.active {
        background: linear-gradient(90deg, rgba(212, 175, 55, 0.12), rgba(0, 240, 255, 0.08)); 
        border-color: rgba(212, 175, 55, 0.3); color: #fff; box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    }
    .og-sidebar-link:hover i, .og-sidebar-link.active i { color: var(--cyan-tech); filter: drop-shadow(0 0 8px var(--cyan-tech)); }
    
    .og-samii-sphere {
        background: linear-gradient(135deg, rgba(0, 240, 255, 0.12), rgba(189, 0, 255, 0.08), rgba(12, 12, 18, 0.95));
        border: 1px solid rgba(0, 240, 255, 0.4); border-radius: 16px; padding: 16px; margin-top: auto;
        box-shadow: var(--cyan-glow); position: relative; overflow: hidden;
    }
    .og-samii-title { font-family: var(--font-mono); font-size: 0.75rem; color: var(--cyan-tech); display: flex; align-items: center; gap: 6px; margin-bottom: 6px; font-weight: 700; text-shadow: 0 0 10px rgba(0,240,255,0.5); }
    .og-samii-text { font-size: 0.8rem; color: var(--text-muted); line-height: 1.4; }

    .og-main-wrapper { margin-left: 280px; width: calc(100% - 280px); min-height: 100vh; display: flex; flex-direction: column; }
    .og-bg-fx { position: fixed; inset: 0; z-index: -1; pointer-events: none; overflow: hidden; }
    .og-bg-grid { position: absolute; inset: 0; background-image: linear-gradient(rgba(212, 175, 55, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 240, 255, 0.04) 1px, transparent 1px); background-size: 50px 50px; }

    @media (max-width: 1024px) {
        .og-sidebar { display: none; }
        .og-main-wrapper { margin-left: 0; width: 100%; }
    }
`;

// --- 1. ROUTE ACCUEIL MARKETPLACE ---
router.get("/", requireAuth, async (req, res) => {
    const { categorie, recherche, pays, ville } = req.query;

    let annoncesAirtable = [];
    try {
        let filtres = ['{actif}=1'];
        if (categorie && categorie !== "tous") filtres.push(`{categorie}="${categorie}"`);
        if (recherche) filtres.push(`SEARCH(LOWER("${recherche}"), LOWER({titre}))`);
        if (pays) filtres.push(`SEARCH(LOWER("${pays}"), LOWER({pays}))`);
        if (ville) filtres.push(`SEARCH(LOWER("${ville}"), LOWER({ville}))`);

        annoncesAirtable = await airtable.find("ANNONCES", `AND(${filtres.join(",")})`, 50);
    } catch (err) {
        console.warn("⚠️ Mode secours actif (Airtable injoignable) :", err.message);
    }

    let toutesAnnonces = [...ANNONCES_VIRTUELLES, ...annoncesAirtable];

    if (categorie && categorie !== "tous") {
        toutesAnnonces = toutesAnnonces.filter(a => a.fields.categorie === categorie);
    }
    if (recherche) {
        const query = recherche.toLowerCase();
        toutesAnnonces = toutesAnnonces.filter(a => a.fields.titre.toLowerCase().includes(query));
    }

    const catInfo = (id) => CATEGORIES_AMAZON.find(c => c.id === id) || { label: id };

    const cardsHtml = toutesAnnonces.map((a, index) => {
        const f = a.fields;
        const cat = catInfo(f.categorie);
        const mainPhoto = f.photo_url || '';
        const isAiAgent = f.type_vendeur === 'ia_marchand';
        const accentClass = isAiAgent ? 'purple-border' : (index % 2 === 0 ? 'cyan-border' : 'gold-border');

        return `
        <a href="/vitrine/${f.vendeur_id || 'marchand_verified_1'}" class="og-card ${accentClass}">
            <div class="og-card__media">
                ${isAiAgent ? '<div class="og-ai-badge">Marchand IA</div>' : ''}
                <span class="og-card__badge">${cat.label}</span>
                ${mainPhoto ? `<img src="${mainPhoto}" alt="${f.titre}" loading="lazy">` : '<div class="og-card__placeholder">⚡</div>'}
                <div class="og-card__price-tag">${f.prix || 'Sur devis'}</div>
            </div>
            <div class="og-card__content">
                <h3 class="og-card__title">${f.titre}</h3>
                <div class="og-card__meta-grid">
                    <span>📍 ${f.pays || 'International'} ${f.ville ? '— ' + f.ville : ''}</span>
                    <span>🛡️ ${f.vendeur_nom || 'Boutique Partenaire Vérifiée'}</span>
                </div>
            </div>
        </a>`;
    }).join("");

    const categoryOptionsHtml = CATEGORIES_AMAZON.map(c => 
        `<option value="${c.id}" ${categorie === c.id ? 'selected' : ''}>${c.label}</option>`
    ).join("");

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Marketplace OG — Catalogue Exclusif</title>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700;800&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
    <style>
        ${SHARED_STYLES}
        
        .og-header { 
            position: sticky; top: 0; z-index: 100; background: rgba(3, 3, 7, 0.96); 
            backdrop-filter: blur(25px); border-bottom: 1px solid rgba(212, 175, 55, 0.25); 
            display: flex; flex-direction: column; box-shadow: 0 10px 30px rgba(0,0,0,0.6);
        }
        
        /* Ligne supérieure style Amazon (Adresse, Recherche, Compte, Panier) */
        .og-header__main-row {
            padding: 14px 28px; display: flex; align-items: center; justify-content: space-between; gap: 20px; border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        
        .og-brand-title { 
            font-family: var(--font-display); color: #fff; font-size: 1.35rem; font-weight: 800; 
            display: flex; align-items: center; gap: 10px; margin: 0; text-decoration: none; white-space: nowrap;
            background: linear-gradient(135deg, #fff 30%, var(--gold-og) 70%, var(--cyan-tech) 100%);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }

        /* Widget Adresse de livraison (Vide par défaut) */
        .og-delivery-widget {
            display: flex; align-items: flex-start; gap: 6px; padding: 6px 10px; border-radius: 8px; 
            border: 1px dashed rgba(255,255,255,0.15); color: var(--text-muted); font-size: 0.78srem; cursor: pointer; transition: border-color 0.2s;
        }
        .og-delivery-widget:hover { border-color: var(--gold-og); color: #fff; }
        .og-delivery-widget .sub-txt { font-weight: 700; color: #fff; font-size: 0.85rem; }

        /* Barre de recherche centrale */
        .og-amazon-search { 
            flex: 1; max-width: 650px; display: flex; background: var(--bg-panel); 
            border: 2px solid var(--gold-og); border-radius: 10px; overflow: hidden; 
            box-shadow: 0 4px 20px rgba(0,0,0,0.5), var(--gold-glow);
        }
        .og-category-select-wrapper { background: rgba(20, 20, 30, 0.98); border-right: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; padding: 0 10px; }
        .og-category-select-wrapper select { background: transparent; border: none; color: #fff; font-family: var(--font-body); font-size: 0.82rem; font-weight: 600; outline: none; cursor: pointer; padding: 10px 4px; }
        .og-category-select-wrapper select option { background: #0a0a10; color: #fff; }
        
        .og-search-input-box { flex: 1; display: flex; align-items: center; padding: 0 14px; background: rgba(0,0,0,0.2); }
        .og-search-input-box input { width: 100%; background: transparent; border: none; color: #fff; font-size: 0.9rem; font-family: var(--font-body); padding: 10px 0; outline: none; }
        
        .og-search-submit { 
            background: linear-gradient(135deg, var(--gold-og), #b89728); color: #030307; border: none; padding: 0 22px; font-weight: 800; cursor: pointer; 
            display: flex; align-items: center; justify-content: center; transition: filter 0.2s; font-size: 0.9rem;
        }
        .og-search-submit:hover { filter: brightness(1.15); }

        /* Bloc Connexion & Compte / Panier à droite */
        .og-header-right { display: flex; align-items: center; gap: 18px; }
        
        .og-account-link {
            display: flex; flex-direction: column; text-decoration: none; color: var(--text-main); font-size: 0.78rem; padding: 4px 8px; border-radius: 8px; border: 1px solid transparent; transition: all 0.2s;
        }
        .og-account-link:hover { border-color: rgba(212,175,55,0.4); background: rgba(212,175,55,0.05); }
        .og-account-link .line-bold { font-weight: 700; color: #fff; font-size: 0.85rem; font-family: var(--font-display); }

        .og-cart-link {
            display: flex; align-items: center; gap: 6px; text-decoration: none; color: var(--gold-og); font-weight: 700; font-size: 0.9rem; padding: 8px 12px; border-radius: 8px; background: rgba(212,175,55,0.08); border: 1px solid rgba(212,175,55,0.2);
        }

        /* Ligne inférieure : Liens rapides textuels Façon Amazon (Sans aucune icône, 100% écriture) */
        .og-header__sub-row {
            background: rgba(10, 10, 16, 0.98); padding: 10px 28px; display: flex; align-items: center; justify-content: space-between; overflow-x: auto; white-space: nowrap; border-top: 1px solid rgba(255,255,255,0.04);
        }
        .og-sub-links { display: flex; align-items: center; gap: 24px; list-style: none; margin: 0; padding: 0; }
        .og-sub-links a {
            color: #dcdce6; text-decoration: none; font-size: 0.85rem; font-weight: 600; font-family: var(--font-body); transition: color 0.2s; position: relative; padding-bottom: 2px;
        }
        .og-sub-links a:hover { color: var(--gold-og); }
        .og-sub-links a::after {
            content: ''; position: absolute; bottom: 0; left: 0; width: 0; height: 2px; background: var(--gold-og); transition: width 0.3s;
        }
        .og-sub-links a:hover::after { width: 100%; }
        
        .og-publish-cta { 
            display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 8px; text-decoration: none; 
            background: linear-gradient(135deg, var(--gold-og), var(--gold-hover)); color: #030307; font-weight: 800; font-size: 0.8rem; 
            font-family: var(--font-display); box-shadow: 0 4px 15px rgba(212,175,55,0.3); transition: all 0.2s;
        }
        .og-publish-cta:hover { transform: translateY(-2px); }

        .og-main-container { padding: 36px; flex: 1; }
        .og-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 28px; margin-top: 24px; }
        
        .og-card { 
            position: relative; background: var(--bg-panel); border-radius: 20px; overflow: hidden; 
            text-decoration: none; display: flex; flex-direction: column; transition: all 0.4s var(--ease-premium); box-shadow: 0 15px 35px rgba(0,0,0,0.6);
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
        
        .og-empty-state { grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 90px 20px; text-align: center; color: var(--text-muted); background: var(--bg-panel); border-radius: 24px; border: 1px dashed rgba(212,175,55,0.3); }
    </style>
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

        <header class="og-header">
            <!-- Ligne principale : Logo, Adresse (vide), Recherche, Connexion / Compte, Panier -->
            <div class="og-header__main-row">
                <a href="/marketplace" class="og-brand-title">MARKETPLACE OG</a>
                
                <!-- Adresse de livraison (Vide par défaut en attente de saisie utilisateur) -->
                <div class="og-delivery-widget" title="Définir votre adresse de livraison">
                    <span>📍</span>
                    <div>
                        <div style="font-size: 0.7rem;">Adresse de livraison :</div>
                        <div class="sub-txt">Définir l'adresse</div>
                    </div>
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
                    <!-- Bloc Connexion / Compte (Gmail / QG) -->
                    <a href="/login" class="og-account-link">
                        <span>Bonjour, Connectez-vous</span>
                        <span class="line-bold">Compte & QG</span>
                    </a>

                    <a href="/marketplace/publier" class="og-publish-cta">+ Publier</a>
                </div>
            </div>

            <!-- Ligne inférieure : Liens rapides textuels (Top Ventes, Services < 24h, Nounous, etc.) sans icônes -->
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

    <script src="https://unpkg.com/lucide@latest"></script>
    <script>if (typeof lucide !== "undefined") lucide.createIcons();</script>
</body>
</html>`);
});

// --- 2. ROUTE FORMULAIRE DE PUBLICATION ---
router.get("/publier", requireAuth, async (req, res) => {
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
router.post("/publier", requireAuth, async (req, res) => {
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
