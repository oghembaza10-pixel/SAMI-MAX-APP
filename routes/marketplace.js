// ==========================================================================
// SAMII OS — MARKETPLACE — PostgreSQL — Upload photo réel (Cloudinary)
// FICHIER COMPLET — VERSION CORRIGÉE
// ==========================================================================

const express = require("express");
const router = express.Router();
const db = require("../services/db");
const gradeService = require("../services/gradeService");

const {
    MARKETPLACE_NAME,
    CATEGORIES,
    SERVICES_RAPIDES,
    SUPPLIER_REGIONS,
    categoryLabel,
    supplierRegionLabel
} = require("../config/marketplace-catalog");

const CLOUDINARY_CLOUD_NAME = "ojwx5hft";
const CLOUDINARY_UPLOAD_PRESET = "MARKETPLACE OG";

// --------------------------------------------------------------------------
// AUTH
// --------------------------------------------------------------------------

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) {
        return res.redirect("/login");
    }

    next();
}

// --------------------------------------------------------------------------
// HELPERS
// --------------------------------------------------------------------------

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getCategoryLabel(id) {
    if (typeof id === "string" && id.startsWith("service-")) {
        const service = (SERVICES_RAPIDES || []).find(s => `service-${s.id}` === id);
        if (service) return `${service.emoji} ${service.label}`;
    }

    if (typeof categoryLabel === "function") {
        return categoryLabel(id);
    }

    const found = (CATEGORIES || []).find(c => c.id === id);

    return found?.label || id || "Autre";
}

function getRegionLabel(id) {
    if (typeof supplierRegionLabel === "function") {
        return supplierRegionLabel(id);
    }

    const found = (SUPPLIER_REGIONS || []).find(r => r.id === id);

    return found?.label || id || "";
}

function parsePhotos(photoUrl, photosUrls) {
    let list = [];

    if (photosUrls) {
        try {
            const parsed =
                typeof photosUrls === "string"
                    ? JSON.parse(photosUrls)
                    : photosUrls;

            if (Array.isArray(parsed)) {
                list = parsed.filter(Boolean);
            }
        } catch {
            list = [];
        }
    }

    if (!list.length && photoUrl) {
        list = [photoUrl];
    }

    return list;
}

function normalizeString(value) {
    return String(value ?? "").trim();
}

function isValidHttpUrl(value) {
    try {
        const url = new URL(value);

        return (
            url.protocol === "http:" ||
            url.protocol === "https:"
        );
    } catch {
        return false;
    }
}

// --------------------------------------------------------------------------
// CATALOG HTML
// --------------------------------------------------------------------------

const CATEGORY_OPTIONS_HTML = [
    {
        id: "tous",
        label: "Toutes nos catégories"
    },
    ...(CATEGORIES || [])
]
    .map(category => `
        <option value="${escapeHtml(category.id)}">
            ${escapeHtml(category.label)}
        </option>
    `)
    .join("");

const REGION_CHIPS_HTML = (SUPPLIER_REGIONS || [])
    .map(region => `
        <a
            href="/marketplace?region=${encodeURIComponent(region.id)}"
            class="region-chip"
            data-region="${escapeHtml(region.id)}"
        >
            <i data-lucide="${escapeHtml(region.icon || "globe")}"></i>
            ${escapeHtml(region.label)}
        </a>
    `)
    .join("");

const SERVICES_CHIPS_HTML = (SERVICES_RAPIDES || [])
    .map(service => `
        <a
            href="/marketplace/publier?service=${encodeURIComponent(service.id)}"
            class="service-chip"
        >
            <span class="service-chip__emoji">${service.emoji}</span>
            ${escapeHtml(service.label)}
        </a>
    `)
    .join("");

// --------------------------------------------------------------------------
// VIRTUAL PRODUCTS
// --------------------------------------------------------------------------

const ANNONCES_VIRTUELLES = [
    {
        id: "v_1",
        titre: "Rolex Submariner Date — Édition Collector Or & Noir",
        categorie: "luxe",
        region_fournisseur: "europe",
        prix: "8 500 €",
        pays: "Suisse",
        ville: "Genève",
        photo_url:
            "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1000&q=85",
        photos_urls: null,
        vendeur_id: "ai_agent_samii",
        vendeur_nom: "Samii Core",
        type_vendeur: "ia_marchand",
        actif: true
    },
    {
        id: "v_2",
        titre: "MacBook Pro M3 Max — 64Go RAM / 2To SSD",
        categorie: "electronique",
        region_fournisseur: "europe",
        prix: "3 490 $",
        pays: "États-Unis",
        ville: "New York",
        photo_url:
            "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1000&q=85",
        photos_urls: null,
        vendeur_id: "ai_agent_vaulta",
        vendeur_nom: "Vaulta Automation",
        type_vendeur: "ia_marchand",
        actif: true
    }
];

// ==========================================================================
// MARKETPLACE
// ==========================================================================

