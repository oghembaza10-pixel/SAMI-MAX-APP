// ==========================================================================
// SAMII OS — MARKETPLACE
// OG TECHNOLOGY EDITION
// Premium Marketplace • Mobile First • Dark/Light • Favorites • Cart
// Country Detection • EUR/USD/GBP • AI Sellers • Airtable
// ==========================================================================

const express = require("express");
const router = express.Router();
const airtable = require("../services/airtable");

// ==========================================================================
// AUTH
// ==========================================================================

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) {
        return res.redirect("/login");
    }
    next();
}

// ==========================================================================
// CATEGORIES — CONSERVÉES
// ==========================================================================

const CATEGORIES_AMAZON = [
    { id: "tous",           label: "Toutes nos catégories" },
    { id: "alexa",          label: "Alexa Skills" },
    { id: "global",         label: "Amazon Global Store" },
    { id: "haul",           label: "Amazon Haul" },
    { id: "seconde_main",   label: "Amazon Seconde main" },
    { id: "animalerie",     label: "Animalerie" },
    { id: "appareils",      label: "Appareils Amazon" },
    { id: "applis",         label: "Applis & Jeux" },
    { id: "auto",           label: "Auto et Moto" },
    { id: "bagages",        label: "Bagages et accessoires de voyage" },
    { id: "beaute",         label: "Beauté et Parfum" },
    { id: "beaute_premium", label: "Beauté Premium" },
    { id: "cheques",        label: "Boutique chèques-cadeaux" },
    { id: "kindle",         label: "Boutique Kindle" },
    { id: "bricolage",      label: "Bricolage" },
    { id: "bebe",           label: "Bébés & Puériculture" },
    { id: "cuisine",        label: "Cuisine & Maison" },
    { id: "dvd",            label: "DVD & Blu-ray" },
    { id: "epicerie",       label: "Épicerie" },
    { id: "bureau",         label: "Fournitures de bureau" },
    { id: "electronique",   label: "High-Tech & Électronique" },
    { id: "jardin",         label: "Jardin & Plein air" },
    { id: "jeux",           label: "Jeux et Jouets" },
    { id: "livres",         label: "Livres" },
    { id: "luxe",           label: "Luxe & Joaillerie" },
    { id: "mode",           label: "Mode & Vêtements" },
    { id: "musique",        label: "Musique, Instruments & Vinyles" },
    { id: "sante",          label: "Santé et Soins du corps" },
    { id: "services",       label: "Services & Prestations" },
    { id: "sport",          label: "Sports et Loisirs" },
    { id: "logiciels",      label: "Logiciels" },
    { id: "autre",          label: "Autre" }
];

// ==========================================================================
// ANNONCES VIRTUELLES — CONSERVÉES
// ==========================================================================

const ANNONCES_VIRTUELLES = [
    {
        id: "v_1",
        fields: {
            titre: "💎 Rolex Submariner Date — Édition Collector Or & Noir",
            categorie: "luxe",
            prix: "12 500 €",
            pays: "Suisse",
            ville: "Genève",
            photo_url:
                "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1000&q=85",
            vendeur_id: "ai_agent_samii",
            vendeur_nom: "Samii Core",
            type_vendeur: "ia_marchand",
            actif: 1
        }
    },
    {
        id: "v_2",
        fields: {
            titre: "⚡ MacBook Pro M3 Max — 64Go RAM / 2To SSD",
            categorie: "electronique",
            prix: "3 490 $",
            pays: "États-Unis",
            ville: "New York",
            photo_url:
                "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1000&q=85",
            vendeur_id: "ai_agent_vaulta",
            vendeur_nom: "Vaulta Automation",
            type_vendeur: "ia_marchand",
            actif: 1
        }
    },
    {
        id: "v_3",
        fields: {
            titre: "🚀 Workflow n8n & Make — Automatisation e-commerce",
            categorie: "services",
            prix: "950 £",
            pays: "Royaume-Uni",
            ville: "Londres",
            photo_url:
                "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1000&q=85",
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
            photo_url:
                "https://images.unsplash.com/photo-1523293182086-7651a899d37f?auto=format&fit=crop&w=1000&q=85",
            vendeur_id: "ai_agent_samii",
            vendeur_nom: "Samii Core",
            type_vendeur: "ia_marchand",
            actif: 1
        }
    }
];

// ==========================================================================
// HELPERS
// ==========================================================================

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getCategoryLabel(id) {
    return (
        CATEGORIES_AMAZON.find(c => c.id === id)?.label ||
        id ||
        "Autre"
    );
}

// ==========================================================================
// MARKETPLACE
// ==========================================================================

