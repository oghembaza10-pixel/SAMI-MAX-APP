// ==========================================================================
// SAMII OS — MARKETPLACE — PostgreSQL — Upload photo réel (Cloudinary)
// FICHIER COMPLET — VERSION CORRIGÉE
// ==========================================================================

const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const db = require("../services/db");
const communautes = require("../config/communautes");
const journalService = require("../services/journalService");
const gradeService = require("../services/gradeService");
const chargily = require("../services/chargily");
const { confirmChargilyPayment } = require("../services/orders");
const devises = require("../services/devises");
const pixelsService = require("../services/pixelsService");
const socketService = require("../services/socketService");
const notify = require("../services/notify");
const CONFIG = require("../config");
const verificationService = require("../services/verificationService");

// Prix stockés en texte libre ("12.90 EUR", "8500 DZD"...). Pour les produits
// CJ (toujours en EUR), on affiche en plus la conversion DZD + MAD — marché
// parallèle pour le DZD (voir CONFIG.DEVISES), marché réel pour le MAD.
// Retourne du HTML déjà échappé — ne PAS ré-échapper le résultat, contrairement
// aux autres champs texte libre de ce fichier (le prix vient d'un formulaire
// marchand, donc potentiellement non fiable dans la branche "pas de match").
function prixAvecConversion(prixStr, COM) {
    const brut = prixStr || "Sur devis";
    const match = String(brut).match(/^([\d.,]+)\s*(EUR|€)$/i);
    if (!match) return escapeHtml(brut);

    const montantEur = Number(match[1].replace(",", ".")) || 0;
    if (!montantEur) return escapeHtml(brut);

    // Les devises montrées à côté de l'euro dépendent de qui regarde. Le
    // dinar algérien et le dirham marocain ne disent rien à quelqu'un de
    // Douala : le prix devient un chiffre qu'il faut aller convertir
    // ailleurs, donc un produit qu'on n'achète pas.
    //
    // Non déclaré = notre couple d'origine, pour que rien ne bouge chez nous.
    const cibles = COM?.marketplace?.conversions || ["DZD", "MAD"];
    const converties = cibles
        .map((d) => escapeHtml(devises.formater(devises.depuisEUR(montantEur, d), d)))
        .join(" / ");
    return `${montantEur.toFixed(2)}€ <span class="prix-converti">≈ ${converties}</span>`;
}
const { mobileNav } = require("../views/partials/mobileNav");

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