router.get("/", requireAuth, async (req, res) => {

    const {
        categorie,
        recherche,
        pays,
        ville,
        region
    } = req.query;

    let annoncesDB = [];

    // ----------------------------------------------------------------------
    // DATABASE
    // ----------------------------------------------------------------------

    try {

        const clauses = ["actif = true"];
        const params = [];

        let index = 1;

        if (
            categorie &&
            categorie !== "tous"
        ) {
            clauses.push(
                `categorie = $${index++}`
            );

            params.push(categorie);
        }

        if (recherche) {

            clauses.push(
                `LOWER(titre) LIKE LOWER($${index++})`
            );

            params.push(
                `%${recherche}%`
            );
        }

        if (pays) {

            clauses.push(
                `LOWER(pays) LIKE LOWER($${index++})`
            );

            params.push(
                `%${pays}%`
            );
        }

        if (ville) {

            clauses.push(
                `LOWER(ville) LIKE LOWER($${index++})`
            );

            params.push(
                `%${ville}%`
            );
        }

        if (region) {

            clauses.push(
                `region_fournisseur = $${index++}`
            );

            params.push(region);
        }

        const rows = await db.query(
            `
            SELECT *
            FROM annonces
            WHERE ${clauses.join(" AND ")}
            ORDER BY created_at DESC
            LIMIT 50
            `,
            params
        );

        annoncesDB = rows;

    } catch (err) {

        console.warn(
            "⚠️ Marketplace lecture :",
            err.message
        );
    }

    // ----------------------------------------------------------------------
    // MERGE
    // ----------------------------------------------------------------------

    let toutesAnnonces = [
        ...ANNONCES_VIRTUELLES,
        ...annoncesDB
    ];

    if (
        categorie &&
        categorie !== "tous"
    ) {
        toutesAnnonces =
            toutesAnnonces.filter(
                a => a.categorie === categorie
            );
    }

    if (region) {
        toutesAnnonces =
            toutesAnnonces.filter(
                a =>
                    a.region_fournisseur === region
            );
    }

    if (recherche) {

        const query =
            String(recherche).toLowerCase();

        toutesAnnonces =
            toutesAnnonces.filter(a =>
                String(a.titre || "")
                    .toLowerCase()
                    .includes(query)
            );
    }

    // ----------------------------------------------------------------------
    // FAVORITES
    // ----------------------------------------------------------------------

    let mesFavorisIds = [];

    try {

        if (req.session.userId) {

            const favRows =
                await db.query(
                    `
                    SELECT annonce_id
                    FROM favoris
                    WHERE user_id = $1
                    `,
                    [req.session.userId]
                );

            mesFavorisIds =
                favRows.map(
                    row => String(row.annonce_id)
                );
        }

    } catch (err) {

        console.warn(
            "⚠️ favoris :",
            err.message
        );
    }

    // ----------------------------------------------------------------------
    // RATINGS
    // ----------------------------------------------------------------------

    let notesParVendeur = {};

    try {

        const noteRows =
            await db.query(
                `
                SELECT
                    cible_id,
                    ROUND(
                        AVG(note)::numeric,
                        1
                    ) AS moyenne,
                    COUNT(*) AS total
                FROM avis
                WHERE cible_type = 'vendeur'
                GROUP BY cible_id
                `
            );

        noteRows.forEach(row => {

            notesParVendeur[row.cible_id] = {
                moyenne: parseFloat(row.moyenne),
                total: parseInt(
                    row.total,
                    10
                )
            };

        });

    } catch (err) {

        console.warn(
            "⚠️ avis :",
            err.message
        );
    }

    // ----------------------------------------------------------------------
    // SELECTS
    // ----------------------------------------------------------------------

    const categoryOptionsHtml =
        [
            {
                id: "tous",
                label: "Toutes nos catégories"
            },
            ...(CATEGORIES || [])
        ]
            .map(c => `
                <option
                    value="${escapeHtml(c.id)}"
                    ${categorie === c.id ? "selected" : ""}
                >
                    ${escapeHtml(c.label)}
                </option>
            `)
            .join("");

    const regionChipsHtml =
        (SUPPLIER_REGIONS || [])
            .map(r => `
                <a
                    href="/marketplace?region=${encodeURIComponent(r.id)}"
                    class="region-chip ${region === r.id ? "active" : ""}"
                >
                    <i data-lucide="${escapeHtml(r.icon || "globe")}"></i>
                    ${escapeHtml(r.label)}
                </a>
            `)
            .join("");

    // ----------------------------------------------------------------------
    // CARDS
    // ----------------------------------------------------------------------

    const cardsHtml =
        toutesAnnonces
            .map((a, index) => {

                const id =
                    a.id ??
                    `product_${index}`;

                const titre =
                    escapeHtml(
                        a.titre ||
                        "Produit SAMII"
                    );

                const cat =
                    escapeHtml(
                        getCategoryLabel(
                            a.categorie
                        )
                    );

                const prix =
                    escapeHtml(
                        a.prix ||
                        "Sur devis"
                    );

                const paysP =
                    escapeHtml(
                        a.pays ||
                        "International"
                    );

                const villeP =
                    escapeHtml(
                        a.ville ||
                        ""
                    );

                const vendeur =
                    escapeHtml(
                        a.vendeur_nom ||
                        "Marchand SAMII"
                    );

                const vendeurId =
                    encodeURIComponent(
                        a.vendeur_id ||
                        "marchand_verified_1"
                    );

                const isAI =
                    a.type_vendeur ===
                    "ia_marchand";

                const vendeurLink =
                    (!isAI && a.vendeur_id && a.vendeur_id !== "marchand_verified_1")
                        ? `/vitrine/${vendeurId}`
                        : null;

                const isReal =
                    typeof id === "number" ||
                    /^\d+$/.test(
                        String(id)
                    );

                const isFav =
                    mesFavorisIds.includes(
                        String(id)
                    );

                const photos =
                    parsePhotos(
                        a.photo_url,
                        a.photos_urls
                    );

                const notes =
                    notesParVendeur[
                        a.vendeur_id
                    ] || null;

                const linkTo =
                    isReal
                        ? `/marketplace/produit/${id}`
                        : `/vitrine/${vendeurId}`;

                const aiBadge =
                    isAI
                        ? `
                            <span class="product-ai">
                                <span class="ai-dot"></span>
                                MARCHAND IA
                            </span>
                          `
                        : "";

                const dotsHtml =
                    photos.length > 1
                        ? `
                            <div class="photo-dots">
                                ${photos
                                    .map(
                                        (photo, photoIndex) => `
                                            <span
                                                class="photo-dot ${
                                                    photoIndex === 0
                                                        ? "active"
                                                        : ""
                                                }"
                                                data-photo="${escapeHtml(photo)}"
                                            ></span>
                                        `
                                    )
                                    .join("")}
                            </div>
                          `
                        : "";

                const noteHtml =
                    notes
                        ? `
                            <span class="seller-rating">
                                <i data-lucide="star"></i>
                                ${notes.moyenne}
                                <small>
                                    (${notes.total})
                                </small>
                            </span>
                          `
                        : "";

                return `
                    <article
                        class="product-card ${isAI ? "is-ai" : ""}"
                        data-product-id="${escapeHtml(String(id))}"
                        data-real="${isReal}"
                    >

                        <div class="product-media">

                            <a
                                href="${linkTo}"
                                class="product-image-link"
                            >

                                ${
                                    photos.length
                                        ? `
                                            <img
                                                src="${escapeHtml(photos[0])}"
                                                alt="${titre}"
                                                loading="lazy"
                                                referrerpolicy="no-referrer"
                                                class="product-main-img"
                                            >
                                          `
                                        : `
                                            <div class="product-placeholder">
                                                <i data-lucide="image"></i>
                                            </div>
                                          `
                                }

                            </a>

                            <div class="product-top">
                                <span class="product-category">
                                    ${cat}
                                </span>

                                ${aiBadge}
                            </div>

                            <button
                                class="favorite-btn ${
                                    isFav ? "saved" : ""
                                }"
                                type="button"
                                onclick='toggleFavorite(
                                    ${JSON.stringify(String(id))},
                                    ${isReal},
                                    this
                                )'
                            >
                                <i data-lucide="heart"></i>
                            </button>

                            ${dotsHtml}

                        </div>

                        <div class="product-body">

                            <div class="product-location">
                                <i data-lucide="map-pin"></i>
                                ${paysP}
                                ${
                                    villeP
                                        ? ` · ${villeP}`
                                        : ""
                                }
                            </div>

                            <a
                                href="${linkTo}"
                                class="product-title"
                            >
                                ${titre}
                            </a>

                            <div class="seller-row">

                                <div class="seller-avatar">
                                    ${isAI ? "AI" : "OG"}
                                </div>

                                <div class="seller-info">

                                    <strong>
                                        ${vendeurLink ? `<a href="${vendeurLink}" style="color:inherit;text-decoration:none;">${vendeur}</a>` : vendeur}
                                    </strong>

                                    <span>
                                        ${
                                            isAI
                                                ? "Intelligence commerciale"
                                                : "Marchand vérifié"
                                        }
                                    </span>

                                </div>

                                ${noteHtml}

                            </div>

                            <div class="product-bottom">

                                <div class="product-price">
                                    ${prix}
                                </div>

                                <div class="product-bottom-actions">

                                    <button
                                        class="cart-mini-btn"
                                        type="button"
                                        title="Ajouter au panier"
                                        onclick='quickAdd(
                                            ${JSON.stringify({
                                                id: String(id),
                                                titre: a.titre || "",
                                                prix: a.prix || "Sur devis",
                                                photo: photos[0] || ""
                                            })}
                                        )'
                                    >
                                        <i data-lucide="shopping-cart"></i>
                                    </button>

                                    <button
                                        class="save-btn ${
                                            isFav ? "saved" : ""
                                        }"
                                        type="button"
                                        title="Ajouter aux favoris"
                                        onclick='toggleFavorite(
                                            ${JSON.stringify(String(id))},
                                            ${isReal},
                                            this
                                        )'
                                    >
                                        <i data-lucide="bookmark"></i>
                                    </button>

                                </div>

                            </div>

                        </div>

                    </article>
                `;
            })
            .join("");

    // ----------------------------------------------------------------------
    // HTML
    // ----------------------------------------------------------------------

    res.send(`
<!DOCTYPE html>

<html lang="fr">

<head>

<meta charset="UTF-8">

<meta
    name="viewport"
    content="width=device-width,initial-scale=1"
>

<title>
    ${escapeHtml(MARKETPLACE_NAME || "SAMII Marketplace")}
</title>

<script src="https://unpkg.com/lucide@latest"></script>

<style>

:root {
    --blue: #00d9ff;
    --blue2: #0077ff;
    --bg: #03060b;
    --panel: #09121d;
    --panel2: #0c1825;
    --text: #f5fbff;
    --muted: #7f96a8;
    --border: rgba(0,217,255,.16);

    --gold: #D4A94A;
    --gold-bright: #F2CC78;
    --gold-soft: rgba(212,169,74,.09);
    --gold-border: rgba(212,169,74,.35);
    --silver-bright: #E8ECEF;
}

* {
    box-sizing: border-box;
}

html,
body {
    margin: 0;
    padding: 0;
    min-height: 100%;
}

body {
    background:
        radial-gradient(
            circle at top right,
            rgba(0,217,255,.08),
            transparent 35%
        ),
        var(--bg);

    color: var(--text);

    font-family:
        Inter,
        system-ui,
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        sans-serif;
}

a {
    color: inherit;
}

button,
input,
select {
    font: inherit;
}

.sidebar {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;

    width: 250px;

    padding: 24px 16px;

    display: flex;
    flex-direction: column;
    justify-content: space-between;

    border-right:
        1px solid
        rgba(0,217,255,.12);

    background:
        rgba(3,7,13,.94);

    backdrop-filter: blur(20px);

    z-index: 20;
}

.brand {
    display: flex;
    align-items: center;
    gap: 10px;

    margin-bottom: 30px;

    padding: 0 8px;
}

.brand-mark {
    width: 38px;
    height: 38px;

    border-radius: 11px;

    display: grid;
    place-items: center;

    background:
        linear-gradient(
            135deg,
            var(--blue),
            var(--blue2)
        );

    color: #001018;

    font-weight: 1000;
}

.brand-name {
    font-size: 14px;
    font-weight: 900;
}

.brand-name span {
    display: block;
    color: var(--muted);
    font-size: 8px;
    letter-spacing: 2px;
}

nav {
    display: flex;
    flex-direction: column;
    gap: 5px;
}

.side-link {
    display: flex;
    align-items: center;
    gap: 11px;

    padding: 12px;

    border-radius: 10px;

    text-decoration: none;

    color: var(--muted);

    font-size: 12px;
    font-weight: 700;

    transition: .2s;
}

.side-link:hover,
.side-link.active {
    color: var(--text);

    background:
        rgba(0,217,255,.08);
}

.side-link.active {
    border:
        1px solid
        rgba(0,217,255,.14);
}

.side-link svg {
    width: 17px;
    height: 17px;
}

.side-bottom {
    padding: 10px;
}

.side-ai {
    display: flex;
    align-items: center;
    gap: 8px;

    color: var(--blue);

    font-size: 9px;
    font-weight: 900;
}

.side-ai-dot,
.ai-dot,
.live-dot {
    width: 7px;
    height: 7px;

    border-radius: 50%;

    background: var(--blue);

    box-shadow:
        0 0 10px
        var(--blue);
}

.side-text {
    color: var(--muted);

    font-size: 9px;

    line-height: 1.5;

    margin-top: 8px;
}

.og-lang-switch {
    display: flex;
    gap: 8px;
    margin-top: 12px;
    font-size: 9px;
    font-weight: 800;
}

.og-lang-switch span {
    cursor: pointer;
    color: var(--muted);
    padding: 3px 6px;
    border-radius: 6px;
    transition: color .2s ease;
}

.og-lang-switch span:hover,
.og-lang-switch span.active {
    color: var(--blue);
    background: rgba(0,217,255,.08);
}

.main {
    margin-left: 250px;
}

.header {
    position: sticky;
    top: 0;

    z-index: 15;

    background:
        rgba(3,6,11,.90);

    backdrop-filter: blur(20px);

    border-bottom:
        1px solid
        rgba(0,217,255,.08);
}

.header-top {
    display: flex;
    align-items: center;
    gap: 16px;

    padding: 16px 24px;
}

.mobile-brand {
    display: none;
}

.search {
    flex: 1;

    max-width: 720px;

    display: flex;
    align-items: center;

    border:
        1px solid
        var(--border);

    background:
        rgba(9,18,29,.9);

    border-radius: 12px;

    overflow: hidden;
}

.search select {
    width: 160px;

    padding: 12px;

    border: none;

    border-right:
        1px solid
        var(--border);

    background: transparent;

    color: var(--muted);

    outline: none;
}

.search input {
    width: 100%;

    padding: 12px 14px;

    border: none;

    background: transparent;

    color: var(--text);

    outline: none;
}

.search button {
    width: 46px;

    border: none;

    background: transparent;

    color: var(--blue);

    cursor: pointer;
}

.header-actions {
    display: flex;
    align-items: center;
    gap: 8px;

    margin-left: auto;
}

.icon-btn {
    width: 38px;
    height: 38px;

    display: grid;
    place-items: center;

    border:
        1px solid
        var(--border);

    border-radius: 10px;

    background:
        rgba(9,18,29,.8);

    color: var(--text);

    cursor: pointer;

    text-decoration: none;

    position: relative;
}

.icon-btn svg {
    width: 17px;
}

.badge-count {
    position: absolute;

    right: -4px;
    top: -4px;

    min-width: 17px;
    height: 17px;

    padding: 0 4px;

    display: flex;
    align-items: center;
    justify-content: center;

    border-radius: 50%;

    background: var(--blue);

    color: #001018;

    font-size: 9px;
    font-weight: 900;
}

.publish-btn {
    display: flex;
    align-items: center;
    gap: 7px;

    padding: 10px 14px;

    border-radius: 10px;

    background:
        linear-gradient(
            135deg,
            var(--blue),
            var(--blue2)
        );

    color: #001018;

    text-decoration: none;

    font-size: 11px;
    font-weight: 900;
}

.subnav,
.region-row {
    display: flex;
    flex-wrap: nowrap;

    gap: 8px;

    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;

    padding: 0 24px 13px;

    scrollbar-width: none;
}

.subnav::-webkit-scrollbar,
.region-row::-webkit-scrollbar {
    display: none;
}

.subnav a,
.region-chip {
    flex: 0 0 auto;

    padding: 7px 12px;

    border-radius: 999px;

    border:
        1px solid
        rgba(0,217,255,.10);

    color: var(--muted);

    text-decoration: none;
    white-space: nowrap;

    font-size: 10px;
    font-weight: 800;
}

.subnav a.active,
.subnav a:hover,
.region-chip.active,
.region-chip:hover {
    color: var(--blue);

    border-color:
        rgba(0,217,255,.3);

    background:
        rgba(0,217,255,.07);
}

.region-row {
    padding-bottom: 14px;
}

.services-row {
    display: flex;
    flex-wrap: nowrap;

    gap: 8px;

    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;

    padding: 0 24px 16px;

    scrollbar-width: none;
}

.services-row::-webkit-scrollbar {
    display: none;
}

.service-chip {
    flex: 0 0 auto;

    display: flex;
    align-items: center;
    gap: 6px;

    padding: 8px 14px;

    border-radius: 999px;

    border:
        1px solid
        rgba(197,160,89,.25);

    background:
        rgba(197,160,89,.06);

    color: var(--text);

    text-decoration: none;
    white-space: nowrap;

    font-size: 11px;
    font-weight: 800;
}

.service-chip:hover {
    border-color:
        rgba(197,160,89,.5);

    background:
        rgba(197,160,89,.12);
}

.service-chip__emoji {
    font-size: 14px;
    line-height: 1;
}

.content {
    padding: 30px;
}

.hero {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;

    gap: 20px;

    margin-bottom: 25px;
}

.hero-kicker {
    display: flex;
    align-items: center;
    gap: 7px;

    color: var(--blue);

    font-size: 9px;
    font-weight: 900;

    letter-spacing: 1.5px;
}

.hero h1 {
    margin: 10px 0 6px;

    font-size: clamp(
        28px,
        4vw,
        48px
    );

    line-height: 1.05;

    letter-spacing: -1.8px;
}

.hero h1 .hero-accent {
    color: var(--blue);
}

.hero p {
    margin: 0;

    color: var(--muted);

    font-size: 12px;
}

.hero-actions {
    display: flex;
    gap: 8px;
}

.filter-btn {
    display: flex;
    align-items: center;
    gap: 7px;

    padding: 10px 13px;

    border:
        1px solid
        var(--border);

    border-radius: 10px;

    background:
        rgba(9,18,29,.8);

    color: var(--text);

    text-decoration: none;

    font-size: 10px;
    font-weight: 800;
}

.products-grid {
    display: grid;

    grid-template-columns:
        repeat(
            auto-fill,
            minmax(210px, 1fr)
        );

    gap: 16px;
}

.product-card {
    position: relative;

    overflow: hidden;

    border:
        1px solid
        var(--gold-border);

    border-radius: 17px;

    background:
        rgba(9,18,29,.88);

    transition:
        transform .2s,
        border-color .2s,
        box-shadow .2s;
}

.product-card::before {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
    z-index: 1;
    box-shadow: inset 0 0 0 1px rgba(212,169,74,.12);
}

.product-card:hover {
    transform:
        translateY(-3px);

    border-color:
        var(--blue);

    box-shadow:
        0 18px 50px rgba(0,0,0,.28),
        0 0 26px rgba(0,217,255,.12);
}

.product-card.is-ai {
    border-color:
        rgba(0,217,255,.18);
}

.product-media {
    position: relative;

    aspect-ratio: 1 / 1;

    background:
        #07101a;

    overflow: hidden;
}

.product-image-link {
    display: block;

    width: 100%;
    height: 100%;
}

.product-main-img {
    width: 100%;
    height: 100%;

    object-fit: cover;

    display: block;
}

.product-placeholder {
    width: 100%;
    height: 100%;

    display: grid;
    place-items: center;

    color: var(--muted);
}

.product-placeholder svg {
    width: 35px;
}

.product-top {
    position: absolute;

    left: 10px;
    top: 10px;

    display: flex;

    gap: 6px;
}

.product-category,
.product-ai {
    padding: 5px 8px;

    border-radius: 999px;

    background:
        rgba(3,6,11,.78);

    backdrop-filter: blur(10px);

    font-size: 8px;
    font-weight: 900;
}

.product-category {
    color: var(--gold-bright);
    border: 1px solid var(--gold-border);
}

.product-ai {
    display: flex;
    align-items: center;
    gap: 5px;

    color: var(--blue);
}

.favorite-btn {
    position: absolute;

    right: 10px;
    top: 10px;

    width: 32px;
    height: 32px;

    display: grid;
    place-items: center;

    border:
        1px solid
        rgba(255,255,255,.08);

    border-radius: 50%;

    background:
        rgba(3,6,11,.72);

    color: var(--text);

    cursor: pointer;
}

.favorite-btn.saved,
.save-btn.saved {
    color: var(--gold-bright);
    border-color: var(--gold-border);
}

.photo-dots {
    position: absolute;

    bottom: 10px;
    left: 50%;

    transform:
        translateX(-50%);

    display: flex;

    gap: 5px;
}

.photo-dot {
    /* Le point visuel reste petit ; la zone cliquable/tapable est agrandie
       via le padding + background-clip, pour rester utilisable au doigt. */
    width: 6px;
    height: 6px;
    padding: 7px;

    border-radius: 50%;

    background:
        rgba(255,255,255,.45);
    background-clip: content-box;

    cursor: pointer;
}

.photo-dot.active {
    background: var(--blue);

    box-shadow:
        0 0 8px
        var(--blue);
}

.product-body {
    padding: 13px;
}

.product-location {
    display: flex;
    align-items: center;
    gap: 5px;

    color: var(--muted);

    font-size: 9px;

    margin-bottom: 7px;
}

.product-location svg {
    width: 12px;
    height: 12px;
}

.product-title {
    display: block;

    color: var(--text);

    text-decoration: none;

    font-size: 12px;
    font-weight: 800;

    line-height: 1.4;

    min-height: 34px;
}

.seller-row {
    display: flex;
    align-items: center;

    gap: 8px;

    margin-top: 12px;
}

.seller-avatar {
    width: 27px;
    height: 27px;

    flex: 0 0 auto;

    display: grid;
    place-items: center;

    border-radius: 8px;

    background:
        rgba(0,217,255,.08);

    color: var(--blue);

    font-size: 8px;
    font-weight: 900;
}

.seller-info {
    min-width: 0;

    display: flex;
    flex-direction: column;

    gap: 2px;
}

.seller-info strong {
    font-size: 9px;

    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.seller-info span {
    color: var(--muted);

    font-size: 8px;
}

.seller-rating {
    margin-left: auto;

    display: flex;
    align-items: center;
    gap: 3px;

    color: #ffd86b;

    font-size: 9px;
}

.seller-rating svg {
    width: 11px;
    height: 11px;

    fill: currentColor;
}

.seller-rating small {
    color: var(--muted);
}

.product-bottom {
    display: flex;
    align-items: center;
    justify-content: space-between;

    margin-top: 13px;
}

.product-bottom-actions {
    display: flex;
    align-items: center;
    gap: 8px;
}

.cart-mini-btn {
    width: 32px;
    height: 32px;

    display: grid;
    place-items: center;

    border: 1px solid var(--border);
    border-radius: 9px;

    background: transparent;
    color: var(--muted);

    cursor: pointer;
}

.cart-mini-btn:hover {
    color: var(--blue);
    border-color: rgba(0,217,255,.3);
}

.product-price {
    color: var(--gold-bright);

    font-size: 16px;
    font-weight: 950;

    text-shadow: 0 0 16px rgba(212,169,74,.22);
}

.save-btn {
    width: 32px;
    height: 32px;

    display: grid;
    place-items: center;

    border:
        1px solid
        var(--border);

    border-radius: 9px;

    background:
        transparent;

    color: var(--muted);

    cursor: pointer;
}

.empty {
    grid-column: 1 / -1;

    padding: 80px 20px;

    text-align: center;

    color: var(--muted);
}

.empty svg {
    width: 45px;
    margin-bottom: 15px;
}

.empty h3 {
    color: var(--text);

    font-size: 15px;
}

.overlay {
    position: fixed;

    inset: 0;

    background:
        rgba(0,0,0,.55);

    opacity: 0;

    pointer-events: none;

    transition: .2s;

    z-index: 50;
}

.overlay.open {
    opacity: 1;

    pointer-events: auto;
}

.cart {
    position: fixed;

    top: 0;
    right: 0;
    bottom: 0;

    width: min(
        390px,
        100%
    );

    display: flex;
    flex-direction: column;

    background:
        #07111c;

    border-left:
        1px solid
        var(--border);

    transform:
        translateX(100%);

    transition: .25s;

    z-index: 60;
}

.cart.open {
    transform:
        translateX(0);
}

.cart-head {
    display: flex;
    align-items: center;
    justify-content: space-between;

    padding: 18px;

    border-bottom:
        1px solid
        var(--border);
}

.cart-title {
    font-size: 16px;
    font-weight: 900;
}

.cart-title span {
    color: var(--blue);
}

.cart-items {
    flex: 1;

    overflow-y: auto;

    padding: 15px;
}

.cart-empty {
    min-height: 300px;

    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    color: var(--muted);

    gap: 8px;
}

.cart-empty svg {
    width: 35px;
}

.cart-item {
    display: flex;
    align-items: center;

    gap: 10px;

    padding: 10px 0;

    border-bottom:
        1px solid
        rgba(0,217,255,.08);
}

.cart-item img {
    width: 60px;
    height: 60px;

    flex: 0 0 auto;

    border-radius: 9px;

    object-fit: cover;
}

.cart-item-info {
    flex: 1;

    min-width: 0;
}

.cart-item-title {
    font-size: 11px;
    font-weight: 800;

    line-height: 1.4;
}

.cart-item-price {
    margin-top: 5px;

    color: var(--blue);

    font-size: 10px;
    font-weight: 800;
}

.cart-remove {
    width: 27px;
    height: 27px;

    border: none;

    border-radius: 7px;

    background:
        rgba(255,255,255,.05);

    color: var(--muted);

    cursor: pointer;
}

.cart-foot {
    padding: 18px;

    border-top:
        1px solid
        var(--border);
}

.cart-total {
    display: flex;
    align-items: center;
    justify-content: space-between;

    margin-bottom: 12px;

    color: var(--muted);

    font-size: 11px;
}

.cart-total strong {
    color: var(--text);

    font-size: 15px;
}

.checkout {
    width: 100%;

    padding: 13px;

    border: none;

    border-radius: 11px;

    background:
        linear-gradient(
            135deg,
            var(--blue),
            var(--blue2)
        );

    color: #001018;

    font-weight: 900;

    cursor: pointer;
}

.toast {
    position: fixed;

    left: 50%;
    bottom: 25px;

    transform:
        translate(-50%, 20px);

    opacity: 0;

    padding: 10px 15px;

    border:
        1px solid
        var(--border);

    border-radius: 10px;

    background:
        #07111c;

    color: var(--text);

    font-size: 11px;

    transition: .2s;

    z-index: 100;
}

.toast.show {
    opacity: 1;

    transform:
        translate(-50%, 0);
}

.mobile-nav {
    display: none;
}

@media (max-width: 900px) {

    .sidebar {
        display: none;
    }

    .main {
        margin-left: 0;
    }

    .mobile-brand {
        display: flex;
        align-items: center;
        gap: 8px;

        font-weight: 900;
    }

    .mobile-brand .brand-mark {
        width: 30px;
        height: 30px;
    }

    .header-top {
        flex-wrap: wrap;

        padding: 12px;
    }

    .search {
        order: 3;

        flex-basis: 100%;
        max-width: none;
    }

    .content {
        padding: 20px 14px 90px;
    }

    .hero {
        align-items: flex-start;

        flex-direction: column;
    }

    .mobile-nav {
        position: fixed;

        left: 0;
        right: 0;
        bottom: 0;

        display: flex;

        justify-content: space-around;

        padding: 9px;

        background:
            rgba(3,6,11,.95);

        border-top:
            1px solid
            var(--border);

        z-index: 30;
    }

    .mobile-nav a {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 3px;

        color: var(--muted);

        text-decoration: none;

        font-size: 8px;
        font-weight: 800;
    }

    .mobile-nav a.active {
        color: var(--blue);
    }

    .mobile-nav svg {
        width: 17px;
    }

    .products-grid {
        grid-template-columns:
            repeat(
                2,
                minmax(0,1fr)
            );

        gap: 10px;
    }

    .product-body {
        padding: 10px;
    }

    .product-title {
        font-size: 10px;
    }

    .product-price {
        font-size: 13px;
    }

    .seller-rating {
        display: none;
    }

}

@media (min-width: 1400px) {

    .products-grid {
        grid-template-columns:
            repeat(
                4,
                minmax(0,1fr)
            );
    }

}

</style>

</head>

<body>

<aside class="sidebar">

    <div>

        <div class="brand">

            <div class="brand-mark">
                OG
            </div>

            <div class="brand-name">
                SAMII
                <span>
                    TECHNOLOGY
                </span>
            </div>

        </div>

        <nav>

            <a
                href="/qg"
                class="side-link"
            >
                <i data-lucide="layout-dashboard"></i>
                <span data-i18n="marketplace.nav.qg">QG Central</span>
            </a>

            <a
                href="/marketplace"
                class="side-link active"
            >
                <i data-lucide="store"></i>
                <span data-i18n="marketplace.nav.marketplace">Marketplace</span>
            </a>

            <a
                href="/community"
                class="side-link"
            >
                <i data-lucide="users"></i>
                <span data-i18n="marketplace.nav.community">Communauté</span>
            </a>

            <a
                href="/marketplace/services-demandes"
                class="side-link"
            >
                <i data-lucide="concierge-bell"></i>
                <span data-i18n="marketplace.nav.services">Demandes de service</span>
            </a>

            <a
                href="/discussions"
                class="side-link"
            >
                <i data-lucide="message-circle"></i>
                <span data-i18n="marketplace.nav.discussions">Discussions</span>
            </a>

            <a
                href="/arsenal"
                class="side-link"
            >
                <i data-lucide="shield-check"></i>
                <span data-i18n="marketplace.nav.arsenal">Arsenal</span>
            </a>

            <a
                href="/academy"
                class="side-link"
            >
                <i data-lucide="graduation-cap"></i>
                <span data-i18n="marketplace.nav.academy">Academy</span>
            </a>

        </nav>

    </div>

    <div class="side-bottom">

        <div class="side-ai">
            <span class="side-ai-dot"></span>
            <span data-i18n="marketplace.sideAi">SAMII ENGINE ACTIVE</span>
        </div>

        <div class="side-text" data-i18n="marketplace.sideText">
            Marketplace synchronisée avec
            l'écosystème SAMII.
        </div>

        <div class="og-lang-switch">
            <span data-lang-btn="fr">FR</span>
            <span data-lang-btn="en">EN</span>
            <span data-lang-btn="ar">AR</span>
            <span data-lang-btn="zh">ZH</span>
        </div>

    </div>

</aside>

<div class="main">

<header class="header">

    <div class="header-top">

        <div class="mobile-brand">

            <div class="brand-mark">
                OG
            </div>

            SAMII

        </div>

        <form
            class="search"
            method="GET"
            action="/marketplace"
        >

            <select name="categorie">
                ${categoryOptionsHtml}
            </select>

            <div
                style="
                    flex:1;
                    display:flex;
                "
            >

                <input
                    type="search"
                    name="recherche"
                    placeholder="Rechercher..."
                    data-i18n-placeholder="marketplace.searchPlaceholder"
                    value="${escapeHtml(recherche || "")}"
                >

            </div>

            <button type="submit">
                <i data-lucide="search"></i>
            </button>

        </form>

        <div class="header-actions">

            <button
                class="icon-btn"
                id="themeBtn"
                type="button"
            >
                <i data-lucide="moon"></i>
            </button>

            <a
                class="icon-btn"
                href="/marketplace/favoris"
            >
                <i data-lucide="heart"></i>
            </a>

            <button
                class="icon-btn"
                type="button"
                onclick="toggleCart()"
            >

                <i data-lucide="shopping-cart"></i>

                <span
                    class="badge-count"
                    id="cartBadge"
                    style="display:none;"
                >
                    0
                </span>

            </button>

            <a
                href="/marketplace/publier"
                class="publish-btn"
            >
                <i data-lucide="plus"></i>
                <span data-i18n="marketplace.publish">Publier</span>
            </a>

        </div>

    </div>

    <div class="region-row">

        <a
            href="/marketplace"
            class="region-chip ${!region ? "active" : ""}"
        >
            <i data-lucide="globe"></i>
            <span data-i18n="marketplace.allRegions">Toutes régions</span>
        </a>

        ${regionChipsHtml}

    </div>

    <div class="services-row">

        ${SERVICES_CHIPS_HTML}

    </div>

</header>

<main class="content">

    <section class="hero">

        <div>

            <div class="hero-kicker">

                <span class="live-dot"></span>

                <span data-i18n="marketplace.live">SAMII MARKETPLACE · LIVE</span>

            </div>

            <h1>
                <span data-i18n="marketplace.heroTitle1">Découvrez.</span>
                <span class="hero-accent" data-i18n="marketplace.heroTitle2">Achetez.</span>
                <span data-i18n="marketplace.heroTitle3">Connectez.</span>
            </h1>

            <p>
                ${toutesAnnonces.length}
                annonce${toutesAnnonces.length !== 1 ? "s" : ""}
                disponible${toutesAnnonces.length !== 1 ? "s" : ""}
                ${region ? " — " + escapeHtml(getRegionLabel(region)) : ""}
            </p>

        </div>

        <div class="hero-actions">

            <a
                href="/marketplace/favoris"
                class="filter-btn"
            >
                <i data-lucide="heart"></i>
                <span data-i18n="marketplace.favoris">Mes favoris</span>
            </a>

        </div>

    </section>

    <section class="products-grid">

        ${
            toutesAnnonces.length
                ? cardsHtml
                : `
                    <div class="empty">

                        <i data-lucide="package-search"></i>

                        <h3 data-i18n="marketplace.emptyTitle">
                            Aucun produit trouvé
                        </h3>

                    </div>
                  `
        }

    </section>

</main>

</div>

<div
    id="overlay"
    class="overlay"
    onclick="toggleCart()"
></div>

<aside
    id="cart"
    class="cart"
>

    <div class="cart-head">

        <div class="cart-title">
            Mon panier
            <span>SAMII</span>
        </div>

        <button
            class="icon-btn"
            onclick="toggleCart()"
        >
            <i data-lucide="x"></i>
        </button>

    </div>

    <div
        id="cartItems"
        class="cart-items"
    ></div>

    <div class="cart-foot">

        <div class="cart-total">

            <span>
                Total
            </span>

            <strong id="cartTotal">
                0
            </strong>

        </div>

        <button
            class="checkout"
            onclick="checkout()"
        >
            Commander
        </button>

    </div>

</aside>

<div
    class="toast"
    id="toast"
></div>

<nav class="mobile-nav">

    <a href="/qg">
        <i data-lucide="layout-dashboard"></i>
        QG
    </a>

    <a
        href="/marketplace"
        class="active"
    >
        <i data-lucide="store"></i>
        Marché
    </a>

    <a href="/community">
        <i data-lucide="users"></i>
        Communauté
    </a>

    <a href="/arsenal">
        <i data-lucide="shield-check"></i>
        Arsenal
    </a>

</nav>

<script>

if (
    typeof lucide !== "undefined"
) {
    lucide.createIcons();
}

// --------------------------------------------------------------------------
// THEME
// --------------------------------------------------------------------------

const themeState =
    localStorage.getItem(
        "samii_market_theme"
    );

if (
    themeState === "light"
) {
    document.body.classList.add(
        "light"
    );
}

function updateThemeIcon() {

    const button =
        document.getElementById(
            "themeBtn"
        );

    if (!button) {
        return;
    }

    button.innerHTML =
        document.body.classList.contains("light")
            ? '<i data-lucide="sun"></i>'
            : '<i data-lucide="moon"></i>';

    if (
        typeof lucide !== "undefined"
    ) {
        lucide.createIcons();
    }
}

updateThemeIcon();

document
    .getElementById("themeBtn")
    ?.addEventListener(
        "click",
        () => {

            document.body.classList.toggle(
                "light"
            );

            localStorage.setItem(
                "samii_market_theme",
                document.body.classList.contains(
                    "light"
                )
                    ? "light"
                    : "dark"
            );

            updateThemeIcon();
        }
    );

// --------------------------------------------------------------------------
// TOAST
// --------------------------------------------------------------------------

function showToast(message) {

    const toast =
        document.getElementById(
            "toast"
        );

    if (!toast) {
        return;
    }

    toast.textContent =
        message;

    toast.classList.add(
        "show"
    );

    setTimeout(
        () =>
            toast.classList.remove(
                "show"
            ),
        2200
    );
}

// --------------------------------------------------------------------------
// FAVORITES
// --------------------------------------------------------------------------

async function toggleFavorite(
    id,
    isReal,
    button
) {

    if (!isReal) {

        showToast(
            "Annonce de démonstration."
        );

        return;
    }

    try {

        const response =
            await fetch(
                "/marketplace/favoris/toggle",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            annonce_id: id
                        })
                }
            );

        const json =
            await response.json();

        if (json.success) {

            document
                .querySelectorAll(
                    '[data-product-id="' +
                    id +
                    '"] .favorite-btn, ' +
                    '[data-product-id="' +
                    id +
                    '"] .save-btn'
                )
                .forEach(
                    element =>
                        element.classList.toggle(
                            "saved",
                            json.favorited
                        )
                );

            showToast(
                json.favorited
                    ? "❤️ Ajouté"
                    : "Retiré"
            );

        } else {

            showToast(
                json.error ||
                "Impossible de modifier le favori."
            );
        }

    } catch (error) {

        console.error(
            error
        );

        showToast(
            "Erreur réseau."
        );
    }
}

// --------------------------------------------------------------------------
// PHOTO DOTS
// --------------------------------------------------------------------------

// Délégation sur document (au lieu d'attacher un listener par point au
// chargement) : fonctionne même si une erreur ailleurs dans ce script
// interrompt l'exécution avant ce bloc, et couvre aussi les cartes
// ajoutées dynamiquement plus tard.
document.addEventListener("click", event => {
    const dot = event.target.closest(".photo-dot");
    if (!dot) return;

    event.preventDefault();
    event.stopPropagation();

    const card = dot.closest(".product-card");
    const image = card?.querySelector(".product-main-img");
    if (image && dot.dataset.photo) {
        image.src = dot.dataset.photo;
    }

    card?.querySelectorAll(".photo-dot").forEach(d => d.classList.remove("active"));
    dot.classList.add("active");
});

// --------------------------------------------------------------------------
// CART
// --------------------------------------------------------------------------

let cart = [];

try {

    cart =
        JSON.parse(
            localStorage.getItem(
                "samii_market_cart"
            ) || "[]"
        );

    if (!Array.isArray(cart)) {
        cart = [];
    }

} catch {

    cart = [];
}

function updateCartBadge() {

    const badge =
        document.getElementById(
            "cartBadge"
        );

    if (!badge) {
        return;
    }

    if (cart.length > 0) {

        badge.style.display =
            "flex";

        badge.textContent =
            cart.reduce(
                (sum, item) =>
                    sum +
                    Number(
                        item.quantity || 1
                    ),
                0
            );

    } else {

        badge.style.display =
            "none";
    }
}

function toggleCart() {

    document
        .getElementById("cart")
        ?.classList.toggle(
            "open"
        );

    document
        .getElementById("overlay")
        ?.classList.toggle(
            "open"
        );

    renderCart();
}

function quickAdd(product) {

    const existing =
        cart.find(
            item =>
                String(item.id) ===
                String(product.id)
        );

    if (existing) {

        existing.quantity =
            Number(
                existing.quantity || 1
            ) + 1;

    } else {

        cart.push({
            ...product,
            quantity: 1
        });
    }

    saveCart();

    showToast(
        "🛒 Ajouté"
    );

    updateCartBadge();
}

function removeFromCart(index) {

    if (
        index < 0 ||
        index >= cart.length
    ) {
        return;
    }

    cart.splice(
        index,
        1
    );

    saveCart();

    renderCart();

    updateCartBadge();
}

function saveCart() {

    localStorage.setItem(
        "samii_market_cart",
        JSON.stringify(cart)
    );
}

function escapeHtmlClient(value) {

    return String(
        value ?? ""
    ).replace(
        /[&<>"']/g,
        character =>
            ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#039;"
            })[character]
    );
}

function renderCart() {

    const container =
        document.getElementById(
            "cartItems"
        );

    const total =
        document.getElementById(
            "cartTotal"
        );

    if (!container || !total) {
        return;
    }

    if (!cart.length) {

        container.innerHTML =
            '<div class="cart-empty">' +
                '<i data-lucide="shopping-bag"></i>' +
                '<p>Panier vide.</p>' +
            '</div>';

        total.textContent =
            "0";

        if (
            typeof lucide !== "undefined"
        ) {
            lucide.createIcons();
        }

        return;
    }

    let html = "";

    cart.forEach(
        (item, index) => {

            const image =
                item.photo
                    ? '<img src="' +
                        escapeHtmlClient(
                            item.photo
                        ) +
                        '" alt="">'
                    : '<div style="' +
                        'width:60px;' +
                        'height:60px;' +
                        'border-radius:9px;' +
                        'background:#07121d;' +
                      '"></div>';

            html +=
                '<div class="cart-item">' +
                    image +

                    '<div class="cart-item-info">' +

                        '<div class="cart-item-title">' +
                            escapeHtmlClient(
                                item.titre
                            ) +
                        '</div>' +

                        '<div class="cart-item-price">' +
                            escapeHtmlClient(
                                item.prix
                            ) +
                            " · x" +
                            Number(
                                item.quantity || 1
                            ) +
                        '</div>' +

                    '</div>' +

                    '<button ' +
                        'class="cart-remove" ' +
                        'type="button" ' +
                        'onclick="removeFromCart(' +
                            index +
                        ')" ' +
                        'aria-label="Supprimer">' +
                        '×' +
                    '</button>' +

                '</div>';
        }
    );

    container.innerHTML =
        html;

    total.textContent =
        cart.length +
        " article" +
        (
            cart.length > 1
                ? "s"
                : ""
        );

    if (
        typeof lucide !== "undefined"
    ) {
        lucide.createIcons();
    }
}

function checkout() {

    if (!cart.length) {

        showToast(
            "Panier vide."
        );

        return;
    }

    showToast(
        "🚀 Redirection vers la commande..."
    );
}

renderCart();
updateCartBadge();

</script>

<script src="/js/i18n.js"></script>

</body>
</html>
`);
});