router.get("/", requireAuth, async (req, res) => {

    const {
        categorie,
        recherche,
        pays,
        ville
    } = req.query;

    let annoncesAirtable = [];

    try {

        let filtres = ["{actif}=1"];

        if (categorie && categorie !== "tous") {
            filtres.push(`{categorie}="${categorie}"`);
        }

        if (recherche) {
            const safe = String(recherche).replace(/"/g, '\\"');

            filtres.push(
                `SEARCH(LOWER("${safe}"), LOWER({titre}))`
            );
        }

        if (pays) {
            const safe = String(pays).replace(/"/g, '\\"');

            filtres.push(
                `SEARCH(LOWER("${safe}"), LOWER({pays}))`
            );
        }

        if (ville) {
            const safe = String(ville).replace(/"/g, '\\"');

            filtres.push(
                `SEARCH(LOWER("${safe}"), LOWER({ville}))`
            );
        }

        annoncesAirtable = await airtable.find(
            "ANNONCES",
            `AND(${filtres.join(",")})`,
            50
        );

    } catch (err) {

        console.warn(
            "⚠️ Marketplace — mode secours :",
            err.message
        );
    }

    let toutesAnnonces = [
        ...ANNONCES_VIRTUELLES,
        ...annoncesAirtable
    ];

    // ----------------------------------------------------------------------
    // FILTRES LOCAUX
    // ----------------------------------------------------------------------

    if (categorie && categorie !== "tous") {

        toutesAnnonces =
            toutesAnnonces.filter(
                a => a.fields?.categorie === categorie
            );
    }

    if (recherche) {

        const query =
            String(recherche).toLowerCase();

        toutesAnnonces =
            toutesAnnonces.filter(a =>
                String(a.fields?.titre || "")
                    .toLowerCase()
                    .includes(query)
            );
    }

    // ----------------------------------------------------------------------
    // CATEGORY OPTIONS
    // ----------------------------------------------------------------------

    const categoryOptionsHtml =
        CATEGORIES_AMAZON
            .map(c => `
                <option
                    value="${escapeHtml(c.id)}"
                    ${categorie === c.id ? "selected" : ""}
                >
                    ${escapeHtml(c.label)}
                </option>
            `)
            .join("");

    // ----------------------------------------------------------------------
    // PRODUCT CARDS
    // ----------------------------------------------------------------------

    const cardsHtml =
        toutesAnnonces.map((a, index) => {

            const f = a.fields || {};

            const id =
                a.id ||
                `product_${index}_${Date.now()}`;

            const titre =
                escapeHtml(f.titre || "Produit SAMII");

            const categorieProduit =
                escapeHtml(
                    getCategoryLabel(f.categorie)
                );

            const prix =
                escapeHtml(f.prix || "Sur devis");

            const paysProduit =
                escapeHtml(
                    f.pays || "International"
                );

            const villeProduit =
                escapeHtml(
                    f.ville || ""
                );

            const vendeur =
                escapeHtml(
                    f.vendeur_nom ||
                    "Marchand SAMII"
                );

            const photo =
                escapeHtml(
                    f.photo_url || ""
                );

            const vendeurId =
                encodeURIComponent(
                    f.vendeur_id ||
                    "marchand_verified_1"
                );

            const isAI =
                f.type_vendeur === "ia_marchand";

            const aiBadge =
                isAI
                    ? `
                        <span class="product-ai">
                            <span class="ai-dot"></span>
                            MARCHAND IA
                        </span>
                    `
                    : "";

            return `
            <article
                class="product-card ${isAI ? "is-ai" : ""}"
                data-product-id="${escapeHtml(id)}"
                data-title="${titre}"
                data-price="${prix}"
            >

                <div class="product-media">

                    <a
                        href="/vitrine/${vendeurId}"
                        class="product-image-link"
                    >

                        ${
                            photo
                            ? `
                                <img
                                    src="${photo}"
                                    alt="${titre}"
                                    loading="lazy"
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
                            ${categorieProduit}
                        </span>

                        ${aiBadge}

                    </div>

                    <button
                        class="favorite-btn"
                        type="button"
                        aria-label="Ajouter aux favoris"
                        onclick='toggleFavorite(${JSON.stringify({
                            id,
                            titre: f.titre || "",
                            prix: f.prix || "Sur devis",
                            photo: f.photo_url || "",
                            vendeur: f.vendeur_nom || "",
                            vendeur_id: f.vendeur_id || ""
                        })}, this)'
                    >
                        <i data-lucide="heart"></i>
                    </button>

                    <div class="product-quick">
                        <button
                            type="button"
                            onclick='quickAdd(${JSON.stringify({
                                id,
                                titre: f.titre || "",
                                prix: f.prix || "Sur devis",
                                photo: f.photo_url || ""
                            })})'
                        >
                            <i data-lucide="shopping-cart"></i>
                            Ajouter
                        </button>
                    </div>

                </div>

                <div class="product-body">

                    <div class="product-location">
                        <i data-lucide="map-pin"></i>
                        ${paysProduit}
                        ${villeProduit ? ` · ${villeProduit}` : ""}
                    </div>

                    <a
                        href="/vitrine/${vendeurId}"
                        class="product-title"
                    >
                        ${titre}
                    </a>

                    <div class="seller-row">

                        <div class="seller-avatar">
                            ${
                                isAI
                                ? "AI"
                                : "OG"
                            }
                        </div>

                        <div class="seller-info">

                            <strong>
                                ${vendeur}
                            </strong>

                            <span>
                                ${isAI
                                    ? "Intelligence commerciale"
                                    : "Marchand vérifié"}
                            </span>

                        </div>

                        <span class="verified">
                            <i data-lucide="badge-check"></i>
                        </span>

                    </div>

                    <div class="product-bottom">

                        <div class="product-price">
                            ${prix}
                        </div>

                        <button
                            class="save-btn"
                            type="button"
                            onclick='toggleFavorite(${JSON.stringify({
                                id,
                                titre: f.titre || "",
                                prix: f.prix || "Sur devis",
                                photo: f.photo_url || "",
                                vendeur: f.vendeur_nom || "",
                                vendeur_id: f.vendeur_id || ""
                            })}, this)'
                        >
                            <i data-lucide="bookmark"></i>
                        </button>

                    </div>

                </div>

            </article>
            `;

        }).join("");

    // ======================================================================
    // HTML
    // ======================================================================

    res.send(`<!DOCTYPE html>

<html lang="fr">

<head>

<meta charset="UTF-8">

<meta
    name="viewport"
    content="width=device-width, initial-scale=1, maximum-scale=1"
>

<title>Marketplace — SAMII OS</title>

<link
    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap"
    rel="stylesheet"
>

<script src="https://unpkg.com/lucide@latest"></script>

<style>

/* ======================================================================
   ROOT
====================================================================== */

:root {

    --bg: #03060b;
    --bg-2: #07101a;
    --panel: rgba(9, 18, 29, .88);
    --panel-2: rgba(12, 25, 39, .96);

    --text: #f5fbff;
    --muted: #7f96a8;

    --blue: #00d9ff;
    --blue-2: #0077ff;

    --cyan-glow:
        0 0 15px rgba(0,217,255,.45),
        0 0 45px rgba(0,119,255,.18);

    --gold: #d7b34c;

    --border:
        rgba(0,217,255,.16);

    --danger: #ff5470;

    --radius: 18px;

    --ease:
        cubic-bezier(.16,1,.3,1);
}

body.light {

    --bg: #eef5fa;
    --bg-2: #e2edf5;

    --panel: rgba(255,255,255,.88);
    --panel-2: rgba(255,255,255,.97);

    --text: #08121c;
    --muted: #607384;

    --border:
        rgba(0,119,255,.16);

    --cyan-glow:
        0 0 20px rgba(0,119,255,.18);

}

/* ======================================================================
   GLOBAL
====================================================================== */

* {
    box-sizing: border-box;
}

html {
    scroll-behavior: smooth;
}

body {

    margin: 0;

    min-height: 100vh;

    background:
        radial-gradient(
            circle at 10% 10%,
            rgba(0,217,255,.09),
            transparent 30%
        ),
        radial-gradient(
            circle at 90% 90%,
            rgba(0,119,255,.12),
            transparent 32%
        ),
        var(--bg);

    color: var(--text);

    font-family: Inter, sans-serif;

    overflow-x: hidden;

    transition:
        background .4s ease,
        color .4s ease;
}

button,
input,
select {
    font: inherit;
}

button {
    cursor: pointer;
}

a {
    color: inherit;
}

/* ======================================================================
   BACKGROUND TECHNOLOGY
====================================================================== */

