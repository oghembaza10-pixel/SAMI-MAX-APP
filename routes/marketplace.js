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
        <a href="/vitrine/${f.vendeur_id}" class="mp-card">
            <div class="mp-card__image">
                <span class="mp-card__cat-badge"><i data-lucide="${cat.icon}"></i> ${cat.label}</span>
                ${f.photo_url ? `<img src="${f.photo_url}" alt="${f.titre}" loading="lazy">` : '<i data-lucide="image"></i>'}
            </div>
            <div class="mp-card__body">
                <h3>${f.titre}</h3>
                <div class="mp-card__price">${f.prix || '—'}</div>
                <div class="mp-card__meta">
                    <span><i data-lucide="map-pin"></i> ${f.ville || '—'}</span>
                    <span><i data-lucide="${f.type_vendeur === 'marchand' ? 'store' : 'user'}"></i> ${f.vendeur_nom || 'Vendeur'}</span>
                </div>
            </div>
        </a>`;
    }).join("");

    const categoriesHtml = CATEGORIES.map(c => `
        <a href="/marketplace?categorie=${c.id}${recherche ? `&recherche=${encodeURIComponent(recherche)}` : ''}${ville ? `&ville=${encodeURIComponent(ville)}` : ''}"
           class="mp-cat-btn ${categorie === c.id || (!categorie && c.id === 'tous') ? 'active' : ''}">
            <i data-lucide="${c.icon}" class="icon"></i><span class="label">${c.label}</span>
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
    <div class="mp-bg-fx">
        <div class="mp-bg-grid"></div>
        <div class="mp-bg-glow mp-bg-glow--1"></div>
        <div class="mp-bg-glow mp-bg-glow--2"></div>
        <div class="mp-bg-particles"></div>
    </div>

    <a href="${isClient ? '/client-qg' : '/qg'}" class="mp-back"><i data-lucide="arrow-left"></i> Retour</a>

    <section class="mp-hero">
        <div class="mp-hero__inner">
            <div>
                <h1><i data-lucide="store"></i> Marketplace</h1>
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
                <i data-lucide="shopping-bag" class="mp-empty__icon"></i>
                Aucune annonce pour le moment dans cette categorie.<br>Sois le premier a publier !
            </div>`}
    </div>

<script src="https://unpkg.com/lucide@latest"></script>
<script>if (typeof lucide !== "undefined") lucide.createIcons();</script>
</body>
</html>`);
});

