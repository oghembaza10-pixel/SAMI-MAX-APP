// ==========================================================================
// SAMII OS — MARKETPLACE OG — Version Définitive (Unsigned & Sans Clé Secrète)
// ==========================================================================
const express = require("express");
const router  = express.Router();
const airtable = require("../services/airtable");
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const cloudinary = require('cloudinary').v2;

// Configuration uniquement avec le cloud_name (aucun api_key ni api_secret requis pour l'unsigned)
cloudinary.config({
    cloud_name: "ojwx5hft"
});

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

const SHARED_STYLES = `
    :root {
        --bg-deep: #030305; --bg-panel: rgba(10, 10, 14, 0.88); --bg-panel-hover: rgba(16, 16, 22, 0.95);
        --gold-og: #d4af37; --gold-hover: #f3e5ab; --gold-glow: 0 0 30px rgba(212, 175, 55, 0.22);
        --cyan-tech: #00f0ff; --cyan-dim: rgba(0, 240, 255, 0.12); --cyan-glow: 0 0 25px rgba(0, 240, 255, 0.22);
        --border-gold: 1px solid rgba(212, 175, 55, 0.28); --border-cyan: 1px solid rgba(0, 240, 255, 0.32);
        --text-main: #f5f5f7; --text-muted: #8e8e93;
        --font-display: 'Cinzel', serif; --font-body: 'Inter', sans-serif; --font-mono: 'JetBrains Mono', monospace;
        --ease-premium: cubic-bezier(0.16, 1, 0.3, 1);
    }
    body { background-color: var(--bg-deep); color: var(--text-main); font-family: var(--font-body); margin: 0; padding: 0; overflow-x: hidden; display: flex; }
    
    .og-sidebar {
        width: 280px; height: 100vh; position: fixed; top: 0; left: 0; background: rgba(5, 5, 8, 0.95);
        border-right: 1px solid rgba(255,255,255,0.06); backdrop-filter: blur(20px); display: flex; flex-direction: column; z-index: 200;
        padding: 24px; box-sizing: border-box; justify-content: space-between;
    }
    .og-sidebar-brand { font-family: var(--font-display); font-size: 1.2rem; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 10px; margin-bottom: 30px; }
    .og-sidebar-brand i { color: var(--gold-og); }
    .og-sidebar-menu { display: flex; flex-direction: column; gap: 8px; flex: 1; }
    .og-sidebar-link {
        display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 12px;
        color: var(--text-muted); text-decoration: none; font-size: 0.9rem; font-weight: 500;
        transition: all 0.3s var(--ease-premium); border: 1px solid transparent;
    }
    .og-sidebar-link i { width: 18px; height: 18px; color: var(--text-muted); transition: color 0.3s; }
    .og-sidebar-link:hover, .og-sidebar-link.active {
        background: rgba(212, 175, 55, 0.08); border-color: rgba(212, 175, 55, 0.2); color: #fff;
    }
    .og-sidebar-link:hover i, .og-sidebar-link.active i { color: var(--gold-og); }
    
    .og-samii-sphere {
        background: linear-gradient(135deg, rgba(0, 240, 255, 0.1), rgba(10, 10, 14, 0.9));
        border: var(--border-cyan); border-radius: 16px; padding: 16px; margin-top: auto;
        box-shadow: var(--cyan-glow); position: relative; overflow: hidden;
    }
    .og-samii-title { font-family: var(--font-mono); font-size: 0.75rem; color: var(--cyan-tech); display: flex; align-items: center; gap: 6px; margin-bottom: 6px; font-weight: 700; }
    .og-samii-text { font-size: 0.8rem; color: var(--text-muted); line-height: 1.4; }

    .og-main-wrapper { margin-left: 280px; width: calc(100% - 280px); min-height: 100vh; display: flex; flex-direction: column; }
    .og-bg-fx { position: fixed; inset: 0; z-index: -1; pointer-events: none; overflow: hidden; }
    .og-bg-grid { position: absolute; inset: 0; background-image: linear-gradient(rgba(212, 175, 55, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 240, 255, 0.03) 1px, transparent 1px); background-size: 60px 60px; }
    .og-ambient-glow { position: absolute; width: 600px; height: 600px; border-radius: 50%; filter: blur(150px); opacity: .14; z-index: -1; }
    .og-ambient-glow.gold { background: var(--gold-og); left: 300px; top: -100px; }
    .og-ambient-glow.cyan { background: var(--cyan-tech); right: -150px; top: 25%; }

    @media (max-width: 1024px) {
        .og-sidebar { display: none; }
        .og-main-wrapper { margin-left: 0; width: 100%; }
    }
`;

