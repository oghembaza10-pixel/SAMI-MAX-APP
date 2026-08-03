// ==========================================================================
// SAMII OS — MARKETPLACE OG — V3 : Sidebar Fournisseurs, Thème Clair/Sombre,
// Devises Intelligentes, Responsive Mobile Réel
// ==========================================================================
const express = require("express");
const router  = express.Router();
const airtable = require("../services/airtable");

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

const CATEGORIES_AMAZON = [
    { id: "tous",            icon: "layout-grid",     label: "Toutes nos catégories" },
    { id: "electronique",    icon: "smartphone",      label: "High-Tech & Électronique" },
    { id: "mode",            icon: "shirt",           label: "Mode & Vêtements" },
    { id: "beaute",          icon: "sparkles",        label: "Beauté et Parfum" },
    { id: "beaute_premium",  icon: "gem",             label: "Beauté Premium" },
    { id: "luxe",            icon: "diamond",         label: "Luxe & Joaillerie" },
    { id: "cuisine",         icon: "utensils-crossed",label: "Cuisine & Maison" },
    { id: "bricolage",       icon: "hammer",          label: "Bricolage" },
    { id: "jardin",          icon: "leaf",            label: "Jardin & Plein air" },
    { id: "bebe",            icon: "baby",            label: "Bébés & Puériculture" },
    { id: "animalerie",      icon: "paw-print",       label: "Animalerie" },
    { id: "auto",            icon: "car",             label: "Auto et Moto" },
    { id: "bagages",         icon: "briefcase",       label: "Bagages et voyage" },
    { id: "sport",           icon: "dumbbell",        label: "Sports et Loisirs" },
    { id: "jeux",            icon: "gamepad-2",       label: "Jeux et Jouets" },
    { id: "livres",          icon: "book-open",       label: "Livres" },
    { id: "musique",         icon: "music",           label: "Musique & Instruments" },
    { id: "bureau",          icon: "briefcase-business", label: "Fournitures de bureau" },
    { id: "logiciels",       icon: "code",            label: "Logiciels" },
    { id: "services",        icon: "concierge-bell",  label: "Services & Prestations" },
    { id: "sante",           icon: "heart-pulse",     label: "Santé et Soins" },
    { id: "epicerie",        icon: "shopping-basket", label: "Épicerie" },
    { id: "autre",           icon: "package",         label: "Autre" },
];

const FOURNISSEUR_REGIONS = [
    { id: "local",   icon: "map-pin",     label: "Fournisseurs Locaux" },
    { id: "europe",  icon: "landmark",    label: "Fournisseurs Européens" },
    { id: "chine",   icon: "factory",     label: "Fournisseurs Chinois" },
    { id: "turquie", icon: "anchor",      label: "Fournisseurs Turcs" },
    { id: "dubai",   icon: "building-2",  label: "Fournisseurs Dubaï" },
];

const DEVISES = [
    { code: "EUR", symbole: "€",  label: "Euro" },
    { code: "USD", symbole: "$",  label: "Dollar US" },
    { code: "GBP", symbole: "£",  label: "Livre Sterling" },
    { code: "DZD", symbole: "DA", label: "Dinar Algérien" },
    { code: "MAD", symbole: "DH", label: "Dirham Marocain" },
    { code: "TND", symbole: "DT", label: "Dinar Tunisien" },
    { code: "AED", symbole: "AED",label: "Dirham EAU" },
    { code: "TRY", symbole: "₺",  label: "Livre Turque" },
];

const ANNONCES_VIRTUELLES = [
    { id: "v_1", fields: {
        titre: "Rolex Submariner Date — Édition Collector Or & Noir",
        categorie: "luxe", region: "europe", prix: "12 500 €",
        pays: "Suisse", ville: "Genève",
        photo_url: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80",
        vendeur_id: "ai_agent_samii", vendeur_nom: "Samii Core (Agent IA)",
        type_vendeur: "ia_marchand", actif: 1,
    }},
    { id: "v_2", fields: {
        titre: "MacBook Pro M3 Max — 64Go RAM / 2To SSD (Pack Studio)",
        categorie: "electronique", region: "europe", prix: "3 490 $",
        pays: "États-Unis", ville: "New York",
        photo_url: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=80",
        vendeur_id: "ai_agent_vaulta", vendeur_nom: "Vaulta Automation (Bot)",
        type_vendeur: "ia_marchand", actif: 1,
    }},
    { id: "v_3", fields: {
        titre: "Workflow n8n & Make — Automatisation e-commerce clés en main",
        categorie: "services", region: "europe", prix: "950 £",
        pays: "Royaume-Uni", ville: "Londres",
        photo_url: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=800&q=80",
        vendeur_id: "marchand_verified_1", vendeur_nom: "Boutique Partenaire Vérifiée",
        type_vendeur: "marchand", actif: 1,
    }},
    { id: "v_4", fields: {
        titre: "Coffret Parfum Privé & Essence d'Oud Souverain",
        categorie: "beaute_premium", region: "local", prix: "280 €",
        pays: "France", ville: "Paris",
        photo_url: "https://images.unsplash.com/photo-1523293182086-7651a899d37f?auto=format&fit=crop&w=800&q=80",
        vendeur_id: "ai_agent_samii", vendeur_nom: "Samii Core (Agent IA)",
        type_vendeur: "ia_marchand", actif: 1,
    }},
];

