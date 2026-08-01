<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Marketplace OG — Catalogue Exclusif</title>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700;800&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-deep: #030307;
            --bg-panel: #08080f;
            --gold-og: #d4af37;
            --gold-hover: #e5c158;
            --cyan-tech: #00f0ff;
            --purple-ai: #bd00ff;
            --text-main: #f0f0f5;
            --text-muted: #9494a0;
            --font-display: 'Cinzel', serif;
            --font-body: 'Inter', sans-serif;
            --font-mono: 'JetBrains Mono', monospace;
            --ease-premium: cubic-bezier(0.16, 1, 0.3, 1);
            --gold-glow: 0 0 25px rgba(212, 175, 55, 0.25);
            --cyan-glow: 0 0 25px rgba(0, 240, 255, 0.25);
            --purple-glow: 0 0 25px rgba(189, 0, 255, 0.25);
        }

        body {
            background-color: var(--bg-deep);
            color: var(--text-main);
            font-family: var(--font-body);
            margin: 0;
            padding: 0;
            overflow-x: hidden;
            display: flex;
            background-image: 
                radial-gradient(circle at 10% 20%, rgba(189, 0, 255, 0.08) 0%, transparent 40%),
                radial-gradient(circle at 90% 80%, rgba(0, 240, 255, 0.08) 0%, transparent 40%),
                radial-gradient(circle at 50% 50%, rgba(212, 175, 55, 0.05) 0%, transparent 60%);
        }
        
        .og-sidebar {
            width: 280px;
            height: 100vh;
            position: fixed;
            top: 0;
            left: 0;
            background: rgba(5, 5, 10, 0.95);
            border-right: 1px solid rgba(255,255,255,0.08);
            backdrop-filter: blur(25px);
            display: flex;
            flex-direction: column;
            z-index: 200;
            padding: 24px;
            box-sizing: border-box;
            justify-content: space-between;
        }
        .og-sidebar-brand {
            font-family: var(--font-display);
            font-size: 1.25rem;
            font-weight: 700;
            color: #fff;
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 30px;
            text-shadow: var(--gold-glow);
        }
        .og-sidebar-brand i { color: var(--gold-og); }
        .og-sidebar-menu { display: flex; flex-direction: column; gap: 8px; flex: 1; }
        .og-sidebar-link {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 16px;
            border-radius: 12px;
            color: var(--text-muted);
            text-decoration: none;
            font-size: 0.9rem;
            font-weight: 500;
            transition: all 0.3s var(--ease-premium);
            border: 1px solid transparent;
        }
        .og-sidebar-link i { width: 18px; height: 18px; color: var(--text-muted); transition: color 0.3s; }
        .og-sidebar-link:hover, .og-sidebar-link.active {
            background: linear-gradient(90deg, rgba(212, 175, 55, 0.12), rgba(0, 240, 255, 0.08)); 
            border-color: rgba(212, 175, 55, 0.3);
            color: #fff;
            box-shadow: 0 4px 20px rgba(0,0,0,0.4);
        }
        .og-sidebar-link:hover i, .og-sidebar-link.active i {
            color: var(--cyan-tech);
            filter: drop-shadow(0 0 8px var(--cyan-tech));
        }
        .og-sidebar-link:hover span.arrow, .og-sidebar-link.active span.arrow { 
            color: var(--cyan-tech, #00f0ff); 
        }

        .og-sidebar .badge-gold {
            background: rgba(212, 175, 55, 0.15); 
            color: var(--gold-og, #d4af37);
            border: 1px solid rgba(212, 175, 55, 0.3);
            font-size: 0.7rem; 
            padding: 2px 6px; 
            border-radius: 4px; 
            font-family: var(--font-mono, monospace);
        }

        .og-sidebar-overlay {
            position: fixed; 
            top: 0; 
            left: 0; 
            width: 100%; 
            height: 100%;
            background: rgba(3, 3, 7, 0.8);
            backdrop-filter: blur(8px);
            z-index: 250;
            opacity: 0; 
            visibility: hidden;
            transition: all 0.3s var(--ease-premium);
        }
        .og-sidebar-overlay.active { 
            opacity: 1; 
            visibility: visible; 
        }
        
        .og-samii-sphere {
            background: linear-gradient(135deg, rgba(0, 240, 255, 0.12), rgba(189, 0, 255, 0.08), rgba(12, 12, 18, 0.95));
            border: 1px solid rgba(0, 240, 255, 0.4);
            border-radius: 16px;
            padding: 16px;
            margin-top: auto;
            box-shadow: var(--cyan-glow);
            position: relative;
            overflow: hidden;
        }
        .og-samii-title {
            font-family: var(--font-mono);
            font-size: 0.75rem;
            color: var(--cyan-tech);
            display: flex;
            align-items: center;
            gap: 6px;
            margin-bottom: 6px;
            font-weight: 700;
            text-shadow: 0 0 10px rgba(0,240,255,0.5);
        }
        .og-samii-text { font-size: 0.8rem; color: var(--text-muted); line-height: 1.4; }

        .og-main-wrapper {
            margin-left: 280px;
            width: calc(100% - 280px);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
        }
        .og-bg-fx { position: fixed; inset: 0; z-index: -1; pointer-events: none; overflow: hidden; }
        .og-bg-grid {
            position: absolute;
            inset: 0;
            background-image: linear-gradient(rgba(212, 175, 55, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 240, 255, 0.04) 1px, transparent 1px);
            background-size: 50px 50px;
        }

        /* Barre Promo Défilante Supérieure */
        .og-top-promo-banner {
            background: linear-gradient(90deg, #111, #221a05, #111);
            border-bottom: 1px solid rgba(212,175,55,0.3);
            color: var(--gold-og);
            font-family: var(--font-mono);
            font-size: 0.78rem;
            padding: 6px 20px;
            text-align: center;
            font-weight: 700;
            letter-spacing: 0.5px;
            box-shadow: inset 0 0 20px rgba(212,175,55,0.1);
        }

        .og-header {
            position: sticky;
            top: 0;
            z-index: 100;
            background: rgba(3, 3, 7, 0.96);
            backdrop-filter: blur(25px);
            border-bottom: 1px solid rgba(212, 175, 55, 0.25);
            display: flex;
            flex-direction: column;
            box-shadow: 0 10px 30px rgba(0,0,0,0.6);
        }
        
        .og-header__main-row {
            padding: 12px 28px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        
        .og-brand-title { 
            font-family: var(--font-display);
            color: #fff;
            font-size: 1.35rem;
            font-weight: 800; 
            display: flex;
            align-items: center;
            gap: 10px;
            margin: 0;
            text-decoration: none;
            white-space: nowrap;
            background: linear-gradient(135deg, #fff 30%, var(--gold-og) 70%, var(--cyan-tech) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .og-delivery-widget {
            display: flex;
            align-items: flex-start;
            gap: 6px;
            padding: 6px 10px;
            border-radius: 8px; 
            border: 1px dashed rgba(255,255,255,0.15);
            color: var(--text-muted);
            font-size: 0.78rem;
            cursor: pointer;
            transition: border-color 0.2s;
        }
        .og-delivery-widget:hover { border-color: var(--gold-og); color: #fff; }
        .og-delivery-widget .sub-txt { font-weight: 700; color: #fff; font-size: 0.85rem; }

        /* Sélecteur Pays & Devise style Amazon */
        .og-locale-selector {
            display: flex;
            align-items: center;
            gap: 6px;
            background: rgba(20,20,30,0.8);
            border: 1px solid rgba(255,255,255,0.12);
            border-radius: 8px;
            padding: 6px 10px;
            color: #fff;
            font-size: 0.8rem;
            font-family: var(--font-mono);
            cursor: pointer;
            transition: border-color 0.2s;
        }
        .og-locale-selector:hover { border-color: var(--gold-og); }
        .og-locale-selector select { background: transparent; border: none; color: #fff; font-family: var(--font-mono); font-size: 0.8rem; font-weight: 700; outline: none; cursor: pointer; }
        .og-locale-selector select option { background: #0a0a10; color: #fff; }

        .og-amazon-search { 
            flex: 1;
            max-width: 550px;
            display: flex;
            background: var(--bg-panel); 
            border: 2px solid var(--gold-og);
            border-radius: 10px;
            overflow: hidden; 
            box-shadow: 0 4px 20px rgba(0,0,0,0.5), var(--gold-glow);
        }
        .og-category-select-wrapper { background: rgba(20, 20, 30, 0.98); border-right: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; padding: 0 8px; }
        .og-category-select-wrapper select { background: transparent; border: none; color: #fff; font-family: var(--font-body); font-size: 0.8rem; font-weight: 600; outline: none; cursor: pointer; padding: 10px 4px; }
        .og-category-select-wrapper select option { background: #0a0a10; color: #fff; }
        
        .og-search-input-box { flex: 1; display: flex; align-items: center; padding: 0 12px; background: rgba(0,0,0,0.2); }
        .og-search-input-box input { width: 100%; background: transparent; border: none; color: #fff; font-size: 0.9rem; font-family: var(--font-body); padding: 10px 0; outline: none; }
        
        .og-search-submit { 
            background: linear-gradient(135deg, var(--gold-og), #b89728);
            color: #030307;
            border: none;
            padding: 0 18px;
            font-weight: 800;
            cursor: pointer; 
            display: flex;
            align-items: center;
            justify-content: center;
            transition: filter 0.2s;
            font-size: 0.9rem;
        }
        .og-search-submit:hover { filter: brightness(1.15); }

        .og-header-right { display: flex; align-items: center; gap: 14px; }
        
        .og-account-link {
            display: flex;
            flex-direction: column;
            text-decoration: none;
            color: var(--text-main);
            font-size: 0.78rem;
            padding: 4px 8px;
            border-radius: 8px;
            border: 1px solid transparent;
            transition: all 0.2s;
        }
        .og-account-link:hover { border-color: rgba(212,175,55,0.4); background: rgba(212,175,55,0.05); }
        .og-account-link .line-bold { font-weight: 700; color: #fff; font-size: 0.85rem; font-family: var(--font-display); }

        /* Bouton Panier coulissant */
        .og-cart-btn {
            display: flex;
            align-items: center;
            gap: 6px;
            text-decoration: none;
            color: var(--gold-og);
            font-weight: 700;
            font-size: 0.85rem;
            padding: 8px 12px;
            border-radius: 8px;
            background: rgba(212,175,55,0.08);
            border: 1px solid rgba(212,175,55,0.3);
            cursor: pointer;
            transition: all 0.2s;
        }
        .og-cart-btn:hover { background: rgba(212,175,55,0.15); }

        .og-header__sub-row {
            background: rgba(10, 10, 16, 0.98);
            padding: 10px 28px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            overflow-x: auto;
            white-space: nowrap;
            border-top: 1px solid rgba(255,255,255,0.04);
        }
        .og-sub-links { display: flex; align-items: center; gap: 24px; list-style: none; margin: 0; padding: 0; }
        .og-sub-links a {
            color: #dcdce6;
            text-decoration: none;
            font-size: 0.85rem;
            font-weight: 600;
            font-family: var(--font-body);
            transition: color 0.2s;
            position: relative;
            padding-bottom: 2px;
        }
        .og-sub-links a:hover { color: var(--gold-og); }
        .og-sub-links a::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 0;
            width: 0;
            height: 2px;
            background: var(--gold-og);
            transition: width 0.3s;
        }
        .og-sub-links a:hover::after { width: 100%; }
        
        .og-publish-cta { 
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 14px;
            border-radius: 8px;
            text-decoration: none; 
            background: linear-gradient(135deg, var(--gold-og), var(--gold-hover));
            color: #030307;
            font-weight: 800;
            font-size: 0.8rem; 
            font-family: var(--font-display);
            box-shadow: 0 4px 15px rgba(212,175,55,0.3);
            transition: all 0.2s;
        }
        .og-publish-cta:hover { transform: translateY(-2px); }

        .og-main-container { padding: 36px; flex: 1; }
        .og-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 28px; margin-top: 24px; }
        
        .og-card { 
            position: relative;
            background: var(--bg-panel);
            border-radius: 20px;
            overflow: hidden; 
            display: flex;
            flex-direction: column;
            transition: all 0.4s var(--ease-premium);
            box-shadow: 0 15px 35px rgba(0,0,0,0.6);
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
            position: absolute;
            top: 12px;
            right: 12px;
            z-index: 3; 
            font-size: 0.68rem;
            font-family: var(--font-mono);
            padding: 5px 10px;
            border-radius: 20px;
            background: rgba(189, 0, 255, 0.9);
            color: #fff;
            border: 1px solid rgba(255,255,255,0.2);
            box-shadow: 0 0 12px rgba(189,0,255,0.6);
            backdrop-filter: blur(8px);
        }
        
        .og-card__badge { 
            position: absolute;
            top: 12px;
            left: 12px;
            z-index: 3; 
            font-size: 0.7rem;
            font-family: var(--font-mono);
            padding: 6px 12px;
            border-radius: 20px; 
            background: rgba(5, 5, 10, 0.85);
            color: #fff;
            border: 1px solid rgba(255,255,255,0.12);
            backdrop-filter: blur(10px);
        }
        .og-card__price-tag { 
            position: absolute;
            bottom: 12px;
            right: 12px;
            z-index: 3; 
            background: linear-gradient(135deg, var(--gold-og), var(--gold-hover));
            color: #030307; 
            font-family: var(--font-mono);
            font-weight: 800;
            font-size: 1rem;
            padding: 6px 14px;
            border-radius: 12px; 
            box-shadow: 0 4px 15px rgba(212,175,55,0.4);
        }
        
        .og-card__content { padding: 18px; display: flex; flex-direction: column; gap: 12px; flex: 1; background: linear-gradient(180deg, rgba(12,12,18,0.6), rgba(5,5,10,0.9)); }
        .og-card__title { font-size: 0.95rem; font-weight: 700; color: #fff; line-height: 1.4; margin: 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .og-card__meta-grid { display: flex; flex-direction: column; gap: 6px; font-size: 0.78rem; color: var(--text-muted); margin-top: auto; }
        
        .og-add-cart-btn {
            width: 100%;
            background: rgba(212,175,55,0.1);
            border: 1px solid rgba(212,175,55,0.4);
            color: var(--gold-og);
            padding: 10px;
            border-radius: 10px;
            font-weight: 700;
            font-size: 0.82rem;
            cursor: pointer;
            transition: all 0.2s;
            font-family: var(--font-mono);
        }
        .og-add-cart-btn:hover { background: var(--gold-og); color: #030307; box-shadow: var(--gold-glow); }

        /* Panier Coulissant (Slide-over Cart) */
        .og-cart-drawer-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.7);
            backdrop-filter: blur(8px);
            z-index: 999;
            display: none;
            opacity: 0;
            transition: opacity 0.3s ease;
        }
        .og-cart-drawer-overlay.open { display: block; opacity: 1; }
        
        .og-cart-drawer {
            position: fixed;
            top: 0;
            right: -420px;
            width: 400px;
            height: 100vh;
            background: #08080f;
            border-left: 1px solid rgba(212,175,55,0.3);
            z-index: 1000;
            box-shadow: -10px 0 50px rgba(0,0,0,0.8);
            display: flex;
            flex-direction: column;
            transition: right 0.4s cubic-bezier(0.16, 1, 0.3, 1);
            box-sizing: border-box;
            padding: 24px;
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

        @media (max-width: 1024px) {
            .og-sidebar { display: none; }
            .og-main-wrapper { margin-left: 0; width: 100%; }
        }
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

        <!-- Barre de notification supérieure -->
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

                <!-- Sélecteur Pays & Devise style Amazon -->
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
                        <input type="text" name="recherche" placeholder="Rechercher dans le catalogue OG..." value="${recherche || ''}">
                    </div>
                    <button type="submit" class="og-search-submit">
                        <i data-lucide="search" style="width:18px;height:18px;"></i>
                    </button>
                </form>

                <div class="og-header-right">
                    <a href="/compte" class="og-account-link">
                        <span>Bonjour, Connecté</span>
                        <span class="line-bold">Compte & Listes</span>
                    </a>
                    <button class="og-cart-btn" onclick="toggleCartDrawer()">
                        <i data-lucide="shopping-cart" style="width:18px;height:18px;"></i>
                        <span>Panier</span>
                    </button>
                </div>
            </div>

            <div class="og-header__sub-row">
                <ul class="og-sub-links">
                    <li><a href="/marketplace">Toutes nos offres</a></li>
                    <li><a href="/marketplace?categorie=ia_marchand">Marchands IA</a></li>
                    <li><a href="/marketplace?categorie=services">Services & Consulting</a></li>
                    <li><a href="/marketplace?categorie=automatisation">Automatisations n8n</a></li>
                    <li><a href="/marketplace?categorie=exclusivites">Le Sovereign</a></li>
                </ul>
                <a href="/marketplace/publier" class="og-publish-cta">
                    <i data-lucide="plus-circle" style="width:15px;height:15px;"></i> Publier une offre
                </a>
            </div>
        </header>

        <main class="og-main-container">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h1 style="font-family: var(--font-display); font-size: 1.8rem; color: #fff; margin: 0;">Catalogue Exclusif</h1>
                <span style="color: var(--text-muted); font-size: 0.9rem; font-family: var(--font-mono);">(${toutesAnnonces.length} résultats actifs)</span>
            </div>

            <div class="og-grid">
                ${cardsHtml.length > 0 ? cardsHtml : `
                    <div class="og-empty-state">
                        <div style="font-size: 2.5rem; margin-bottom: 12px;">🔍</div>
                        <h3 style="color: #fff; font-family: var(--font-display); margin-bottom: 8px;">Aucune offre trouvée</h3>
                        <p>Modifiez vos filtres de recherche ou explorez une autre catégorie de la marketplace.</p>
                    </div>
                `}
            </div>
        </main>
    </div>

    <!-- Tiroir Panier Coulissant -->
    <div class="og-cart-drawer-overlay" id="cartOverlay" onclick="toggleCartDrawer()"></div>
    <div class="og-cart-drawer" id="cartDrawer">
        <div class="og-cart-drawer-header">
            <div class="og-cart-drawer-title">Votre Panier OG</div>
            <button class="og-cart-close-btn" onclick="toggleCartDrawer()">&times;</button>
        </div>
        <div class="og-cart-items-list" id="cartItemsList">
            <div style="color: var(--text-muted); text-align: center; margin-top: 40px; font-size: 0.9rem;">Votre panier est vide pour le moment.</div>
        </div>
        <div class="og-cart-drawer-footer">
            <button class="og-checkout-btn" onclick="procederPaiement()">Commander en sécurité</button>
        </div>
    </div>

    <script src="https://unpkg.com/lucide@latest"></script>
    <script>
        lucide.createIcons();

        function toggleCartDrawer() {
            document.getElementById('cartDrawer').classList.toggle('open');
            document.getElementById('cartOverlay').classList.toggle('open');
        }

        let panier = [];
        function ajouterAuPanier(titre, prix) {
            panier.push({ titre, prix });
            mettreAJourPanierUI();
            toggleCartDrawer();
        }

        function mettreAJourPanierUI() {
            const listContainer = document.getElementById('cartItemsList');
            if (panier.length === 0) {
                listContainer.innerHTML = '<div style="color: var(--text-muted); text-align: center; margin-top: 40px; font-size: 0.9rem;">Votre panier est vide pour le moment.</div>';
                return;
            }
            listContainer.innerHTML = panier.map((item, idx) => `
                <div class="og-cart-item-row">
                    <div>
                        <div style="color: #fff; font-weight: 600; font-size: 0.88rem;">${item.titre}</div>
                        <div style="color: var(--gold-og); font-family: var(--font-mono); font-size: 0.8rem; margin-top: 4px;">${item.prix}</div>
                    </div>
                    <button onclick="supprimerDuPanier(${idx})" style="background:transparent; border:none; color:var(--text-muted); cursor:pointer; font-size:1rem;">&times;</button>
                </div>
            `).join('');
        }

        function supprimerDuPanier(index) {
            panier.splice(index, 1);
            mettreAJourPanierUI();
        }

        function procederPaiement() {
            alert("Redirection vers le tunnel de paiement sécurisé de la Marketplace OG...");
        }
    </script>
</body>
</html>
// --- 1. ROUTE INDEX MARKETPLACE (Suite & Fin) ---
router.get("/", async (req, res) => {
    try {
        const toutesAnnonces = await airtable.select("ANNONCES");
        const recherche = req.query.recherche || '';
        const cardsHtml = ''; // Assurez-vous que cardsHtml est défini ou généré correctement ici

        res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Marketplace OG — International</title>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <style>
        ${SHARED_STYLES}
    </style>
</head>
<body>
    <div class="og-bg-fx">
        <div class="og-bg-grid"></div>
    </div>

    <div class="og-app-layout">
        <!-- HEADER PRINCIPAL -->
        <header class="og-header">
            <div class="og-header__top-row">
                <a href="/marketplace" class="og-logo">
                    MARKETPLACE<span>OG</span>
                </a>

                <form action="/marketplace" method="GET" class="og-search-form">
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

                    <!-- Bouton Panier Coulissant -->
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
            let total = 0;
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
    </script>
</body>
</html>`);
    } catch (err) {
        console.error("Erreur chargement Marketplace OG :", err);
        res.status(500).send("Erreur interne du serveur");
    }
});