// Les descriptions importées depuis CJ/BigBuy contiennent du HTML brut
// (balises <img>, mise en page fournisseur) — sans ça, escapeHtml() les
// affiche telles quelles comme texte illisible (tout le code source visible).
function stripHtmlTags(value) {
    return String(value ?? "")
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, "\"")
        .replace(/&#0?39;/gi, "'")
        .replace(/\s+/g, " ")
        .trim();
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

// ==========================================================================
// MARKETPLACE
// ==========================================================================

// Ouvert à tous, sans compte — comme les grandes marketplaces : on ne
// demande une identité qu'au moment de vendre ou d'acheter, jamais pour
// simplement regarder.
router.get("/", async (req, res) => {

    // La communauté du SERVICE : elle décide du libellé de l'espace
    // local et des devises affichées à côté de l'euro.
    const COM = res.locals?.COM || null;

    const {
        categorie,
        recherche,
        pays,
        ville,
        region
    } = req.query;

    // Espace principal de navigation : produits vendus/expédiés localement
    // (region_fournisseur = 'local') vs catalogue d'import international
    // (toutes les autres régions). Les deux univers étaient mélangés dans un
    // seul flux trié par date — l'import (ajouté en masse par synchronisation
    // fournisseur) noyait systématiquement les rares annonces locales.
    const espace =
        req.query.espace === "local" || req.query.espace === "international"
            ? req.query.espace
            : "";

    // Filet de sécurité : le webhook Chargily peut ne jamais arriver (mauvaise
    // config côté dashboard, réseau...). Au retour du client sur cette page
    // après paiement, on revérifie activement le statut auprès de Chargily.
    let pixelPurchaseHtml = "";
    if (req.query.commande === "payee" && req.query.order_id) {
        try {
            const rows = await db.query(
                `SELECT chargily_checkout_id, montant, devise FROM commandes WHERE id = $1`,
                [req.query.order_id]
            );
            if (rows[0]?.chargily_checkout_id) {
                await confirmChargilyPayment(rows[0].chargily_checkout_id);
            }
            // Attribution par session (dernière boutique/produit visité) — pas
            // de découpage par vendeur pour un panier multi-vendeurs, cohérent
            // avec le fonctionnement standard des pixels pub (dernier contact).
            const pixels = await pixelsService.getPixels(req.session.pixelVendeurId);
            if (pixels && rows[0]) {
                pixelPurchaseHtml = pixelsService.pixelEventHtml(pixels, "Purchase", {
                    value: Number(rows[0].montant) || undefined,
                    currency: rows[0].devise || "EUR",
                    transactionId: req.query.order_id,
                });
            }
        } catch (err) {
            console.error("❌ Vérification retour paiement Chargily :", err.message);
        }
    }

    let annoncesDB = [];

    // ----------------------------------------------------------------------
    // DATABASE
    // ----------------------------------------------------------------------

    try {

        const clauses = ["actif = true"];
        const params = [];

        let index = 1;

        // ── CHACUNE SA MARKETPLACE ──────────────────────────────────────
        //
        // Sans ce filtre, sa Marketplace affiche nos 203 annonces : les
        // produits CJ, les fournisseurs importés, et les annonces de tous
        // les marchands de la plateforme. C'est la même fuite que le fil,
        // les discussions et le classement — elle revient à chaque table
        // qu'on n'a pas encore visitée, parce qu'une table sans notion de
        // communauté est globale par défaut.
        //
        // Le COALESCE range tout l'existant chez nous, ce qui est exact :
        // tout ce qui a été publié jusqu'ici l'a été chez nous. Sa
        // Marketplace démarre donc vide, et se remplit de ce que SES
        // membres y mettent.
        clauses.push(`COALESCE(communaute, $${index}) = $${index + 1}`);
        params.push(communautes.DEFAUT, (COM || communautes.get(communautes.DEFAUT)).slug);
        index += 2;

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

        if (espace === "local") {
            clauses.push(`region_fournisseur = 'local'`);
        } else if (espace === "international") {
            clauses.push(`(region_fournisseur IS DISTINCT FROM 'local')`);
        }

        const rows = await db.query(
            `
            SELECT *
            FROM annonces
            WHERE ${clauses.join(" AND ")}
            ORDER BY created_at DESC
            LIMIT 400
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

    // Effet réel de la carte Boost Visibilité (Coffre OG) : les annonces des
    // vendeurs avec un Boost actif remontent en tête de liste, sans changer
    // l'ordre entre elles (tri stable) ni entre les autres annonces.
    try {
        const boostRows = await db.query(
            `SELECT u.id AS user_id, w.coffre
             FROM utilisateurs u
             JOIN workspaces w ON w.id = u.workspace_boutique_id
             WHERE w.coffre IS NOT NULL AND w.coffre != ''`
        );
        const maintenant = Date.now();
        const vendeursBoostes = new Set();
        boostRows.forEach(r => {
            try {
                const activeUntil = JSON.parse(r.coffre)?.boost?.activeUntil;
                if (activeUntil && new Date(activeUntil).getTime() > maintenant) vendeursBoostes.add(r.user_id);
            } catch { /* ignore */ }
        });
        if (vendeursBoostes.size) {
            annoncesDB = [...annoncesDB].sort((a, b) =>
                (vendeursBoostes.has(b.vendeur_id) ? 1 : 0) - (vendeursBoostes.has(a.vendeur_id) ? 1 : 0)
            );
        }
    } catch (err) {
        console.warn("⚠️ Marketplace lecture boosts :", err.message);
    }

    // ----------------------------------------------------------------------
    // LISTING (déjà filtrée en SQL — categorie/region/espace)
    // ----------------------------------------------------------------------

    let toutesAnnonces = annoncesDB;

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
    // LE VISAGE DU VENDEUR
    //
    // « Il faut qu'on voie la photo de profil de la personne » — dans la
    // communauté comme sur la marketplace. La pastille du vendeur affichait
    // les deux lettres « OG » écrites en dur : notre marque, sur la page
    // d'une partenaire, à la place du visage de son membre.
    //
    // Requête à part plutôt qu'une jointure : la requête principale fait un
    // SELECT * dont dépend tout le reste de la page. Si celle-ci échoue, on
    // retombe sur les initiales et rien d'autre ne bouge.
    // ----------------------------------------------------------------------

    let vendeursParId = {};

    try {

        const ids = [...new Set(
            annoncesDB
                .map(a => a.vendeur_id)
                .filter(id => id !== null && id !== undefined && String(id).trim() !== "")
        )];

        if (ids.length) {

            const vRows = await db.query(
                `SELECT id, prenom, nom, photo_profil_url
                   FROM utilisateurs
                  WHERE id = ANY($1)`,
                [ids]
            );

            vRows.forEach(row => {
                vendeursParId[row.id] = row;
            });
        }

    } catch (err) {

        console.warn(
            "⚠️ vendeurs :",
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

    // "local" a désormais son propre onglet d'espace (voir espaceRowHtml) —
    // on ne le répète pas dans les chips de sous-filtre international.
    // Déclaré AVANT son premier usage : une constante lue avant sa
    // déclaration lève une ReferenceError, et toute la Marketplace serait
    // tombée en 500. C'est la troisième fois de la session que je fais
    // cette faute ; elle ne se voit qu'au rendu, jamais à la relecture.
    const avecFournisseurs = COM?.marketplace?.fournisseurs !== false;

    const regionChipsHtml = !avecFournisseurs ? "" :
        (SUPPLIER_REGIONS || [])
            .filter(r => r.id !== "local")
            .map(r => `
                <a
                    href="/marketplace?region=${encodeURIComponent(r.id)}&espace=international"
                    class="region-chip ${region === r.id ? "active" : ""}"
                >
                    <i data-lucide="${escapeHtml(r.icon || "globe")}"></i>
                    ${escapeHtml(r.label)}
                </a>
            `)
            .join("");

    // ── LES ESPACES : LOCAL / IMPORT ────────────────────────────────────
    //
    // « Tu enlèves ce qui est à nous : les fournisseurs. »
    //
    // « Import International » est notre catalogue de dropshipping — nos
    // accords, nos partenaires, nos 203 annonces. Chez elle, il ferait deux
    // promesses fausses : que ces produits sont disponibles, et qu'elle a un
    // réseau d'import qu'elle n'a pas.
    //
    // Et sans import, la distinction « Local / Import » n'a plus d'objet :
    // tout ce qui est chez elle EST local. On ne laisse donc pas un onglet
    // « Local » seul à côté de « Tout voir » — deux boutons qui donnent la
    // même liste, c'est une hésitation qu'on impose au visiteur pour rien.
    const espaceRowHtml = avecFournisseurs ? `
        <a
            href="/marketplace"
            class="espace-tab ${!espace ? "active" : ""}"
        >
            <i data-lucide="layout-grid"></i>
            Tout voir
        </a>
        <a
            href="/marketplace?espace=local"
            class="espace-tab espace-tab--local ${espace === "local" ? "active" : ""}"
        >
            ${escapeHtml(COM?.marketplace?.local || "🇩🇿 Algérie & Local")}
        </a>
        <a
            href="/marketplace?espace=international"
            class="espace-tab ${espace === "international" ? "active" : ""}"
        >
            🌍 Import International
        </a>
    ` : "";

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

                const prix = prixAvecConversion(a.prix, COM);

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

                // Son visage plutôt que nos deux lettres. Le repli n'est pas
                // « OG » — sur le service d'une partenaire, notre sigle n'a
                // rien à faire là — mais les initiales de la personne, et à
                // défaut de nom, l'icône de boutique.
                const fiche = vendeursParId[a.vendeur_id] || null;
                const initialesVendeur = isAI
                    ? "IA"
                    : (
                        ((fiche?.prenom || "").trim()[0] || "") +
                        ((fiche?.nom || "").trim()[0] || "")
                    ).toUpperCase() || "🏪";
                const photoVendeur = String(fiche?.photo_profil_url || "").trim();
                const avatarVendeur = `${initialesVendeur}${
                    photoVendeur && !isAI
                        ? `<img src="${escapeHtml(photoVendeur)}" alt="" loading="lazy" onerror="this.remove()">`
                        : ""}`;

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

                                ${vendeurLink
                                    ? `<a class="seller-avatar" href="${vendeurLink}">${avatarVendeur}</a>`
                                    : `<div class="seller-avatar">${avatarVendeur}</div>`}

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
    ${escapeHtml(COM && !COM.ecosysteme
        ? `Marketplace — ${COM.nom}`
        : (MARKETPLACE_NAME || "SAMII Marketplace"))}
</title>
${pixelPurchaseHtml}
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#070809">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">

<script src="https://unpkg.com/lucide@latest"></script>

<style>

:root {
    /* Mode OG : même identité noir/or/gris métal que le QG. Le slot --blue
       (accent secondaire, utilisé pour boutons/icônes/bordures partout
       dans ce fichier) devient un platine froid au lieu du cyan tech —
       les 33 catégories/cartes qui consomment var(--blue) suivent
       automatiquement, sans toucher à chaque règle une par une. */
    --blue: #C6CAD2;
    --blue-rgb: 198,202,210;
    --blue2: #9AA0AA;
    --bg: #03060b;
    --bg-rgb: 3,6,11;
    --panel: #09121d;
    --panel-rgb: 9,18,29;
    --panel2: #0c1825;
    --text: #f5fbff;
    --muted: #7f96a8;
    --border: rgba(198,202,210,.16);

    --gold: #D9B36C;
    --gold-bright: #F5DA92;
    --gold-soft: rgba(217,179,108,.09);
    --gold-border: rgba(217,179,108,.35);
    --silver-bright: #C6CAD2;
}

/* Sa palette, posée APRÈS la nôtre : à spécificité égale, la dernière
   règle gagne. Une communauté qui ne déclare pas de couleurs garde
   exactement l'apparence d'origine — donc rien ne change chez nous.

   La Marketplace était en noir et or, comme le QG. Sur une marque blanche
   et noire, c'était la seule page qui restait sombre : on voyait qu'on
   changeait de maison en y entrant. */
:root { ${COM ? communautes.styleDe(COM) : ""} }

/* Mode jour — le bouton lune/soleil (#themeBtn) est déjà câblé en JS
   (toggle de body.light + persistance localStorage), mais aucune règle
   CSS ne consommait la classe : le clic ne changeait donc rien à
   l'écran. On redéfinit les mêmes tokens que le reste de la page utilise
   déjà partout (var(--bg), var(--panel)...), donc tout se réadapte. */
body.light {
    --bg: #f4f7fa;
    --bg-rgb: 244,247,250;
    --panel: #ffffff;
    --panel-rgb: 255,255,255;
    --panel2: #eef2f6;
    --text: #0d1117;
    --muted: #57606a;
    --border: rgba(91,100,112,.18);

    --blue: #5B6470;
    --blue-rgb: 91,100,112;
    --blue2: #3F4750;

    --gold: #b78103;
    --gold-bright: #8a6102;
    --gold-soft: rgba(183,129,3,.08);
    --gold-border: rgba(183,129,3,.3);
    --silver-bright: #3a4552;
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
            rgba(var(--blue-rgb),.08),
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

    transition: background .4s ease, color .4s ease;
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
        rgba(var(--blue-rgb),.12);

    /* Le fond était écrit en dur (rgba(3,7,13,.94)) : sur une marque
       blanche, la colonne restait noire à côté d'un contenu clair, et on
       voyait qu'on changeait de maison en entrant. En passant par le jeton,
       elle suit la communauté — et ne change rien chez nous, où --panel EST
       ce noir-là. */
    background: var(--panel);

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
        rgba(var(--blue-rgb),.08);
}

.side-link.active {
    border:
        1px solid
        rgba(var(--blue-rgb),.14);
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
    background: rgba(var(--blue-rgb),.08);
}

.main {
    margin-left: 250px;
}

.header {
    position: sticky;
    top: 0;

    z-index: 15;

    background:
        rgba(var(--bg-rgb),.90);

    backdrop-filter: blur(20px);

    border-bottom:
        1px solid
        rgba(var(--blue-rgb),.08);
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
        rgba(var(--panel-rgb),.9);

    border-radius: 12px;

    overflow: hidden;
}

.search select {
    flex: 0 1 160px;
    min-width: 90px;

    padding: 12px 8px;

    border: none;

    border-right:
        1px solid
        var(--border);

    background: transparent;

    color: var(--muted);

    outline: none;

    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
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
        rgba(var(--panel-rgb),.8);

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

    -webkit-mask-image: linear-gradient(to right, transparent, #000 20px, #000 calc(100% - 20px), transparent);
    mask-image: linear-gradient(to right, transparent, #000 20px, #000 calc(100% - 20px), transparent);
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
        rgba(var(--blue-rgb),.10);

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
        rgba(var(--blue-rgb),.3);

    background:
        rgba(var(--blue-rgb),.07);
}

.region-row {
    padding-bottom: 14px;
}

.filters-topline {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 24px 16px;
}

.filters-topline .espace-row {
    padding: 0;
}

.espace-row {
    display: flex;
    gap: 8px;
    flex-wrap: nowrap;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    padding: 4px 24px 16px;
    flex: 1 1 auto;
    min-width: 0;
}

.espace-row::-webkit-scrollbar {
    display: none;
}

.espace-tab {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 18px;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: rgba(var(--panel2-rgb, 12,24,37),.5);
    color: var(--text);
    text-decoration: none;
    white-space: nowrap;
    font-size: 12px;
    font-weight: 800;
}

.espace-tab.active,
.espace-tab:hover {
    border-color: rgba(var(--blue-rgb),.4);
    background: rgba(var(--blue-rgb),.1);
    color: var(--blue);
}

.espace-tab--local {
    border-color: var(--gold-border);
    background: var(--gold-soft);
}

.espace-tab--local.active,
.espace-tab--local:hover {
    border-color: var(--gold);
    background: rgba(217,179,108,.16);
    color: var(--gold-bright);
}

.more-filters-toggle {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 16px;
    margin-left: auto;
    border-radius: 12px;
    border: 1px dashed rgba(var(--blue-rgb),.3);
    background: transparent;
    color: var(--muted);
    white-space: nowrap;
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
}

.more-filters-toggle:hover,
.more-filters-toggle.active {
    border-style: solid;
    border-color: rgba(var(--blue-rgb),.4);
    background: rgba(var(--blue-rgb),.1);
    color: var(--blue);
}

.more-filters-toggle svg {
    width: 14px;
    height: 14px;
}

.more-filters-toggle.open #moreFiltersChevron {
    transform: rotate(180deg);
}

.more-filters-badge {
    padding: 2px 8px;
    border-radius: 999px;
    background: rgba(var(--blue-rgb),.15);
    color: var(--blue);
    font-size: 10px;
}

.more-filters-panel {
    animation: filtersReveal .18s ease;
}

@keyframes filtersReveal {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
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

    -webkit-mask-image: linear-gradient(to right, transparent, #000 20px, #000 calc(100% - 20px), transparent);
    mask-image: linear-gradient(to right, transparent, #000 20px, #000 calc(100% - 20px), transparent);
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
        rgba(var(--panel-rgb),.8);

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
        rgba(var(--panel-rgb),.88);

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
        0 0 26px rgba(var(--blue-rgb),.12);
}

.product-card.is-ai {
    border-color:
        rgba(var(--blue-rgb),.18);
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
        rgba(var(--bg-rgb),.78);

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
        rgba(var(--bg-rgb),.72);

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
        rgba(var(--blue-rgb),.08);

    color: var(--blue);

    font-size: 8px;
    font-weight: 900;

    /* La photo se pose par-dessus les initiales, qui restent dessous :
       une adresse morte découvre le repli au lieu d'une icône cassée. */
    position: relative;
    overflow: hidden;
}

.seller-avatar img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
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
    border-color: rgba(var(--blue-rgb),.3);
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

.cart-delivery {
    padding: 0 15px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    border-top: 1px solid var(--border);
    padding-top: 12px;
}

.cart-input {
    width: 100%;
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: rgba(0,0,0,.3);
    color: #f5fbff;
    font-size: 13px;
    font-family: inherit;
    outline: none;
}

.cart-input:focus {
    border-color: var(--blue);
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
        rgba(var(--blue-rgb),.08);
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

        height: 64px;

        display: grid;
        grid-template-columns: repeat(5, 1fr);

        padding: 8px 4px;

        background:
            rgba(var(--bg-rgb),.95);

        border-top:
            1px solid
            var(--border);

        z-index: 30;
    }

    .mobile-nav a {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 3px;

        min-width: 0;

        color: var(--muted);

        text-decoration: none;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;

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
                ${escapeHtml(COM && !COM.ecosysteme ? COM.sigle : "OG")}
            </div>

            <div class="brand-name">
                ${escapeHtml(COM && !COM.ecosysteme ? COM.marque : "SAMII")}
                <span>
                    ${escapeHtml(COM && !COM.ecosysteme ? COM.marqueSuite : "TECHNOLOGY")}
                </span>
            </div>

        </div>

        <nav>
${(() => {
    // ── SA COLONNE, PAS LA NÔTRE ────────────────────────────────────────
    //
    // Ces sept entrées étaient écrites en dur : QG Central, Marketplace,
    // Communauté, Demandes de service, Discussions, Arsenal, Academy.
    // Sur son service, la Marketplace qu'on vient de lui ouvrir servait
    // donc le sommaire de tout ce qu'on ne lui a PAS donné — et les liens
    // menaient à des pages que la porte referme, donc à des rebonds.
    //
    // Même registre que partout ailleurs : config/modules-qg.js, filtré par
    // ce à quoi sa communauté a droit.
    const modulesQg = require("../config/modules-qg");
    const laCom = COM || communautes.get(communautes.DEFAUT);
    const ctx = { userId: req.session?.userId || "" };
    const LIBELLES = { affaires: "QG Central", communaute: "Communauté" };
    const entrees = modulesQg.autorises(laCom)
        .filter((m) => ["affaires", "marketplace", "communaute", "academy", "discussions", "arsenal", "assistant"].includes(m.id));
    // « Demandes de service » appartient à la Marketplace : elle suit donc
    // le module marketplace, et disparaît avec lui.
    const extra = entrees.some((m) => m.id === "marketplace")
        ? [{ href: "/marketplace/services-demandes", icone: "concierge-bell", libelle: "Demandes de service" }]
        : [];
    const lignes = entrees.map((m) => ({
        href: modulesQg.lien(m, laCom, ctx),
        icone: m.icone,
        libelle: m.id === "assistant" ? laCom.assistant : (LIBELLES[m.id] || m.libelle),
        cle: m.cle,
    }));
    // On insère les demandes de service juste après la Marketplace, là où
    // elles étaient.
    const i = lignes.findIndex((l) => l.href === "/marketplace");
    if (i >= 0) lignes.splice(i + 1, 0, ...extra.map((e) => ({ ...e, cle: "" })));
    return lignes.map((l) => `
            <a href="${l.href}" class="side-link">
                <i data-lucide="${escapeHtml(l.icone)}"></i>
                <span${l.cle ? ` data-i18n="${escapeHtml(l.cle)}"` : ""}>${escapeHtml(l.libelle)}</span>
            </a>`).join("");
})()}
        </nav>

    </div>

    <div class="side-bottom">

        <div class="side-ai">
            <span class="side-ai-dot"></span>
            ${COM && !COM.ecosysteme
                ? `<span>${escapeHtml(COM.moteur)}</span>`
                : `<span data-i18n="marketplace.sideAi">SAMII ENGINE ACTIVE</span>`}
        </div>

        ${COM && !COM.ecosysteme
            ? `<div class="side-text">${escapeHtml(COM.moteurTexte)}</div>`
            : `<div class="side-text" data-i18n="marketplace.sideText">
            Marketplace synchronisée avec
            l'écosystème SAMII.
        </div>`}

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
                ${escapeHtml(COM && !COM.ecosysteme ? COM.sigle : "OG")}
            </div>

            ${escapeHtml(COM && !COM.ecosysteme ? COM.marque : "SAMII")}

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

        <a href="/marketplace/lien-externe"
           style="display:flex;align-items:center;gap:6px;padding:9px 14px;border-radius:20px;
                  background:rgba(95,212,255,0.08);border:1px solid rgba(95,212,255,0.3);
                  color:var(--cyan-tech,#5FD4FF);text-decoration:none;font-size:.82rem;
                  font-weight:600;white-space:nowrap;">
            <i data-lucide="link" style="width:15px;height:15px;"></i>
            <span data-i18n="marketplace.lienExterneCta">Pas trouvé ? Colle un lien →</span>
        </a>

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

    <div class="filters-topline">

        <div class="espace-row">
            ${espaceRowHtml}
        </div>

        <button
            type="button"
            class="more-filters-toggle ${region ? "active open" : ""}"
            id="moreFiltersToggle"
            onclick="toggleMoreFilters()"
        >
            <i data-lucide="sliders-horizontal"></i>
            <span data-i18n="marketplace.moreFilters">Plus de filtres</span>
            ${region ? `<span class="more-filters-badge">${escapeHtml(supplierRegionLabel(region))}</span>` : ""}
            <i data-lucide="chevron-down" id="moreFiltersChevron"></i>
        </button>

    </div>

    <div class="more-filters-panel" id="moreFiltersPanel" ${region ? "" : `style="display:none;"`}>

        ${(espace !== "local" && avecFournisseurs) ? `
        <div class="region-row">

            <a
                href="/marketplace${espace === "international" ? "?espace=international" : ""}"
                class="region-chip ${!region ? "active" : ""}"
            >
                <i data-lucide="globe"></i>
                <span data-i18n="marketplace.allRegions">Toutes régions</span>
            </a>

            ${regionChipsHtml}

        </div>
        ` : ""}

        <div class="services-row">

            ${SERVICES_CHIPS_HTML}

        </div>

    </div>

</header>

<main class="content">

    <section class="hero">

        <div>

            <div class="hero-kicker">

                <span class="live-dot"></span>

                ${COM && !COM.ecosysteme
                    ? `<span>${escapeHtml(COM.marque)} ${escapeHtml(COM.marqueSuite)} · MARKETPLACE</span>`
                    : `<span data-i18n="marketplace.live">SAMII MARKETPLACE · LIVE</span>`}

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
                : espace === "local"
                    ? `
                        <div class="empty">

                            <i data-lucide="map-pin"></i>

                            <h3>
                                Aucune annonce locale pour l'instant
                            </h3>

                            <p style="color:var(--muted);font-size:12px;margin:8px 0 16px;">
                                ${escapeHtml(COM?.marketplace?.exemples
                                    || "Vélo, chambre à louer, service, produit d'un grossiste algérien…")}
                                Sois le premier à publier ici.
                            </p>

                            <a
                                href="/marketplace/publier"
                                class="espace-tab espace-tab--local"
                                style="display:inline-flex;"
                            >
                                <i data-lucide="plus"></i>
                                Publier une annonce locale
                            </a>

                        </div>
                      `
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
            <span>${escapeHtml(COM && !COM.ecosysteme ? COM.marque : "SAMII")}</span>
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

    <div class="cart-delivery" id="cartDelivery" style="display:none;">
        <input id="ci-nom" class="cart-input" placeholder="Nom complet">
        <input id="ci-telephone" class="cart-input" placeholder="Téléphone">
        <input id="ci-email" class="cart-input" type="email" placeholder="Email (pour suivre ta commande)">
        <input id="ci-adresse" class="cart-input" placeholder="Adresse de livraison">
        <div style="display:flex;gap:8px;">
            <input id="ci-ville" class="cart-input" placeholder="Ville" style="flex:1;">
            <input id="ci-pays" class="cart-input" placeholder="Pays" style="flex:1;">
        </div>
    </div>

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

${mobileNav("/marketplace", COM, { userId: req.session?.userId })}

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

function toggleMoreFilters() {
    const panel = document.getElementById("moreFiltersPanel");
    const toggle = document.getElementById("moreFiltersToggle");
    if (!panel || !toggle) return;
    const isOpen = panel.style.display !== "none";
    panel.style.display = isOpen ? "none" : "";
    toggle.classList.toggle("open", !isOpen);
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

    const delivery = document.getElementById("cartDelivery");

    if (!cart.length) {

        container.innerHTML =
            '<div class="cart-empty">' +
                '<i data-lucide="shopping-bag"></i>' +
                '<p>Panier vide.</p>' +
            '</div>';

        total.textContent =
            "0";

        if (delivery) delivery.style.display = "none";

        if (
            typeof lucide !== "undefined"
        ) {
            lucide.createIcons();
        }

        return;
    }

    if (delivery) delivery.style.display = "flex";

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

async function checkout() {

    if (!cart.length) {
        showToast("Panier vide.");
        return;
    }

    const nom       = document.getElementById("ci-nom")?.value.trim() || "";
    const telephone = document.getElementById("ci-telephone")?.value.trim() || "";
    const email     = document.getElementById("ci-email")?.value.trim() || "";
    const adresse   = document.getElementById("ci-adresse")?.value.trim() || "";
    const ville     = document.getElementById("ci-ville")?.value.trim() || "";
    const pays      = document.getElementById("ci-pays")?.value.trim() || "";

    if (!nom || !telephone || !adresse) {
        showToast("Renseigne ton nom, téléphone et adresse.");
        return;
    }
    if (!email || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
        showToast("Un email valide est nécessaire pour suivre ta commande.");
        return;
    }

    const btn = document.querySelector(".checkout");
    if (btn) { btn.disabled = true; btn.textContent = "Envoi..."; }

    try {
        const res = await fetch("/marketplace/commander", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items: cart, nom_client: nom, telephone, email, adresse, ville, pays }),
        });
        const data = await res.json();

        if (data.success) {
            cart = [];
            saveCart();
            renderCart();
            updateCartBadge();

            if (data.checkoutUrl) {
                showToast("✅ Redirection vers le paiement...");
                window.location.href = data.checkoutUrl;
                return;
            }

            showToast(data.paymentError || "✅ Commande envoyée ! On te contacte pour confirmer.");
            toggleCart();
        } else {
            showToast(data.error || "Erreur, réessaye.");
        }
    } catch (err) {
        showToast("Erreur réseau, réessaye.");
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = "Commander"; }
    }
}

renderCart();
updateCartBadge();

</script>

<script src="/js/i18n.js"></script>
<script src="/js/pwa-register.js"></script>

</body>
</html>
`);
});

// ==========================================================================
// COMMANDE — panier réel (jusque-là "Commander" n'envoyait rien)
// ==========================================================================

function parseMontantEtDevise(prixStr) {
    const match = String(prixStr || "").match(/^([\d.,]+)\s*([A-Z]{2,4})?/);
    if (!match) return { montant: 0, devise: "DZD" };
    const montant = Number(match[1].replace(",", ".")) || 0;
    return { montant, devise: match[2] || "DZD" };
}

// Un achat marketplace/lien externe n'a par défaut aucun workspace (vente
// plateforme) — mais si l'acheteur vient de la boutique d'un marchand (même
// attribution que les pixels pub, voir pixelsService), et que ce marchand a
// choisi un QG dans Réglages > Ma boutique, la commande y remonte comme
// n'importe quelle autre commande workspace (QG + notif Telegram incluses).
async function resoudreWorkspaceBoutique(req) {
    if (!req.session.pixelVendeurId) return null;
    try {
        const rows = await db.query(
            `SELECT workspace_boutique_id FROM utilisateurs WHERE id = $1`,
            [req.session.pixelVendeurId]
        );
        return rows[0]?.workspace_boutique_id || null;
    } catch {
        return null;
    }
}

async function notifierNouvelleCommandeBoutique(workspaceId, orderId, resume) {
    if (!workspaceId) return;
    try {
        await journalService.log({ action: "commande.creee.boutique", details: `#${orderId.slice(0, 8)} — ${resume.nom} (${resume.montant} ${resume.devise})`, workspaceId, montant: resume.montant, refId: orderId });
        socketService.emitToShop(workspaceId, "nouvelle-commande", { id: orderId });
        notify.notifyWorkspace(workspaceId, {
            title: "🛍️ Nouvelle commande boutique",
            body: `${resume.nom} — ${resume.montant} ${resume.devise}`,
            url: "/qg",
        });
        await require("../services/telegramService").notifyAdmin(
            workspaceId,
            `🛍️ *Nouvelle commande boutique !*\n\n🆔 *Numéro :* \`${orderId.slice(0, 8)}\`\n👤 *Client :* ${resume.nom}\n📞 *Tél :* ${resume.telephone}\n📦 *Produit :* ${resume.produit}\n💰 *Montant :* ${resume.montant} ${resume.devise}`
        );
    } catch (err) {
        console.error("❌ notifierNouvelleCommandeBoutique :", err.message);
    }
}

// Achat ouvert à tous, avec ou sans compte — seul un email est demandé, au
// moment de commander, pour pouvoir suivre la commande (comme les grandes
// marketplaces qui autorisent l'achat invité).
router.post(
    "/commander",
    async (req, res) => {
        try {
            const { items, nom_client, telephone, adresse, ville, pays, email } = req.body;

            if (!Array.isArray(items) || !items.length) {
                return res.json({ success: false, error: "Panier vide." });
            }
            if (!nom_client?.trim() || !telephone?.trim() || !adresse?.trim()) {
                return res.json({ success: false, error: "Nom, téléphone et adresse sont obligatoires." });
            }
            if (!email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
                return res.json({ success: false, error: "Un email valide est nécessaire pour suivre ta commande." });
            }

            let montantTotal = 0;
            let devise = "DZD";
            const lignes = items.map((it) => {
                const qty = Number(it.quantity) || 1;
                const { montant, devise: d } = parseMontantEtDevise(it.prix);
                montantTotal += montant * qty;
                devise = d;
                return `${it.titre || "Produit"}${it.variante ? ` (${it.variante})` : ""} x${qty}`;
            });

            const id = crypto.randomUUID();
            const workspaceId = await resoudreWorkspaceBoutique(req);
            const produitResume = lignes.join(" · ");

            await db.query(
                `INSERT INTO commandes
                    (id, workspace_id, nom_client, telephone, email, adresse, pays, ville, produit, montant, devise, statut, source)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'en attente','marketplace')`,
                [id, workspaceId, nom_client.trim(), telephone.trim(), email.trim(), adresse.trim(), (pays || "").trim(), (ville || "").trim(), produitResume, montantTotal, devise]
            );

            await notifierNouvelleCommandeBoutique(workspaceId, id, {
                nom: nom_client.trim(), telephone: telephone.trim(), produit: produitResume, montant: montantTotal, devise,
            });

            // Paiement en ligne réel (Chargily n'accepte que le DZD — nos prix
            // marketplace sont en EUR, on convertit uniquement pour ce paiement,
            // le montant/devise enregistrés en base restent ceux affichés au client).
            if (chargily.isEnabled()) {
                const montantDzd = devise === "DZD"
                    ? Math.round(montantTotal)
                    : Math.round(montantTotal * CONFIG.CHARGILY.EUR_TO_DZD_RATE);

                const checkout = await chargily.createCheckout({
                    amount: montantDzd,
                    currency: "dzd",
                    description: `Commande SAMII Marketplace #${id.slice(0, 8)}`,
                    successUrl: `${CONFIG.APP_URL}/marketplace?commande=payee&order_id=${id}`,
                    failureUrl: `${CONFIG.APP_URL}/marketplace?commande=echouee`,
                    webhookUrl: `${CONFIG.APP_URL}/webhook/chargily`,
                    metadata: { order_id: id },
                });

                if (checkout.success) {
                    await db.query(`UPDATE commandes SET chargily_checkout_id = $1 WHERE id = $2`, [checkout.checkoutId, id]);
                    return res.json({ success: true, id, checkoutUrl: checkout.checkoutUrl });
                }

                console.error("❌ Chargily checkout (commande marketplace) :", checkout.error);
                // Le paiement en ligne a échoué à se créer, mais la commande existe déjà
                // (statut "en attente") — on le signale au client plutôt que de la perdre.
                return res.json({ success: true, id, paymentError: "Paiement en ligne indisponible pour le moment, on te contacte pour confirmer." });
            }

            res.json({ success: true, id });
        } catch (err) {
            console.error("❌ POST /marketplace/commander :", err.message);
            res.json({ success: false, error: "Erreur serveur." });
        }
    }
);

// ==========================================================================
// LIEN EXTERNE — produit trouvé sur Amazon/AliExpress/etc., absent du
// catalogue. Extraction best-effort (titre/photo/prix), sinon le client
// complète lui-même. Marge de service : 1€ fixe + 15% du prix produit.
// ==========================================================================
const extractionProduit = require("../services/extractionProduit");
const FRAIS_SERVICE_FIXE_EUR = 1;
const FRAIS_SERVICE_POURCENT = 0.15;

function convertirEnEUR(montant, devise) {
    if (!Number.isFinite(montant)) return null;
    const d = CONFIG.DEVISES;
    switch (String(devise || "EUR").toUpperCase()) {
        case "EUR": return montant;
        case "USD": return montant / d.EUR_TO_USD;
        default:    return montant; // devise non gérée par le convertisseur → traitée telle quelle, affichée au client pour vérif
    }
}

router.get("/lien-externe", (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Produit externe — SAMII Marketplace</title>
<script src="https://unpkg.com/lucide@latest"></script>
<style>
:root { --bg:#03060b; --panel:rgba(9,18,29,.9); --text:#f5fbff; --muted:#7f96a8; --blue:#00d9ff; --blue-2:#0077ff; --border:rgba(0,217,255,.16); --gold:#d4af37; }
* { box-sizing:border-box; }
body { margin:0; min-height:100vh; background:var(--bg); color:var(--text); font-family:Inter,system-ui,sans-serif; padding:24px 16px 80px; }
.le-shell { max-width:480px; margin:0 auto; }
.back { display:inline-flex; align-items:center; gap:6px; color:var(--muted); text-decoration:none; font-size:12.5px; margin-bottom:16px; }
h1 { font-size:19px; margin:0 0 6px; }
p.sub { color:var(--muted); font-size:12.5px; margin:0 0 22px; line-height:1.5; }
.le-card { background:var(--panel); border:1px solid var(--border); border-radius:18px; padding:22px; margin-bottom:16px; }
label { display:block; font-size:11px; text-transform:uppercase; letter-spacing:.05em; color:var(--muted); margin:14px 0 6px; }
label:first-of-type { margin-top:0; }
input, select { width:100%; padding:12px 13px; border-radius:10px; border:1px solid var(--border); background:rgba(0,0,0,.3); color:var(--text); font-size:13.5px; font-family:inherit; outline:none; }
input:focus, select:focus { border-color:var(--blue); }
.row2 { display:flex; gap:10px; }
.row2 > div { flex:1; }
.btn { width:100%; padding:13px; margin-top:14px; border:none; border-radius:10px; font-weight:700; font-size:13.5px; cursor:pointer; }
.btn-blue { background:linear-gradient(135deg,var(--blue),var(--blue-2)); color:#001018; }
.btn-blue:disabled { opacity:.5; cursor:not-allowed; }
.status { text-align:center; font-size:12.5px; margin-top:10px; min-height:16px; color:var(--blue); }
.status.err { color:#ff6b6b; }
#step2 { display:none; }
.le-preview { display:flex; gap:12px; align-items:center; margin-bottom:6px; }
.le-preview img { width:56px; height:56px; border-radius:10px; object-fit:cover; background:#0a0d14; border:1px solid var(--border); }
.le-breakdown { font-size:12.5px; color:var(--muted); line-height:1.9; border-top:1px solid var(--border); margin-top:16px; padding-top:14px; }
.le-breakdown strong { color:var(--gold); }
.le-total { display:flex; justify-content:space-between; font-size:15px; font-weight:800; color:#fff; margin-top:8px; }
</style>
</head>
<body>
<div class="le-shell">
    <a href="/marketplace" class="back"><i data-lucide="arrow-left"></i> Retour au marketplace</a>
    <h1>🔗 Produit trouvé ailleurs ?</h1>
    <p class="sub">Colle le lien du produit (Amazon, AliExpress, autre site...) — on l'achète pour toi et on te le livre. Frais de service : 1€ + 15% du prix produit.</p>

    <div class="le-card" id="step1">
        <label>Lien du produit</label>
        <input type="url" id="url" placeholder="https://...">
        <button type="button" class="btn btn-blue" id="analyserBtn">🔍 Analyser le lien</button>
        <div class="status" id="status1"></div>
    </div>

    <div class="le-card" id="step2">
        <div class="le-preview">
            <img id="prevImg" src="" alt="">
            <div style="flex:1;">
                <label style="margin:0 0 4px;">Titre du produit</label>
                <input type="text" id="titre" placeholder="Titre du produit">
            </div>
        </div>
        <div class="row2">
            <div>
                <label>Prix produit</label>
                <input type="number" step="0.01" id="prix" placeholder="0.00">
            </div>
            <div>
                <label>Devise</label>
                <select id="devise">
                    <option value="EUR">EUR €</option>
                    <option value="USD">USD $</option>
                    <option value="GBP">GBP £</option>
                    <option value="CNY">CNY ¥</option>
                </select>
            </div>
        </div>

        <div class="le-breakdown" id="breakdown"></div>

        <label>Nom complet</label>
        <input type="text" id="nom_client" placeholder="Ton nom">
        <label>Téléphone</label>
        <input type="text" id="telephone" placeholder="06...">
        <label>Email (pour suivre ta commande)</label>
        <input type="email" id="email" placeholder="toi@exemple.com">
        <label>Adresse de livraison</label>
        <input type="text" id="adresse" placeholder="Adresse complète">
        <div class="row2">
            <div><label>Ville</label><input type="text" id="ville" placeholder="Ville"></div>
            <div><label>Pays</label><input type="text" id="pays" placeholder="Pays"></div>
        </div>

        <button type="button" class="btn btn-blue" id="commanderBtn">💳 Payer maintenant</button>
        <div class="status" id="status2"></div>
    </div>
</div>

<script>
lucide.createIcons();
const FRAIS_FIXE = ${FRAIS_SERVICE_FIXE_EUR};
const FRAIS_POURCENT = ${FRAIS_SERVICE_POURCENT};

document.getElementById('analyserBtn').addEventListener('click', async () => {
    const url = document.getElementById('url').value.trim();
    const status1 = document.getElementById('status1');
    if (!url) { status1.className = 'status err'; status1.textContent = 'Colle un lien d\\'abord.'; return; }

    status1.className = 'status'; status1.textContent = '⏳ Analyse en cours...';
    try {
        const res = await fetch('/marketplace/lien-externe/extraire', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url }),
        });
        const json = await res.json();

        document.getElementById('titre').value = json.titre || '';
        document.getElementById('prix').value = json.prix || '';
        document.getElementById('devise').value = json.devise || 'EUR';
        if (json.image) document.getElementById('prevImg').src = json.image;

        status1.textContent = json.success ? '✅ Vérifie les infos ci-dessous, corrige si besoin.' : '';
        if (!json.success) { status1.className = 'status err'; status1.textContent = json.error || 'Analyse impossible, remplis les champs toi-même ci-dessous.'; }

        document.getElementById('step2').style.display = 'block';
        document.getElementById('step2').scrollIntoView({ behavior: 'smooth' });
        recalculer();
    } catch (err) {
        status1.className = 'status err';
        status1.textContent = 'Erreur réseau — remplis les champs manuellement ci-dessous.';
        document.getElementById('step2').style.display = 'block';
    }
});

function recalculer() {
    const prix = parseFloat(document.getElementById('prix').value) || 0;
    const frais = FRAIS_FIXE + prix * FRAIS_POURCENT;
    const total = prix + frais;
    const devise = document.getElementById('devise').value;
    document.getElementById('breakdown').innerHTML =
        'Prix produit : <strong>' + prix.toFixed(2) + ' ' + devise + '</strong><br>' +
        'Frais de service (1€ + 15%) : <strong>' + frais.toFixed(2) + ' ' + devise + '</strong>' +
        '<div class="le-total"><span>Total à payer</span><span>' + total.toFixed(2) + ' ' + devise + '</span></div>';
}
document.getElementById('prix').addEventListener('input', recalculer);
document.getElementById('devise').addEventListener('change', recalculer);

document.getElementById('commanderBtn').addEventListener('click', async () => {
    const status2 = document.getElementById('status2');
    const payload = {
        url: document.getElementById('url').value.trim(),
        titre: document.getElementById('titre').value.trim(),
        image: document.getElementById('prevImg').src || '',
        prix: parseFloat(document.getElementById('prix').value) || 0,
        devise: document.getElementById('devise').value,
        nom_client: document.getElementById('nom_client').value.trim(),
        telephone: document.getElementById('telephone').value.trim(),
        email: document.getElementById('email').value.trim(),
        adresse: document.getElementById('adresse').value.trim(),
        ville: document.getElementById('ville').value.trim(),
        pays: document.getElementById('pays').value.trim(),
    };

    if (!payload.titre || !payload.prix || !payload.nom_client || !payload.telephone || !payload.adresse) {
        status2.className = 'status err';
        status2.textContent = 'Titre, prix, nom, téléphone et adresse sont obligatoires.';
        return;
    }
    if (!payload.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
        status2.className = 'status err';
        status2.textContent = 'Un email valide est nécessaire pour suivre ta commande.';
        return;
    }

    const btn = document.getElementById('commanderBtn');
    btn.disabled = true; btn.textContent = '⏳ Création de la commande...';
    status2.className = 'status'; status2.textContent = '';

    try {
        const res = await fetch('/marketplace/lien-externe/commander', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (json.success && json.checkoutUrl) {
            window.location.href = json.checkoutUrl;
        } else if (json.success) {
            status2.textContent = '✅ Commande enregistrée — ' + (json.paymentError || 'on te contacte pour le paiement.');
            btn.textContent = '✅ Commande envoyée';
        } else {
            status2.className = 'status err';
            status2.textContent = json.error || 'Erreur.';
            btn.disabled = false; btn.textContent = '💳 Payer maintenant';
        }
    } catch (err) {
        status2.className = 'status err';
        status2.textContent = 'Erreur réseau, réessaie.';
        btn.disabled = false; btn.textContent = '💳 Payer maintenant';
    }
});
</script>
</body>
</html>`);
});

router.post("/lien-externe/extraire", requireAuth, async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.json({ success: false, error: "Lien manquant." });
        const result = await extractionProduit.extraireProduit(url);
        res.json(result);
    } catch (err) {
        console.error("❌ POST /marketplace/lien-externe/extraire :", err.message);
        res.json({ success: false, error: "Erreur serveur." });
    }
});

router.post("/lien-externe/commander", async (req, res) => {
    try {
        const { url, titre, image, prix, devise, nom_client, telephone, adresse, ville, pays, email } = req.body;

        if (!url || !titre || !prix || !nom_client?.trim() || !telephone?.trim() || !adresse?.trim()) {
            return res.json({ success: false, error: "Lien, titre, prix, nom, téléphone et adresse sont obligatoires." });
        }
        if (!email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            return res.json({ success: false, error: "Un email valide est nécessaire pour suivre ta commande." });
        }

        const prixEUR = convertirEnEUR(Number(prix), devise);
        if (!prixEUR || prixEUR <= 0) return res.json({ success: false, error: "Prix invalide." });

        const fraisEUR = FRAIS_SERVICE_FIXE_EUR + prixEUR * FRAIS_SERVICE_POURCENT;
        const totalEUR = prixEUR + fraisEUR;

        const id = crypto.randomUUID();
        const workspaceId = await resoudreWorkspaceBoutique(req);
        await db.query(
            `INSERT INTO commandes
                (id, workspace_id, nom_client, telephone, email, adresse, pays, ville, produit, montant, devise, statut, source,
                 url_produit, titre_produit, image_produit, prix_source, devise_source, frais_service)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'EUR','en attente','lien_externe',$11,$12,$13,$14,$15,$16)`,
            [
                id, workspaceId, nom_client.trim(), telephone.trim(), email.trim(), adresse.trim(), (pays || "").trim(), (ville || "").trim(),
                titre.trim(), totalEUR.toFixed(2),
                url, titre.trim(), image || "", Number(prix), (devise || "EUR").toUpperCase(), fraisEUR.toFixed(2),
            ]
        );

        await notifierNouvelleCommandeBoutique(workspaceId, id, {
            nom: nom_client.trim(), telephone: telephone.trim(), produit: titre.trim(), montant: totalEUR.toFixed(2), devise: "EUR",
        });

        if (chargily.isEnabled()) {
            const montantDzd = Math.round(totalEUR * CONFIG.CHARGILY.EUR_TO_DZD_RATE);
            const checkout = await chargily.createCheckout({
                amount: montantDzd,
                currency: "dzd",
                description: `SAMII — Achat externe #${id.slice(0, 8)} : ${titre.slice(0, 60)}`,
                successUrl: `${CONFIG.APP_URL}/marketplace?commande=payee&order_id=${id}`,
                failureUrl: `${CONFIG.APP_URL}/marketplace?commande=echouee`,
                webhookUrl: `${CONFIG.APP_URL}/webhook/chargily`,
                metadata: { order_id: id },
            });

            if (checkout.success) {
                await db.query(`UPDATE commandes SET chargily_checkout_id = $1 WHERE id = $2`, [checkout.checkoutId, id]);
                return res.json({ success: true, id, checkoutUrl: checkout.checkoutUrl });
            }

            console.error("❌ Chargily checkout (lien externe) :", checkout.error);
            return res.json({ success: true, id, paymentError: "Paiement en ligne indisponible pour le moment, on te contacte pour confirmer." });
        }

        res.json({ success: true, id });
    } catch (err) {
        console.error("❌ POST /marketplace/lien-externe/commander :", err.message);
        res.json({ success: false, error: "Erreur serveur." });
    }
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

    // La communauté du SERVICE : elle décide du libellé de l'espace
    // local et des devises affichées à côté de l'euro.
    const COM = res.locals?.COM || null;

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

                    -- Ses favoris chez elle : sans ça, un produit mis de
                    -- côté chez nous réapparaît dans sa liste à elle.
                    AND COALESCE(a.communaute, $2) = $3

                    AND
                        a.actif = true

                    ORDER BY
                        f.created_at DESC
                    `,
                    [
                        req.session.userId,
                        communautes.DEFAUT,
                        (COM || communautes.get(communautes.DEFAUT)).slug
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
                                            ${prixAvecConversion(annonce.prix, COM)}
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
    async (req, res) => {

    // La communauté du SERVICE : elle décide du libellé de l'espace
    // local et des devises affichées à côté de l'euro.
    const COM = res.locals?.COM || null;

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
        let pixelViewContentHtml = "";

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
                    -- Ouvrir une fiche produit se faisait sur le seul
                    -- numéro. Les identifiants se suivent : un membre de
                    -- chez elle voyait n'importe lequel de nos 203 produits
                    -- en tapant un entier, sur SON domaine et sous SA
                    -- marque. C'est la porte qu'on a déjà fermée deux fois
                    -- ailleurs, et qui reste ouverte tant qu'on ne l'a pas
                    -- fermée table par table.
                    AND COALESCE(communaute, $2) = $3
                    `,
                    [id, communautes.DEFAUT, (COM || communautes.get(communautes.DEFAUT)).slug]
                );

            produit =
                rows[0];

            if (!produit) {

                return res.redirect(
                    "/marketplace"
                );
            }

            // Attribution pub : un clic direct depuis une pub vers une fiche
            // produit rattache aussi la navigation à ce vendeur (pas seulement
            // en arrivant par son sous-domaine).
            if (pixelsService.estVendeurReel(produit.vendeur_id)) {
                req.session.pixelVendeurId = produit.vendeur_id;
            }
            const pixels = await pixelsService.getPixels(req.session.pixelVendeurId);
            if (pixels) {
                const { montant: prixNum } = parseMontantEtDevise(produit.prix);
                pixelViewContentHtml = pixelsService.pixelEventHtml(pixels, "ViewContent", {
                    value: prixNum || undefined,
                    contentId: String(produit.id),
                    contentName: produit.titre,
                });
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

        function parseJsonColumn(value) {
            if (!value) return [];
            if (Array.isArray(value)) return value;
            try {
                const parsed = typeof value === "string" ? JSON.parse(value) : value;
                return Array.isArray(parsed) ? parsed : [];
            } catch {
                return [];
            }
        }

        const videos = parseJsonColumn(produit.videos);
        const variantesBrutes = parseJsonColumn(produit.variantes);

        // Les variantes CJ n'ont pas de format fixe. "variantNameEn" répète le
        // titre entier du produit (ex: "Waist Trainer ... Skin1 Black1 XS S") —
        // l'utiliser comme libellé de bouton affichait le nom complet du
        // produit répété jusqu'à 77 fois. "variantKey" est le seul champ court
        // et fiable ("Skin1 Black1-XS S", "Black set-4XL"...).
        const variantes = variantesBrutes.map((v, i) => {
            const nom =
                v.variantKey || v.variantName ||
                [v.variantKey1, v.variantKey2].filter(Boolean).join(" / ") ||
                v.variantNameEn || v.name ||
                `Option ${i + 1}`;
            const prix = v.variantSellPrice ?? v.sellPrice ?? v.price ?? null;
            const image = v.variantImage || v.image || null;
            const vid = v.vid || v.variantId || v.variantID || String(i);
            return { vid: String(vid), nom: String(nom).trim(), prix, image };
        }).filter(v => v.nom);

        // Beaucoup de produits CJ ont des dizaines de variantes brutes (une
        // par combinaison couleur×taille) — un mur de boutons oblige à
        // scroller longtemps avant de pouvoir choisir puis payer. Quand
        // TOUTES les clés suivent le motif "A-B" (le cas standard CJ), on les
        // scinde en deux sélecteurs courts (ex: 8 couleurs + 6 tailles au
        // lieu de 48 boutons). Sinon on garde une liste plate.
        const SIZE_TOKEN_RE = /^(xxs|xs|s|m|l|xl|xxl|xxxl|\d?xl|[2-9]xl|\d{2,3}|onesize|unique|standard)$/i;

        function splitVariantKey(key) {
            const idx = key.lastIndexOf("-");
            if (idx <= 0 || idx >= key.length - 1) return null;
            return [key.slice(0, idx).trim(), key.slice(idx + 1).trim()];
        }

        function looksLikeSizes(values) {
            const hits = values.filter(v => SIZE_TOKEN_RE.test(v.replace(/\s+/g, ""))).length;
            return hits >= Math.ceil(values.length / 2);
        }

        const splitPairs = variantes.map(v => splitVariantKey(v.nom));
        const variantesSplit = variantes.length > 1 && splitPairs.every(Boolean);

        let axis1Label = "Option 1";
        let axis2Label = "Option 2";
        let axis1Values = [];
        let axis2Values = [];
        const comboLookup = {};

        if (variantesSplit) {
            variantes.forEach((v, i) => {
                const [a1, a2] = splitPairs[i];
                comboLookup[`${a1}||${a2}`] = v;
            });

            axis1Values = [...new Set(splitPairs.map(p => p[0]))];
            axis2Values = [...new Set(splitPairs.map(p => p[1]))];

            if (looksLikeSizes(axis2Values) && !looksLikeSizes(axis1Values)) {
                axis1Label = "Couleur";
                axis2Label = "Taille";
            } else if (looksLikeSizes(axis1Values) && !looksLikeSizes(axis2Values)) {
                axis1Label = "Taille";
                axis2Label = "Couleur";
            }
        }

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
${pixelViewContentHtml}
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

.prix-converti {
    display: block;
    font-size: 14px;
    font-weight: 500;
    color: #7f96a8;
    margin-top: 2px;
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

.pd-thumbs { display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
.pd-thumb { width: 64px; height: 64px; object-fit: cover; border-radius: 10px; cursor: pointer; opacity: .6; border: 2px solid transparent; }
.pd-thumb.active, .pd-thumb:hover { opacity: 1; border-color: #00d9ff; }

.pd-videos { display: flex; flex-direction: column; gap: 12px; margin-top: 14px; }
.pd-videos video { width: 100%; border-radius: 16px; background: #000; max-height: 480px; }

.pd-variants { margin: 16px 0; }
.pd-variant-group { margin-bottom: 14px; }
.pd-variants label { display: block; font-size: 12px; color: #7f96a8; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 8px; }
.pd-variant-list { display: flex; flex-wrap: wrap; gap: 8px; }
.pd-variant-btn { margin: 0; padding: 9px 14px; border-radius: 10px; border: 1px solid rgba(0,217,255,.16); background: rgba(0,217,255,.06); color: #f5fbff; font-weight: 600; font-size: 13px; cursor: pointer; }
.pd-variant-btn.active { background: #00d9ff; color: #001018; border-color: #00d9ff; }
.pd-variant-btn:disabled { opacity: .3; cursor: not-allowed; }
.pd-variant-select { width: 100%; max-width: 420px; padding: 12px 14px; border-radius: 10px; border: 1px solid rgba(0,217,255,.16); background: rgba(0,217,255,.06); color: #f5fbff; font-size: 14px; font-family: inherit; }
.pd-variant-select option { background: #061019; }
.pd-variant-warn { color: #ff8c8c; font-size: 12px; margin-top: 6px; display: none; }

.pd-actions { display: flex; gap: 10px; flex-wrap: wrap; }
.pd-buy-now { background: linear-gradient(135deg,#3ddc84,#1fae63); color: #001a0d; }
.pd-quick-checkout { display: none; margin-top: 16px; padding: 16px; border-radius: 14px; border: 1px solid rgba(61,220,132,.25); background: rgba(61,220,132,.05); }
.pd-quick-checkout.open { display: block; }
.pd-quick-checkout input { width: 100%; box-sizing: border-box; padding: 11px 12px; margin-bottom: 8px; border-radius: 9px; border: 1px solid rgba(0,217,255,.16); background: rgba(0,0,0,.3); color: #fff; font-family: inherit; font-size: 13px; }
.pd-quick-row { display: flex; gap: 8px; }
.pd-quick-row input { flex: 1; }
.pd-quick-submit { width: 100%; margin-top: 4px; }

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
                <img id="pd-main-image"
                    src="${escapeHtml(photos[0])}"
                    alt="${escapeHtml(produit.titre)}"
                    referrerpolicy="no-referrer"
                >
                ${photos.length > 1 ? `
                <div class="pd-thumbs">
                    ${photos.map((p, i) => `
                        <img src="${escapeHtml(p)}" referrerpolicy="no-referrer"
                             class="pd-thumb ${i === 0 ? "active" : ""}"
                             onclick="document.getElementById('pd-main-image').src=this.src;document.querySelectorAll('.pd-thumb').forEach(t=>t.classList.remove('active'));this.classList.add('active');">
                    `).join("")}
                </div>` : ""}
              `
            : ""
    }

    ${videos.length ? `
    <div class="pd-videos">
        ${videos.slice(0, 2).map(v => `
            <video controls preload="metadata" playsinline referrerpolicy="no-referrer">
                <source src="${escapeHtml(v)}">
            </video>
        `).join("")}
    </div>` : ""}

    <h1>
        ${escapeHtml(produit.titre)}
    </h1>

    <div class="price" id="pd-price">
        ${prixAvecConversion(produit.prix, COM)}
    </div>

    ${variantes.length ? `
    <div class="pd-variants">
        ${variantesSplit ? `
            <div class="pd-variant-group">
                <label>${escapeHtml(axis1Label)}</label>
                <div class="pd-variant-list" id="pd-axis1">
                    ${axis1Values.map((val, i) => `
                        <button type="button" class="pd-variant-btn ${i === 0 ? "active" : ""}"
                                data-val="${escapeHtml(val)}" onclick="selectAxis(1, this)">
                            ${escapeHtml(val)}
                        </button>
                    `).join("")}
                </div>
            </div>
            <div class="pd-variant-group">
                <label>${escapeHtml(axis2Label)}</label>
                <div class="pd-variant-list" id="pd-axis2">
                    ${axis2Values.map((val, i) => `
                        <button type="button" class="pd-variant-btn ${i === 0 ? "active" : ""}"
                                data-val="${escapeHtml(val)}" onclick="selectAxis(2, this)">
                            ${escapeHtml(val)}
                        </button>
                    `).join("")}
                </div>
            </div>
            <div class="pd-variant-warn" id="pd-combo-warn">Cette combinaison n'est pas disponible.</div>
        ` : variantes.length > 8 ? `
            <label>Choisis une option :</label>
            <select class="pd-variant-select" id="pd-variant-select" onchange="selectVariantFlat(this.value)">
                ${variantes.map((v, i) => `
                    <option value="${escapeHtml(v.nom)}" ${i === 0 ? "selected" : ""}>${escapeHtml(v.nom)}</option>
                `).join("")}
            </select>
        ` : `
            <label>Choisis une option :</label>
            <div class="pd-variant-list">
                ${variantes.map((v, i) => `
                    <button type="button" class="pd-variant-btn ${i === 0 ? "active" : ""}"
                            data-nom="${escapeHtml(v.nom)}" onclick="selectVariantFlat(this.dataset.nom, this)">
                        ${escapeHtml(v.nom)}
                    </button>
                `).join("")}
            </div>
        `}
    </div>` : ""}

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
                        stripHtmlTags(produit.description)
                    )}
                </p>
              `
            : ""
    }

    <div class="pd-actions">
        <button
            type="button"
            class="pd-buy-now"
            id="pd-buy-now"
            onclick="ouvrirAchatDirect()"
        >
            ⚡ Acheter maintenant
        </button>

        <button
            type="button"
            id="pd-add-cart"
            onclick="ajouterAuPanier()"
        >
            🛒 Ajouter au panier
        </button>

        <!-- POSER UNE QUESTION AVANT D'ACHETER.
             « Est-ce que vous livrez à Yaoundé ? », « c'est quelle taille ? » —
             sans réponse à ça, beaucoup n'achètent simplement pas. Le message
             part avec la référence du produit : le vendeur, qui en a trente en
             ligne, sait tout de suite de quoi on parle. -->
        <button
            type="button"
            id="pd-message"
            style="background:#1a2530;color:#f5fbff;"
            onclick="ecrireAuVendeur()"
        >
            ✉️ Poser une question
        </button>

        <button
            type="button"
            style="background:#1a2530;color:#f5fbff;"
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
    </div>

    <div id="pd-cart-msg" style="margin-top:10px;color:#3ddc84;font-size:14px;"></div>

    <div class="pd-quick-checkout" id="pd-quick-checkout">
        <label style="display:block;font-size:11px;color:#7f96a8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px;">
            Achat direct — pas besoin de passer par le panier
        </label>
        <input id="qc-nom" placeholder="Nom complet">
        <input id="qc-telephone" placeholder="Téléphone">
        <input id="qc-email" type="email" placeholder="Email (pour suivre ta commande)">
        <input id="qc-adresse" placeholder="Adresse de livraison">
        <div class="pd-quick-row">
            <input id="qc-ville" placeholder="Ville">
            <input id="qc-pays" placeholder="Pays">
        </div>
        <button type="button" class="pd-quick-submit" id="pd-quick-submit" onclick="confirmerAchatDirect()">
            Confirmer l'achat
        </button>
    </div>

    <h2
        style="
            margin-top:30px;
        "
    >
        Avis (${notes.total})
    </h2>

    ${avisHtml}

</div>

<script>
const PD_SPLIT = ${variantesSplit ? "true" : "false"};
// L'identifiant du vendeur, posé par le serveur : c'est à lui que
// part la question. JSON.stringify, jamais de concaténation.
const PD_VENDEUR = ${JSON.stringify(String(produit.vendeur_id || ""))};
const PD_COMBOS = ${JSON.stringify(comboLookup)};
const PD_BASE_PRIX = ${JSON.stringify(produit.prix || "Sur devis")};

let selectedAxis1 = ${variantesSplit && axis1Values.length ? JSON.stringify(axis1Values[0]) : "null"};
let selectedAxis2 = ${variantesSplit && axis2Values.length ? JSON.stringify(axis2Values[0]) : "null"};
let selectedVariant = ${variantes.length && !variantesSplit ? `"${escapeHtml(variantes[0].nom)}"` : "null"};

function selectAxis(axisNum, btn) {
    document.querySelectorAll("#pd-axis" + axisNum + " .pd-variant-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    if (axisNum === 1) selectedAxis1 = btn.dataset.val;
    else selectedAxis2 = btn.dataset.val;
    updateComboState();
}

function updateComboState() {
    if (!PD_SPLIT) return;
    const combo = PD_COMBOS[selectedAxis1 + "||" + selectedAxis2];
    const warn = document.getElementById("pd-combo-warn");
    const addBtn = document.getElementById("pd-add-cart");
    const buyBtn = document.getElementById("pd-buy-now");
    if (combo) {
        selectedVariant = selectedAxis1 + " / " + selectedAxis2;
        if (warn) warn.style.display = "none";
        if (addBtn) addBtn.disabled = false;
        if (buyBtn) buyBtn.disabled = false;
        const priceEl = document.getElementById("pd-price");
        if (priceEl && combo.prix) priceEl.textContent = Number(combo.prix).toFixed(2) + "€";
    } else {
        selectedVariant = null;
        if (warn) warn.style.display = "block";
        if (addBtn) addBtn.disabled = true;
        if (buyBtn) buyBtn.disabled = true;
    }
}

function selectVariantFlat(nom, btn) {
    if (btn) {
        document.querySelectorAll(".pd-variant-list .pd-variant-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
    }
    selectedVariant = nom;
}

updateComboState();

function currentItem() {
    return {
        titre: ${JSON.stringify(produit.titre || "")},
        prix: PD_BASE_PRIX,
        photo: ${JSON.stringify(photos[0] || "")},
        variante: selectedVariant,
        quantity: 1,
    };
}

function ecrireAuVendeur() {
    var texte = window.prompt("Votre question au vendeur :");
    if (texte === null) return;
    texte = texte.trim();
    if (!texte) return;
    var b = document.getElementById("pd-message");
    b.disabled = true;
    fetch("/messages/envoyer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            destinataire: PD_VENDEUR,
            contenu: texte,
            annonce: "${id}",
        }),
    })
    .then(function (r) { return r.json(); })
    .then(function (rep) {
        if (!rep.success) throw new Error(rep.error || "refusé");
        b.textContent = "✅ Question envoyée";
    })
    .catch(function (err) {
        // Sans compte, on ne peut pas écrire. Le dire et emmener, plutôt que
        // d'afficher un refus qui ne mène nulle part.
        if (/connecte/i.test(err.message)) {
            if (confirm("Il faut un compte pour écrire au vendeur. Se connecter ?")) {
                window.location.href = "/login";
            }
        } else {
            alert("Message non envoyé : " + err.message);
        }
        b.disabled = false;
    });
}

function ajouterAuPanier() {
    if (PD_SPLIT && !selectedVariant) return;

    const cart = JSON.parse(localStorage.getItem("samii_market_cart") || "[]");
    const item = currentItem();
    const cartId = selectedVariant ? "${id}-" + selectedVariant : "${id}";

    const existing = cart.find(c => String(c.id) === cartId);
    if (existing) {
        existing.quantity = Number(existing.quantity || 1) + 1;
    } else {
        cart.push({
            id: cartId,
            titre: item.titre + (selectedVariant ? " (" + selectedVariant + ")" : ""),
            prix: item.prix,
            photo: item.photo,
            variante: selectedVariant,
            quantity: 1,
        });
    }
    localStorage.setItem("samii_market_cart", JSON.stringify(cart));

    const msg = document.getElementById("pd-cart-msg");
    msg.innerHTML = '✅ Ajouté au panier — <a href="/marketplace" style="color:#00d9ff;">voir mon panier →</a>';
}

// Achat direct : évite le détour panier → page marketplace → ouvrir panier →
// remplir livraison. Le formulaire s'ouvre ici, sur la fiche produit, et
// poste directement à la même route que le panier (/marketplace/commander).
function ouvrirAchatDirect() {
    if (PD_SPLIT && !selectedVariant) return;
    document.getElementById("pd-quick-checkout").classList.add("open");
    document.getElementById("pd-quick-checkout").scrollIntoView({ behavior: "smooth", block: "center" });
}

async function confirmerAchatDirect() {
    const nom       = document.getElementById("qc-nom").value.trim();
    const telephone = document.getElementById("qc-telephone").value.trim();
    const email     = document.getElementById("qc-email").value.trim();
    const adresse   = document.getElementById("qc-adresse").value.trim();
    const ville     = document.getElementById("qc-ville").value.trim();
    const pays      = document.getElementById("qc-pays").value.trim();

    if (!nom || !telephone || !adresse) {
        alert("Renseigne ton nom, téléphone et adresse.");
        return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        alert("Un email valide est nécessaire pour suivre ta commande.");
        return;
    }

    const btn = document.getElementById("pd-quick-submit");
    btn.disabled = true;
    btn.textContent = "Envoi...";

    try {
        const res = await fetch("/marketplace/commander", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items: [currentItem()], nom_client: nom, telephone, email, adresse, ville, pays }),
        });
        const data = await res.json();

        if (data.success) {
            if (data.checkoutUrl) {
                location.href = data.checkoutUrl;
            } else {
                document.getElementById("pd-quick-checkout").innerHTML =
                    '<p style="color:#3ddc84;">✅ Commande envoyée' + (data.paymentError ? " — " + data.paymentError : "") + '</p>';
            }
        } else {
            alert(data.error || "Erreur, réessaie.");
            btn.disabled = false;
            btn.textContent = "Confirmer l'achat";
        }
    } catch {
        alert("Erreur réseau, réessaie.");
        btn.disabled = false;
        btn.textContent = "Confirmer l'achat";
    }
}
</script>

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
            // VÉRIFICATION D'IDENTITÉ (location de chambre uniquement —
            // accueil de clients chez soi, risque réel de confiance)
            // --------------------------------------------------------------

            if (cleanCategorie === "service-chambre") {
                const statutVerif = await verificationService.getStatut(req.session.userId);
                if (!verificationService.estVerifie(statutVerif)) {
                    return res.redirect("/verification");
                }
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
                    actif,
                    -- Là où l'annonce est publiée. Sans cette colonne, tout
                    -- ce que ses membres mettent en vente atterrit chez
                    -- nous : invisible pour eux, et visible par tout le
                    -- monde chez nous.
                    communaute
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
                    true,
                    $12
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
                    nom,
                    (res.locals?.COM || communautes.get(communautes.DEFAUT)).slug
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
// MES PRODUITS — organiser sa vitrine (sections, vedettes) — vendeur_id
// n'a de sens que pour un compte utilisateur (annonces publiées à titre
// perso via "Publier"), pas pour les imports fournisseur (CJ/BigBuy).
// ==========================================================================

router.get("/mes-produits", requireAuth, async (req, res) => {
    let mesAnnonces = [];
    try {
        mesAnnonces = await db.query(
            // Une même personne peut vendre chez nous ET chez elle : on ne
            // lui montre ici que les annonces de la boutique où elle se
            // trouve, sinon elle modifie sans le voir une annonce publiée
            // ailleurs.
            `SELECT id, titre, prix, photo_url, photos_urls, section_vitrine, en_vedette, actif
             FROM annonces
             WHERE vendeur_id = $1 AND COALESCE(communaute, $2) = $3
             ORDER BY created_at DESC LIMIT 200`,
            [req.session.userId, communautes.DEFAUT,
             (res.locals?.COM || communautes.get(communautes.DEFAUT)).slug]
        );
    } catch (err) {
        console.error("❌ GET /marketplace/mes-produits :", err.message);
    }

    const ligneHtml = (a) => {
        let photos = [];
        try { if (a.photos_urls) photos = JSON.parse(a.photos_urls); } catch { /* ignore */ }
        const photo = photos[0] || a.photo_url || "";
        return `
        <div class="mp-row" data-id="${a.id}">
            ${photo ? `<img src="${escapeHtml(photo)}" alt="">` : `<div class="mp-row__ph"><i data-lucide="image"></i></div>`}
            <div class="mp-row__body">
                <strong>${escapeHtml(a.titre)}${!a.actif ? ` <span class="mp-inactive">(inactif)</span>` : ""}</strong>
                <span class="mp-prix">${escapeHtml(a.prix || "")}</span>
                <div class="mp-row__controls">
                    <input type="text" class="mp-section" placeholder="Nom de section (ex: Nouveautés)" value="${escapeHtml(a.section_vitrine || "")}">
                    <label class="mp-vedette"><input type="checkbox" class="mp-vedette-cb" ${a.en_vedette ? "checked" : ""}> ⭐ En vedette</label>
                    <button type="button" class="mp-save-btn" data-id="${a.id}">Enregistrer</button>
                    <span class="mp-status" id="mp-status-${a.id}"></span>
                </div>
            </div>
        </div>`;
    };

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Mes produits — SAMII Marketplace</title>
<script src="https://unpkg.com/lucide@latest"></script>
<style>
:root { --bg:#03060b; --panel:rgba(9,18,29,.9); --text:#f5fbff; --muted:#7f96a8; --blue:#00d9ff; --blue-2:#0077ff; --border:rgba(0,217,255,.16); }
* { box-sizing:border-box; }
body { margin:0; min-height:100vh; background:var(--bg); color:var(--text); font-family:Inter,system-ui,sans-serif; padding:24px 16px 80px; }
.mp-shell { max-width:720px; margin:0 auto; }
.back { display:inline-flex; align-items:center; gap:6px; color:var(--muted); text-decoration:none; font-size:12.5px; margin-bottom:16px; }
h1 { font-size:19px; margin:0 0 6px; }
p.sub { color:var(--muted); font-size:12.5px; margin:0 0 22px; }
.mp-row { display:flex; gap:14px; background:var(--panel); border:1px solid var(--border); border-radius:16px; padding:14px; margin-bottom:12px; }
.mp-row img, .mp-row__ph { width:64px; height:64px; border-radius:10px; object-fit:cover; flex-shrink:0; background:#0a0d14; display:grid; place-items:center; color:var(--blue); }
.mp-row__body { flex:1; min-width:0; }
.mp-row__body strong { display:block; font-size:13.5px; margin-bottom:2px; }
.mp-inactive { color:#ff6b6b; font-weight:400; font-size:11px; }
.mp-prix { display:block; color:var(--blue); font-size:12px; margin-bottom:10px; }
.mp-row__controls { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
.mp-section { flex:1; min-width:160px; padding:8px 10px; border-radius:8px; border:1px solid var(--border); background:rgba(0,0,0,.3); color:var(--text); font-size:12.5px; }
.mp-vedette { display:flex; align-items:center; gap:5px; font-size:12px; color:var(--muted); white-space:nowrap; }
.mp-save-btn { padding:8px 14px; border-radius:8px; border:1px solid var(--blue); background:rgba(0,217,255,.1); color:var(--blue); font-size:12px; font-weight:700; cursor:pointer; }
.mp-save-btn:disabled { opacity:.5; }
.mp-status { font-size:11.5px; color:#3ddc84; }
.mp-empty { text-align:center; padding:60px 20px; border:1px dashed var(--border); border-radius:16px; color:var(--muted); }
</style>
</head>
<body>
<div class="mp-shell">
    <a href="/marketplace" class="back"><i data-lucide="arrow-left"></i> Retour au marketplace</a>
    <h1>🗂️ Gérer mes produits</h1>
    <p class="sub">Organise ta vitrine : regroupe tes produits par section, mets-en en vedette. Laisse la section vide pour qu'un produit reste dans le groupe général.</p>
    ${mesAnnonces.length ? mesAnnonces.map(ligneHtml).join("") : `<div class="mp-empty">Aucun produit publié pour l'instant. <a href="/marketplace/publier" style="color:var(--blue);">Publier mon premier produit →</a></div>`}
</div>
<script>
lucide.createIcons();
document.querySelectorAll(".mp-save-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
        const row = btn.closest(".mp-row");
        const id = btn.dataset.id;
        const section_vitrine = row.querySelector(".mp-section").value.trim();
        const en_vedette = row.querySelector(".mp-vedette-cb").checked;
        const status = document.getElementById("mp-status-" + id);

        btn.disabled = true;
        status.textContent = "⏳...";
        try {
            const res = await fetch("/marketplace/mes-produits/" + id, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ section_vitrine, en_vedette }),
            });
            const json = await res.json();
            status.textContent = json.success ? "✅ Enregistré" : (json.error || "Erreur");
        } catch (err) {
            status.textContent = "❌ Erreur réseau";
        } finally {
            btn.disabled = false;
            setTimeout(() => { status.textContent = ""; }, 2500);
        }
    });
});
</script>
</body>
</html>`);
});

router.post("/mes-produits/:id", requireAuth, async (req, res) => {
    try {
        const { section_vitrine, en_vedette } = req.body;
        const rows = await db.query(
            `UPDATE annonces SET section_vitrine = $1, en_vedette = $2
             WHERE id = $3 AND vendeur_id = $4 RETURNING id`,
            [String(section_vitrine || "").trim().slice(0, 40) || null, !!en_vedette, req.params.id, req.session.userId]
        );
        if (!rows[0]) return res.json({ success: false, error: "Produit introuvable." });
        res.json({ success: true });
    } catch (err) {
        console.error("❌ POST /marketplace/mes-produits/:id :", err.message);
        res.json({ success: false, error: "Erreur serveur." });
    }
});

// ==========================================================================
// EXPORT
// ==========================================================================

module.exports = router;