const SHARED_STYLES = `
    :root {
        --bg-deep: #050505;
        --bg-panel: rgba(14, 14, 18, 0.85);
        --bg-panel-hover: rgba(20, 20, 26, 0.92);
        --border-soft: rgba(255,255,255,0.08);
        --gold-og: #d4af37;
        --gold-hover: #f3e5ab;
        --gold-glow: 0 0 32px rgba(212, 175, 55, 0.25);
        --cyan-tech: #00e5ff;
        --cyan-glow: 0 0 28px rgba(0, 229, 255, 0.22);
        --purple-vibe: #b84dff;
        --purple-glow: 0 0 28px rgba(184, 77, 255, 0.25);
        --text-main: #f5f5f7;
        --text-muted: #96969e;
        --font-display: 'Cinzel', serif;
        --font-body: 'Inter', sans-serif;
        --font-mono: 'JetBrains Mono', monospace;
        --ease: cubic-bezier(0.16, 1, 0.3, 1);
    }
    [data-theme="light"] {
        --bg-deep: #eef1f7;
        --bg-panel: rgba(255, 255, 255, 0.85);
        --bg-panel-hover: rgba(255, 255, 255, 0.98);
        --border-soft: rgba(20,30,60,0.08);
        --gold-og: #b8892a;
        --gold-hover: #8f6a1c;
        --gold-glow: 0 0 26px rgba(184, 137, 42, 0.18);
        --cyan-tech: #0090d8;
        --cyan-glow: 0 0 24px rgba(0, 144, 216, 0.18);
        --purple-vibe: #8a2be2;
        --purple-glow: 0 0 24px rgba(138, 43, 226, 0.16);
        --text-main: #14161f;
        --text-muted: #5a5e6e;
    }

    * { box-sizing: border-box; }
    body {
        background-color: var(--bg-deep); color: var(--text-main); font-family: var(--font-body);
        margin: 0; padding: 0; overflow-x: hidden; display: flex;
        transition: background-color .4s var(--ease), color .4s var(--ease);
        background-image:
            radial-gradient(circle at 10% 20%, rgba(184,77,255,0.06) 0%, transparent 40%),
            radial-gradient(circle at 90% 80%, rgba(0,229,255,0.06) 0%, transparent 40%);
    }
    [data-theme="light"] body {
        background-image:
            radial-gradient(circle at 10% 20%, rgba(184,137,42,0.05) 0%, transparent 40%),
            radial-gradient(circle at 90% 80%, rgba(0,144,216,0.05) 0%, transparent 40%);
    }

    .og-bg-fx { position: fixed; inset: 0; z-index: -1; pointer-events: none; overflow: hidden; }
    .og-bg-grid {
        position: absolute; inset: 0;
        background-image: linear-gradient(var(--border-soft) 1px, transparent 1px), linear-gradient(90deg, var(--border-soft) 1px, transparent 1px);
        background-size: 50px 50px;
    }

    /* ── SIDEBAR ── */
    .og-sidebar {
        width: 272px; height: 100vh; position: fixed; top: 0; left: 0; background: var(--bg-panel);
        border-right: 1px solid var(--border-soft); backdrop-filter: blur(25px); display: flex; flex-direction: column;
        z-index: 300; padding: 22px; justify-content: space-between; overflow-y: auto;
        transition: transform .35s var(--ease), background-color .4s var(--ease);
    }
    .og-sidebar-brand { font-family: var(--font-display); font-size: 1.2rem; font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 10px; margin-bottom: 26px; }
    .og-sidebar-brand i { color: var(--gold-og); width: 22px; height: 22px; }
    .og-sidebar-menu { display: flex; flex-direction: column; gap: 6px; }
    .og-sidebar-link {
        display: flex; align-items: center; gap: 12px; padding: 11px 14px; border-radius: 12px;
        color: var(--text-muted); text-decoration: none; font-size: .88rem; font-weight: 500;
        transition: all .3s var(--ease); border: 1px solid transparent;
    }
    .og-sidebar-link i { width: 17px; height: 17px; flex-shrink: 0; }
    .og-sidebar-link:hover, .og-sidebar-link.active {
        background: linear-gradient(90deg, rgba(212,175,55,0.14), rgba(0,229,255,0.06));
        border-color: rgba(212,175,55,0.3); color: var(--text-main);
    }
    .og-sidebar-link:hover i, .og-sidebar-link.active i { color: var(--gold-og); }

    /* Accordéon fournisseurs */
    .og-accordion-trigger {
        display: flex; align-items: center; gap: 12px; padding: 11px 14px; border-radius: 12px;
        color: var(--text-muted); font-size: .88rem; font-weight: 500; cursor: pointer;
        transition: all .3s var(--ease); border: 1px solid transparent; justify-content: space-between;
    }
    .og-accordion-trigger:hover { background: rgba(212,175,55,0.06); color: var(--text-main); }
    .og-accordion-trigger .left { display: flex; align-items: center; gap: 12px; }
    .og-accordion-trigger i.chev { width: 15px; height: 15px; transition: transform .3s var(--ease); }
    .og-accordion-trigger.open i.chev { transform: rotate(180deg); }
    .og-accordion-body {
        max-height: 0; overflow: hidden; transition: max-height .35s var(--ease);
        display: flex; flex-direction: column; gap: 2px; padding-left: 14px;
    }
    .og-accordion-body.open { max-height: 300px; padding-top: 6px; padding-bottom: 4px; }
    .og-accordion-body a {
        display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 10px;
        color: var(--text-muted); text-decoration: none; font-size: .8rem;
        border-left: 2px solid transparent; transition: all .25s ease;
    }
    .og-accordion-body a:hover { color: var(--gold-og); border-left-color: var(--gold-og); background: rgba(212,175,55,0.05); }
    .og-accordion-body a i { width: 14px; height: 14px; }

    .og-samii-sphere {
        background: linear-gradient(135deg, rgba(0,229,255,0.1), rgba(184,77,255,0.06), var(--bg-panel));
        border: 1px solid rgba(0,229,255,0.35); border-radius: 16px; padding: 15px; margin-top: 20px;
    }
    .og-samii-title { font-family: var(--font-mono); font-size: .72rem; color: var(--cyan-tech); display: flex; align-items: center; gap: 6px; margin-bottom: 6px; font-weight: 700; }
    .og-samii-title i { width: 13px; height: 13px; }
    .og-samii-text { font-size: .78rem; color: var(--text-muted); line-height: 1.4; }

    .og-main-wrapper { margin-left: 272px; width: calc(100% - 272px); min-height: 100vh; display: flex; flex-direction: column; transition: margin-left .35s var(--ease), width .35s var(--ease); }

    /* ── OVERLAY MOBILE SIDEBAR ── */
    .og-sidebar-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.6); backdrop-filter: blur(4px); z-index: 250; display: none; }
    .og-sidebar-overlay.open { display: block; }
    .og-hamburger {
        display: none; background: var(--bg-panel); border: 1px solid var(--border-soft); border-radius: 10px;
        width: 40px; height: 40px; align-items: center; justify-content: center; cursor: pointer; color: var(--text-main); flex-shrink: 0;
    }
    .og-hamburger i { width: 20px; height: 20px; }

    /* ── HEADER ── */
    .og-top-promo-banner {
        background: linear-gradient(90deg, var(--bg-panel), rgba(212,175,55,0.08), var(--bg-panel));
        border-bottom: 1px solid var(--border-soft); color: var(--gold-og); font-family: var(--font-mono); font-size: .74rem;
        padding: 6px 16px; text-align: center; font-weight: 700; letter-spacing: .04em;
    }
    .og-header {
        position: sticky; top: 0; z-index: 100; background: var(--bg-panel);
        backdrop-filter: blur(25px); border-bottom: 1px solid var(--border-soft);
        display: flex; flex-direction: column; box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    }
    .og-header__main-row { padding: 14px 26px; display: flex; align-items: center; gap: 14px; border-bottom: 1px solid var(--border-soft); flex-wrap: nowrap; }

    .og-brand-title {
        font-family: var(--font-display); color: var(--text-main); font-size: 1.25rem; font-weight: 800;
        display: flex; align-items: center; gap: 8px; margin: 0; text-decoration: none; white-space: nowrap; flex-shrink: 0;
    }
    .og-brand-title i { color: var(--gold-og); width: 24px; height: 24px; }

    .og-delivery-widget { display: none; align-items: flex-start; gap: 6px; padding: 6px 10px; border-radius: 8px; border: 1px dashed var(--border-soft); color: var(--text-muted); font-size: .76rem; cursor: pointer; flex-shrink: 0; }
    .og-delivery-widget i { width: 14px; height: 14px; margin-top: 2px; }
    .og-delivery-widget .sub-txt { font-weight: 700; color: var(--text-main); font-size: .82rem; }

    .og-locale-selector {
        display: flex; align-items: center; gap: 6px; background: var(--bg-panel-hover);
        border: 1px solid var(--border-soft); border-radius: 9px; padding: 7px 10px; color: var(--text-main);
        font-size: .78rem; font-family: var(--font-mono); flex-shrink: 0;
    }
    .og-locale-selector i { width: 14px; height: 14px; color: var(--gold-og); }
    .og-locale-selector select { background: transparent; border: none; color: var(--text-main); font-family: var(--font-mono); font-size: .78rem; font-weight: 700; outline: none; cursor: pointer; }
    .og-locale-selector select option { background: var(--bg-deep); color: var(--text-main); }

    .og-theme-toggle {
        background: var(--bg-panel-hover); border: 1px solid var(--border-soft); border-radius: 9px;
        width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; color: var(--gold-og);
        transition: transform .3s var(--ease);
    }
    .og-theme-toggle:hover { transform: rotate(20deg); }
    .og-theme-toggle i { width: 18px; height: 18px; }

    .og-amazon-search { flex: 1; min-width: 140px; display: flex; background: var(--bg-panel-hover); border: 2px solid var(--gold-og); border-radius: 10px; overflow: hidden; }
    .og-category-select-wrapper { background: var(--bg-panel); border-right: 1px solid var(--border-soft); display: none; align-items: center; padding: 0 6px; }
    .og-category-select-wrapper select { background: transparent; border: none; color: var(--text-main); font-family: var(--font-body); font-size: .78rem; font-weight: 600; outline: none; cursor: pointer; padding: 10px 4px; }
    .og-category-select-wrapper select option { background: var(--bg-deep); color: var(--text-main); }
    .og-search-input-box { flex: 1; display: flex; align-items: center; padding: 0 12px; }
    .og-search-input-box input { width: 100%; background: transparent; border: none; color: var(--text-main); font-size: .86rem; font-family: var(--font-body); padding: 10px 0; outline: none; }
    .og-search-submit { background: linear-gradient(135deg, var(--gold-og), var(--gold-hover)); color: #030307; border: none; padding: 0 16px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .og-search-submit i { width: 17px; height: 17px; }

    .og-header-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; margin-left: auto; }
    .og-account-link { display: none; flex-direction: column; text-decoration: none; color: var(--text-main); font-size: .76rem; padding: 4px 8px; border-radius: 8px; }
    .og-account-link .line-bold { font-weight: 700; color: var(--text-main); font-size: .83rem; font-family: var(--font-display); }

    .og-cart-btn { display: flex; align-items: center; gap: 6px; color: var(--gold-og); font-weight: 700; font-size: .82rem; padding: 8px 12px; border-radius: 9px; background: rgba(212,175,55,0.08); border: 1px solid rgba(212,175,55,0.3); cursor: pointer; flex-shrink: 0; }
    .og-cart-btn i { width: 16px; height: 16px; }

    .og-header__sub-row { background: var(--bg-panel-hover); padding: 9px 26px; display: flex; align-items: center; overflow-x: auto; white-space: nowrap; }
    .og-header__sub-row::-webkit-scrollbar { display: none; }
    .og-sub-links { display: flex; align-items: center; gap: 22px; list-style: none; margin: 0; padding: 0; }
    .og-sub-links a { color: var(--text-main); text-decoration: none; font-size: .82rem; font-weight: 600; transition: color .2s ease; }
    .og-sub-links a:hover { color: var(--gold-og); }

    .og-publish-cta {
        display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 9px; text-decoration: none;
        background: linear-gradient(135deg, var(--gold-og), var(--gold-hover)); color: #030307; font-weight: 800; font-size: .8rem;
        font-family: var(--font-display); flex-shrink: 0;
    }
    .og-publish-cta i { width: 15px; height: 15px; }

    .og-main-container { padding: 30px; flex: 1; }
    .og-status-line { font-family: var(--font-mono); font-size: .8rem; color: var(--gold-og); margin-bottom: 18px; display: flex; align-items: center; gap: 8px; }
    .og-status-line .dot { width: 7px; height: 7px; background: var(--gold-og); border-radius: 50%; box-shadow: var(--gold-glow); }

    /* ── GRILLE — 2 colonnes minimum garanti, style gros site ── */
    .og-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
    .og-card { position: relative; background: var(--bg-panel); border-radius: 18px; overflow: hidden; display: flex; flex-direction: column; transition: all .4s var(--ease); }
    .og-card.cyan-border { border: 1px solid rgba(0,229,255,0.22); }
    .og-card.gold-border { border: 1px solid rgba(212,175,55,0.22); }
    .og-card.purple-border { border: 1px solid rgba(184,77,255,0.3); box-shadow: 0 0 16px rgba(184,77,255,0.1); }
    .og-card:hover { transform: translateY(-6px); box-shadow: 0 20px 45px rgba(0,0,0,0.25), var(--cyan-glow); }
    .og-card.gold-border:hover { box-shadow: 0 20px 45px rgba(0,0,0,0.25), var(--gold-glow); }
    .og-card.purple-border:hover { box-shadow: 0 20px 45px rgba(0,0,0,0.25), var(--purple-glow); }

    .og-card__media { position: relative; width: 100%; aspect-ratio: 1/1; background: #000; overflow: hidden; }
    .og-card__media img { width: 100%; height: 100%; object-fit: cover; transition: transform .6s var(--ease); }
    .og-card:hover .og-card__media img { transform: scale(1.1); }
    .og-card__placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: var(--text-muted); }
    .og-card__placeholder i { width: 30px; height: 30px; }

    .og-ai-badge { position: absolute; top: 8px; right: 8px; z-index: 3; display: flex; align-items: center; gap: 4px; font-size: .6rem; font-family: var(--font-mono); padding: 4px 8px; border-radius: 20px; background: var(--purple-vibe); color: #fff; }
    .og-ai-badge i { width: 10px; height: 10px; }
    .og-card__badge { position: absolute; top: 8px; left: 8px; z-index: 3; display: flex; align-items: center; gap: 4px; font-size: .62rem; font-family: var(--font-mono); padding: 5px 9px; border-radius: 20px; background: rgba(5,5,10,0.8); color: #fff; backdrop-filter: blur(6px); }
    .og-card__badge i { width: 10px; height: 10px; color: var(--gold-og); }
    .og-card__price-tag { position: absolute; bottom: 8px; right: 8px; z-index: 3; background: linear-gradient(135deg, var(--gold-og), var(--gold-hover)); color: #030307; font-family: var(--font-mono); font-weight: 800; font-size: .82rem; padding: 5px 10px; border-radius: 10px; }

    .og-card__content { padding: 12px; display: flex; flex-direction: column; gap: 8px; flex: 1; }
    .og-card__title { font-size: .8rem; font-weight: 700; color: var(--text-main); line-height: 1.35; margin: 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; min-height: 2.2em; }
    .og-card__meta-grid { display: flex; flex-direction: column; gap: 4px; font-size: .68rem; color: var(--text-muted); margin-top: auto; }
    .og-card__meta-grid span { display: flex; align-items: center; gap: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .og-card__meta-grid i { width: 11px; height: 11px; flex-shrink: 0; }

    .og-add-cart-btn { width: 100%; background: rgba(212,175,55,0.1); border: 1px solid rgba(212,175,55,0.35); color: var(--gold-og); padding: 9px; border-radius: 9px; font-weight: 700; font-size: .74rem; cursor: pointer; font-family: var(--font-mono); display: flex; align-items: center; justify-content: center; gap: 5px; }
    .og-add-cart-btn i { width: 13px; height: 13px; }
    .og-add-cart-btn:hover { background: var(--gold-og); color: #030307; }

    .og-empty-state { grid-column: 1/-1; display: flex; flex-direction: column; align-items: center; padding: 70px 20px; text-align: center; color: var(--text-muted); background: var(--bg-panel); border-radius: 20px; border: 1px dashed rgba(212,175,55,0.3); }
    .og-empty-state i { width: 40px; height: 40px; color: rgba(212,175,55,0.5); margin-bottom: 14px; }

    /* ── PANIER COULISSANT ── */
    .og-cart-drawer-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.7); backdrop-filter: blur(8px); z-index: 999; display: none; opacity: 0; transition: opacity .3s ease; }
    .og-cart-drawer-overlay.open { display: block; opacity: 1; }
    .og-cart-drawer { position: fixed; top: 0; right: -420px; width: min(400px, 92vw); height: 100vh; background: var(--bg-deep); border-left: 1px solid var(--border-soft); z-index: 1000; display: flex; flex-direction: column; transition: right .4s var(--ease); box-sizing: border-box; padding: 22px; }
    .og-cart-drawer.open { right: 0; }
    .og-cart-drawer-header { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-soft); padding-bottom: 14px; margin-bottom: 14px; }
    .og-cart-drawer-title { font-family: var(--font-display); font-size: 1.1rem; color: var(--text-main); font-weight: 700; }
    .og-cart-close-btn { background: transparent; border: none; color: var(--text-muted); cursor: pointer; display: flex; }
    .og-cart-close-btn i { width: 22px; height: 22px; }
    .og-cart-items-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; }
    .og-cart-item-row { background: var(--bg-panel); border: 1px solid var(--border-soft); border-radius: 12px; padding: 12px; display: flex; justify-content: space-between; align-items: center; }
    .og-cart-drawer-footer { border-top: 1px solid var(--border-soft); padding-top: 14px; margin-top: 14px; }
    .og-checkout-btn { width: 100%; background: linear-gradient(135deg, var(--gold-og), var(--gold-hover)); color: #030307; border: none; border-radius: 12px; padding: 13px; font-weight: 800; font-family: var(--font-display); cursor: pointer; }

    /* ── RESPONSIVE — le vrai correctif mobile ── */
    @media (min-width: 720px) {
        .og-delivery-widget, .og-category-select-wrapper, .og-account-link { display: flex; }
        .og-card__title { font-size: .88rem; min-height: 2.4em; }
        .og-add-cart-btn { font-size: .78rem; }
        .og-grid { gap: 18px; }
    }
    @media (min-width: 1024px) {
        .og-grid { grid-template-columns: repeat(3, 1fr); }
        .og-main-container { padding: 36px; }
    }
    @media (min-width: 1300px) {
        .og-grid { grid-template-columns: repeat(4, 1fr); }
    }
    @media (max-width: 1023px) {
        .og-sidebar { transform: translateX(-100%); }
        .og-sidebar.open { transform: translateX(0); box-shadow: 20px 0 50px rgba(0,0,0,0.5); }
        .og-main-wrapper { margin-left: 0; width: 100%; }
        .og-hamburger { display: flex; }
        .og-header__main-row { padding: 12px 16px; }
        .og-locale-selector span.label { display: none; }
        .og-main-container { padding: 16px; }
        .og-top-promo-banner { font-size: .66rem; padding: 5px 10px; }
        .og-header__sub-row { padding: 8px 16px; }
        .og-cart-btn span.txt { display: none; }
    }
    @media (max-width: 420px) {
        .og-brand-title span.txt { display: none; }
        .og-search-input-box input { font-size: .8rem; }
    }
`;