.tech-bg {

    position: fixed;

    inset: 0;

    z-index: -5;

    pointer-events: none;

    overflow: hidden;
}

.tech-grid {

    position: absolute;

    inset: 0;

    background-image:
        linear-gradient(
            rgba(0,217,255,.035) 1px,
            transparent 1px
        ),
        linear-gradient(
            90deg,
            rgba(0,217,255,.035) 1px,
            transparent 1px
        );

    background-size: 42px 42px;

    mask-image:
        linear-gradient(
            to bottom,
            black,
            transparent 90%
        );
}

.tech-orb {

    position: absolute;

    width: 380px;

    height: 380px;

    border-radius: 50%;

    filter: blur(80px);

    opacity: .12;

    background: var(--blue);

}

.tech-orb.one {
    top: -180px;
    left: -100px;
}

.tech-orb.two {
    right: -150px;
    bottom: 10%;
    background: var(--blue-2);
}

/* ======================================================================
   DESKTOP SIDEBAR
====================================================================== */

.sidebar {

    position: fixed;

    left: 0;
    top: 0;

    width: 245px;
    height: 100vh;

    padding: 22px 16px;

    background:
        linear-gradient(
            180deg,
            rgba(4,10,17,.97),
            rgba(3,7,12,.94)
        );

    border-right:
        1px solid var(--border);

    z-index: 300;

    display: flex;

    flex-direction: column;

    transition: .35s var(--ease);
}

body.light .sidebar {

    background:
        rgba(247,251,254,.95);

}

.brand {

    display: flex;

    align-items: center;

    gap: 10px;

    padding: 8px 10px 25px;

    font-weight: 800;

    letter-spacing: .5px;
}

.brand-mark {

    width: 37px;
    height: 37px;

    display: grid;
    place-items: center;

    border-radius: 11px;

    color: white;

    background:
        linear-gradient(
            135deg,
            var(--blue),
            var(--blue-2)
        );

    box-shadow: var(--cyan-glow);

    font-weight: 900;
}

.brand-name {

    font-size: 15px;

}

.brand-name span {

    color: var(--blue);

}

.side-menu {

    display: flex;

    flex-direction: column;

    gap: 6px;
}

.side-link {

    display: flex;

    align-items: center;

    gap: 12px;

    padding: 12px 13px;

    border-radius: 12px;

    text-decoration: none;

    color: var(--muted);

    font-size: 13px;

    font-weight: 600;

    border: 1px solid transparent;

    transition: .25s var(--ease);
}

.side-link svg {

    width: 18px;
    height: 18px;
}

.side-link:hover,
.side-link.active {

    color: var(--text);

    background:
        linear-gradient(
            90deg,
            rgba(0,217,255,.12),
            rgba(0,119,255,.04)
        );

    border-color:
        rgba(0,217,255,.22);

    box-shadow:
        inset 3px 0 0 var(--blue),
        var(--cyan-glow);
}

.side-link.active svg {

    color: var(--blue);

    filter:
        drop-shadow(0 0 7px var(--blue));
}

.side-bottom {

    margin-top: auto;

    padding: 14px;

    border:
        1px solid var(--border);

    border-radius: 16px;

    background:
        linear-gradient(
            135deg,
            rgba(0,217,255,.08),
            rgba(0,119,255,.03)
        );
}

.side-ai {

    display: flex;

    align-items: center;

    gap: 8px;

    font-size: 11px;

    font-family: "JetBrains Mono";

    color: var(--blue);

    margin-bottom: 6px;
}

.side-ai-dot {

    width: 7px;
    height: 7px;

    background: #00ff9d;

    border-radius: 50%;

    box-shadow:
        0 0 10px #00ff9d;
}

.side-text {

    color: var(--muted);

    font-size: 11px;

    line-height: 1.5;
}

/* ======================================================================
   MAIN
====================================================================== */

.main {

    margin-left: 245px;

    min-height: 100vh;

    width: calc(100% - 245px);
}

/* ======================================================================
   HEADER
====================================================================== */

.header {

    position: sticky;

    top: 0;

    z-index: 200;

    backdrop-filter: blur(24px);

    background:
        rgba(3,7,12,.82);

    border-bottom:
        1px solid var(--border);
}

body.light .header {

    background:
        rgba(244,249,253,.86);

}

.header-top {

    min-height: 70px;

    padding:
        10px 28px;

    display: flex;

    align-items: center;

    gap: 15px;
}

.mobile-brand {

    display: none;

}

.search {

    flex: 1;

    display: flex;

    min-width: 0;

    max-width: 720px;

    margin: auto;

    border:
        1px solid rgba(0,217,255,.25);

    border-radius: 13px;

    overflow: hidden;

    background:
        rgba(0,0,0,.25);

    transition: .25s;
}

.search:focus-within {

    border-color: var(--blue);

    box-shadow: var(--cyan-glow);
}

body.light .search {

    background:
        rgba(255,255,255,.7);

}

.search select {

    width: 165px;

    padding: 0 12px;

    background: transparent;

    border: none;

    border-right:
        1px solid var(--border);

    color: var(--text);

    outline: none;

    font-size: 12px;
}

.search select option {

    background: #07101a;

    color: white;
}

.search input {

    flex: 1;

    min-width: 0;

    border: none;

    outline: none;

    background: transparent;

    color: var(--text);

    padding: 13px 14px;

    font-size: 13px;
}

.search input::placeholder {

    color: var(--muted);

}

.search button {

    width: 50px;

    border: none;

    background:
        linear-gradient(
            135deg,
            var(--blue),
            var(--blue-2)
        );

    color: white;

    transition: .25s;
}

.search button:hover {

    filter: brightness(1.2);

    box-shadow: var(--cyan-glow);
}

/* HEADER ACTIONS */

.header-actions {

    display: flex;

    align-items: center;

    gap: 8px;
}

.icon-btn {

    width: 40px;
    height: 40px;

    display: grid;

    place-items: center;

    border:
        1px solid var(--border);

    border-radius: 11px;

    color: var(--muted);

    background:
        rgba(255,255,255,.025);

    transition: .25s var(--ease);
}

.icon-btn:hover {

    color: var(--blue);

    border-color: var(--blue);

    box-shadow: var(--cyan-glow);

    transform: translateY(-2px);
}

.publish-btn {

    display: inline-flex;

    align-items: center;

    gap: 7px;

    padding: 10px 14px;

    border-radius: 11px;

    color: #001018;

    text-decoration: none;

    background:
        linear-gradient(
            135deg,
            var(--blue),
            #00a9ff
        );

    font-size: 12px;

    font-weight: 800;

    box-shadow:
        0 5px 20px rgba(0,217,255,.25);

    transition: .25s var(--ease);
}