// ==========================================================================
// FAVORITES TOGGLE
// ==========================================================================

router.post(
    "/favoris/toggle",
    requireAuth,
    async (req, res) => {

        try {

            const userId =
                req.session.userId;

            const annonceId =
                parseInt(
                    req.body.annonce_id,
                    10
                );

            if (
                !userId ||
                !annonceId
            ) {
                return res.json({
                    success: false,
                    error:
                        "Requête invalide."
                });
            }

            const existing =
                await db.query(
                    `
                    SELECT id
                    FROM favoris
                    WHERE user_id = $1
                    AND annonce_id = $2
                    `,
                    [
                        userId,
                        annonceId
                    ]
                );

            if (
                existing.length > 0
            ) {

                await db.query(
                    `
                    DELETE FROM favoris
                    WHERE id = $1
                    `,
                    [
                        existing[0].id
                    ]
                );

                return res.json({
                    success: true,
                    favorited: false
                });
            }

            await db.query(
                `
                INSERT INTO favoris
                (
                    user_id,
                    annonce_id
                )
                VALUES
                (
                    $1,
                    $2
                )
                `,
                [
                    userId,
                    annonceId
                ]
            );

            return res.json({
                success: true,
                favorited: true
            });

        } catch (err) {

            console.error(
                "❌ favoris/toggle :",
                err.message
            );

            return res.json({
                success: false,
                error:
                    "Erreur serveur."
            });
        }
    }
);