const CLIENT_SCRIPT = `
    if (typeof lucide !== "undefined") lucide.createIcons();

    // ── Thème clair/sombre ──
    const themeToggleBtn = document.getElementById('themeToggle');
    const themeIcon = document.getElementById('themeIcon');
    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        if (themeIcon) themeIcon.setAttribute('data-lucide', theme === 'light' ? 'moon' : 'sun');
        if (typeof lucide !== "undefined") lucide.createIcons();
        localStorage.setItem('og-theme', theme);
    }
    const savedTheme = localStorage.getItem('og-theme') || 'dark';
    applyTheme(savedTheme);
    themeToggleBtn?.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
        applyTheme(current);
    });

    // ── Devise : détection auto + mémorisation ──
    const deviseSelect = document.getElementById('deviseSelect');
    const savedDevise = localStorage.getItem('og-devise');
    if (deviseSelect) {
        if (savedDevise) {
            deviseSelect.value = savedDevise;
        } else {
            const lang = navigator.language || 'fr-FR';
            const guess = lang.includes('DZ') ? 'DZD' : lang.includes('MA') ? 'MAD' : lang.includes('TN') ? 'TND' : lang.startsWith('en') ? 'USD' : 'EUR';
            deviseSelect.value = guess;
        }
        deviseSelect.addEventListener('change', () => localStorage.setItem('og-devise', deviseSelect.value));
    }

    // ── Sidebar mobile ──
    const sidebar = document.getElementById('ogSidebar');
    const sidebarOverlay = document.getElementById('ogSidebarOverlay');
    function toggleSidebar() {
        sidebar.classList.toggle('open');
        sidebarOverlay.classList.toggle('open');
    }
    document.getElementById('hamburgerBtn')?.addEventListener('click', toggleSidebar);
    sidebarOverlay?.addEventListener('click', toggleSidebar);

    // ── Accordéon fournisseurs ──
    document.querySelectorAll('.og-accordion-trigger').forEach(trigger => {
        trigger.addEventListener('click', () => {
            trigger.classList.toggle('open');
            const body = trigger.nextElementSibling;
            body.classList.toggle('open');
        });
    });

    // ── Panier ──
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
            container.innerHTML = '<div style="color:var(--text-muted);font-size:.85rem;text-align:center;margin-top:40px;">Ton panier est vide pour l\\'instant.</div>';
            document.getElementById('cartTotalPrice').innerText = '—';
            return;
        }
        let html = '';
        panier.forEach((item, idx) => {
            html += \`<div class="og-cart-item-row">
                <div><div style="font-size:.85rem;font-weight:600;color:var(--text-main);margin-bottom:4px;">\${item.titre}</div>
                <div style="font-size:.78rem;color:var(--gold-og);font-family:var(--font-mono);">\${item.prix}</div></div>
                <button onclick="retirerDuPanier(\${idx})" style="background:transparent;border:none;color:#ff5c5c;cursor:pointer;font-size:1.1rem;">&times;</button>
            </div>\`;
        });
        container.innerHTML = html;
        document.getElementById('cartTotalPrice').innerText = panier[panier.length - 1].prix;
    }
`;