router.get("/publier", requireAuth, async (req, res) => {
    const categoriesOptions = CATEGORIES.filter(c => c.id !== "tous")
        .map(c => `<option value="${c.id}">${c.label}</option>`).join("");

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
    <div class="mp-bg-fx">
        <div class="mp-bg-grid"></div>
        <div class="mp-bg-glow mp-bg-glow--1"></div>
        <div class="mp-bg-glow mp-bg-glow--2"></div>
    </div>

<div class="pb-shell">
    <a href="/marketplace" class="pb-back"><i data-lucide="arrow-left"></i> Retour à la Marketplace</a>
    <h1><i data-lucide="plus-circle"></i> Publier une annonce</h1>
    <div class="pb-card">
        <form id="form-publier">
            <label>Catégorie</label>
            <select name="categorie" id="select-categorie" required>${categoriesOptions}</select>

            <label id="label-photos">Photos (jusqu'à 3)</label>
            <div class="pb-photo-grid" id="photo-grid"></div>
            <div class="pb-photo-status" id="photo-status"></div>
            <input type="hidden" name="photos_urls" id="photos_urls">

            <label>Titre</label>
            <input type="text" name="titre" placeholder="Ex : iPhone 12 comme neuf" required>

            <div id="champs-vehicules" style="display:none;">
                <div class="pb-row">
                    <div>
                        <label>Marque</label>
                        <input type="text" name="vh_marque" placeholder="Ex : Renault">
                    </div>
                    <div>
                        <label>Modèle</label>
                        <input type="text" name="vh_modele" placeholder="Ex : Clio 4">
                    </div>
                </div>
                <div class="pb-row">
                    <div>
                        <label>Année</label>
                        <input type="text" name="vh_annee" placeholder="Ex : 2019">
                    </div>
                    <div>
                        <label>Kilométrage</label>
                        <input type="text" name="vh_km" placeholder="Ex : 85000 km">
                    </div>
                </div>
                <div class="pb-row">
                    <div>
                        <label>Carburant</label>
                        <select name="vh_carburant">
                            <option value="essence">Essence</option>
                            <option value="diesel">Diesel</option>
                            <option value="electrique">Électrique</option>
                            <option value="hybride">Hybride</option>
                            <option value="gpl">GPL</option>
                        </select>
                    </div>
                    <div>
                        <label>Boîte</label>
                        <select name="vh_boite">
                            <option value="manuelle">Manuelle</option>
                            <option value="automatique">Automatique</option>
                        </select>
                    </div>
                </div>
            </div>

            <div class="pb-row">
                <div>
                    <label>Prix</label>
                    <input type="text" name="prix" placeholder="Ex : 45000 DZD" required>
                </div>
                <div>
                    <label>Ville</label>
                    <input type="text" name="ville" placeholder="Ex : Alger" required>
                </div>
            </div>

            <label>Description</label>
            <textarea name="description" placeholder="Décris ton produit ou service..."></textarea>

            <label>Pays</label>
            <input type="text" name="pays" placeholder="Ex : Algérie" required>

            <button type="submit" class="pb-submit" id="btn-submit">Publier l'annonce</button>
        </form>
        <div class="pb-msg" id="msg"></div>
    </div>
</div>
<script src="https://unpkg.com/lucide@latest"></script>
<script>
if (typeof lucide !== "undefined") lucide.createIcons();

const CLOUDINARY_CLOUD_NAME = "${CLOUDINARY_CLOUD_NAME}";
const CLOUDINARY_PRESET = "${CLOUDINARY_PRESET}";
const MAX_PHOTOS = { vehicules: 5, immobilier: 5, default: 3 };

let photosUploadees = [];

const selectCategorie = document.getElementById('select-categorie');
const champsVehicules = document.getElementById('champs-vehicules');
const photoGrid = document.getElementById('photo-grid');
const labelPhotos = document.getElementById('label-photos');

function getMaxPhotos(cat) {
    return MAX_PHOTOS[cat] || MAX_PHOTOS.default;
}

function rebuildPhotoGrid(cat) {
    const max = getMaxPhotos(cat);
    labelPhotos.textContent = 'Photos (jusqu\\'à ' + max + ')';
    photosUploadees = new Array(max).fill(null);
    photoGrid.innerHTML = '';
    for (let i = 0; i < max; i++) {
        const slot = document.createElement('div');
        slot.className = 'pb-photo-slot';
        slot.dataset.index = i;
        slot.innerHTML = '<input type="file" accept="image/*" class="pb-photo-input"><i data-lucide="camera" class="pb-photo-slot__icon"></i>';
        photoGrid.appendChild(slot);
    }
    if (typeof lucide !== "undefined") lucide.createIcons();
    attachPhotoListeners();
}

function attachPhotoListeners() {
    document.querySelectorAll('.pb-photo-input').forEach(input => {
        input.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const slot = e.target.closest('.pb-photo-slot');
            const index = parseInt(slot.dataset.index, 10);
            const statusEl = document.getElementById('photo-status');

            slot.classList.add('uploading');
            statusEl.textContent = '⏳ Envoi photo ' + (index + 1) + '...';
            statusEl.style.color = 'var(--cyan-tech)';

            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', CLOUDINARY_PRESET);

            try {
                const res = await fetch('https://api.cloudinary.com/v1_1/' + CLOUDINARY_CLOUD_NAME + '/image/upload', {
                    method: 'POST', body: formData,
                });
                const data = await res.json();
                if (data.secure_url) {
                    photosUploadees[index] = data.secure_url;
                    slot.style.backgroundImage = 'url(' + data.secure_url + ')';
                    slot.classList.add('filled');
                    document.getElementById('photos_urls').value = JSON.stringify(photosUploadees.filter(Boolean));
                    statusEl.textContent = '✅ Photo ' + (index + 1) + ' prête';
                    statusEl.style.color = '#3ddc84';
                } else {
                    statusEl.textContent = '❌ Erreur upload';
                    statusEl.style.color = '#e55';
                }
            } catch (err) {
                statusEl.textContent = '❌ Erreur réseau';
                statusEl.style.color = '#e55';
            } finally {
                slot.classList.remove('uploading');
            }
        });
    });
}

selectCategorie.addEventListener('change', function() {
    const cat = selectCategorie.value;
    champsVehicules.style.display = cat === 'vehicules' ? 'block' : 'none';
    rebuildPhotoGrid(cat);
});

rebuildPhotoGrid(selectCategorie.value);

document.getElementById('form-publier').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('msg');
    const btn = document.getElementById('btn-submit');
    const data = Object.fromEntries(new FormData(e.target));

    if (data.categorie === 'vehicules') {
        data.caracteristiques = JSON.stringify({
            marque: data.vh_marque, modele: data.vh_modele, annee: data.vh_annee,
            km: data.vh_km, carburant: data.vh_carburant, boite: data.vh_boite,
        });
    }

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
        const { titre, categorie, prix, description, photos_urls, ville, pays, caracteristiques } = req.body;
        if (!titre || !categorie || !prix || !ville || !pays) {
            return res.json({ success: false, error: "Tous les champs obligatoires doivent être remplis." });
        }

        let photosArray = [];
        try { photosArray = photos_urls ? JSON.parse(photos_urls) : []; } catch {}
        const photoPrincipale = photosArray[0] || "";

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
            photo_url: photoPrincipale,
            photos_urls: photos_urls || "[]",
            caracteristiques: caracteristiques || "",
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
