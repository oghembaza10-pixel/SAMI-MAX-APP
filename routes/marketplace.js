// ==========================================================================
// SAMII OS — MARKETPLACE — Page d'accueil, catégories, annonces, upload photo
// ==========================================================================
const express = require("express");
const router  = express.Router();
const airtable = require("../services/airtable");
const workspaceService = require("../services/workspaceService");
const CONFIG = require("../config");

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

const CATEGORIES = [
    { id: "tous",           icon: "🛍️", label: "Tout" },
    { id: "electronique",   icon: "📱", label: "Électronique" },
    { id: "mode",           icon: "👕", label: "Mode" },
    { id: "beaute",         icon: "💄", label: "Beauté" },
    { id: "maison",         icon: "🏠", label: "Maison" },
    { id: "electromenager", icon: "🧺", label: "Électro." },
    { id: "sport",          icon: "⚽", label: "Sport" },
    { id: "loisirs",        icon: "🎮", label: "Loisirs" },
    { id: "livres",         icon: "📚", label: "Livres" },
    { id: "vehicules",      icon: "🚗", label: "Véhicules" },
    { id: "immobilier",     icon: "🏢", label: "Immobilier" },
    { id: "animaux",        icon: "🐾", label: "Animaux" },
    { id: "alimentation",   icon: "🍽️", label: "Alimentation" },
    { id: "services",       icon: "🛎️", label: "Services" },
    { id: "artisanat",      icon: "🎨", label: "Artisanat" },
    { id: "bebe",           icon: "🍼", label: "Bébé" },
    { id: "bureau",         icon: "💼", label: "Bureau" },
    { id: "autre",          icon: "📦", label: "Autre" },
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

    const catLabel = (id) => CATEGORIES.find(c => c.id === id)?.label || id;

    const cardsHtml = annonces.map(a => {
        const f = a.fields;
        return `
        <a href="/vitrine/${f.vendeur_id}" class="mp-card">
            <div class="mp-card__image">
                <span class="mp-card__cat-badge">${catLabel(f.categorie)}</span>
                ${f.photo_url ? `<img src="${f.photo_url}" alt="${f.titre}" loading="lazy">` : '<i data-lucide="image"></i>'}
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
        <a href="/marketplace?categorie=${c.id}${recherche ? `&recherche=${encodeURIComponent(recherche)}` : ''}${ville ? `&ville=${encodeURIComponent(ville)}` : ''}"
           class="mp-cat-btn ${categorie === c.id || (!categorie && c.id === 'tous') ? 'active' : ''}">
            <span class="icon">${c.icon}</span><span class="label">${c.label}</span>
        </a>
    `).join("");

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Marketplace — OG Empire</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;800&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/css/hub-premium.css">
    <link rel="stylesheet" href="/css/marketplace-style.css">
</head>
<body>
    <a href="${isClient ? '/client-qg' : '/qg'}" class="mp-back">← Retour</a>

    <section class="mp-hero">
        <div class="mp-hero__inner">
            <div>
                <h1>🏪 Marketplace</h1>
                <p>Produits, services, offres — tout l'écosystème OG Empire.</p>
                <div class="mp-stats-pill"><span class="dot"></span>${annonces.length} annonce${annonces.length !== 1 ? 's' : ''} disponible${annonces.length !== 1 ? 's' : ''}</div>
            </div>
            <a href="/marketplace/publier" class="mp-publish-btn">
                <i data-lucide="plus-circle"></i> Publier
            </a>
        </div>
    </section>

    <form class="mp-search" method="GET">
        <input type="hidden" name="categorie" value="${categorie || 'tous'}">
        <input type="text" name="recherche" placeholder="Rechercher..." value="${recherche || ''}">
        <input type="text" name="ville" placeholder="Ville" value="${ville || ''}">
        <button type="submit"><i data-lucide="search"></i></button>
    </form>

    <div class="mp-cats-wrap">
        <div class="mp-cats">${categoriesHtml}</div>
    </div>

    <div class="mp-grid">
        ${annonces.length ? cardsHtml : `
            <div class="mp-empty">
                <span class="mp-empty__icon">🛍️</span>
                Aucune annonce pour le moment dans cette categorie.<br>Sois le premier a publier !
            </div>`}
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
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/css/hub-premium.css">
    <link rel="stylesheet" href="/css/marketplace-style.css">
</head>
<body>
<div class="pb-shell">
    <a href="/marketplace" class="pb-back">← Retour à la Marketplace</a>
    <h1>➕ Publier une annonce</h1>
    <div class="pb-card">
        <form id="form-publier">
            <label>Photo du produit</label>
            <div class="pb-photo-zone" id="photo-zone">
                <input type="file" id="input-photo" accept="image/*">
                <div class="pb-photo-zone__icon">📷</div>
                <div class="pb-photo-zone__text">Clique ou glisse une photo ici</div>
            </div>
            <div class="pb-photo-preview" id="photo-preview">
                <img id="photo-preview-img" alt="Aperçu">
            </div>
            <div class="pb-photo-status" id="photo-status"></div>
            <input type="hidden" name="photo_url" id="photo_url">

            <label>Titre</label>
            <input type="text" name="titre" placeholder="Ex : iPhone 12 comme neuf" required>

            <div class="pb-row">
                <div>
                    <label>Catégorie</label>
                    <select name="categorie" required>${categoriesOptions}</select>
                </div>
                <div>
                    <label>Prix</label>
                    <input type="text" name="prix" placeholder="Ex : 45000 DZD" required>
                </div>
            </div>

            <label>Description</label>
            <textarea name="description" placeholder="Décris ton produit ou service..."></textarea>

            <div class="pb-row">
                <div>
                    <label>Ville</label>
                    <input type="text" name="ville" placeholder="Ex : Alger" required>
                </div>
                <div>
                    <label>Pays</label>
                    <input type="text" name="pays" placeholder="Ex : Algérie" required>
                </div>
            </div>

            <button type="submit" class="pb-submit" id="btn-submit">Publier l'annonce</button>
        </form>
        <div class="pb-msg" id="msg"></div>
    </div>
</div>
<script>
const CLOUDINARY_CLOUD_NAME = "TON_CLOUD_NAME";
const CLOUDINARY_PRESET = "TON_UPLOAD_PRESET";

document.getElementById('input-photo').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const statusEl = document.getElementById('photo-status');
    statusEl.textContent = '⏳ Envoi de la photo...';
    statusEl.style.color = 'var(--cyan-tech)';

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_PRESET);

    try {
        const res = await fetch(\`https://api.cloudinary.com/v1_1/\${CLOUDINARY_CLOUD_NAME}/image/upload\`, {
            method: 'POST', body: formData,
        });
        const data = await res.json();

        if (data.secure_url) {
            document.getElementById('photo_url').value = data.secure_url;
            document.getElementById('photo-preview-img').src = data.secure_url;
            document.getElementById('photo-preview').style.display = 'block';
            statusEl.textContent = '✅ Photo prête';
            statusEl.style.color = '#3ddc84';
        } else {
            statusEl.textContent = '❌ Erreur upload photo';
            statusEl.style.color = '#e55';
        }
    } catch (err) {
        statusEl.textContent = '❌ Erreur réseau';
        statusEl.style.color = '#e55';
    }
});

document.getElementById('form-publier').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('msg');
    const btn = document.getElementById('btn-submit');
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