// ==========================================================================
// FAVORITES PAGE
// ==========================================================================

router.get(
    "/favoris",
    requireAuth,
    async (req, res) => {

        let annonces = [];

        try {

            annonces =
                await db.query(
                    `
                    SELECT
                        a.*
                    FROM annonces a

                    INNER JOIN favoris f
                        ON f.annonce_id = a.id

                    WHERE
                        f.user_id = $1

                    AND
                        a.actif = true

                    ORDER BY
                        f.created_at DESC
                    `,
                    [
                        req.session.userId
                    ]
                );

        } catch (err) {

            console.error(
                "❌ favoris list :",
                err.message
            );
        }

        const html =
            annonces.length

                ? annonces
                    .map(
                        annonce => {

                            const photos =
                                parsePhotos(
                                    annonce.photo_url,
                                    annonce.photos_urls
                                );

                            return `
                                <article
                                    class="product-card"
                                >

                                    <div
                                        class="product-media"
                                    >

                                        <a
                                            href="/marketplace/produit/${annonce.id}"
                                            class="product-image-link"
                                        >

                                            ${
                                                photos.length
                                                    ? `
                                                        <img
                                                            src="${escapeHtml(photos[0])}"
                                                            alt="${escapeHtml(annonce.titre)}"
                                                            referrerpolicy="no-referrer"
                                                        >
                                                      `
                                                    : `
                                                        <div
                                                            style="
                                                                width:100%;
                                                                aspect-ratio:1/1;
                                                                display:grid;
                                                                place-items:center;
                                                                color:#7f96a8;
                                                            "
                                                        >
                                                            <i data-lucide="image"></i>
                                                        </div>
                                                      `
                                            }

                                        </a>

                                    </div>

                                    <div
                                        class="product-body"
                                    >

                                        <a
                                            href="/marketplace/produit/${annonce.id}"
                                            class="product-title"
                                        >
                                            ${escapeHtml(annonce.titre)}
                                        </a>

                                        <div
                                            class="product-price"
                                        >
                                            ${escapeHtml(
                                                annonce.prix ||
                                                "Sur devis"
                                            )}
                                        </div>

                                    </div>

                                </article>
                            `;
                        }
                    )
                    .join("")

                : `
                    <div class="empty">
                        <i data-lucide="heart-off"></i>
                        <h3>
                            Aucun favori
                        </h3>
                    </div>
                  `;

        res.send(`
<!DOCTYPE html>

<html lang="fr">

<head>

<meta charset="UTF-8">

<meta
    name="viewport"
    content="width=device-width,initial-scale=1"
>

<title>
    Favoris — SAMII
</title>

<script src="https://unpkg.com/lucide@latest"></script>

<style>

body {
    background: #03060b;
    color: #f5fbff;
    font-family: Inter, sans-serif;
    padding: 24px;
}

a {
    color: #00d9ff;
}

.products-grid {
    display: grid;

    grid-template-columns:
        repeat(
            auto-fill,
            minmax(200px,1fr)
        );

    gap: 14px;

    max-width: 1200px;

    margin: 20px auto;
}

.product-card {
    border:
        1px solid
        rgba(212,169,74,.35);

    border-radius: 16px;

    overflow: hidden;

    background:
        rgba(9,18,29,.88);
}

.product-media img {
    width: 100%;

    aspect-ratio: 1 / 1;

    object-fit: cover;

    display: block;
}

.product-body {
    padding: 12px;
}

.product-title {
    display: block;

    color: #f5fbff;

    text-decoration: none;

    font-size: 12px;

    margin-bottom: 6px;
}

.product-price {
    color: #F2CC78;

    font-weight: 800;
}

.empty {
    text-align: center;

    padding: 60px;

    color: #7f96a8;
}

</style>

</head>

<body>

<a href="/marketplace">
    ← Retour
</a>

<h1>
    ❤️ Mes favoris
</h1>

<div class="products-grid">
    ${html}
</div>

<script>

if (
    typeof lucide !== "undefined"
) {
    lucide.createIcons();
}

</script>

</body>

</html>
`);
    }
);

