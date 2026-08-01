// ==========================================================================
// SAMII OS — MARKETPLACE OG — Version Ultime (Flux Dynamique & Agents IA)
// ==========================================================================
const express = require("express");
const router  = express.Router();
const airtable = require("../services/airtable");

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

const CATEGORIES = [
    { id: "tous",           icon: "layout-grid",    label: "Toutes nos catégories" },
    { id: "electronique",   icon: "smartphone",     label: "Électronique & High-Tech" },
    { id: "mode",           icon: "shirt",          label: "Mode & Vêtements" },
    { id: "beaute",         icon: "sparkles",       label: "Beauté & Parfums" },
    { id: "maison",         icon: "home",           label: "Cuisine & Maison" },
    { id: "electromenager", icon: "washing-machine",label: "Électroménager" },
    { id: "sport",          icon: "dumbbell",       label: "Sports & Loisirs" },
    { id: "vehicules",      icon: "car",            label: "Auto et Moto / Véhicules" },
    { id: "immobilier",     icon: "building-2",     label: "Immobilier" },
    { id: "bureau",         icon: "briefcase",      label: "Fournitures de bureau" },
    { id: "livres",         icon: "book-open",      label: "Livres & E-books" },
    { id: "services",       icon: "concierge-bell", label: "Services & Prestations" },
    { id: "autre",          icon: "package",        label: "Autre" }
];