function renderSidebar(fournisseurOuvert) {
    const regionsHtml = FOURNISSEUR_REGIONS.map(r => `
        <a href="/marketplace?region=${r.id}"><i data-lucide="${r.icon}"></i> ${r.label}</a>
    `).join("");

    return `
    <aside class="og-sidebar" id="ogSidebar">
        <div>
            <div class="og-sidebar-brand"><i data-lucide="crown"></i> OG EMPIRE</div>
            <nav class="og-sidebar-menu">
                <a href="/qg" class="og-sidebar-link"><i data-lucide="layout-dashboard"></i> QG Central</a>
                <a href="/marketplace" class="og-sidebar-link active"><i data-lucide="store"></i> Marketplace</a>
                <div class="og-accordion-trigger ${fournisseurOuvert ? 'open' : ''}">
                    <span class="left"><i data-lucide="globe"></i> Fournisseurs</span>
                    <i data-lucide="chevron-down" class="chev"></i>
                </div>
                <div class="og-accordion-body ${fournisseurOuvert ? 'open' : ''}">
                    ${regionsHtml}
                </div>
                <a href="/academy" class="og-sidebar-link"><i data-lucide="graduation-cap"></i> Academy</a>
                <a href="/community" class="og-sidebar-link"><i data-lucide="users"></i> Community</a>
                <a href="/arsenal" class="og-sidebar-link"><i data-lucide="shield-check"></i> Arsenal</a>
            </nav>
        </div>
        <div class="og-samii-sphere">
            <div class="og-samii-title"><i data-lucide="sparkles"></i> Sphère Samii</div>
            <div class="og-samii-text">Marketplace internationale active. Synchronisée en temps réel.</div>
        </div>
    </aside>
    <div class="og-sidebar-overlay" id="ogSidebarOverlay"></div>`;
}