// ==========================================================================
// AVIS
// ==========================================================================

router.post(
    "/avis",
    requireAuth,
    async (req, res) => {

        try {

            const {
                vendeur_id,
                note,
                commentaire
            } = req.body;

            const n =
                parseInt(
                    note,
                    10
                );

            if (
                !vendeur_id ||
                !n ||
                n < 1 ||
                n > 5
            ) {
                return res.json({
                    success: false,
                    error:
                        "Note invalide."
                });
            }

            await db.query(
                `
                INSERT INTO avis
                (
                    cible_type,
                    cible_id,
                    auteur_id,
                    note,
                    commentaire
                )
                VALUES
                (
                    'vendeur',
                    $1,
                    $2,
                    $3,
                    $4
                )
                `,
                [
                    vendeur_id,
                    req.session.userId,
                    n,
                    commentaire || ""
                ]
            );

            return res.json({
                success: true
            });

        } catch (err) {

            console.error(
                "❌ avis :",
                err.message
            );

            return res.json({
                success: false,
                error:
                    "Erreur serveur."
            });
        }
    }
);

// ==========================================================================
// PRODUCT
// ==========================================================================

router.get(
    "/produit/:id",
    requireAuth,
    async (req, res) => {

        const id =
            parseInt(
                req.params.id,
                10
            );

        if (!id) {
            return res.redirect(
                "/marketplace"
            );
        }

        let produit = null;
        let avisListe = [];

        let notes = {
            moyenne: 0,
            total: 0
        };

        try {

            const rows =
                await db.query(
                    `
                    SELECT *
                    FROM annonces
                    WHERE
                        id = $1
                    AND
                        actif = true
                    `,
                    [id]
                );

            produit =
                rows[0];

            if (!produit) {

                return res.redirect(
                    "/marketplace"
                );
            }

            avisListe =
                await db.query(
                    `
                    SELECT
                        a.*,
                        u.prenom,
                        u.nom

                    FROM avis a

                    LEFT JOIN utilisateurs u
                        ON u.id = a.auteur_id

                    WHERE
                        a.cible_type = 'vendeur'

                    AND
                        a.cible_id = $1

                    ORDER BY
                        a.created_at DESC

                    LIMIT 20
                    `,
                    [
                        produit.vendeur_id
                    ]
                );

            if (
                avisListe.length
            ) {

                const total =
                    avisListe.reduce(
                        (
                            sum,
                            avis
                        ) =>
                            sum +
                            Number(
                                avis.note
                            ),
                        0
                    );

                notes = {
                    moyenne:
                        (
                            total /
                            avisListe.length
                        ).toFixed(1),

                    total:
                        avisListe.length
                };
            }

        } catch (err) {

            console.error(
                "❌ produit :",
                err.message
            );

            return res.redirect(
                "/marketplace"
            );
        }

        const photos =
            parsePhotos(
                produit.photo_url,
                produit.photos_urls
            );

        const avisHtml =
            avisListe.length

                ? avisListe
                    .map(
                        avis => {

                            const note =
                                Math.max(
                                    1,
                                    Math.min(
                                        5,
                                        Number(
                                            avis.note
                                        )
                                    )
                                );

                            return `
                                <div
                                    style="
                                        border:
                                            1px solid
                                            rgba(0,217,255,.16);

                                        border-radius:
                                            12px;

                                        padding:
                                            14px;

                                        margin-bottom:
                                            8px;

                                        background:
                                            rgba(9,18,29,.88);
                                    "
                                >

                                    <strong>
                                        ${escapeHtml(
                                            (
                                                avis.prenom ||
                                                "Client"
                                            ) +
                                            " " +
                                            (
                                                avis.nom
                                                    ? avis.nom[0] + "."
                                                    : ""
                                            )
                                        )}
                                    </strong>

                                    —

                                    <span>
                                        ${"★".repeat(note)}
                                        ${"☆".repeat(5 - note)}
                                    </span>

                                    ${
                                        avis.commentaire
                                            ? `
                                                <p
                                                    style="
                                                        color:#7f96a8;
                                                        margin:6px 0 0;
                                                    "
                                                >
                                                    ${escapeHtml(
                                                        avis.commentaire
                                                    )}
                                                </p>
                                              `
                                            : ""
                                    }

                                </div>
                            `;
                        }
                    )
                    .join("")

                : `
                    <p
                        style="
                            color:#7f96a8;
                        "
                    >
                        Aucun avis pour l'instant.
                    </p>
                  `;

        res.send(`
<!DOCTYPE html>

<html lang="fr">

<head>

<meta charset="UTF-8">

<meta
    name="viewport"
    content="width=device-width,initial-scale=1"
>

<title>
    ${escapeHtml(produit.titre)}
</title>

<script src="https://unpkg.com/lucide@latest"></script>

<style>

body {
    background: #03060b;
    color: #f5fbff;

    font-family:
        Inter,
        system-ui,
        sans-serif;

    margin: 0;

    padding: 24px;
}

a {
    color: #00d9ff;
}

img {
    max-width: 100%;

    border-radius: 16px;
}

.price {
    font-size: 28px;

    color: #00d9ff;

    font-weight: 800;

    margin: 14px 0;
}

button {
    padding: 12px 20px;

    border: none;

    border-radius: 12px;

    background: #00d9ff;

    color: #001018;

    font-weight: 800;

    cursor: pointer;

    margin-top: 10px;
}

</style>

</head>

<body>

<a href="/marketplace">
    ← Retour
</a>

<div
    style="
        max-width:900px;
        margin:20px auto;
    "
>

    ${
        photos.length
            ? `
                <img
                    src="${escapeHtml(photos[0])}"
                    alt="${escapeHtml(produit.titre)}"
                    referrerpolicy="no-referrer"
                >
              `
            : ""
    }

    <h1>
        ${escapeHtml(produit.titre)}
    </h1>

    <div class="price">
        ${escapeHtml(
            produit.prix ||
            "Sur devis"
        )}
    </div>

    <p
        style="
            color:#7f96a8;
        "
    >
        ${escapeHtml(
            produit.pays ||
            ""
        )}

        ${
            produit.ville
                ? " · " +
                  escapeHtml(
                      produit.ville
                  )
                : ""
        }
    </p>

    ${
        produit.description
            ? `
                <p
                    style="
                        color:#c5cdd5;
                        line-height:1.7;
                    "
                >
                    ${escapeHtml(
                        produit.description
                    )}
                </p>
              `
            : ""
    }

    <button
        type="button"
        onclick="
            fetch(
                '/marketplace/favoris/toggle',
                {
                    method:'POST',
                    headers:{
                        'Content-Type':
                            'application/json'
                    },
                    body:JSON.stringify({
                        annonce_id:${id}
                    })
                }
            )
            .then(() =>
                location.reload()
            )
        "
    >
        ❤️ Favori
    </button>

    <h2
        style="
            margin-top:30px;
        "
    >
        Avis (${notes.total})
    </h2>

    ${avisHtml}

</div>

</body>

</html>
`);
    }
);