// 🤖 ANNONCES TEST FICTIVES (Marchands & Agents IA Autonomes)
const ANNONCES_VIRTUELLES = [
    {
        id: "v_1",
        fields: {
            titre: "💎 Rolex Submariner Date — Édition Collector Or & Noir",
            categorie: "mode",
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
            prix: "3 490 €",
            pays: "France",
            ville: "Paris",
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
            prix: "850 €",
            pays: "Algérie",
            ville: "Oran",
            photo_url: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=800&q=80",
            vendeur_id: "admin_og",
            vendeur_nom: "Claudine Harry",
            type_vendeur: "marchand",
            actif: 1
        }
    },
    {
        id: "v_4",
        fields: {
            titre: "🌿 Coffret Parfum Privé & Essence d'Oud Souverain",
            categorie: "beaute",
            prix: "220 €",
            pays: "Émirats Arabes Unis",
            ville: "Dubaï",
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
        --bg-panel: rgba(12, 12, 18, 0.88); 
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
        width: 280px; height: 100vh; position: fixed; top: 0; left: 0; background: rgba(5, 5, 10, 0.92);
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

// --- 1. ACCUEIL MARKETPLACE (Mix Airtable + Test IA) ---
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
        console.warn("⚠️ Mode secours actif (Airtale injoignable) :", err.message);
    }

    // Fusion avec les annonces virtuelles / test IA pour un rendu ultra-riche
    let toutesAnnonces = [...ANNONCES_VIRTUELLES, ...annoncesAirtable];

    // Filtrage dynamique en mémoire si Airtable est vide ou pour compléter les tests
    if (categorie && categorie !== "tous") {
        toutesAnnonces = toutesAnnonces.filter(a => a.fields.categorie === categorie);
    }
    if (recherche) {
        const query = recherche.toLowerCase();
        toutesAnnonces = toutesAnnonces.filter(a => a.fields.titre.toLowerCase().includes(query));
    }

    const catInfo = (id) => CATEGORIES.find(c => c.id === id) || { icon: "package", label: id };

    const cardsHtml = toutesAnnonces.map((a, index) => {
        const f = a.fields;
        const cat = catInfo(f.categorie);
        const mainPhoto = f.photo_url || '';
        const isAiAgent = f.type_vendeur === 'ia_marchand';
        
        const accentClass = isAiAgent ? 'purple-border' : (index % 2 === 0 ? 'cyan-border' : 'gold-border');

        return `
        <a href="/vitrine/${f.vendeur_id || 'admin_og'}" class="og-card ${accentClass}">
            <div class="og-card__media">
                ${isAiAgent ? '<div class="og-ai-badge"><i data-lucide="bot"></i> Marchand IA</div>' : ''}
                <span class="og-card__badge"><i data-lucide="${cat.icon}"></i> ${cat.label}</span>
                ${mainPhoto ? `<img src="${mainPhoto}" alt="${f.titre}" loading="lazy">` : '<div class="og-card__placeholder"><i data-lucide="zap" style="width:36px;height:36px;color:var(--cyan-tech);"></i></div>'}
                <div class="og-card__price-tag">${f.prix || 'Sur devis'}</div>
            </div>
            <div class="og-card__content">
                <h3 class="og-card__title">${f.titre}</h3>
                <div class="og-card__meta-grid">
                    <span><i data-lucide="map-pin" style="color:var(--cyan-tech); width:14px; height:14px;"></i> ${f.pays || 'International'} ${f.ville ? '— ' + f.ville : ''}</span>
                    <span><i data-lucide="shield-check" style="color:var(--gold-og); width:14px; height:14px;"></i> ${f.vendeur_nom || 'Claudine Harry'}</span>
                </div>
            </div>
        </a>`;
    }).join("");

    const categoryOptionsHtml = CATEGORIES.map(c => 
        `<option value="${c.id}" ${categorie === c.id ? 'selected' : ''}>${c.label}</option>`
    ).join("");

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Marketplace OG — OG Empire</title>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700;800&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
    <style>
        ${SHARED_STYLES}
        
        .og-header { 
            position: sticky; top: 0; z-index: 100; background: rgba(3, 3, 7, 0.90); 
            backdrop-filter: blur(25px); border-bottom: 1px solid rgba(212, 175, 55, 0.2); 
            padding: 22px 36px; display: flex; flex-direction: column; gap: 18px; 
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        }
        .og-header__top { display: flex; justify-content: space-between; align-items: center; width: 100%; }
        
        .og-brand-title { 
            font-family: var(--font-display); color: #fff; font-size: 1.6rem; font-weight: 800; 
            display: flex; align-items: center; gap: 14px; margin: 0; 
            background: linear-gradient(135deg, #fff 30%, var(--gold-og) 70%, var(--cyan-tech) 100%);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
            text-shadow: 0 0 40px rgba(212,175,55,0.3);
        }
        .og-brand-title i { color: var(--gold-og); width: 28px; height: 28px; filter: drop-shadow(0 0 10px var(--gold-og)); }
        
        .og-publish-cta { 
            display: inline-flex; align-items: center; gap: 10px; padding: 12px 24px; border-radius: 14px; text-decoration: none; 
            background: linear-gradient(135deg, var(--gold-og), var(--gold-hover)); color: #030307; font-weight: 800; font-size: 0.9rem; 
            font-family: var(--font-display); box-shadow: 0 8px 30px rgba(212,175,55,0.4); transition: all 0.3s var(--ease-premium); border: 1px solid #fff;
        }
        .og-publish-cta:hover { transform: translateY(-3px) scale(1.02); box-shadow: 0 12px 40px rgba(0,240,255,0.4); }
        
        .og-amazon-search { 
            width: 100%; display: flex; background: var(--bg-panel); 
            border: 1px solid rgba(0, 240, 255, 0.3); border-radius: 16px; overflow: hidden; backdrop-filter: blur(20px); 
            box-shadow: 0 8px 32px rgba(0,0,0,0.6), inset 0 0 15px rgba(0,240,255,0.05);
        }
        .og-category-select-wrapper { background: rgba(15, 15, 25, 0.95); border-right: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; padding: 0 16px; }
        .og-category-select-wrapper select { background: transparent; border: none; color: #fff; font-family: var(--font-body); font-size: 0.9rem; font-weight: 500; outline: none; cursor: pointer; padding: 14px 0; }
        .og-category-select-wrapper select option { background: #0a0a10; color: #fff; }
        
        .og-search-input-box { flex: 2; display: flex; align-items: center; gap: 12px; padding: 0 18px; background: rgba(0,0,0,0.25); }
        .og-search-input-box input { width: 100%; background: transparent; border: none; color: #fff; font-size: 0.95rem; font-family: var(--font-body); padding: 14px 0; outline: none; }
        
        .og-location-box { flex: 1; display: flex; align-items: center; gap: 10px; padding: 0 16px; border-left: 1px solid rgba(255,255,255,0.08); background: rgba(0,0,0,0.15); }
        .og-location-box input { width: 100%; background: transparent; border: none; color: #fff; font-size: 0.9rem; font-family: var(--font-body); outline: none; }
        
        .og-search-submit { 
            background: linear-gradient(135deg, var(--cyan-tech), #0088ff); color: #000; border: none; padding: 0 32px; font-weight: 800; cursor: pointer; 
            display: flex; align-items: center; justify-content: center; font-family: var(--font-display); transition: filter 0.2s;
        }
        .og-search-submit:hover { filter: brightness(1.2); }

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
            position: absolute; top: 12px; right: 12px; z-index: 3; display: flex; align-items: center; gap: 5px;
            font-size: 0.68rem; font-family: var(--font-mono); padding: 5px 10px; border-radius: 20px;
            background: rgba(189, 0, 255, 0.9); color: #fff; border: 1px solid rgba(255,255,255,0.2);
            box-shadow: 0 0 12px rgba(189,0,255,0.6); backdrop-filter: blur(8px);
        }
        
        .og-card__badge { 
            position: absolute; top: 12px; left: 12px; z-index: 3; display: flex; align-items: center; gap: 6px; 
            font-size: 0.7rem; font-family: var(--font-mono); padding: 6px 12px; border-radius: 20px; 
            background: rgba(5, 5, 10, 0.85); color: #fff; border: 1px solid rgba(255,255,255,0.12); backdrop-filter: blur(10px);
        }
        .og-card__price-tag { 
            position: absolute; bottom: 12px; right: 12px; z-index: 3; 
            background: linear-gradient(135deg, var(--gold-og), var(--gold-hover)); color: #000; 
            font-family: var(--font-mono); font-weight: 800; font-size: 1rem; padding: 6px 14px; border-radius: 12px; 
            box-shadow: 0 4px 15px rgba(212,175,55,0.4);
        }
        
        .og-card__content { padding: 18px; display: flex; flex-direction: column; gap: 12px; flex: 1; background: linear-gradient(180deg, rgba(12,12,18,0.6), rgba(5,5,10,0.9)); }
        .og-card__title { font-size: 0.95rem; font-weight: 700; color: #fff; line-height: 1.4; margin: 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .og-card__meta-grid { display: flex; flex-direction: column; gap: 6px; font-size: 0.78rem; color: var(--text-muted); margin-top: auto; }
        .og-card__meta-grid span { display: flex; align-items: center; gap: 8px; }
        
        .og-empty-state { grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 90px 20px; text-align: center; color: var(--text-muted); background: var(--bg-panel); border-radius: 24px; border: 1px dashed rgba(0,240,255,0.3); }
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
            <div class="og-samii-text">Marketplace hybride active. Agents IA & Marchands synchronisés en temps réel.</div>
        </div>
    </aside>

    <div class="og-main-wrapper">
        <div class="og-bg-fx">
            <div class="og-bg-grid"></div>
        </div>

        <header class="og-header">
            <div class="og-header__top">
                <h1 class="og-brand-title"><i data-lucide="store"></i> MARKETPLACE OG</h1>
                <a href="/marketplace/publier" class="og-publish-cta"><i data-lucide="plus-circle"></i> Publier une annonce</a>
            </div>
            
            <form class="og-amazon-search" method="GET">
                <div class="og-category-select-wrapper">
                    <select name="categorie">
                        ${categoryOptionsHtml}
                    </select>
                </div>
                <div class="og-search-input-box">
                    <i data-lucide="search" style="color:var(--cyan-tech); width:20px; height:20px; flex-shrink:0;"></i>
                    <input type="text" name="recherche" placeholder="Rechercher un produit ou agent IA..." value="${recherche || ''}">
                </div>
                <div class="og-location-box">
                    <i data-lucide="globe" style="color:var(--gold-og); width:18px; height:18px; flex-shrink:0;"></i>
                    <input type="text" name="pays" placeholder="Pays / Ville" value="${pays || ville || ''}">
                </div>
                <button type="submit" class="og-search-submit"><i data-lucide="search"></i> Explorer</button>
            </form>
        </header>

        <main class="og-main-container">
            <div style="font-family: var(--font-mono); font-size: 0.82rem; color: var(--cyan-tech); margin-bottom: 20px; display: flex; align-items: center; gap: 8px;">
                <span style="width: 8px; height: 8px; background: var(--cyan-tech); border-radius: 50%; box-shadow: var(--cyan-glow); display: inline-block;"></span>
                ${toutesAnnonces.length} annonce${toutesAnnonces.length !== 1 ? 's' : ''} disponible${toutesAnnonces.length !== 1 ? 's' : ''} (dont agents IA marchands)
            </div>
            <div class="og-grid">
                ${toutesAnnonces.length ? cardsHtml : `
                    <div class="og-empty-state">
                        <i data-lucide="shopping-bag" style="width:56px;height:56px;color:var(--gold-og);margin-bottom:16px;"></i>
                        <div style="font-size: 1.1rem; font-weight: 600; color: #fff; margin-bottom: 8px;">Aucune annonce active</div>
                        <div style="font-size: 0.85rem;">Publiez un article pour alimenter la marketplace.</div>
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

// --- 2. PAGE DE PUBLICATION ---
router.get("/publier", requireAuth, async (req, res) => {
    const optionsCategories = CATEGORIES.filter(c => c.id !== 'tous').map(c => 
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
        .og-form-container { width: 100%; max-width: 750px; margin: auto; background: var(--bg-panel); border: 1px solid rgba(0, 240, 255, 0.35); border-radius: 24px; padding: 45px; box-shadow: 0 25px 60px rgba(0,0,0,0.8), var(--cyan-glow); backdrop-filter: blur(25px); box-sizing: border-box; }
        .og-form-title { font-family: var(--font-display); color: #fff; font-size: 1.8rem; margin-bottom: 24px; display: flex; align-items: center; gap: 14px; text-shadow: 0 0 20px rgba(0,240,255,0.4); }
        .og-form-title i { color: var(--cyan-tech); }
        .og-form-group { margin-bottom: 22px; display: flex; flex-direction: column; gap: 8px; }
        .og-form-group label { font-size: 0.85rem; font-weight: 600; color: var(--text-muted); font-family: var(--font-mono); }
        .og-form-control { background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.12); border-radius: 14px; padding: 14px 16px; color: #fff; font-size: 0.95rem; font-family: var(--font-body); outline: none; transition: all 0.3s; }
        .og-form-control:focus { border-color: var(--cyan-tech); box-shadow: var(--cyan-glow); background: rgba(0,240,255,0.03); }
        select.og-form-control { cursor: pointer; }
        .og-submit-btn { width: 100%; background: linear-gradient(135deg, var(--gold-og), var(--gold-hover)); color: #030307; border: none; border-radius: 14px; padding: 16px; font-weight: 800; font-size: 1.05rem; font-family: var(--font-display); cursor: pointer; margin-top: 15px; box-shadow: 0 10px 35px rgba(212,175,55,0.4); transition: all 0.3s; }
        .og-submit-btn:hover { transform: translateY(-3px); box-shadow: 0 15px 45px rgba(0,240,255,0.5); }
        .og-back { display: inline-flex; align-items: center; gap: 8px; color: var(--text-muted); text-decoration: none; font-size: 0.88rem; margin-bottom: 24px; transition: color 0.2s; }
        .og-back:hover { color: var(--cyan-tech); }
    </style>
</head>
<body>
    <div class="og-bg-fx">
        <div class="og-bg-grid"></div>
    </div>

    <div class="og-form-container">
        <a href="/marketplace" class="og-back"><i data-lucide="arrow-left"></i> Retour à la Marketplace</a>
        <h1 class="og-form-title"><i data-lucide="plus-circle"></i> Publier une annonce</h1>
        
        <form action="/marketplace/publier" method="POST">
            <div class="og-form-group">
                <label>Titre de l'annonce</label>
                <input type="text" name="titre" class="og-form-control" required placeholder="Ex: Montre de Luxe / Service Exclusif">
            </div>
            
            <div class="og-form-group">
                <label>Catégorie</label>
                <select name="categorie" class="og-form-control" required>
                    <option value="">Sélectionner une catégorie...</option>
                    ${optionsCategories}
                </select>
            </div>

            <div class="og-form-group">
                <label>Prix</label>
                <input type="text" name="prix" class="og-form-control" required placeholder="Ex: 250 €">
            </div>

            <div class="og-form-group">
                <label>Pays / Zone</label>
                <input type="text" name="pays" class="og-form-control" required placeholder="Ex: France, Algérie, International...">
            </div>

            <div class="og-form-group">
                <label>Ville</label>
                <input type="text" name="ville" class="og-form-control" placeholder="Ex: Paris, Oran...">
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
            vendeur_id: req.session.userId || 'admin_og',
            vendeur_nom: req.session.nom || 'Claudine Harry',
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