.publish-btn:hover {

    transform: translateY(-2px);

    box-shadow: var(--cyan-glow);
}

/* SUB NAV */

.subnav {

    display: flex;

    align-items: center;

    gap: 8px;

    padding:
        8px 28px;

    overflow-x: auto;

    scrollbar-width: none;

    border-top:
        1px solid rgba(255,255,255,.025);
}

.subnav::-webkit-scrollbar {
    display: none;
}

.subnav a {

    flex: 0 0 auto;

    text-decoration: none;

    padding: 7px 11px;

    border-radius: 9px;

    color: var(--muted);

    font-size: 11px;

    font-weight: 600;

    border:
        1px solid transparent;

    transition: .2s;
}

.subnav a:hover,
.subnav a.active {

    color: var(--blue);

    border-color:
        rgba(0,217,255,.18);

    background:
        rgba(0,217,255,.06);
}

/* ======================================================================
   CONTENT
====================================================================== */

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

    font-family:
        "JetBrains Mono";

    color: var(--blue);

    font-size: 10px;

    letter-spacing: 1.4px;

    text-transform: uppercase;

    margin-bottom: 8px;
}

.live-dot {

    width: 7px;
    height: 7px;

    border-radius: 50%;

    background: #00ff9d;

    box-shadow:
        0 0 10px #00ff9d;
}

.hero h1 {

    margin: 0;

    font-size:
        clamp(25px, 3vw, 40px);

    line-height: 1;

    letter-spacing: -.9px;

}

.hero h1 span {

    color: var(--blue);

    text-shadow:
        0 0 25px rgba(0,217,255,.25);
}

.hero p {

    margin: 10px 0 0;

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

    border:
        1px solid var(--border);

    color: var(--text);

    background:
        var(--panel);

    border-radius: 11px;

    padding: 10px 13px;

    font-size: 11px;

    font-weight: 700;
}

/* ======================================================================
   PRODUCTS
====================================================================== */

.products-grid {

    display: grid;

    grid-template-columns:
        repeat(
            auto-fill,
            minmax(220px, 1fr)
        );

    gap: 17px;
}

.product-card {

    position: relative;

    overflow: hidden;

    min-width: 0;

    border:
        1px solid var(--border);

    border-radius:
        var(--radius);

    background:
        var(--panel);

    backdrop-filter: blur(18px);

    box-shadow:
        0 15px 35px rgba(0,0,0,.18);

    transition:
        transform .35s var(--ease),
        border-color .35s,
        box-shadow .35s;

}

.product-card:hover {

    transform:
        translateY(-6px);

    border-color:
        rgba(0,217,255,.42);

    box-shadow:
        0 25px 60px rgba(0,0,0,.3),
        var(--cyan-glow);
}

.product-card.is-ai {

    border-color:
        rgba(165,93,255,.28);

}

.product-card.is-ai:hover {

    border-color:
        rgba(165,93,255,.7);

    box-shadow:
        0 25px 60px rgba(0,0,0,.35),
        0 0 35px rgba(165,93,255,.2);
}

/* MEDIA */

.product-media {

    position: relative;

    aspect-ratio: 1 / 1;

    background:
        linear-gradient(
            135deg,
            #07121d,
            #020509
        );

    overflow: hidden;
}

.product-image-link {

    display: block;

    width: 100%;

    height: 100%;
}

.product-media img {

    width: 100%;

    height: 100%;

    object-fit: cover;

    display: block;

    transition:
        transform .7s var(--ease);
}

.product-card:hover .product-media img {

    transform: scale(1.08);
}

.product-placeholder {

    height: 100%;

    display: grid;

    place-items: center;

    color: var(--blue);
}

.product-placeholder svg {

    width: 45px;
    height: 45px;

    opacity: .35;
}

/* PRODUCT TOP */

.product-top {

    position: absolute;

    top: 10px;

    left: 10px;

    right: 10px;

    display: flex;

    justify-content: space-between;

    align-items: flex-start;

    gap: 6px;

    pointer-events: none;
}

.product-category,
.product-ai {

    padding:
        5px 8px;

    border-radius:
        999px;

    backdrop-filter:
        blur(12px);

    font-family:
        "JetBrains Mono";

    font-size: 8px;

    font-weight: 700;

    white-space: nowrap;
}

.product-category {

    color: white;

    background:
        rgba(3,8,14,.76);

    border:
        1px solid rgba(255,255,255,.1);
}

.product-ai {

    color: white;

    background:
        rgba(130,45,210,.8);

    border:
        1px solid rgba(205,145,255,.4);

    box-shadow:
        0 0 18px rgba(165,93,255,.3);
}

.ai-dot {

    width: 5px;
    height: 5px;

    display: inline-block;

    margin-right: 4px;

    border-radius: 50%;

    background: #d7a7ff;

    box-shadow:
        0 0 8px #d7a7ff;
}

/* FAVORITE */

.favorite-btn {

    position: absolute;

    right: 10px;

    bottom: 10px;

    width: 36px;
    height: 36px;

    border-radius: 50%;

    display: grid;

    place-items: center;

    color: white;

    background:
        rgba(0,0,0,.55);

    border:
        1px solid rgba(255,255,255,.16);

    backdrop-filter: blur(10px);

    transition: .25s var(--ease);
}

.favorite-btn:hover {

    color: #ff5e7d;

    border-color: #ff5e7d;

    box-shadow:
        0 0 18px rgba(255,94,125,.3);

    transform: scale(1.08);
}

.favorite-btn.saved {

    color: #ff5470;

    background:
        rgba(255,84,112,.12);

    border-color:
        rgba(255,84,112,.45);
}

/* QUICK ADD */

.product-quick {

    position: absolute;

    left: 10px;

    right: 10px;

    bottom: 10px;

    opacity: 0;

    transform: translateY(8px);

    pointer-events: none;

    transition: .3s var(--ease);
}

.product-card:hover .product-quick {

    opacity: 1;

    transform: translateY(0);

    pointer-events: auto;
}

.product-quick button {

    width: calc(100% - 48px);

    margin-right: 44px;

    padding: 9px;

    display: flex;

    justify-content: center;

    align-items: center;

    gap: 6px;

    border:
        1px solid rgba(0,217,255,.4);

    border-radius: 10px;

    color: white;

    background:
        rgba(2,10,18,.82);

    backdrop-filter: blur(12px);

    font-size: 10px;

    font-weight: 800;

    transition: .2s;
}

.product-quick button:hover {

    background:
        var(--blue);

    color:
        #001018;

    box-shadow:
        var(--cyan-glow);
}

/* BODY */

.product-body {

    padding: 13px;

}