// ==========================================================================
// SERVICES — DEMANDES
// ==========================================================================

router.get(
    "/services-demandes",
    requireAuth,
    async (req, res) => {

        let demandes = [];

        try {

            demandes =
                await db.query(
                    `
                    SELECT
                        p.*,
                        u.prenom,
                        u.nom

                    FROM publications p

                    LEFT JOIN utilisateurs u
                        ON u.id = p.auteur_id

                    WHERE
                        p.categorie = 'service'

                    ORDER BY
                        p.created_at DESC

                    LIMIT 30
                    `
                );

        } catch (err) {

            console.error(
                "❌ services-demandes :",
                err.message
            );
        }

        const listHtml =
            demandes.length

                ? demandes
                    .map(
                        demande => `
                            <div
                                style="
                                    border:
                                        1px solid
                                        rgba(0,217,255,.16);

                                    border-radius:
                                        14px;

                                    padding:
                                        16px;

                                    margin-bottom:
                                        10px;

                                    background:
                                        rgba(9,18,29,.88);
                                "
                            >

                                <strong>
                                    ${escapeHtml(
                                        demande.prenom ||
                                        "Membre"
                                    )}

                                    ${escapeHtml(
                                        demande.nom ||
                                        ""
                                    )}
                                </strong>

                                <p
                                    style="
                                        color:#7f96a8;
                                        margin-top:8px;
                                    "
                                >
                                    ${escapeHtml(
                                        demande.contenu ||
                                        ""
                                    )}
                                </p>

                            </div>
                        `
                    )
                    .join("")

                : `
                    <p
                        style="
                            color:#7f96a8;
                        "
                    >
                        Aucune demande de service
                        pour l'instant.
                    </p>
                  `;

        res.send(`
<!DOCTYPE html>

<html lang="fr">

<head>

<meta charset="UTF-8">

<meta
    name="viewport"
    content="width=device-width,initial-scale=1"
>

<title>
    Services — SAMII
</title>

<style>

body {
    background:#03060b;

    color:#f5fbff;

    font-family:
        Inter,
        system-ui,
        sans-serif;

    padding:24px;

    max-width:800px;

    margin:0 auto;
}

a {
    color:#00d9ff;
}

</style>

</head>

<body>

<a href="/marketplace">
    ← Retour Marketplace
</a>

<h1>
    🛎️ Demandes de service
</h1>

<p
    style="
        color:#7f96a8;
    "
>
    Ces demandes proviennent
    de la Communauté SAMII.
</p>

${listHtml}

</body>

</html>
`);
    }
);

