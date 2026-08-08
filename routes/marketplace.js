// ==========================================================================
// SAMII OS — MARKETPLACE — PostgreSQL — Upload photo réel (Cloudinary)
// ==========================================================================
const express = require("express");
const router = express.Router();
const db = require("../services/db");
const {
    MARKETPLACE_NAME,
    CATEGORIES,
    SUPPLIER_REGIONS,
    categoryLabel,
    supplierRegionLabel
} = require("../config/marketplace-catalog");

const CLOUDINARY_CLOUD_NAME = "ojwx5hft";
const CLOUDINARY_UPLOAD_PRESET = "MARKETPLACE OG";

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

const CATEGORY_OPTIONS_HTML = [
    { id: "tous", label: "Toutes nos catégories" },
    ...CATEGORIES
].map(category => `
    <option value="${escapeHtml(category.id)}">
        ${escapeHtml(category.label)}
    </option>
`).join("");

const REGION_CHIPS_HTML = SUPPLIER_REGIONS.map(region => `
    <a
        href="/marketplace?region=${encodeURIComponent(region.id)}"
        class="region-chip"
        data-region="${escapeHtml(region.id)}"
    >
        <i data-lucide="${escapeHtml(region.icon)}"></i>
        ${escapeHtml(region.label)}
    </a>
`).join("");