.product-location {

    display: flex;

    align-items: center;

    gap: 4px;

    color: var(--muted);

    font-size: 9px;

    margin-bottom: 8px;

}

.product-location svg {

    width: 11px;
    height: 11px;

    color: var(--blue);
}

.product-title {

    display: -webkit-box;

    -webkit-line-clamp: 2;

    -webkit-box-orient: vertical;

    overflow: hidden;

    min-height: 34px;

    text-decoration: none;

    font-size: 12px;

    font-weight: 700;

    line-height: 1.45;

    transition: color .2s;
}

.product-title:hover {

    color: var(--blue);
}

/* SELLER */

.seller-row {

    display: flex;

    align-items: center;

    gap: 7px;

    margin-top: 12px;

    padding-top: 10px;

    border-top:
        1px solid rgba(255,255,255,.055);
}

.seller-avatar {

    width: 25px;
    height: 25px;

    flex: 0 0 25px;

    display: grid;

    place-items: center;

    border-radius: 8px;

    color: white;

    font-size: 8px;

    font-weight: 900;

    background:
        linear-gradient(
            135deg,
            var(--blue),
            var(--blue-2)
        );
}

.seller-info {

    display: flex;

    flex-direction: column;

    min-width: 0;

    flex: 1;
}

.seller-info strong {

    font-size: 9px;

    overflow: hidden;

    text-overflow: ellipsis;

    white-space: nowrap;
}

.seller-info span {

    color: var(--muted);

    font-size: 8px;

    margin-top: 2px;
}

.verified {

    color: var(--blue);
}

.verified svg {

    width: 15px;
    height: 15px;
}

/* BOTTOM */

.product-bottom {

    display: flex;

    align-items: center;

    justify-content: space-between;

    margin-top: 11px;
}

.product-price {

    font-family:
        "JetBrains Mono";

    color: var(--blue);

    font-size: 14px;

    font-weight: 800;

    text-shadow:
        0 0 12px rgba(0,217,255,.2);
}

.save-btn {

    width: 31px;
    height: 31px;

    display: grid;

    place-items: center;

    border:
        1px solid var(--border);

    border-radius: 9px;

    color: var(--muted);

    background: transparent;

}

.save-btn:hover {

    color: var(--blue);

    border-color: var(--blue);

    box-shadow: var(--cyan-glow);
}

/* ======================================================================
   EMPTY
====================================================================== */

.empty {

    grid-column: 1 / -1;

    padding: 90px 20px;

    text-align: center;

    border:
        1px dashed var(--border);

    border-radius: 20px;

    color: var(--muted);

}

.empty svg {

    width: 45px;
    height: 45px;

    color: var(--blue);

    margin-bottom: 15px;
}

/* ======================================================================
   CART DRAWER
====================================================================== */

.overlay {

    position: fixed;

    inset: 0;

    z-index: 500;

    background:
        rgba(0,0,0,.62);

    backdrop-filter:
        blur(7px);

    opacity: 0;

    pointer-events: none;

    transition: .3s;
}

.overlay.open {

    opacity: 1;

    pointer-events: auto;
}

.cart {

    position: fixed;

    top: 0;
    right: 0;

    width:
        min(430px, 100vw);

    height: 100vh;

    z-index: 501;

    background:
        #06101a;

    border-left:
        1px solid var(--border);

    transform:
        translateX(100%);

    transition:
        transform .45s var(--ease);

    display: flex;

    flex-direction: column;

    box-shadow:
        -20px 0 70px rgba(0,0,0,.5);
}

body.light .cart {

    background:
        #f7fbfe;
}

.cart.open {

    transform:
        translateX(0);
}

.cart-head {

    padding: 20px;

    display: flex;

    align-items: center;

    justify-content: space-between;

    border-bottom:
        1px solid var(--border);
}

.cart-title {

    font-weight: 800;

    font-size: 17px;
}

.cart-title span {

    color: var(--blue);

}

.cart-items {

    flex: 1;

    overflow-y: auto;

    padding: 16px;

}

.cart-empty {

    text-align: center;

    padding: 70px 20px;

    color: var(--muted);

}

.cart-item {

    display: flex;

    gap: 10px;

    padding: 10px;

    margin-bottom: 8px;

    border:
        1px solid var(--border);

    border-radius: 13px;

    background:
        rgba(255,255,255,.025);
}

.cart-item img {

    width: 60px;
    height: 60px;

    object-fit: cover;

    border-radius: 9px;
}

.cart-item-info {

    flex: 1;

}

.cart-item-title {

    font-size: 11px;

    font-weight: 700;

    line-height: 1.4;

}

.cart-item-price {

    margin-top: 6px;

    color: var(--blue);

    font-family:
        "JetBrains Mono";

    font-size: 10px;

}

.cart-remove {

    border: none;

    background: transparent;

    color: var(--danger);

    align-self: flex-start;
}

.cart-foot {

    padding: 18px;

    border-top:
        1px solid var(--border);
}

.cart-total {

    display: flex;

    justify-content: space-between;

    margin-bottom: 13px;

    font-size: 12px;
}

.cart-total strong {

    color: var(--blue);

}

.checkout {

    width: 100%;

    border: none;

    border-radius: 12px;

    padding: 14px;

    color: #001018;

    background:
        linear-gradient(
            135deg,
            var(--blue),
            #008cff
        );

    font-weight: 900;

    box-shadow:
        var(--cyan-glow);

    transition: .25s;
}

.checkout:hover {

    transform: translateY(-2px);

}

/* ======================================================================
   MOBILE NAV
====================================================================== */

.mobile-nav {

    display: none;

}

/* ======================================================================
   RESPONSIVE
====================================================================== */

@media (max-width: 1200px) {

    .products-grid {

        grid-template-columns:
            repeat(
                3,
                minmax(0,1fr)
            );
    }

}