// ==========================================================================
// PUBLISH PAGE
// ==========================================================================

router.get(
    "/publier",
    requireAuth,
    async (req, res) => {

        const serviceQuery =
            (SERVICES_RAPIDES || [])
                .find(s => s.id === req.query.service);

        const preselectedCategorie =
            serviceQuery
                ? `service-${serviceQuery.id}`
                : "";

        const preselectedTitre =
            serviceQuery
                ? `${serviceQuery.label} — `
                : "";

        const opts =
            (CATEGORIES || [])
                .filter(
                    category =>
                        category.id !== "tous"
                )
                .map(
                    category => `
                        <option
                            value="${escapeHtml(category.id)}"
                        >
                            ${escapeHtml(
                                category.label
                            )}
                        </option>
                    `
                )
                .join("");

        const optsServices =
            (SERVICES_RAPIDES || [])
                .map(
                    service => `
                        <option
                            value="service-${escapeHtml(service.id)}"
                            ${preselectedCategorie === `service-${service.id}` ? "selected" : ""}
                        >
                            ${service.emoji} ${escapeHtml(service.label)}
                        </option>
                    `
                )
                .join("");

        const optsReg =
            (SUPPLIER_REGIONS || [])
                .map(
                    region => `
                        <option
                            value="${escapeHtml(region.id)}"
                        >
                            ${escapeHtml(
                                region.label
                            )}
                        </option>
                    `
                )
                .join("");

        const erreur =
            req.query.erreur
                ? `
                    <div
                        style="
                            margin-bottom:15px;
                            padding:12px;
                            border-radius:10px;
                            background:
                                rgba(255,70,70,.08);
                            border:
                                1px solid
                                rgba(255,70,70,.2);
                            color:#ff8c8c;
                            font-size:11px;
                        "
                    >
                        Impossible de publier
                        l'annonce.
                        Vérifie les champs
                        obligatoires.
                    </div>
                  `
                : "";

        res.send(`
<!DOCTYPE html>

<html lang="fr">

<head>

<meta charset="UTF-8">

<meta
    name="viewport"
    content="width=device-width,initial-scale=1"
>

<title>
    Publier — SAMII
</title>

<script src="https://unpkg.com/lucide@latest"></script>

<style>

:root {
    --blue:#00d9ff;
    --bg:#03070d;
    --panel:#091522;
    --text:#f5fbff;
    --muted:#8196a7;
    --border:rgba(0,217,255,.16);
}

* {
    box-sizing:border-box;
}

body {
    margin:0;

    min-height:100vh;

    display:flex;

    justify-content:center;

    padding:25px;

    background:var(--bg);

    color:var(--text);

    font-family:
        Inter,
        system-ui,
        sans-serif;
}

.form-box {
    width:100%;

    max-width:640px;

    padding:28px;

    border:
        1px solid
        var(--border);

    border-radius:22px;

    background:var(--panel);
}

a.back {
    color:var(--muted);

    text-decoration:none;

    font-size:12px;
}

h1 {
    margin:20px 0 8px;

    font-size:26px;
}

.group {
    margin-bottom:16px;
}

label {
    display:block;

    color:var(--muted);

    font-size:11px;

    font-weight:700;

    margin-bottom:6px;
}

input,
select,
textarea {
    width:100%;

    padding:12px;

    border-radius:10px;

    border:
        1px solid
        var(--border);

    background:
        rgba(0,0,0,.3);

    color:white;

    outline:none;

    font-family:inherit;
}

select option {
    background:#07101a;
}

.upload-zone {
    display:flex;

    gap:10px;

    flex-wrap:wrap;
}

.upload-slot {
    width:90px;
    height:90px;

    border-radius:12px;

    border:
        2px dashed
        var(--border);

    display:grid;

    place-items:center;

    color:var(--muted);

    cursor:pointer;

    position:relative;

    overflow:hidden;

    background:
        rgba(0,0,0,.2);
}

.upload-slot img {
    width:100%;
    height:100%;

    object-fit:cover;

    position:absolute;

    inset:0;
}

.upload-status {
    font-size:11px;

    color:var(--blue);

    margin-top:8px;

    min-height:16px;
}

.submit {
    width:100%;

    margin-top:14px;

    padding:15px;

    border:none;

    border-radius:13px;

    color:#001018;

    background:
        linear-gradient(
            135deg,
            var(--blue),
            #0077ff
        );

    font-weight:900;

    cursor:pointer;
}

.submit:disabled {
    opacity:.6;

    cursor:not-allowed;
}

</style>

</head>

<body>

<div class="form-box">

    <a
        href="/marketplace"
        class="back"
    >
        ← Retour à Marketplace
    </a>

    <h1>
        Publier sur
        <span
            style="
                color:#00d9ff;
            "
        >
            SAMII
        </span>
    </h1>

    ${erreur}

    <form id="formPublier">

        <div class="group">

            <label>
                Titre
            </label>

            <input
                type="text"
                name="titre"
                required
                maxlength="180"
                value="${escapeHtml(preselectedTitre)}"
            >

        </div>

        <div class="group">

            <label>
                Catégorie
            </label>

            <select
                name="categorie"
                required
            >

                <option value="">
                    Sélectionner...
                </option>

                <optgroup label="🧰 Services">
                    ${optsServices}
                </optgroup>

                <optgroup label="📦 Produits">
                    ${opts}
                </optgroup>

            </select>

        </div>

        <div class="group">

            <label>
                Région du fournisseur
                (optionnel)
            </label>

            <select
                name="region_fournisseur"
            >

                <option value="">
                    Non précisé
                </option>

                ${optsReg}

            </select>

        </div>

        <div class="group">

            <label>
                Prix
            </label>

            <input
                type="text"
                name="prix"
                required
                maxlength="100"
                placeholder="Ex : 250 €"
            >

        </div>

        <div class="group">

            <label>
                Pays
            </label>

            <input
                type="text"
                name="pays"
                required
                maxlength="100"
            >

        </div>

        <div class="group">

            <label>
                Ville
            </label>

            <input
                type="text"
                name="ville"
                maxlength="100"
            >

        </div>

        <div class="group">

            <label>
                Description
            </label>

            <textarea
                name="description"
                rows="5"
                maxlength="5000"
            ></textarea>

        </div>

        <div class="group">

            <label>
                Photos
                (clique pour ajouter)
            </label>

            <div
                class="upload-zone"
                id="uploadZone"
            >

                <div
                    class="upload-slot"
                    data-slot="0"
                    title="Ajouter une photo"
                >
                    <i data-lucide="plus"></i>
                </div>

                <div
                    class="upload-slot"
                    data-slot="1"
                    title="Ajouter une photo"
                >
                    <i data-lucide="plus"></i>
                </div>

                <div
                    class="upload-slot"
                    data-slot="2"
                    title="Ajouter une photo"
                >
                    <i data-lucide="plus"></i>
                </div>

            </div>

            <input
                type="file"
                id="fileInput"
                accept="image/*"
                style="display:none;"
            >

            <div
                class="upload-status"
                id="uploadStatus"
            ></div>

            <input
                type="hidden"
                name="photos_json"
                id="photosJson"
                value="[]"
            >

        </div>

        <button
            class="submit"
            id="submitButton"
            type="submit"
        >
            🚀 Publier sur SAMII
        </button>

    </form>

</div>

<script>

if (
    typeof lucide !== "undefined"
) {
    lucide.createIcons();
}

let uploadedPhotos = [];

let activeSlot = null;

const fileInput =
    document.getElementById(
        "fileInput"
    );

const statusElement =
    document.getElementById(
        "uploadStatus"
    );

const photosJson =
    document.getElementById(
        "photosJson"
    );

const submitButton =
    document.getElementById(
        "submitButton"
    );

// --------------------------------------------------------------------------
// SLOT CLICK
// --------------------------------------------------------------------------

document
    .querySelectorAll(
        ".upload-slot"
    )
    .forEach(
        slot => {

            slot.addEventListener(
                "click",
                () => {

                    activeSlot =
                        Number(
                            slot.dataset.slot
                        );

                    fileInput.value =
                        "";

                    fileInput.click();
                }
            );
        }
    );

// --------------------------------------------------------------------------
// CLOUDINARY UPLOAD
// --------------------------------------------------------------------------

fileInput.addEventListener(
    "change",
    async function () {

        const file =
            this.files?.[0];

        if (!file) {
            return;
        }

        if (
            !file.type.startsWith(
                "image/"
            )
        ) {

            statusElement.textContent =
                "❌ Fichier image invalide.";

            return;
        }

        if (
            file.size >
            10 * 1024 * 1024
        ) {

            statusElement.textContent =
                "❌ Image trop lourde (10 Mo maximum).";

            return;
        }

        if (
            activeSlot === null
        ) {
            return;
        }

        statusElement.textContent =
            "⏳ Envoi de la photo...";

        try {

            const formData =
                new FormData();

            formData.append(
                "file",
                file
            );

            formData.append(
                "upload_preset",
                "${CLOUDINARY_UPLOAD_PRESET}"
            );

            const response =
                await fetch(
                    "https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload",
                    {
                        method:"POST",
                        body:formData
                    }
                );

            const json =
                await response.json();

            if (
                !response.ok ||
                !json.secure_url
            ) {

                console.error(
                    "Cloudinary:",
                    json
                );

                statusElement.textContent =
                    "❌ Échec de l'envoi.";

                return;
            }

            uploadedPhotos[
                activeSlot
            ] =
                json.secure_url;

            const slot =
                document.querySelector(
                    '.upload-slot[data-slot="' +
                    activeSlot +
                    '"]'
                );

            if (slot) {

                slot.innerHTML =
                    '<img src="' +
                    escapeHtmlClient(
                        json.secure_url
                    ) +
                    '" alt="Photo">';
            }

            uploadedPhotos =
                uploadedPhotos
                    .filter(Boolean)
                    .slice(0,3);

            photosJson.value =
                JSON.stringify(
                    uploadedPhotos
                );

            statusElement.textContent =
                "✅ Photo ajoutée.";

            if (
                typeof lucide !== "undefined"
            ) {
                lucide.createIcons();
            }

            setTimeout(
                () => {

                    statusElement.textContent =
                        "";

                },
                1500
            );

        } catch (error) {

            console.error(
                error
            );

            statusElement.textContent =
                "❌ Erreur réseau.";

        }

    }
);

// --------------------------------------------------------------------------
// CLIENT ESCAPE
// --------------------------------------------------------------------------

function escapeHtmlClient(
    value
) {

    return String(
        value ?? ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}

// --------------------------------------------------------------------------
// PUBLISH
// --------------------------------------------------------------------------

document
    .getElementById(
        "formPublier"
    )
    .addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            if (
                submitButton.disabled
            ) {
                return;
            }

            const form =
                event.currentTarget;

            if (
                !form.checkValidity()
            ) {

                form.reportValidity();

                return;
            }

            submitButton.disabled =
                true;

            submitButton.textContent =
                "⏳ Publication...";

            try {

                const data =
                    Object.fromEntries(
                        new FormData(form)
                    );

                const response =
                    await fetch(
                        "/marketplace/publier",
                        {
                            method:"POST",

                            headers:{
                                "Content-Type":
                                    "application/json"
                            },

                            body:
                                JSON.stringify(
                                    data
                                )
                        }
                    );

                if (
                    response.redirected
                ) {

                    window.location.href =
                        response.url;

                    return;
                }

                if (
                    response.ok
                ) {

                    window.location.href =
                        "/marketplace";

                    return;
                }

                throw new Error(
                    "Publication refusée"
                );

            } catch (error) {

                console.error(
                    error
                );

                statusElement.textContent =
                    "❌ Impossible de publier l'annonce.";

                submitButton.disabled =
                    false;

                submitButton.textContent =
                    "🚀 Publier sur SAMII";
            }
        }
    );

</script>

</body>

</html>
`);
    }
);