// --- 1. ACCUEIL MARKETPLACE ---
router.get("/", requireAuth, async (req, res) => {
    const { categorie, recherche, pays, ville } = req.query;

    let filtres = ['{actif}=1'];
    if (categorie && categorie !== "tous") filtres.push(`{categorie}="${categorie}"`);
    if (recherche) filtres.push(`SEARCH(LOWER("${recherche}"), LOWER({titre}))`);
    if (pays) filtres.push(`SEARCH(LOWER("${pays}"), LOWER({pays}))`);
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
        const photos = [f.photo_url, f.photo_url_2, f.photo_url_3, f.photo_url_4, f.photo_url_5].filter(Boolean);
        const mainPhoto = photos.length ? photos[0] : '';
        return `
        <a href="/vitrine/${f.vendeur_id}" class="og-card">
            <div class="og-card__media">
                <span class="og-card__badge"><i data-lucide="${cat.icon}"></i> ${cat.label}</span>
                ${mainPhoto ? `<img src="${mainPhoto}" alt="${f.titre}" loading="lazy">` : '<i data-lucide="image" class="og-card__placeholder-icon"></i>'}
                <div class="og-card__price-tag">${f.prix || '—'}</div>
            </div>
            <div class="og-card__content">
                <h3 class="og-card__title">${f.titre}</h3>
                <div class="og-card__meta-grid">
                    <span><i data-lucide="globe"></i> ${f.pays || 'International'} ${f.ville ? '— ' + f.ville : ''}</span>
                    <span><i data-lucide="user"></i> ${f.vendeur_nom || 'Vendeur'}</span>
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
        .og-header { position: sticky; top: 0; z-index: 100; background: rgba(3, 3, 5, 0.92); backdrop-filter: blur(20px); border-bottom: 1px solid rgba(255, 255, 255, 0.06); padding: 20px 32px; display: flex; flex-direction: column; gap: 16px; }
        .og-header__top { display: flex; justify-content: space-between; align-items: center; width: 100%; }
        .og-brand-title { font-family: var(--font-display); color: #fff; font-size: 1.5rem; font-weight: 700; display: flex; align-items: center; gap: 12px; margin: 0; }
        .og-brand-title i { color: var(--gold-og); width: 26px; height: 26px; }
        .og-publish-cta { display: inline-flex; align-items: center; gap: 10px; padding: 10px 20px; border-radius: 12px; text-decoration: none; background: linear-gradient(135deg, var(--gold-og), var(--gold-hover)); color: #000; font-weight: 700; font-size: 0.85rem; font-family: var(--font-display); box-shadow: 0 8px 25px rgba(212,175,55,0.25); }
        
        .og-amazon-search { width: 100%; display: flex; background: var(--bg-panel); border: var(--border-gold); border-radius: 14px; overflow: hidden; backdrop-filter: blur(15px); }
        .og-category-select-wrapper { background: rgba(20, 20, 28, 0.9); border-right: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; padding: 0 14px; }
        .og-category-select-wrapper select { background: transparent; border: none; color: #fff; font-family: var(--font-body); font-size: 0.85rem; outline: none; cursor: pointer; padding: 12px 0; }
        .og-category-select-wrapper select option { background: #121218; color: #fff; }
        
        .og-search-input-box { flex: 2; display: flex; align-items: center; gap: 10px; padding: 0 16px; background: rgba(0,0,0,0.3); }
        .og-search-input-box input { width: 100%; background: transparent; border: none; color: #fff; font-size: 0.9rem; font-family: var(--font-body); padding: 12px 0; outline: none; }
        
        .og-location-box { flex: 1; display: flex; align-items: center; gap: 8px; padding: 0 14px; border-left: 1px solid rgba(255,255,255,0.08); background: rgba(0,0,0,0.2); }
        .og-location-box input { width: 100%; background: transparent; border: none; color: #fff; font-size: 0.85rem; font-family: var(--font-body); outline: none; }
        
        .og-search-submit { background: linear-gradient(135deg, var(--gold-og), var(--gold-hover)); color: #000; border: none; padding: 0 28px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; font-family: var(--font-display); }

        .og-main-container { padding: 32px; flex: 1; }
        .og-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 20px; margin-top: 20px; }
        .og-card { position: relative; background: var(--bg-panel); border-radius: 18px; overflow: hidden; border: 1px solid rgba(255,255,255,0.07); text-decoration: none; display: flex; flex-direction: column; transition: transform 0.35s var(--ease-premium), border-color 0.35s var(--ease-premium); }
        .og-card:hover { transform: translateY(-6px); border-color: rgba(212, 175, 55, 0.6); box-shadow: 0 20px 45px rgba(0,0,0,0.75), var(--gold-glow); }
        .og-card__media { position: relative; width: 100%; aspect-ratio: 1/1; background: #000; display: flex; align-items: center; justify-content: center; overflow: hidden; }
        .og-card__media img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.6s ease; }
        .og-card:hover .og-card__media img { transform: scale(1.08); }
        .og-card__badge { position: absolute; top: 10px; left: 10px; z-index: 2; display: flex; align-items: center; gap: 5px; font-size: 0.65rem; font-family: var(--font-mono); padding: 5px 10px; border-radius: 20px; background: rgba(5, 5, 5, 0.8); color: #fff; border: 1px solid rgba(255,255,255,0.08); }
        .og-card__price-tag { position: absolute; bottom: 10px; right: 10px; z-index: 2; background: linear-gradient(135deg, var(--gold-og), var(--gold-hover)); color: #000; font-family: var(--font-mono); font-weight: 700; font-size: 0.95rem; padding: 6px 12px; border-radius: 10px; }
        .og-card__content { padding: 14px; display: flex; flex-direction: column; gap: 8px; flex: 1; }
        .og-card__title { font-size: 0.88rem; font-weight: 600; color: #fff; line-height: 1.35; margin: 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .og-card__meta-grid { display: flex; flex-direction: column; gap: 5px; font-size: 0.72rem; color: var(--text-muted); margin-top: auto; }
        .og-card__meta-grid span { display: flex; align-items: center; gap: 6px; }
        .og-empty-state { grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 20px; text-align: center; color: var(--text-muted); background: var(--bg-panel); border-radius: 20px; border: 1px dashed rgba(255,255,255,0.1); }
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
            <div class="og-samii-text">Marketplace connectée. Flux synchronisés avec Cloudinary (Preset: MARKETPLACE OG).</div>
        </div>
    </aside>

    <div class="og-main-wrapper">
        <div class="og-bg-fx">
            <div class="og-bg-grid"></div>
            <div class="og-ambient-glow gold"></div>
            <div class="og-ambient-glow cyan"></div>
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
                    <i data-lucide="search" style="color:var(--gold-og); width:18px; height:18px; flex-shrink:0;"></i>
                    <input type="text" name="recherche" placeholder="Rechercher un produit..." value="${recherche || ''}">
                </div>
                <div class="og-location-box">
                    <i data-lucide="globe" style="color:var(--cyan-tech); width:16px; height:16px; flex-shrink:0;"></i>
                    <input type="text" name="pays" placeholder="Pays / Ville" value="${pays || ville || ''}">
                </div>
                <button type="submit" class="og-search-submit"><i data-lucide="search"></i></button>
            </form>
        </header>

        <main class="og-main-container">
            <div style="font-family: var(--font-mono); font-size: 0.78rem; color: var(--cyan-tech); margin-bottom: 16px;">
                ● ${annonces.length} annonce${annonces.length !== 1 ? 's' : ''} active${annonces.length !== 1 ? 's' : ''}
            </div>
            <div class="og-grid">
                ${annonces.length ? cardsHtml : `
                    <div class="og-empty-state">
                        <i data-lucide="shopping-bag" style="width:48px;height:48px;color:var(--gold-og);margin-bottom:16px;"></i>
                        <div>Aucune annonce trouvée. Soyez le premier à publier !</div>
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
        body { padding: 40px 20px; justify-content: center; }
        .og-form-container { width: 100%; max-width: 750px; margin: auto; background: var(--bg-panel); border: var(--border-gold); border-radius: 24px; padding: 40px; box-shadow: 0 20px 50px rgba(0,0,0,0.8), var(--gold-glow); backdrop-filter: blur(20px); box-sizing: border-box; }
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
    <div class="og-bg-fx">
        <div class="og-bg-grid"></div>
        <div class="og-ambient-glow gold"></div>
        <div class="og-ambient-glow cyan"></div>
    </div>

    <div class="og-form-container">
        <a href="/marketplace" class="og-back"><i data-lucide="arrow-left"></i> Retour à la Marketplace</a>
        <h1 class="og-form-title"><i data-lucide="plus-circle"></i> Publier une annonce</h1>
        
        <form action="/marketplace/publier" method="POST" enctype="multipart/form-data">
            <div class="og-form-group">
                <label>Titre de l'annonce</label>
                <input type="text" name="titre" class="og-form-control" required placeholder="Ex: Produit Premium">
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
                <input type="text" name="prix" class="og-form-control" required placeholder="Ex: 100 €">
            </div>

            <div class="og-form-group">
                <label>Pays / Zone</label>
                <input type="text" name="pays" class="og-form-control" required placeholder="Ex: France, Algérie...">
            </div>

            <div class="og-form-group">
                <label>Ville</label>
                <input type="text" name="ville" class="og-form-control" placeholder="Ex: Paris...">
            </div>

            <div class="og-form-group">
                <label>Matricule / Référence</label>
                <input type="text" name="matricule" class="og-form-control" placeholder="Ex: MAT-001">
            </div>

            <div class="og-form-group">
                <label>Vraies Photos (Maximum 5 photos)</label>
                <input type="file" name="photos" class="og-form-control" accept="image/*" multiple>
                <small style="color: var(--text-muted); font-size: 0.75rem; margin-top: 4px;">Envoi direct via le preset unsigned MARKETPLACE OG.</small>
            </div>

            <button type="submit" class="og-submit-btn">Mettre en ligne</button>
        </form>
    </div>
    <script src="https://unpkg.com/lucide@latest"></script>
    <script>if (typeof lucide !== "undefined") lucide.createIcons();</script>
</body>
</html>`);
});

// --- 3. TRAITEMENT POST UPLOAD (AVEC UPLOAD_PRESET EN UNSIGNED) ---
router.post("/publier", requireAuth, upload.array("photos", 5), async (req, res) => {
    try {
        const { titre, categorie, prix, pays, ville, matricule } = req.body;
        let photoUrls = [];

        if (req.files && req.files.length > 0) {
            for (let file of req.files) {
                let b64 = Buffer.from(file.buffer).toString("base64");
                let dataURI = "data:" + file.mimetype + ";base64," + b64;
                
                // Appel cloud_name + preset unsigned exact (sans api_secret)
                let uploadResponse = await cloudinary.uploader.upload(dataURI, {
                    upload_preset: "MARKETPLACE OG"
                });
                photoUrls.push(uploadResponse.secure_url);
            }
        }

        await airtable.create("ANNONCES", {
            titre,
            categorie,
            prix,
            pays: pays || 'International',
            ville: ville || '',
            matricule: matricule || '',
            photo_url: photoUrls[0] || '',
            photo_url_2: photoUrls[1] || '',
            photo_url_3: photoUrls[2] || '',
            photo_url_4: photoUrls[3] || '',
            photo_url_5: photoUrls[4] || '',
            vendeur_id: req.session.userId || 'admin_og',
            vendeur_nom: req.session.nom || 'Mohamed',
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