@media (max-width: 900px) {

    .sidebar {

        display: none;
    }

    .main {

        margin-left: 0;

        width: 100%;
    }

    .mobile-brand {

        display: flex;

        align-items: center;

        gap: 7px;

        font-size: 12px;

        font-weight: 900;

        white-space: nowrap;
    }

    .mobile-brand .brand-mark {

        width: 31px;
        height: 31px;

        font-size: 10px;
    }

    .header-top {

        padding:
            9px 12px;

        gap: 8px;

        flex-wrap: wrap;
    }

    .search {

        order: 3;

        flex-basis: 100%;

        max-width: none;
    }

    .search select {

        width: 105px;

    }

    .header-actions {

        margin-left: auto;
    }

    .publish-btn {

        padding:
            9px 10px;

    }

    .publish-btn span {

        display: none;
    }

    .subnav {

        padding:
            7px 12px;
    }

    .content {

        padding:
            18px 12px 90px;
    }

    .hero {

        align-items: flex-start;

        flex-direction: column;

        margin-bottom: 17px;
    }

    .hero h1 {

        font-size: 27px;

    }

    .hero-actions {

        width: 100%;
    }

    .filter-btn {

        flex: 1;

        justify-content: center;
    }

    .products-grid {

        grid-template-columns:
            repeat(
                2,
                minmax(0,1fr)
            );

        gap: 10px;
    }

    .product-card {

        border-radius: 14px;
    }

    .product-body {

        padding: 10px;

    }

    .product-title {

        font-size: 11px;

        min-height: 32px;
    }

    .product-price {

        font-size: 12px;
    }

    .seller-info span {

        display: none;
    }

    .product-quick {

        display: none;
    }

    .mobile-nav {

        position: fixed;

        left: 8px;
        right: 8px;
        bottom: 8px;

        height: 62px;

        z-index: 400;

        display: grid;

        grid-template-columns:
            repeat(4,1fr);

        padding: 5px;

        border:
            1px solid rgba(0,217,255,.22);

        border-radius: 17px;

        background:
            rgba(4,10,17,.92);

        backdrop-filter:
            blur(25px);

        box-shadow:
            0 15px 50px rgba(0,0,0,.45),
            var(--cyan-glow);
    }

    body.light .mobile-nav {

        background:
            rgba(250,253,255,.93);

    }

    .mobile-nav a {

        display: flex;

        flex-direction: column;

        align-items: center;

        justify-content: center;

        gap: 3px;

        text-decoration: none;

        color: var(--muted);

        font-size: 8px;

        font-weight: 700;

        border-radius: 12px;
    }

    .mobile-nav a svg {

        width: 18px;
        height: 18px;
    }

    .mobile-nav a.active {

        color: var(--blue);

        background:
            rgba(0,217,255,.08);

    }

}

/* VERY SMALL PHONES */

@media (max-width: 390px) {

    .products-grid {

        gap: 7px;

    }

    .product-body {

        padding: 8px;

    }

    .product-location {

        font-size: 8px;

    }

    .product-title {

        font-size: 10px;

    }

    .seller-row {

        margin-top: 8px;

    }

    .seller-avatar {

        width: 22px;
        height: 22px;

        flex-basis: 22px;
    }

    .verified {

        display: none;
    }

}

/* DESKTOP 4/5 */

@media (min-width: 1400px) {

    .products-grid {

        grid-template-columns:
            repeat(
                4,
                minmax(0,1fr)
            );
    }

}

@media (min-width: 1800px) {

    .products-grid {

        grid-template-columns:
            repeat(
                5,
                minmax(0,1fr)
            );
    }

}

</style>

</head>

<body>

<!-- ================================================================
     TECH BACKGROUND
================================================================ -->

<div class="tech-bg">

    <div class="tech-grid"></div>

    <div class="tech-orb one"></div>

    <div class="tech-orb two"></div>

</div>

<!-- ================================================================
     DESKTOP SIDEBAR
================================================================ -->

<aside class="sidebar">

    <div>

        <div class="brand">

            <div class="brand-mark">
                OG
            </div>

            <div class="brand-name">
                SAMII <span>TECHNOLOGY</span>
            </div>

        </div>

        <nav class="side-menu">

            <a
                href="/qg"
                class="side-link"
            >
                <i data-lucide="layout-dashboard"></i>
                QG Central
            </a>

            <a
                href="/marketplace"
                class="side-link active"
            >
                <i data-lucide="store"></i>
                Marketplace
            </a>

            <a
                href="/community"
                class="side-link"
            >
                <i data-lucide="users"></i>
                Communauté
            </a>

            <a
                href="/arsenal"
                class="side-link"
            >
                <i data-lucide="shield-check"></i>
                Arsenal
            </a>

            <a
                href="/academy"
                class="side-link"
            >
                <i data-lucide="graduation-cap"></i>
                Academy
            </a>

        </nav>

    </div>

    <div class="side-bottom">

        <div class="side-ai">

            <span class="side-ai-dot"></span>

            SAMII ENGINE ACTIVE

        </div>

        <div class="side-text">

            Marketplace synchronisée avec
            l'écosystème SAMII.

        </div>

    </div>

</aside>

<!-- ================================================================
     MAIN
================================================================ -->

<div class="main">

    <!-- HEADER -->

    <header class="header">

        <div class="header-top">

            <div class="mobile-brand">

                <div class="brand-mark">
                    OG
                </div>

                SAMII

            </div>

            <!-- SEARCH -->

            <form
                class="search"
                method="GET"
                action="/marketplace"
            >

                <select name="categorie">

                    ${categoryOptionsHtml}

                </select>

                <input
                    type="search"
                    name="recherche"
                    placeholder="Rechercher un produit, service ou marchand..."
                    value="${escapeHtml(recherche || "")}"
                >

                <button type="submit">

                    <i data-lucide="search"></i>

                </button>

            </form>

            <!-- ACTIONS -->

            <div class="header-actions">

                <button
                    class="icon-btn"
                    id="themeBtn"
                    type="button"
                    title="Changer le thème"
                >

                    <i data-lucide="moon"></i>

                </button>

                <button
                    class="icon-btn"
                    type="button"
                    onclick="openFavorites()"
                    title="Mes favoris"
                >

                    <i data-lucide="heart"></i>

                </button>

                <button
                    class="icon-btn"
                    type="button"
                    onclick="toggleCart()"
                    title="Mon panier"
                >

                    <i data-lucide="shopping-cart"></i>

                </button>

                <a
                    href="/marketplace/publier"
                    class="publish-btn"
                >

                    <i data-lucide="plus"></i>

                    <span>
                        Publier
                    </span>

                </a>

            </div>

        </div>

        <!-- SUB NAV -->

        <nav class="subnav">

            <a
                href="/marketplace"
                class="${!categorie || categorie === "tous" ? "active" : ""}"
            >
                Tout
            </a>

            <a href="/marketplace?categorie=electronique">
                Technologie
            </a>

            <a href="/marketplace?categorie=mode">
                Mode
            </a>

            <a href="/marketplace?categorie=luxe">
                Luxe
            </a>

            <a href="/marketplace?categorie=services">
                Services
            </a>

            <a href="/marketplace?categorie=sport">
                Sport
            </a>

            <a href="/marketplace?categorie=cuisine">
                Maison
            </a>

            <a href="/marketplace?categorie=beaute">
                Beauté
            </a>

            <a href="/marketplace?categorie=autre">
                Autres
            </a>

        </nav>

    </header>

    <!-- CONTENT -->

    <main class="content">

        <section class="hero">

            <div>

                <div class="hero-kicker">

                    <span class="live-dot"></span>

                    SAMII MARKETPLACE · LIVE

                </div>

                <h1>
                    Découvrez.
                    <span>Achetez.</span>
                    Connectez.
                </h1>

                <p>
                    ${toutesAnnonces.length}
                    annonce${toutesAnnonces.length !== 1 ? "s" : ""}
                    disponible${toutesAnnonces.length !== 1 ? "s" : ""}
                    dans l'écosystème SAMII.
                </p>

            </div>

            <div class="hero-actions">

                <button
                    class="filter-btn"
                    type="button"
                    onclick="detectCountry()"
                >

                    <i data-lucide="map-pin"></i>

                    <span id="countryLabel">
                        Détection pays
                    </span>

                </button>

                <button
                    class="filter-btn"
                    type="button"
                    onclick="openFavorites()"
                >

                    <i data-lucide="heart"></i>

                    Mes favoris

                </button>

            </div>

        </section>

        <!-- PRODUCTS -->

        <section class="products-grid">

            ${
                toutesAnnonces.length
                ? cardsHtml
                : `
                    <div class="empty">

                        <i data-lucide="package-search"></i>

                        <h3>
                            Aucun produit trouvé
                        </h3>

                        <p>
                            Essayez une autre recherche
                            ou publiez votre première annonce.
                        </p>

                    </div>
                `
            }

        </section>

    </main>