// ==========================================================================
// PUBLISH POST
// ==========================================================================

router.post(
    "/publier",
    requireAuth,
    async (req, res) => {

        try {

            const {
                titre,
                categorie,
                prix,
                pays,
                ville,
                description,
                region_fournisseur,
                photos_json
            } = req.body;

            // --------------------------------------------------------------
            // CLEAN INPUT
            // --------------------------------------------------------------

            const cleanTitre =
                normalizeString(
                    titre
                );

            const cleanCategorie =
                normalizeString(
                    categorie
                );

            const cleanPrix =
                normalizeString(
                    prix
                );

            const cleanPays =
                normalizeString(
                    pays
                );

            const cleanVille =
                normalizeString(
                    ville
                );

            const cleanDescription =
                normalizeString(
                    description
                );

            const cleanRegion =
                normalizeString(
                    region_fournisseur
                );

            // --------------------------------------------------------------
            // REQUIRED
            // --------------------------------------------------------------

            if (
                !cleanTitre ||
                !cleanCategorie ||
                !cleanPrix ||
                !cleanPays
            ) {

                return res.redirect(
                    "/marketplace/publier?erreur=1"
                );
            }

            // --------------------------------------------------------------
            // CATEGORY VALIDATION
            // --------------------------------------------------------------

            const validCategory =
                (CATEGORIES || [])
                    .some(
                        category =>
                            category.id ===
                            cleanCategorie
                    ) ||
                (SERVICES_RAPIDES || [])
                    .some(
                        service =>
                            `service-${service.id}` ===
                            cleanCategorie
                    );

            if (!validCategory) {

                return res.redirect(
                    "/marketplace/publier?erreur=1"
                );
            }

            // --------------------------------------------------------------
            // REGION VALIDATION
            // --------------------------------------------------------------

            if (
                cleanRegion &&
                !(SUPPLIER_REGIONS || [])
                    .some(
                        region =>
                            region.id ===
                            cleanRegion
                    )
            ) {

                return res.redirect(
                    "/marketplace/publier?erreur=1"
                );
            }

            // --------------------------------------------------------------
            // PHOTOS
            // --------------------------------------------------------------

            let photosArray = [];

            try {

                const parsed =
                    JSON.parse(
                        photos_json ||
                        "[]"
                    );

                if (
                    Array.isArray(
                        parsed
                    )
                ) {

                    photosArray =
                        parsed
                            .filter(
                                value =>
                                    typeof value ===
                                    "string" &&
                                    isValidHttpUrl(
                                        value
                                    )
                            )
                            .slice(
                                0,
                                3
                            );
                }

            } catch {

                photosArray = [];
            }

            const photoUrl =
                photosArray[0] ||
                "";

            const photosJsonDb =
                photosArray.length
                    ? JSON.stringify(
                        photosArray
                    )
                    : null;

            // --------------------------------------------------------------
            // SELLER
            // --------------------------------------------------------------

            const vendeurId =
                req.session.userId;

            const nom =
                String(
                    req.session.nom ||
                    "Marchand OG"
                ).trim();

            if (!vendeurId) {

                return res.redirect(
                    "/marketplace/publier?erreur=1"
                );
            }

            // --------------------------------------------------------------
            // INSERT
            // --------------------------------------------------------------

            await db.query(
                `
                INSERT INTO annonces
                (
                    titre,
                    categorie,
                    prix,
                    pays,
                    ville,
                    description,
                    photo_url,
                    photos_urls,
                    region_fournisseur,
                    vendeur_id,
                    vendeur_nom,
                    type_vendeur,
                    actif
                )
                VALUES
                (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    $7,
                    $8,
                    $9,
                    $10,
                    $11,
                    'marchand',
                    true
                )
                `,
                [
                    cleanTitre,
                    cleanCategorie,
                    cleanPrix,
                    cleanPays,
                    cleanVille,
                    cleanDescription,
                    photoUrl,
                    photosJsonDb,
                    cleanRegion || null,
                    vendeurId,
                    nom
                ]
            );

            if (req.session.userId) {
                await gradeService.ajouterPoints(req.session.userId, 10, "Publication Marketplace");
            }

            return res.redirect(
                "/marketplace"
            );

        } catch (err) {

            console.error(
                "❌ publication :",
                err.message
            );

            return res.redirect(
                "/marketplace/publier?erreur=1"
            );
        }
    }
);

// ==========================================================================
// EXPORT
// ==========================================================================

module.exports = router;