const ANNONCES_VIRTUELLES = [
    { id: "v_1", titre: "Rolex Submariner Date — Édition Collector Or & Noir", categorie: "luxe", region_fournisseur: "europe", prix: "8 500 €", pays: "Suisse", ville: "Genève", photo_url: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1000&q=85", photos_urls: null, vendeur_id: "ai_agent_samii", vendeur_nom: "Samii Core", type_vendeur: "ia_marchand", actif: true },
    { id: "v_2", titre: "MacBook Pro M3 Max — 64Go RAM / 2To SSD", categorie: "electronique", region_fournisseur: "europe", prix: "3 490 $", pays: "États-Unis", ville: "New York", photo_url: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1000&q=85", photos_urls: null, vendeur_id: "ai_agent_vaulta", vendeur_nom: "Vaulta Automation", type_vendeur: "ia_marchand", actif: true },
];

function escapeHtml(v) {
    return String(v ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
function getCategoryLabel(id) { return CATEGORIES_AMAZON.find(c => c.id === id)?.label || id || "Autre"; }
function getRegionLabel(id) { return REGIONS_FOURNISSEURS.find(r => r.id === id)?.label || ""; }
function parsePhotos(photo_url, photos_urls) {
    let list = [];
    if (photos_urls) {
        try {
            const p = typeof photos_urls === "string" ? JSON.parse(photos_urls) : photos_urls;
            if (Array.isArray(p)) list = p.filter(Boolean);
        } catch { /* ignore */ }
    }
    if (!list.length && photo_url) list = [photo_url];
    return list;
}

router.get("/", requireAuth, async (req, res) => {
    const { categorie, recherche, pays, ville, region } = req.query;
    let annoncesDB = [];

    try {
        let clauses = ["actif = true"]; let params = []; let i = 1;
        if (categorie && categorie !== "tous") { clauses.push(`categorie = $${i++}`); params.push(categorie); }
        if (recherche) { clauses.push(`LOWER(titre) LIKE LOWER($${i++})`); params.push(`%${recherche}%`); }
        if (pays) { clauses.push(`LOWER(pays) LIKE LOWER($${i++})`); params.push(`%${pays}%`); }
        if (ville) { clauses.push(`LOWER(ville) LIKE LOWER($${i++})`); params.push(`%${ville}%`); }
        if (region) { clauses.push(`region_fournisseur = $${i++}`); params.push(region); }

        const rows = await db.query(`SELECT * FROM annonces WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC LIMIT 50`, params);
        annoncesDB = rows;
    } catch (err) { console.warn("⚠️ Marketplace lecture :", err.message); }

    let toutesAnnonces = [...ANNONCES_VIRTUELLES, ...annoncesDB];
    if (categorie && categorie !== "tous") toutesAnnonces = toutesAnnonces.filter(a => a.categorie === categorie);
    if (region) toutesAnnonces = toutesAnnonces.filter(a => a.region_fournisseur === region);
    if (recherche) { const q = recherche.toLowerCase(); toutesAnnonces = toutesAnnonces.filter(a => String(a.titre||"").toLowerCase().includes(q)); }

    let mesFavorisIds = [];
    try {
        if (req.session.userId) {
            const favRows = await db.query(`SELECT annonce_id FROM favoris WHERE user_id = $1`, [req.session.userId]);
            mesFavorisIds = favRows.map(r => String(r.annonce_id));
        }
    } catch (err) { console.warn("⚠️ favoris :", err.message); }

    let notesParVendeur = {};
    try {
        const noteRows = await db.query(`SELECT cible_id, ROUND(AVG(note)::numeric,1) AS moyenne, COUNT(*) AS total FROM avis WHERE cible_type='vendeur' GROUP BY cible_id`);
        noteRows.forEach(r => { notesParVendeur[r.cible_id] = { moyenne: parseFloat(r.moyenne), total: parseInt(r.total,10) }; });
    } catch (err) { console.warn("⚠️ avis :", err.message); }

    const categoryOptionsHtml = CATEGORIES_AMAZON.map(c => `<option value="${escapeHtml(c.id)}" ${categorie===c.id?"selected":""}>${escapeHtml(c.label)}</option>`).join("");
    const regionChipsHtml = REGIONS_FOURNISSEURS.map(r => `<a href="/marketplace?region=${r.id}" class="region-chip ${region===r.id?"active":""}"><i data-lucide="${r.icon}"></i> ${r.label}</a>`).join("");

    const cardsHtml = toutesAnnonces.map((a, index) => {
        const id = a.id || `product_${index}`;
        const titre = escapeHtml(a.titre || "Produit SAMII");
        const cat = escapeHtml(getCategoryLabel(a.categorie));
        const prix = escapeHtml(a.prix || "Sur devis");
        const paysP = escapeHtml(a.pays || "International");
        const villeP = escapeHtml(a.ville || "");
        const vendeur = escapeHtml(a.vendeur_nom || "Marchand SAMII");
        const vendeurId = encodeURIComponent(a.vendeur_id || "marchand_verified_1");
        const isAI = a.type_vendeur === "ia_marchand";
        const isReal = typeof id === "number" || /^\d+$/.test(String(id));
        const isFav = mesFavorisIds.includes(String(id));
        const photos = parsePhotos(a.photo_url, a.photos_urls);
        const notes = notesParVendeur[a.vendeur_id] || null;
        const linkTo = isReal ? `/marketplace/produit/${id}` : `/vitrine/${vendeurId}`;
        const aiBadge = isAI ? `<span class="product-ai"><span class="ai-dot"></span>MARCHAND IA</span>` : "";
        const dotsHtml = photos.length > 1 ? `<div class="photo-dots">${photos.map((p,pi)=>`<span class="photo-dot ${pi===0?"active":""}" data-photo="${escapeHtml(p)}"></span>`).join("")}</div>` : "";
        const noteHtml = notes ? `<span class="seller-rating"><i data-lucide="star"></i> ${notes.moyenne} <small>(${notes.total})</small></span>` : "";

        return `
        <article class="product-card ${isAI?"is-ai":""}" data-product-id="${escapeHtml(String(id))}" data-real="${isReal}">
            <div class="product-media">
                <a href="${linkTo}" class="product-image-link">
                    ${photos.length ? `<img src="${escapeHtml(photos[0])}" alt="${titre}" loading="lazy" class="product-main-img">` : `<div class="product-placeholder"><i data-lucide="image"></i></div>`}
                </a>
                <div class="product-top"><span class="product-category">${cat}</span>${aiBadge}</div>
                <button class="favorite-btn ${isFav?"saved":""}" type="button" onclick='toggleFavorite(${JSON.stringify(String(id))}, ${isReal}, this)'><i data-lucide="heart"></i></button>
                ${dotsHtml}
                <div class="product-quick"><button type="button" onclick='quickAdd(${JSON.stringify({id:String(id),titre:a.titre||"",prix:a.prix||"Sur devis",photo:photos[0]||""})})'><i data-lucide="shopping-cart"></i> Ajouter</button></div>
            </div>
            <div class="product-body">
                <div class="product-location"><i data-lucide="map-pin"></i> ${paysP}${villeP?` · ${villeP}`:""}</div>
                <a href="${linkTo}" class="product-title">${titre}</a>
                <div class="seller-row">
                    <div class="seller-avatar">${isAI?"AI":"OG"}</div>
                    <div class="seller-info"><strong>${vendeur}</strong><span>${isAI?"Intelligence commerciale":"Marchand vérifié"}</span></div>
                    ${noteHtml}
                </div>
                <div class="product-bottom">
                    <div class="product-price">${prix}</div>
                    <button class="save-btn ${isFav?"saved":""}" type="button" onclick='toggleFavorite(${JSON.stringify(String(id))}, ${isReal}, this)'><i data-lucide="bookmark"></i></button>
                </div>
            </div>
        </article>`;
    }).join("");

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>Marketplace — SAMII OS</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
<script src="https://unpkg.com/lucide@latest"></script>
<style>
:root{--bg:#03060b;--panel:rgba(9,18,29,.88);--text:#f5fbff;--muted:#7f96a8;--blue:#00d9ff;--blue-2:#0077ff;--cyan-glow:0 0 15px rgba(0,217,255,.45);--gold:#d7b34c;--border:rgba(0,217,255,.16);--danger:#ff5470;--radius:18px;--ease:cubic-bezier(.16,1,.3,1);}
body.light{--bg:#eef5fa;--panel:rgba(255,255,255,.88);--text:#08121c;--muted:#607384;--border:rgba(0,119,255,.16);}
*{box-sizing:border-box;} body{margin:0;min-height:100vh;background:radial-gradient(circle at 10% 10%,rgba(0,217,255,.09),transparent 30%),radial-gradient(circle at 90% 90%,rgba(0,119,255,.12),transparent 32%),var(--bg);color:var(--text);font-family:Inter,sans-serif;overflow-x:hidden;}
button,input,select{font:inherit;cursor:pointer;} a{color:inherit;text-decoration:none;}
.sidebar{position:fixed;left:0;top:0;width:245px;height:100vh;padding:22px 16px;background:linear-gradient(180deg,rgba(4,10,17,.97),rgba(3,7,12,.94));border-right:1px solid var(--border);z-index:300;display:flex;flex-direction:column;}
body.light .sidebar{background:rgba(247,251,254,.95);}
.brand{display:flex;align-items:center;gap:10px;padding:8px 10px 25px;font-weight:800;}
.brand-mark{width:37px;height:37px;display:grid;place-items:center;border-radius:11px;color:white;background:linear-gradient(135deg,var(--blue),var(--blue-2));font-weight:900;}
.brand-name span{color:var(--blue);}
.side-link{display:flex;align-items:center;gap:12px;padding:12px 13px;border-radius:12px;color:var(--muted);font-size:13px;font-weight:600;border:1px solid transparent;margin-bottom:6px;}
.side-link svg{width:18px;height:18px;}
.side-link:hover,.side-link.active{color:var(--text);background:linear-gradient(90deg,rgba(0,217,255,.12),rgba(0,119,255,.04));border-color:rgba(0,217,255,.22);}
.side-link.active svg{color:var(--blue);}
.side-bottom{margin-top:auto;padding:14px;border:1px solid var(--border);border-radius:16px;background:linear-gradient(135deg,rgba(0,217,255,.08),rgba(0,119,255,.03));}
.side-ai{display:flex;align-items:center;gap:8px;font-size:11px;font-family:"JetBrains Mono";color:var(--blue);margin-bottom:6px;}
.side-ai-dot{width:7px;height:7px;background:#00ff9d;border-radius:50%;}
.side-text{color:var(--muted);font-size:11px;line-height:1.5;}
.main{margin-left:245px;min-height:100vh;width:calc(100% - 245px);}
.header{position:sticky;top:0;z-index:200;backdrop-filter:blur(24px);background:rgba(3,7,12,.82);border-bottom:1px solid var(--border);}
.header-top{min-height:70px;padding:10px 28px;display:flex;align-items:center;gap:15px;}
.mobile-brand{display:none;}
.search{flex:1;display:flex;max-width:720px;margin:auto;border:1px solid rgba(0,217,255,.25);border-radius:13px;overflow:hidden;background:rgba(0,0,0,.25);}
.search select{width:165px;padding:0 12px;background:transparent;border:none;border-right:1px solid var(--border);color:var(--text);font-size:12px;}
.search select option{background:#07101a;}
.search input{flex:1;border:none;outline:none;background:transparent;color:var(--text);padding:13px 14px;font-size:13px;}
.search button{width:50px;border:none;background:linear-gradient(135deg,var(--blue),var(--blue-2));color:white;}
.header-actions{display:flex;align-items:center;gap:8px;}
.icon-btn{width:40px;height:40px;display:grid;place-items:center;border:1px solid var(--border);border-radius:11px;color:var(--muted);position:relative;}
.icon-btn:hover{color:var(--blue);border-color:var(--blue);}
.icon-btn .badge-count{position:absolute;top:-5px;right:-5px;background:var(--danger);color:white;font-size:9px;font-weight:800;width:16px;height:16px;border-radius:50%;display:flex;align-items:center;justify-content:center;}
.publish-btn{display:inline-flex;align-items:center;gap:7px;padding:10px 14px;border-radius:11px;color:#001018;background:linear-gradient(135deg,var(--blue),#00a9ff);font-size:12px;font-weight:800;}
.subnav{display:flex;align-items:center;gap:8px;padding:8px 28px;overflow-x:auto;}
.subnav a{padding:7px 11px;border-radius:9px;color:var(--muted);font-size:11px;font-weight:600;border:1px solid transparent;white-space:nowrap;}
.subnav a:hover,.subnav a.active{color:var(--blue);border-color:rgba(0,217,255,.18);background:rgba(0,217,255,.06);}
.region-row{display:flex;gap:8px;padding:10px 28px;overflow-x:auto;background:rgba(0,0,0,.15);}
.region-chip{display:flex;align-items:center;gap:6px;padding:7px 13px;border-radius:20px;color:var(--muted);font-size:11px;font-weight:600;border:1px solid var(--border);white-space:nowrap;}
.region-chip svg{width:13px;height:13px;}
.region-chip:hover,.region-chip.active{color:#001018;background:var(--blue);border-color:var(--blue);}
.content{padding:30px;}
.hero{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:25px;flex-wrap:wrap;}
.hero-kicker{display:flex;align-items:center;gap:7px;font-family:"JetBrains Mono";color:var(--blue);font-size:10px;letter-spacing:1.4px;text-transform:uppercase;margin-bottom:8px;}
.live-dot{width:7px;height:7px;border-radius:50%;background:#00ff9d;}
.hero h1{margin:0;font-size:clamp(25px,3vw,40px);}
.hero h1 span{color:var(--blue);}
.hero p{margin:10px 0 0;color:var(--muted);font-size:12px;}
.hero-actions{display:flex;gap:8px;}
.filter-btn{display:flex;align-items:center;gap:7px;border:1px solid var(--border);color:var(--text);background:var(--panel);border-radius:11px;padding:10px 13px;font-size:11px;font-weight:700;}
.products-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:17px;}
.product-card{position:relative;overflow:hidden;border:1px solid var(--border);border-radius:var(--radius);background:var(--panel);}
.product-card:hover{border-color:rgba(0,217,255,.42);}
.product-card.is-ai{border-color:rgba(165,93,255,.28);}
.product-media{position:relative;aspect-ratio:1/1;background:linear-gradient(135deg,#07121d,#020509);overflow:hidden;}
.product-media img{width:100%;height:100%;object-fit:cover;display:block;}
.product-placeholder{height:100%;display:grid;place-items:center;color:var(--blue);}
.product-placeholder svg{width:45px;height:45px;opacity:.35;}
.product-top{position:absolute;top:10px;left:10px;right:10px;display:flex;justify-content:space-between;gap:6px;pointer-events:none;}
.product-category,.product-ai{padding:5px 8px;border-radius:999px;font-family:"JetBrains Mono";font-size:8px;font-weight:700;white-space:nowrap;}
.product-category{color:white;background:rgba(3,8,14,.76);border:1px solid rgba(255,255,255,.1);}
.product-ai{color:white;background:rgba(130,45,210,.8);border:1px solid rgba(205,145,255,.4);}
.ai-dot{width:5px;height:5px;display:inline-block;margin-right:4px;border-radius:50%;background:#d7a7ff;}
.favorite-btn{position:absolute;right:10px;bottom:10px;width:36px;height:36px;border-radius:50%;display:grid;place-items:center;color:white;background:rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.16);z-index:3;}
.favorite-btn.saved{color:#ff5470;background:rgba(255,84,112,.12);border-color:rgba(255,84,112,.45);}
.photo-dots{position:absolute;bottom:10px;left:10px;display:flex;gap:5px;z-index:3;}
.photo-dot{width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,.4);}
.photo-dot.active{background:var(--blue);}
.product-quick{position:absolute;left:10px;right:10px;bottom:10px;opacity:0;transition:.3s;}
.product-card:hover .product-quick{opacity:1;}
.product-quick button{width:calc(100% - 48px);margin-right:44px;padding:9px;display:flex;justify-content:center;align-items:center;gap:6px;border:1px solid rgba(0,217,255,.4);border-radius:10px;color:white;background:rgba(2,10,18,.82);font-size:10px;font-weight:800;}
.product-body{padding:13px;}
.product-location{display:flex;align-items:center;gap:4px;color:var(--muted);font-size:9px;margin-bottom:8px;}
.product-location svg{width:11px;height:11px;color:var(--blue);}
.product-title{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:34px;font-size:12px;font-weight:700;line-height:1.45;}
.seller-row{display:flex;align-items:center;gap:7px;margin-top:12px;padding-top:10px;border-top:1px solid rgba(255,255,255,.055);}
.seller-avatar{width:25px;height:25px;flex:0 0 25px;display:grid;place-items:center;border-radius:8px;color:white;font-size:8px;font-weight:900;background:linear-gradient(135deg,var(--blue),var(--blue-2));}
.seller-info{display:flex;flex-direction:column;min-width:0;flex:1;}
.seller-info strong{font-size:9px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.seller-info span{color:var(--muted);font-size:8px;}
.seller-rating{display:flex;align-items:center;gap:3px;font-size:9px;font-weight:700;color:var(--gold);}
.seller-rating svg{width:11px;height:11px;fill:var(--gold);}
.seller-rating small{color:var(--muted);font-weight:500;}
.product-bottom{display:flex;align-items:center;justify-content:space-between;margin-top:11px;}
.product-price{font-family:"JetBrains Mono";color:var(--blue);font-size:14px;font-weight:800;}
.save-btn{width:31px;height:31px;display:grid;place-items:center;border:1px solid var(--border);border-radius:9px;color:var(--muted);background:transparent;}
.save-btn.saved{color:#ff5470;border-color:rgba(255,84,112,.45);}
.empty{grid-column:1/-1;padding:90px 20px;text-align:center;border:1px dashed var(--border);border-radius:20px;color:var(--muted);}
.empty svg{width:45px;height:45px;color:var(--blue);margin-bottom:15px;}
.overlay{position:fixed;inset:0;z-index:500;background:rgba(0,0,0,.62);opacity:0;pointer-events:none;transition:.3s;}
.overlay.open{opacity:1;pointer-events:auto;}
.cart{position:fixed;top:0;right:0;width:min(430px,100vw);height:100vh;z-index:501;background:#06101a;border-left:1px solid var(--border);transform:translateX(100%);transition:transform .45s var(--ease);display:flex;flex-direction:column;}
.cart.open{transform:translateX(0);}
.cart-head{padding:20px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);}
.cart-title span{color:var(--blue);}
.cart-items{flex:1;overflow-y:auto;padding:16px;}
.cart-empty{text-align:center;padding:70px 20px;color:var(--muted);}
.cart-item{display:flex;gap:10px;padding:10px;margin-bottom:8px;border:1px solid var(--border);border-radius:13px;background:rgba(255,255,255,.025);}
.cart-item img{width:60px;height:60px;object-fit:cover;border-radius:9px;}
.cart-item-info{flex:1;}
.cart-item-title{font-size:11px;font-weight:700;}
.cart-item-price{margin-top:6px;color:var(--blue);font-family:"JetBrains Mono";font-size:10px;}
.cart-remove{border:none;background:transparent;color:var(--danger);align-self:flex-start;}
.cart-foot{padding:18px;border-top:1px solid var(--border);}
.cart-total{display:flex;justify-content:space-between;margin-bottom:13px;font-size:12px;}
.cart-total strong{color:var(--blue);}
.checkout{width:100%;border:none;border-radius:12px;padding:14px;color:#001018;background:linear-gradient(135deg,var(--blue),#008cff);font-weight:900;}
.toast{position:fixed;bottom:26px;left:50%;transform:translateX(-50%) translateY(20px);background:#0c1a28;border:1px solid var(--blue);color:var(--text);padding:12px 22px;border-radius:12px;font-size:12px;z-index:900;opacity:0;transition:.3s;pointer-events:none;}
.toast.show{opacity:1;transform:translateX(-50%) translateY(0);}
.mobile-nav{display:none;}
@media (max-width:1200px){.products-grid{grid-template-columns:repeat(3,minmax(0,1fr));}}
@media (max-width:900px){
.sidebar{display:none;} .main{margin-left:0;width:100%;}
.mobile-brand{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:900;}
.mobile-brand .brand-mark{width:31px;height:31px;font-size:10px;}
.header-top{padding:9px 12px;gap:8px;flex-wrap:wrap;} .search{order:3;flex-basis:100%;max-width:none;} .search select{width:105px;}
.header-actions{margin-left:auto;} .publish-btn span{display:none;}
.subnav,.region-row{padding-left:12px;padding-right:12px;} .content{padding:18px 12px 90px;}
.hero{flex-direction:column;align-items:flex-start;} .hero h1{font-size:27px;} .hero-actions{width:100%;} .filter-btn{flex:1;justify-content:center;}
.products-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;} .product-quick{display:none;} .seller-info span{display:none;}
.mobile-nav{position:fixed;left:8px;right:8px;bottom:8px;height:62px;z-index:400;display:grid;grid-template-columns:repeat(4,1fr);padding:5px;border:1px solid rgba(0,217,255,.22);border-radius:17px;background:rgba(4,10,17,.92);backdrop-filter:blur(25px);}
.mobile-nav a{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;color:var(--muted);font-size:8px;font-weight:700;border-radius:12px;}
.mobile-nav a svg{width:18px;height:18px;} .mobile-nav a.active{color:var(--blue);background:rgba(0,217,255,.08);}
}
@media (min-width:1400px){.products-grid{grid-template-columns:repeat(4,minmax(0,1fr));}}
</style>
</head>
<body>
<aside class="sidebar">
<div><div class="brand"><div class="brand-mark">OG</div><div class="brand-name">SAMII <span>TECHNOLOGY</span></div></div>
<nav>
<a href="/qg" class="side-link"><i data-lucide="layout-dashboard"></i> QG Central</a>
<a href="/marketplace" class="side-link active"><i data-lucide="store"></i> Marketplace</a>
<a href="/community" class="side-link"><i data-lucide="users"></i> Communauté</a>
<a href="/marketplace/services-demandes" class="side-link"><i data-lucide="concierge-bell"></i> Demandes de service</a>
<a href="/arsenal" class="side-link"><i data-lucide="shield-check"></i> Arsenal</a>
<a href="/academy" class="side-link"><i data-lucide="graduation-cap"></i> Academy</a>
</nav></div>
<div class="side-bottom"><div class="side-ai"><span class="side-ai-dot"></span> SAMII ENGINE ACTIVE</div><div class="side-text">Marketplace synchronisée avec l'écosystème SAMII.</div></div>
</aside>
<div class="main">
<header class="header">
<div class="header-top">
<div class="mobile-brand"><div class="brand-mark">OG</div> SAMII</div>
<form class="search" method="GET" action="/marketplace">
<select name="categorie">${categoryOptionsHtml}</select>
<div style="flex:1;display:flex;"><input type="search" name="recherche" placeholder="Rechercher..." value="${escapeHtml(recherche||"")}"></div>
<button type="submit"><i data-lucide="search"></i></button>
</form>
<div class="header-actions">
<button class="icon-btn" id="themeBtn" type="button"><i data-lucide="moon"></i></button>
<a class="icon-btn" href="/marketplace/favoris"><i data-lucide="heart"></i></a>
<button class="icon-btn" type="button" onclick="toggleCart()"><i data-lucide="shopping-cart"></i><span class="badge-count" id="cartBadge" style="display:none;">0</span></button>
<a href="/marketplace/publier" class="publish-btn"><i data-lucide="plus"></i><span>Publier</span></a>
</div></div>
<nav class="subnav">
<a href="/marketplace" class="${!categorie||categorie==="tous"?"active":""}">Tout</a>
<a href="/marketplace?categorie=electronique">Technologie</a>
<a href="/marketplace?categorie=mode">Mode</a>
<a href="/marketplace?categorie=luxe">Luxe</a>
<a href="/marketplace?categorie=services">Services</a>
<a href="/marketplace?categorie=sport">Sport</a>
<a href="/marketplace?categorie=autre">Autres</a>
</nav>
<div class="region-row">
<a href="/marketplace" class="region-chip ${!region?"active":""}"><i data-lucide="globe"></i> Toutes régions</a>
${regionChipsHtml}
</div>
</header>
<main class="content">
<section class="hero">
<div><div class="hero-kicker"><span class="live-dot"></span> SAMII MARKETPLACE · LIVE</div><h1>Découvrez. <span>Achetez.</span> Connectez.</h1>
<p>${toutesAnnonces.length} annonce${toutesAnnonces.length!==1?"s":""} disponible${toutesAnnonces.length!==1?"s":""}${region?" — "+escapeHtml(getRegionLabel(region)):""}</p></div>
<div class="hero-actions"><a href="/marketplace/favoris" class="filter-btn"><i data-lucide="heart"></i> Mes favoris</a></div>
</section>
<section class="products-grid">${toutesAnnonces.length?cardsHtml:`<div class="empty"><i data-lucide="package-search"></i><h3>Aucun produit trouvé</h3></div>`}</section>
</main></div>
<div id="overlay" class="overlay" onclick="toggleCart()"></div>
<aside id="cart" class="cart">
<div class="cart-head"><div class="cart-title">Mon panier <span>SAMII</span></div><button class="icon-btn" onclick="toggleCart()"><i data-lucide="x"></i></button></div>
<div id="cartItems" class="cart-items"></div>
<div class="cart-foot"><div class="cart-total"><span>Total</span><strong id="cartTotal">0</strong></div><button class="checkout" onclick="checkout()">Commander</button></div>
</aside>
<div class="toast" id="toast"></div>
<nav class="mobile-nav">
<a href="/qg"><i data-lucide="layout-dashboard"></i> QG</a>
<a href="/marketplace" class="active"><i data-lucide="store"></i> Marché</a>
<a href="/community"><i data-lucide="users"></i> Communauté</a>
<a href="/arsenal"><i data-lucide="shield-check"></i> Arsenal</a>
</nav>
<script>
if (typeof lucide!=="undefined") lucide.createIcons();
const st=localStorage.getItem("samii_market_theme"); if(st==="light") document.body.classList.add("light");
function upIcon(){const b=document.getElementById("themeBtn");if(!b)return;b.innerHTML=document.body.classList.contains("light")?'<i data-lucide="sun"></i>':'<i data-lucide="moon"></i>';if(typeof lucide!=="undefined")lucide.createIcons();}
upIcon();
document.getElementById("themeBtn")?.addEventListener("click",()=>{document.body.classList.toggle("light");localStorage.setItem("samii_market_theme",document.body.classList.contains("light")?"light":"dark");upIcon();});
function showToast(m){const t=document.getElementById("toast");t.textContent=m;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2200);}
async function toggleFavorite(id,isReal,btn){
if(!isReal){showToast("Annonce de démonstration.");return;}
try{const res=await fetch("/marketplace/favoris/toggle",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({annonce_id:id})});
const j=await res.json();
if(j.success){document.querySelectorAll('[data-product-id="'+id+'"] .favorite-btn, [data-product-id="'+id+'"] .save-btn').forEach(el=>el.classList.toggle("saved",j.favorited));showToast(j.favorited?"❤️ Ajouté":"Retiré");}
}catch(e){showToast("Erreur réseau.");}}
document.querySelectorAll(".photo-dot").forEach(dot=>{dot.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();const card=dot.closest(".product-card");const img=card.querySelector(".product-main-img");if(img)img.src=dot.dataset.photo;card.querySelectorAll(".photo-dot").forEach(d=>d.classList.remove("active"));dot.classList.add("active");});});
let cart=JSON.parse(localStorage.getItem("samii_market_cart")||"[]");
function updBadge(){const b=document.getElementById("cartBadge");if(!b)return;if(cart.length>0){b.style.display="flex";b.textContent=cart.length;}else b.style.display="none";}
function toggleCart(){document.getElementById("cart").classList.toggle("open");document.getElementById("overlay").classList.toggle("open");renderCart();}
function quickAdd(p){const ex=cart.find(i=>String(i.id)===String(p.id));if(ex)ex.quantity=(ex.quantity||1)+1;else cart.push({...p,quantity:1});saveCart();showToast("🛒 Ajouté");updBadge();}
function removeFromCart(i){cart.splice(i,1);saveCart();renderCart();updBadge();}
function saveCart(){localStorage.setItem("samii_market_cart",JSON.stringify(cart));}
function renderCart(){const c=document.getElementById("cartItems");const t=document.getElementById("cartTotal");
if(!cart.length){c.innerHTML='<div class="cart-empty"><i data-lucide="shopping-bag"></i><p>Panier vide.</p></div>';t.textContent="0";if(typeof lucide!=="undefined")lucide.createIcons();return;}
let h="";cart.forEach((it,idx)=>{const img=it.photo?'<img src="'+it.photo+'" alt="">':'<div style="width:60px;height:60px;border-radius:9px;background:#07121d;"></div>';
h+='<div class="cart-item">'+img+'<div class="cart-item-info"><div class="cart-item-title">'+esc(it.titre)+'</div><div class="cart-item-price">'+esc(it.prix)+' · x'+(it.quantity||1)+'</div></div><button class="cart-remove" onclick="removeFromCart('+idx+')">×</button></div>';});
c.innerHTML=h;t.textContent=cart.length+" article"+(cart.length>1?"s":"");if(typeof lucide!=="undefined")lucide.createIcons();}
function esc(v){return String(v||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
function checkout(){if(!cart.length){showToast("Panier vide.");return;}showToast("🚀 Redirection vers la commande...");}
renderCart();updBadge();
</script>
</body></html>`);
});

router.post("/favoris/toggle", requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const annonceId = parseInt(req.body.annonce_id, 10);
        if (!userId || !annonceId) return res.json({ success: false, error: "Requête invalide." });
        const existing = await db.query(`SELECT id FROM favoris WHERE user_id=$1 AND annonce_id=$2`, [userId, annonceId]);
        if (existing.length > 0) { await db.query(`DELETE FROM favoris WHERE id=$1`, [existing[0].id]); return res.json({ success: true, favorited: false }); }
        await db.query(`INSERT INTO favoris (user_id, annonce_id) VALUES ($1,$2)`, [userId, annonceId]);
        res.json({ success: true, favorited: true });
    } catch (err) { console.error("❌ favoris/toggle :", err.message); res.json({ success: false, error: "Erreur serveur." }); }
});

router.get("/favoris", requireAuth, async (req, res) => {
    let annonces = [];
    try {
        annonces = await db.query(`SELECT a.* FROM annonces a INNER JOIN favoris f ON f.annonce_id=a.id WHERE f.user_id=$1 ORDER BY f.created_at DESC`, [req.session.userId]);
    } catch (err) { console.error("❌ favoris list :", err.message); }
    const html = annonces.length ? annonces.map(a => { const photos = parsePhotos(a.photo_url, a.photos_urls);
        return `<article class="product-card"><div class="product-media"><a href="/marketplace/produit/${a.id}" class="product-image-link">${photos.length?`<img src="${escapeHtml(photos[0])}" alt="">`:`<div class="product-placeholder"><i data-lucide="image"></i></div>`}</a></div><div class="product-body"><a href="/marketplace/produit/${a.id}" class="product-title">${escapeHtml(a.titre)}</a><div class="product-price">${escapeHtml(a.prix||"Sur devis")}</div></div></article>`;
    }).join("") : `<div class="empty"><i data-lucide="heart-off"></i><h3>Aucun favori</h3></div>`;
    res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Favoris</title>
    <script src="https://unpkg.com/lucide@latest"></script>
    <style>body{background:#03060b;color:#f5fbff;font-family:Inter,sans-serif;padding:24px;}a{color:#00d9ff;}.products-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px;max-width:1200px;margin:20px auto;}.product-card{border:1px solid rgba(0,217,255,.16);border-radius:16px;overflow:hidden;background:rgba(9,18,29,.88);}.product-media img{width:100%;aspect-ratio:1/1;object-fit:cover;}.product-body{padding:12px;}.product-title{display:block;color:#f5fbff;text-decoration:none;font-size:12px;margin-bottom:6px;}.product-price{color:#00d9ff;font-weight:800;}.empty{text-align:center;padding:60px;color:#7f96a8;}</style></head>
    <body><a href="/marketplace">← Retour</a><h1>❤️ Mes favoris</h1><div class="products-grid">${html}</div></body></html>`);
});

router.post("/avis", requireAuth, async (req, res) => {
    try {
        const { vendeur_id, note, commentaire } = req.body;
        const n = parseInt(note, 10);
        if (!vendeur_id || !n || n < 1 || n > 5) return res.json({ success: false, error: "Note invalide." });
        await db.query(`INSERT INTO avis (cible_type, cible_id, auteur_id, note, commentaire) VALUES ('vendeur',$1,$2,$3,$4)`, [vendeur_id, req.session.userId, n, commentaire || ""]);
        res.json({ success: true });
    } catch (err) { console.error("❌ avis :", err.message); res.json({ success: false, error: "Erreur serveur." }); }
});

router.get("/produit/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.redirect("/marketplace");
    let produit = null, avisListe = [], notes = { moyenne: 0, total: 0 };
    try {
        const rows = await db.query(`SELECT * FROM annonces WHERE id=$1 AND actif=true`, [id]);
        produit = rows[0];
        if (!produit) return res.redirect("/marketplace");
        avisListe = await db.query(`SELECT a.*, u.prenom, u.nom FROM avis a LEFT JOIN utilisateurs u ON u.id=a.auteur_id WHERE a.cible_type='vendeur' AND a.cible_id=$1 ORDER BY a.created_at DESC LIMIT 20`, [produit.vendeur_id]);
        if (avisListe.length) { const total = avisListe.reduce((s, a) => s + a.note, 0); notes = { moyenne: (total / avisListe.length).toFixed(1), total: avisListe.length }; }
    } catch (err) { console.error("❌ produit :", err.message); return res.redirect("/marketplace"); }

    const photos = parsePhotos(produit.photo_url, produit.photos_urls);
    const avisHtml = avisListe.length ? avisListe.map(a => `<div style="border:1px solid rgba(0,217,255,.16);border-radius:12px;padding:14px;margin-bottom:8px;background:rgba(9,18,29,.88);"><strong>${escapeHtml((a.prenom||"Client")+" "+(a.nom?a.nom[0]+".":""))}</strong> — ${"★".repeat(a.note)}${"☆".repeat(5-a.note)}${a.commentaire?`<p style="color:#7f96a8;margin:6px 0 0;">${escapeHtml(a.commentaire)}</p>`:""}</div>`).join("") : `<p style="color:#7f96a8;">Aucun avis pour l'instant.</p>`;

    res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(produit.titre)}</title>
    <script src="https://unpkg.com/lucide@latest"></script>
    <style>body{background:#03060b;color:#f5fbff;font-family:Inter,sans-serif;margin:0;padding:24px;}a{color:#00d9ff;}img{max-width:100%;border-radius:16px;}.price{font-size:28px;color:#00d9ff;font-weight:800;margin:14px 0;}button{padding:12px 20px;border:none;border-radius:12px;background:#00d9ff;color:#001018;font-weight:800;cursor:pointer;margin-top:10px;}</style></head>
    <body><a href="/marketplace">← Retour</a>
    <div style="max-width:900px;margin:20px auto;">
    ${photos.length?`<img src="${escapeHtml(photos[0])}" alt="">`:""}
    <h1>${escapeHtml(produit.titre)}</h1>
    <div class="price">${escapeHtml(produit.prix||"Sur devis")}</div>
    <p style="color:#7f96a8;">${escapeHtml(produit.pays||"")}${produit.ville?" · "+escapeHtml(produit.ville):""}</p>
    ${produit.description?`<p style="color:#c5cdd5;line-height:1.7;">${escapeHtml(produit.description)}</p>`:""}
    <button onclick="fetch('/marketplace/favoris/toggle',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({annonce_id:${id}})}).then(()=>alert('Favori mis à jour'))">❤️ Favori</button>
    <h2 style="margin-top:30px;">Avis (${notes.total})</h2>
    ${avisHtml}
    </div></body></html>`);
});

router.get("/services-demandes", requireAuth, async (req, res) => {
    let demandes = [];
    try {
        demandes = await db.query(`SELECT p.*, u.prenom, u.nom FROM publications p LEFT JOIN utilisateurs u ON u.id=p.auteur_id WHERE p.categorie='service' ORDER BY p.created_at DESC LIMIT 30`);
    } catch (err) { console.error("❌ services-demandes :", err.message); }
    const listHtml = demandes.length ? demandes.map(d => `<div style="border:1px solid rgba(0,217,255,.16);border-radius:14px;padding:16px;margin-bottom:10px;background:rgba(9,18,29,.88);"><strong>${escapeHtml(d.prenom||"Membre")} ${escapeHtml(d.nom||"")}</strong><p style="color:#7f96a8;margin-top:8px;">${escapeHtml(d.contenu||"")}</p></div>`).join("") : `<p style="color:#7f96a8;">Aucune demande de service pour l'instant.</p>`;
    res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Services — SAMII</title>
    <style>body{background:#03060b;color:#f5fbff;font-family:Inter,sans-serif;padding:24px;max-width:800px;margin:0 auto;}a{color:#00d9ff;}</style></head>
    <body><a href="/marketplace">← Retour Marketplace</a><h1>🛎️ Demandes de service</h1><p style="color:#7f96a8;">Ces demandes proviennent de la Communauté SAMII.</p>${listHtml}</body></html>`);
});

router.get("/publier", requireAuth, async (req, res) => {
    const opts = CATEGORIES_AMAZON.filter(c => c.id !== "tous").map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.label)}</option>`).join("");
    const optsReg = REGIONS_FOURNISSEURS.map(r => `<option value="${escapeHtml(r.id)}">${escapeHtml(r.label)}</option>`).join("");
    res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Publier — SAMII</title>
    <script src="https://unpkg.com/lucide@latest"></script>
    <style>
    :root{--blue:#00d9ff;--bg:#03070d;--panel:#091522;--text:#f5fbff;--muted:#8196a7;--border:rgba(0,217,255,.16);}
    *{box-sizing:border-box;} body{margin:0;min-height:100vh;display:flex;justify-content:center;padding:25px;background:var(--bg);color:var(--text);font-family:Inter,sans-serif;}
    .form-box{width:100%;max-width:640px;padding:28px;border:1px solid var(--border);border-radius:22px;background:var(--panel);}
    a.back{color:var(--muted);text-decoration:none;font-size:12px;}
    h1{margin:20px 0 8px;font-size:26px;} .group{margin-bottom:16px;}
    label{display:block;color:var(--muted);font-size:11px;font-weight:700;margin-bottom:6px;}
    input,select,textarea{width:100%;padding:12px;border-radius:10px;border:1px solid var(--border);background:rgba(0,0,0,.3);color:white;outline:none;font-family:inherit;}
    select option{background:#07101a;}
    .upload-zone{display:flex;gap:10px;flex-wrap:wrap;}
    .upload-slot{width:90px;height:90px;border-radius:12px;border:2px dashed var(--border);display:grid;place-items:center;color:var(--muted);cursor:pointer;position:relative;overflow:hidden;background:rgba(0,0,0,.2);}
    .upload-slot img{width:100%;height:100%;object-fit:cover;position:absolute;inset:0;}
    .upload-status{font-size:11px;color:var(--blue);margin-top:8px;}
    .submit{width:100%;margin-top:14px;padding:15px;border:none;border-radius:13px;color:#001018;background:linear-gradient(135deg,var(--blue),#0077ff);font-weight:900;cursor:pointer;}
    </style></head>
    <body><div class="form-box">
    <a href="/marketplace" class="back">← Retour à Marketplace</a>
    <h1>Publier sur <span style="color:#00d9ff">SAMII</span></h1>
    <form id="formPublier">
    <div class="group"><label>Titre</label><input type="text" name="titre" required></div>
    <div class="group"><label>Catégorie</label><select name="categorie" required><option value="">Sélectionner...</option>${opts}</select></div>
    <div class="group"><label>Région du fournisseur (optionnel)</label><select name="region_fournisseur"><option value="">Non précisé</option>${optsReg}</select></div>
    <div class="group"><label>Prix</label><input type="text" name="prix" required placeholder="Ex : 250 €"></div>
    <div class="group"><label>Pays</label><input type="text" name="pays" required></div>
    <div class="group"><label>Ville</label><input type="text" name="ville"></div>
    <div class="group"><label>Description</label><textarea name="description" rows="4"></textarea></div>
    <div class="group">
    <label>Photos (clique pour ajouter, upload réel)</label>
    <div class="upload-zone" id="uploadZone">
    <div class="upload-slot" data-slot="0"><i data-lucide="plus"></i></div>
    <div class="upload-slot" data-slot="1"><i data-lucide="plus"></i></div>
    <div class="upload-slot" data-slot="2"><i data-lucide="plus"></i></div>
    </div>
    <input type="file" id="fileInput" accept="image/*" style="display:none;">
    <div class="upload-status" id="uploadStatus"></div>
    <input type="hidden" name="photos_json" id="photosJson" value="[]">
    </div>
    <button class="submit" type="submit">🚀 Publier sur SAMII</button>
    </form>
    </div>
    <script>
    if(typeof lucide!=="undefined")lucide.createIcons();
    let uploadedPhotos=[];
    let activeSlot=null;
    document.querySelectorAll(".upload-slot").forEach(slot=>{
        slot.addEventListener("click",()=>{activeSlot=slot.dataset.slot;document.getElementById("fileInput").click();});
    });
    document.getElementById("fileInput").addEventListener("change",async function(){
        const file=this.files[0]; if(!file) return;
        const status=document.getElementById("uploadStatus");
        status.textContent="⏳ Envoi en cours...";
        try{
            const fd=new FormData(); fd.append("file",file); fd.append("upload_preset","MARKETPLACE OG");
            const res=await fetch("https://api.cloudinary.com/v1_1/ojwx5hft/image/upload",{method:"POST",body:fd});
            const json=await res.json();
            if(json.secure_url){
                uploadedPhotos[activeSlot]=json.secure_url;
                const slot=document.querySelector('.upload-slot[data-slot="'+activeSlot+'"]');
                slot.innerHTML='<img src="'+json.secure_url+'" alt="">';
                document.getElementById("photosJson").value=JSON.stringify(uploadedPhotos.filter(Boolean));
                status.textContent="✅ Photo ajoutée !";
                setTimeout(()=>status.textContent="",1500);
            } else { status.textContent="❌ Échec de l'envoi."; }
        }catch(e){ status.textContent="❌ Erreur réseau."; }
    });
    document.getElementById("formPublier").addEventListener("submit",async(e)=>{
        e.preventDefault();
        const data=Object.fromEntries(new FormData(e.target));
        const res=await fetch("/marketplace/publier",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
        if(res.redirected){ window.location.href=res.url; } else { window.location.href="/marketplace"; }
    });
    </script>
    </body></html>`);
});

router.post("/publier", requireAuth, async (req, res) => {
    try {
        const { titre, categorie, prix, pays, ville, description, region_fournisseur, photos_json } = req.body;
        if (!titre || !categorie || !prix || !pays) return res.redirect("/marketplace/publier?erreur=1");

        let photosArray = [];
        try { photosArray = JSON.parse(photos_json || "[]"); } catch { photosArray = []; }

        const photoUrl = photosArray[0] || "";
        const photosJsonDb = photosArray.length ? JSON.stringify(photosArray) : null;
        const nom = req.session.nom || "Marchand OG";
        const vendeurId = req.session.userId || ("marchand_" + Date.now());

        await db.query(
            `INSERT INTO annonces (titre, categorie, prix, pays, ville, description, photo_url, photos_urls, region_fournisseur, vendeur_id, vendeur_nom, type_vendeur, actif)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'marchand',true)`,
            [titre, categorie, prix, pays, ville || "", description || "", photoUrl, photosJsonDb, region_fournisseur || null, vendeurId, nom]
        );
        res.redirect("/marketplace");
    } catch (err) {
        console.error("❌ publication :", err.message);
        res.redirect("/marketplace/publier?erreur=1");
    }
});

module.exports = router;