function renderDevisesOptions() {
    return DEVISES.map(d => `<option value="${d.code}">${d.code} (${d.symbole})</option>`).join("");
}

// --- 1. ROUTE ACCUEIL MARKETPLACE ---
router.get("/", requireAuth, async (req, res) => {
    const { categorie, recherche, pays, ville, region } = req.query;
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
    if (categorie && categorie !== "tous") toutesAnnonces = toutesAnnonces.filter(a => a.fields.categorie === categorie);
    if (region) toutesAnnonces = toutesAnnonces.filter(a => a.fields.region === region);
    if (recherche) {
        const q = recherche.toLowerCase();
        toutesAnnonces = toutesAnnonces.filter(a => a.fields.titre.toLowerCase().includes(q));
    }

    const catInfo = (id) => CATEGORIES_AMAZON.find(c => c.id === id) || { icon: "package", label: id };

    const cardsHtml = toutesAnnonces.map((a, index) => {
        const f = a.fields;
        const cat = catInfo(f.categorie);
        const mainPhoto = f.photo_url || '';
        const isAiAgent = f.type_vendeur === 'ia_marchand';
        const accentClass = isAiAgent ? 'purple-border' : (index % 2 === 0 ? 'cyan-border' : 'gold-border');
        return `
        <div class="og-card ${accentClass}">
            <a href="/vitrine/${f.vendeur_id || 'marchand_verified_1'}" style="text-decoration:none;display:flex;flex-direction:column;flex:1;color:inherit;">
                <div class="og-card__media">
                    ${isAiAgent ? '<div class="og-ai-badge"><i data-lucide="bot"></i> IA</div>' : ''}
                    <span class="og-card__badge"><i data-lucide="${cat.icon}"></i> ${cat.label}</span>
                    ${mainPhoto ? `<img src="${mainPhoto}" alt="${f.titre}" loading="lazy">` : `<div class="og-card__placeholder"><i data-lucide="image"></i></div>`}
                    <div class="og-card__price-tag">${f.prix || 'Sur devis'}</div>
                </div>
                <div class="og-card__content">
                    <h3 class="og-card__title">${f.titre}</h3>
                    <div class="og-card__meta-grid">
                        <span><i data-lucide="map-pin"></i> ${f.pays || 'International'} ${f.ville ? '— ' + f.ville : ''}</span>
                        <span><i data-lucide="shield-check"></i> ${f.vendeur_nom || 'Boutique Partenaire Vérifiée'}</span>
                    </div>
                </div>
            </a>
            <div style="padding:0 12px 12px;">
                <button onclick="ajouterAuPanier('${f.titre.replace(/'/g, "\\'")}', '${(f.prix || 'Sur devis').replace(/'/g, "\\'")}')" class="og-add-cart-btn">
                    <i data-lucide="shopping-cart"></i> Ajouter
                </button>
            </div>
        </div>`;
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
    <style>${SHARED_STYLES}</style>
</head>
<body>
    ${renderSidebar(!!region)}

    <div class="og-main-wrapper">
        <div class="og-bg-fx"><div class="og-bg-grid"></div></div>

        <div class="og-top-promo-banner">
            ⚡ MARKETPLACE INTERNATIONALE OG — VENTES FLASH & SERVICES D'URGENCE EN CONTINU
        </div>

        <header class="og-header">
            <div class="og-header__main-row">
                <button class="og-hamburger" id="hamburgerBtn"><i data-lucide="menu"></i></button>
                <a href="/marketplace" class="og-brand-title"><i data-lucide="gem"></i> <span class="txt">MARKETPLACE OG</span></a>

                <div class="og-delivery-widget" title="Définir votre adresse de livraison">
                    <i data-lucide="map-pin"></i>
                    <div><div style="font-size:.68rem;">Adresse :</div><div class="sub-txt">Définir</div></div>
                </div>

                <div class="og-locale-selector">
                    <i data-lucide="globe"></i>
                    <select id="deviseSelect">${renderDevisesOptions()}</select>
                </div>

                <button class="og-theme-toggle" id="themeToggle" title="Changer de thème">
                    <i data-lucide="sun" id="themeIcon"></i>
                </button>

                <form class="og-amazon-search" method="GET">
                    <div class="og-category-select-wrapper">
                        <select name="categorie">${categoryOptionsHtml}</select>
                    </div>
                    <div class="og-search-input-box">
                        <input type="text" name="recherche" placeholder="Rechercher sur Marketplace OG..." value="${recherche || ''}">
                    </div>
                    <button type="submit" class="og-search-submit"><i data-lucide="search"></i></button>
                </form>

                <div class="og-header-right">
                    <a href="/login" class="og-account-link">
                        <span style="font-size:.72rem;">Bonjour, Connectez-vous</span>
                        <span class="line-bold">Compte & QG</span>
                    </a>
                    <button onclick="toggleCart()" class="og-cart-btn">
                        <i data-lucide="shopping-cart"></i> <span id="cartCountBadge">0</span> <span class="txt">art.</span>
                    </button>
                    <a href="/marketplace/publier" class="og-publish-cta"><i data-lucide="plus-circle"></i> Publier</a>
                </div>
            </div>
            <div class="og-header__sub-row">
                <ul class="og-sub-links">
                    <li><a href="/marketplace?recherche=top+vente">Top Ventes</a></li>
                    <li><a href="/marketplace?recherche=livreur+24h">Livreur -24h</a></li>
                    <li><a href="/marketplace?categorie=services&recherche=nounou">Nounou</a></li>
                    <li><a href="/marketplace?recherche=services+rapides">Urgences</a></li>
                    <li><a href="/marketplace?recherche=exclusivites">Nouveautés</a></li>
                    <li><a href="/marketplace?recherche=cartes+cadeaux">Cartes Cadeaux</a></li>
                    <li><a href="/marketplace?recherche=ventes+flash">Ventes Flash</a></li>
                </ul>
            </div>
        </header>

        <main class="og-main-container">
            <div class="og-status-line">
                <span class="dot"></span>
                ${toutesAnnonces.length} annonce${toutesAnnonces.length !== 1 ? 's' : ''} disponible${toutesAnnonces.length !== 1 ? 's' : ''}
                ${region ? ` — ${FOURNISSEUR_REGIONS.find(r => r.id === region)?.label || ''}` : ' (Marchands EU, UK & US)'}
            </div>
            <div class="og-grid">
                ${toutesAnnonces.length ? cardsHtml : `
                    <div class="og-empty-state">
                        <i data-lucide="package-search"></i>
                        <div style="font-size:1rem;font-weight:600;color:var(--text-main);margin-bottom:6px;">Aucune annonce active</div>
                        <div style="font-size:.85rem;">Publie un article pour alimenter le catalogue.</div>
                    </div>`}
            </div>
        </main>
    </div>

    <div id="cartOverlay" class="og-cart-drawer-overlay" onclick="toggleCart()"></div>
    <div id="cartDrawer" class="og-cart-drawer">
        <div class="og-cart-drawer-header">
            <div class="og-cart-drawer-title">Mon Panier OG</div>
            <button class="og-cart-close-btn" onclick="toggleCart()"><i data-lucide="x"></i></button>
        </div>
        <div class="og-cart-items-list" id="cartItemsContainer">
            <div style="color:var(--text-muted);font-size:.85rem;text-align:center;margin-top:40px;">Ton panier est vide pour l'instant.</div>
        </div>
        <div class="og-cart-drawer-footer">
            <div style="display:flex;justify-content:space-between;margin-bottom:14px;font-family:var(--font-mono);font-size:.9rem;">
                <span style="color:var(--text-muted);">Dernier article :</span>
                <span id="cartTotalPrice" style="color:var(--gold-og);font-weight:700;">—</span>
            </div>
            <button class="og-checkout-btn" onclick="alert('Redirection sécurisée vers la passerelle de paiement Samii OS...')">Passer la commande</button>
        </div>
    </div>

    <script src="https://unpkg.com/lucide@latest"></script>
    <script>${CLIENT_SCRIPT}</script>
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
        .og-form-container { width: 100%; max-width: 720px; margin: auto; background: var(--bg-panel); border: 1px solid rgba(212,175,55,0.3); border-radius: 22px; padding: 36px; backdrop-filter: blur(20px); box-sizing: border-box; }
        .og-form-title { font-family: var(--font-display); color: var(--text-main); font-size: 1.6rem; margin-bottom: 22px; display: flex; align-items: center; gap: 12px; }
        .og-form-title i { color: var(--gold-og); width: 26px; height: 26px; }
        .og-form-group { margin-bottom: 20px; display: flex; flex-direction: column; gap: 8px; }
        .og-form-group label { font-size: .8rem; font-weight: 600; color: var(--text-muted); font-family: var(--font-mono); }
        .og-form-control { background: rgba(0,0,0,0.3); border: 1px solid var(--border-soft); border-radius: 12px; padding: 13px 15px; color: var(--text-main); font-size: .9rem; font-family: var(--font-body); outline: none; }
        [data-theme="light"] .og-form-control { background: rgba(255,255,255,0.6); }
        .og-form-control:focus { border-color: var(--gold-og); box-shadow: var(--gold-glow); }
        select.og-form-control { cursor: pointer; }
        select.og-form-control option { background: var(--bg-deep); color: var(--text-main); }
        .og-submit-btn { width: 100%; background: linear-gradient(135deg, var(--gold-og), var(--gold-hover)); color: #030307; border: none; border-radius: 12px; padding: 15px; font-weight: 800; font-size: 1rem; font-family: var(--font-display); cursor: pointer; margin-top: 12px; }
        .og-back { display: inline-flex; align-items: center; gap: 8px; color: var(--text-muted); text-decoration: none; font-size: .86rem; margin-bottom: 22px; }
        .og-back:hover { color: var(--gold-og); }
        .og-back i { width: 16px; height: 16px; }
    </style>
</head>
<body>
    <div class="og-bg-fx"><div class="og-bg-grid"></div></div>
    <div class="og-form-container">
        <a href="/marketplace" class="og-back"><i data-lucide="arrow-left"></i> Retour à la Marketplace</a>
        <h1 class="og-form-title"><i data-lucide="plus-circle"></i> Publier une annonce internationale</h1>
        <form action="/marketplace/publier" method="POST">
            <div class="og-form-group">
                <label>Titre de l'annonce</label>
                <input type="text" name="titre" class="og-form-control" required placeholder="Ex: Rolex Submariner / Nounou / Livreur 24h">
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
                <input type="text" name="prix" class="og-form-control" required placeholder="Ex: 12 500 € ou 3 490 $ ou 950 £">
            </div>
            <div class="og-form-group">
                <label>Pays / Zone</label>
                <input type="text" name="pays" class="og-form-control" required placeholder="Ex: Royaume-Uni, France, Suisse...">
            </div>
            <div class="og-form-group">
                <label>Ville</label>
                <input type="text" name="ville" class="og-form-control" placeholder="Ex: Londres, Paris, Genève...">
            </div>
            <div class="og-form-group">
                <label>Lien Photo (URL directe)</label>
                <input type="url" name="photo_url" class="og-form-control" placeholder="https://images.unsplash.com/...">
            </div>
            <button type="submit" class="og-submit-btn">Mettre en ligne immédiatement</button>
        </form>
    </div>
    <script src="https://unpkg.com/lucide@latest"></script>
    <script>
        if (typeof lucide !== "undefined") lucide.createIcons();
        const saved = localStorage.getItem('og-theme') || 'dark';
        document.documentElement.setAttribute('data-theme', saved);
    </script>
</body>
</html>`);
});

// --- 3. TRAITEMENT POST PUBLICATION ---
router.post("/publier", requireAuth, async (req, res) => {
    try {
        const { titre, categorie, prix, pays, ville, photo_url } = req.body;
        await airtable.create("ANNONCES", {
            titre, categorie, prix,
            pays: pays || 'International',
            ville: ville || '',
            photo_url: photo_url || '',
            vendeur_id: 'marchand_verified_' + Date.now(),
            vendeur_nom: 'Boutique Partenaire Vérifiée',
            type_vendeur: 'marchand',
            actif: 1,
        });
        res.redirect("/marketplace");
    } catch (err) {
        console.error("Erreur publication annonce Marketplace OG :", err);
        res.redirect("/marketplace/publier?erreur=1");
    }
});

module.exports = router;