</div>

<!-- ================================================================
     CART
================================================================ -->

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
                Total estimé
            </span>

            <strong id="cartTotal">
                0
            </strong>

        </div>

        <button
            class="checkout"
            onclick="checkout()"
        >

            Continuer vers la commande

        </button>

    </div>

</aside>

<!-- ================================================================
     MOBILE NAV
================================================================ -->

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

/* =====================================================================
   LUCIDE
===================================================================== */

if (typeof lucide !== "undefined") {
    lucide.createIcons();
}

/* =====================================================================
   THEME
===================================================================== */

const savedTheme =
    localStorage.getItem("samii_market_theme");

if (savedTheme === "light") {

    document.body.classList.add("light");

}

function updateThemeIcon() {

    const btn =
        document.getElementById("themeBtn");

    if (!btn) return;

    btn.innerHTML =
        document.body.classList.contains("light")
        ? '<i data-lucide="sun"></i>'
        : '<i data-lucide="moon"></i>';

    if (typeof lucide !== "undefined") {
        lucide.createIcons();
    }
}

updateThemeIcon();

document
    .getElementById("themeBtn")
    ?.addEventListener("click", () => {

        document.body.classList.toggle("light");

        localStorage.setItem(
            "samii_market_theme",
            document.body.classList.contains("light")
                ? "light"
                : "dark"
        );

        updateThemeIcon();

    });

/* =====================================================================
   COUNTRY
===================================================================== */

function detectCountry() {

    const timezone =
        Intl.DateTimeFormat()
            .resolvedOptions()
            .timeZone || "";

    let country = "International";

    if (
        timezone.includes("Algiers")
    ) {
        country = "Algérie 🇩🇿";
    }
    else if (
        timezone.includes("Paris")
    ) {
        country = "France 🇫🇷";
    }
    else if (
        timezone.includes("London")
    ) {
        country = "Royaume-Uni 🇬🇧";
    }
    else if (
        timezone.includes("New_York")
    ) {
        country = "États-Unis 🇺🇸";
    }

    const label =
        document.getElementById(
            "countryLabel"
        );

    if (label) {
        label.textContent = country;
    }

    localStorage.setItem(
        "samii_country",
        country
    );
}

const savedCountry =
    localStorage.getItem("samii_country");

if (savedCountry) {

    const label =
        document.getElementById(
            "countryLabel"
        );

    if (label) {
        label.textContent = savedCountry;
    }

} else {

    detectCountry();

}

/* =====================================================================
   FAVORITES
===================================================================== */

let favorites =
    JSON.parse(
        localStorage.getItem(
            "samii_market_favorites"
        ) || "[]"
    );

function isFavorite(id) {

    return favorites.some(
        item => String(item.id) === String(id)
    );

}

function toggleFavorite(product, button) {

    const index =
        favorites.findIndex(
            item =>
                String(item.id) ===
                String(product.id)
        );

    if (index >= 0) {

        favorites.splice(index, 1);

        if (button) {
            button.classList.remove("saved");
        }

    } else {

        favorites.push(product);

        if (button) {
            button.classList.add("saved");
        }

    }

    localStorage.setItem(
        "samii_market_favorites",
        JSON.stringify(favorites)
    );

    updateFavoriteButtons();

}

function updateFavoriteButtons() {

    document
        .querySelectorAll(".favorite-btn")
        .forEach(btn => {

            const card =
                btn.closest(".product-card");

            if (!card) return;

            const id =
                card.dataset.productId;

            if (isFavorite(id)) {
                btn.classList.add("saved");
            } else {
                btn.classList.remove("saved");
            }

        });

}

updateFavoriteButtons();

/* =====================================================================
   FAVORITES VIEW
===================================================================== */

function openFavorites() {

    if (!favorites.length) {

        alert(
            "❤️ Aucun produit sauvegardé pour le moment."
        );

        return;
    }

    alert(
        "❤️ Vous avez " +
        favorites.length +
        " produit(s) sauvegardé(s)."
    );

}

/* =====================================================================
   CART
===================================================================== */

let cart =
    JSON.parse(
        localStorage.getItem(
            "samii_market_cart"
        ) || "[]"
    );

function toggleCart() {

    document
        .getElementById("cart")
        .classList.toggle("open");

    document
        .getElementById("overlay")
        .classList.toggle("open");

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
            (existing.quantity || 1) + 1;

    } else {

        cart.push({
            ...product,
            quantity: 1
        });

    }

    saveCart();

    toggleCart();

}

function removeFromCart(index) {

    cart.splice(index, 1);

    saveCart();

    renderCart();

}

function saveCart() {

    localStorage.setItem(
        "samii_market_cart",
        JSON.stringify(cart)
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

    if (!cart.length) {

        container.innerHTML = \`
            <div class="cart-empty">

                <i data-lucide="shopping-bag"></i>

                <p>
                    Votre panier est vide.
                </p>

                <small>
                    Ajoutez des produits depuis Marketplace.
                </small>

            </div>
        \`;

        total.textContent = "0";

        if (typeof lucide !== "undefined") {
            lucide.createIcons();
        }

        return;

    }

    let html = "";

    cart.forEach((item, index) => {

        html += \`
            <div class="cart-item">

                \${
                    item.photo
                    ? \`
                        <img
                            src="\${item.photo}"
                            alt=""
                        >
                    \`
                    : \`
                        <div
                            style="
                                width:60px;
                                height:60px;
                                border-radius:9px;
                                background:#07121d;
                            "
                        ></div>
                    \`
                }

                <div class="cart-item-info">

                    <div class="cart-item-title">
                        \${escapeClient(item.titre)}
                    </div>

                    <div class="cart-item-price">
                        \${escapeClient(item.prix)}
                        · x\${item.quantity || 1}
                    </div>

                </div>

                <button
                    class="cart-remove"
                    onclick="removeFromCart(\${index})"
                >
                    ×
                </button>

            </div>
        \`;

    });

    container.innerHTML = html;

    total.textContent =
        cart.length +
        " article" +
        (cart.length > 1 ? "s" : "");

    if (typeof lucide !== "undefined") {
        lucide.createIcons();
    }

}

function escapeClient(value) {

    return String(value || "")
        .replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        }[char]));

}

function checkout() {

    if (!cart.length) {

        alert(
            "Votre panier est vide."
        );

        return;
    }

    /*
        FUTUR :
        Ici on connectera directement
        le moteur de commandes SAMII.
    */

    alert(
        "🚀 Commande SAMII prête. " +
        "Le moteur de commande sera connecté ici."
    );

}

renderCart();

/* =====================================================================
   ESC = CLOSE CART
===================================================================== */

document.addEventListener(
    "keydown",
    event => {

        if (event.key === "Escape") {

            document
                .getElementById("cart")
                .classList.remove("open");

            document
                .getElementById("overlay")
                .classList.remove("open");

        }

    }
);

</script>

</body>

</html>`);

});

// ==========================================================================
// PUBLICATION — FORMULAIRE
// ==========================================================================

router.get("/publier", requireAuth, async (req, res) => {

    const optionsCategories =
        CATEGORIES_AMAZON
            .filter(c => c.id !== "tous")
            .map(c => `
                <option value="${escapeHtml(c.id)}">
                    ${escapeHtml(c.label)}
                </option>
            `)
            .join("");

    res.send(`<!DOCTYPE html>

<html lang="fr">

<head>

<meta charset="UTF-8">

<meta
    name="viewport"
    content="width=device-width,initial-scale=1"
>

<title>Publier — SAMII Marketplace</title>

<style>

:root {
    --blue:#00d9ff;
    --blue2:#0077ff;
    --bg:#03070d;
    --panel:#091522;
    --text:#f5fbff;
    --muted:#8196a7;
}

* {
    box-sizing:border-box;
}

body {

    margin:0;

    min-height:100vh;

    display:flex;

    justify-content:center;

    align-items:center;

    padding:25px;

    background:
        radial-gradient(
            circle at 20% 10%,
            rgba(0,217,255,.1),
            transparent 35%
        ),
        radial-gradient(
            circle at 90% 80%,
            rgba(0,119,255,.12),
            transparent 35%
        ),
        var(--bg);

    color:var(--text);

    font-family:Inter,Arial,sans-serif;
}

.form-box {

    width:100%;

    max-width:720px;

    padding:32px;

    border:1px solid rgba(0,217,255,.2);

    border-radius:24px;

    background:
        rgba(9,21,34,.92);

    box-shadow:
        0 30px 80px rgba(0,0,0,.5),
        0 0 40px rgba(0,217,255,.08);
}

.back {

    color:var(--muted);

    text-decoration:none;

    font-size:12px;
}

h1 {

    margin:
        25px 0 8px;

    font-size:
        clamp(25px,5vw,36px);
}

.subtitle {

    color:var(--muted);

    font-size:12px;

    margin-bottom:28px;
}

.group {

    margin-bottom:18px;
}

label {

    display:block;

    color:var(--muted);

    font-size:11px;

    font-weight:700;

    margin-bottom:7px;
}

input,
select {

    width:100%;

    padding:14px;

    border-radius:12px;

    border:
        1px solid rgba(0,217,255,.14);

    background:
        rgba(0,0,0,.25);

    color:white;

    outline:none;
}

input:focus,
select:focus {

    border-color:var(--blue);

    box-shadow:
        0 0 20px rgba(0,217,255,.12);
}

select option {

    background:#07101a;

}

.submit {

    width:100%;

    margin-top:10px;

    padding:15px;

    border:none;

    border-radius:13px;

    color:#001018;

    background:
        linear-gradient(
            135deg,
            var(--blue),
            var(--blue2)
        );

    font-weight:900;

    cursor:pointer;

    box-shadow:
        0 0 30px rgba(0,217,255,.2);
}

.submit:hover {

    box-shadow:
        0 0 40px rgba(0,217,255,.4);

    transform:translateY(-2px);
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
    Publier sur <span style="color:#00d9ff">SAMII</span>
</h1>

<div class="subtitle">
    Votre publication peut alimenter Marketplace
    et l'écosystème SAMII.
</div>

<form
    action="/marketplace/publier"
    method="POST"
>

<div class="group">

<label>
Titre de l'annonce
</label>

<input
    type="text"
    name="titre"
    required
    placeholder="Nom du produit ou service"
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

${optionsCategories}

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
    placeholder="Algérie, France, Maroc..."
>

</div>

<div class="group">

<label>
Ville
</label>

<input
    type="text"
    name="ville"
    placeholder="Alger, Paris..."
>

</div>

<div class="group">

<label>
Image du produit — URL
</label>

<input
    type="url"
    name="photo_url"
    placeholder="https://..."
>

</div>

<button
    class="submit"
    type="submit"
>
    🚀 Publier sur SAMII
</button>

</form>

</div>

</body>

</html>`);

});

// ==========================================================================
// PUBLICATION — POST
// ==========================================================================

router.post("/publier", requireAuth, async (req, res) => {

    try {

        const {
            titre,
            categorie,
            prix,
            pays,
            ville,
            photo_url
        } = req.body;

        await airtable.create(
            "ANNONCES",
            {
                titre,
                categorie,
                prix,
                pays:
                    pays ||
                    "International",
                ville:
                    ville ||
                    "",
                photo_url:
                    photo_url ||
                    "",
                vendeur_id:
                    "marchand_verified_" +
                    Date.now(),
                vendeur_nom:
                    "Boutique Partenaire Vérifiée",
                type_vendeur:
                    "marchand",
                actif: 1
            }
        );

        res.redirect(
            "/marketplace"
        );

    } catch (err) {

        console.error(
            "❌ Erreur publication Marketplace SAMII :",
            err
        );

        res.redirect(
            "/marketplace/publier?erreur=1"
        );

    }

});

module.exports = router;
