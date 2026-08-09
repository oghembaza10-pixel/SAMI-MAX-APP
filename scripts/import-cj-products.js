// ==========================================================================
// Import CJ Dropshipping → Marketplace (table `annonces`)
// Récupère des produits réels par thème (mode, technologie, téléphones,
// tendance/TikTok) via services/providers/cj.js, avec le détail complet
// (photos multiples, vidéos, variantes, stock, SKU) quand CJ le fournit.
// Rien n'est inventé : un champ absent chez CJ reste vide côté SAMII.
//
// Usage : node scripts/import-cj-products.js
// Réglages via variables d'environnement (toutes optionnelles) :
//   CJ_IMPORT_LIMIT      nombre de produits par thème (défaut 15 — volontairement
//                        modeste : augmente une fois le premier passage vérifié)
//   CJ_MARGIN_PERCENT    marge en % appliquée au coût CJ (défaut 20)
//   CJ_MARGIN_FIXED_EUR  marge fixe ajoutée en EUR (défaut 1)
//   CJ_SHIP_COUNTRIES    codes pays CJ séparés par virgule (ex: "US,FR") pour
//                        restreindre aux produits expédiables vers ces pays.
//                        Vide par défaut = pas de filtre pays (comportement CJ
//                        non vérifié depuis cet environnement, donc pas de
//                        valeur par défaut devinée).
// ==========================================================================
const cj = require("../services/providers/cj");
const db = require("../services/db");

const IMPORT_LIMIT = Number(process.env.CJ_IMPORT_LIMIT || 15);
const MARGIN_PERCENT = Number(process.env.CJ_MARGIN_PERCENT || 20);
const MARGIN_FIXED_EUR = Number(process.env.CJ_MARGIN_FIXED_EUR || 1);
const SHIP_COUNTRIES = (process.env.CJ_SHIP_COUNTRIES || "")
    .split(",")
    .map(c => c.trim())
    .filter(Boolean);

// --------------------------------------------------------------------------
// THÈMES — mode / technologie / téléphones / tendance TikTok
// --------------------------------------------------------------------------
const THEMES = [
    { label: "Téléphones & Accessoires", keyword: "phone accessories",  categorie: "telephones-accessoires", video: false },
    { label: "Mode Femme",                keyword: "women fashion",     categorie: "mode-femme",              video: false },
    { label: "Mode Homme",                keyword: "men fashion",       categorie: "mode-homme",              video: false },
    { label: "Technologie & Gadgets",     keyword: "electronic gadget", categorie: "electronique-tech",       video: false },
    { label: "Tendances TikTok",          keyword: "",                  categorie: "tendances-nouveautes",    video: true, tiktok: true },
];

// --------------------------------------------------------------------------
// Catégories officielles réellement en base (categories_produits) — la
// même liste utilisée par routes/marketplace.js pour le filtre.
// --------------------------------------------------------------------------
async function getCategorySlugs() {
    const rows = await db.query(`SELECT slug FROM categories_produits WHERE actif = true`);
    return new Set(rows.map(r => r.slug));
}

// Affine la catégorie du thème avec le nom de catégorie réel donné par CJ,
// uniquement si ce nom matche clairement une autre catégorie officielle.
function refineCategory(cjCategoryName, fallback, knownSlugs) {
    const n = (cjCategoryName || "").toLowerCase();
    const rules = [
        [/(earring|jewelry|jewellery|ring|necklace|bracelet)/, "bijoux-accessoires"],
        [/(watch|wearable)/, "montres-wearables"],
        [/(shoe|sneaker|footwear)/, "chaussures"],
        [/(bag|backpack|luggage)/, "sacs-bagagerie"],
        [/(beauty|cosmetic|skin|makeup|perfume)/, "beaute-cosmetiques"],
        [/(sport|fitness|outdoor)/, "sport-fitness"],
        [/(bike|bicycle|scooter|e-bike|mobility)/, "velos-mobilite-electrique"],
        [/(kitchen|cookware|home appliance)/, "cuisine-electromenager"],
        [/(furniture)/, "meubles"],
        [/(light|lamp|smart home)/, "eclairage-smart-home"],
        [/(gaming|console|controller)/, "gaming"],
        [/(audio|headphone|speaker|earbud)/, "audio"],
        [/(camera|photo|video)/, "photo-video"],
        [/(computer|laptop|office)/, "informatique-bureau"],
        [/(baby|infant)/, "bebe"],
        [/(toy|kids|children)/, "enfants-jouets"],
        [/(pet|animal)/, "animaux"],
        [/(garden|outdoor)/, "jardin-exterieur"],
        [/(tool|diy|repair)/, "bricolage-outillage"],
        [/(security|camera surveillance|alarm)/, "securite-surveillance"],
        [/(battery|power bank|energy)/, "energie-batteries"],
        [/(travel|luggage|luggage)/, "voyage-loisirs"],
        [/(art|craft|creativ)/, "arts-creativite"],
        [/(book|education)/, "livres-education"],
        [/(clean|organiz)/, "entretien-organisation"],
        [/(car|moto|automobile)/, "automobile-moto"],
        [/(phone|mobile case)/, "telephones-accessoires"],
    ];
    for (const [regex, slug] of rules) {
        if (regex.test(n) && knownSlugs.has(slug)) return slug;
    }
    return knownSlugs.has(fallback) ? fallback : "tendances-nouveautes";
}

// CJ renvoie parfois le prix d'un produit à variantes sous forme de plage
// ("2.42-4.86" = prix mini-maxi selon la variante). On prend le prix le plus
// bas comme prix de base ("à partir de") ; le détail par variante reste dans
// `variantes`. Retourne null si vraiment rien d'exploitable (on n'invente pas).
function parseCjPrice(value) {
    if (value === null || value === undefined || value === "") return null;
    const str = String(value).trim();
    const range = str.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/);
    if (range) return Number(range[1]);
    const num = Number(str);
    return Number.isFinite(num) ? num : null;
}

function priceFor(cost) {
    return Number((cost * (1 + MARGIN_PERCENT / 100) + MARGIN_FIXED_EUR).toFixed(2));
}

async function importTheme(theme, knownSlugs) {
    console.log(`\n📦 Thème : ${theme.label}`);

    const params = {
        page: 1,
        size: IMPORT_LIMIT,
        keyword: theme.keyword || "",
        productFlag: 0, // tendance
        countryCode: SHIP_COUNTRIES[0] || "",
    };
    if (theme.tiktok) params.zonePlatform = "tiktok";
    if (theme.video) params.productType = 10;

    let listResult;
    try {
        listResult = await cj.listProducts(params);
    } catch (err) {
        console.error(`❌ Liste CJ (${theme.label}) :`, err.message);
        return { imported: 0, skipped: 0 };
    }

    const rows = cj.extractProductRows(listResult);
    if (!rows.length) {
        console.log("   Aucun produit retourné par CJ pour ce thème.");
        return { imported: 0, skipped: 0 };
    }

    let imported = 0;
    let skipped = 0;

    for (const row of rows) {
        const pid = row?.pid || row?.productId || row?.id;
        if (!pid) { skipped++; continue; }

        let product;
        try {
            product = await cj.getFullProduct(pid);
        } catch (err) {
            console.warn(`   ⚠️ Détail produit ${pid} :`, err.message);
            skipped++;
            continue;
        }

        const cost = parseCjPrice(product.cost_price ?? product.price);
        if (!product.title || cost === null) { skipped++; continue; }

        const categorie = refineCategory(product.category, theme.categorie, knownSlugs);
        const prix = priceFor(cost);
        const photosUrls = JSON.stringify(product.images || []);
        const videos = JSON.stringify(product.videos || []);
        const variantes = JSON.stringify(product.variants || []);

        const metadata = JSON.stringify({
            source: "CJ",
            cj_pid: product.cj_pid,
            cj_spu: product.cj_spu,
            category_cj: product.category,
            brand: product.brand,
            warehouse: product.warehouse,
            weight: product.weight,
            dimensions: product.dimensions,
            rating: product.rating,
            review_count: product.review_count,
            sales: product.sales,
        });

        try {
            const result = await db.query(`
                INSERT INTO annonces
                    (titre, categorie, description, prix, photo_url, photos_urls, caracteristiques,
                     type_vendeur, vendeur_id, vendeur_nom, pays, actif, created_at,
                     provider_code, provider_product_id, source_url, region_fournisseur,
                     prix_fournisseur, devise, stock, sku, synced_at, metadata,
                     videos, variantes, fournisseur_verifie)
                VALUES
                    ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,NOW(),$12,$13,$14,$15,$16,$17,$18,$19,NOW(),$20::jsonb,
                     $21::jsonb,$22::jsonb,true)
                ON CONFLICT (provider_code, provider_product_id)
                WHERE provider_code IS NOT NULL AND provider_product_id IS NOT NULL
                DO UPDATE SET
                    titre=EXCLUDED.titre,
                    categorie=EXCLUDED.categorie,
                    prix=EXCLUDED.prix,
                    photo_url=EXCLUDED.photo_url,
                    photos_urls=EXCLUDED.photos_urls,
                    prix_fournisseur=EXCLUDED.prix_fournisseur,
                    devise=EXCLUDED.devise,
                    stock=EXCLUDED.stock,
                    sku=EXCLUDED.sku,
                    metadata=EXCLUDED.metadata,
                    videos=EXCLUDED.videos,
                    variantes=EXCLUDED.variantes,
                    synced_at=NOW()
                RETURNING id, titre
            `, [
                product.title, categorie, product.description || `Produit importé depuis CJ Dropshipping.`,
                `${prix} EUR`, product.main_image || null, photosUrls,
                JSON.stringify({ source: "CJ", category: product.category, sku: product.sku }),
                "fournisseur", "cj", "CJ Dropshipping", product.country || "Chine",
                "CJ", String(product.cj_pid || pid), null, "chine",
                cost, "EUR", product.stock, product.sku,
                metadata, videos, variantes,
            ]);

            await db.query(
                `INSERT INTO provider_syncs (provider_code, entity_type, entity_id, operation, status, external_id, finished_at)
                 VALUES ('CJ', 'produit', $1, 'import', 'success', $2, NOW())`,
                [String(result[0]?.id || ""), String(pid)]
            );

            console.log(`   ✅ ${result[0]?.titre} (id=${result[0]?.id}, cat=${categorie}, photos=${product.images.length}, vidéos=${product.videos.length}, variantes=${product.variants.length})`);
            imported++;
        } catch (err) {
            console.error(`   ❌ Insert échoué pour ${pid} :`, err.message);
            skipped++;
        }
    }

    return { imported, skipped };
}

async function main() {
    console.log(`Marge appliquée : ${MARGIN_PERCENT}% + ${MARGIN_FIXED_EUR} EUR`);
    if (SHIP_COUNTRIES.length) console.log(`Filtre pays CJ : ${SHIP_COUNTRIES.join(", ")}`);

    const knownSlugs = await getCategorySlugs();
    if (!knownSlugs.size) {
        throw new Error("categories_produits est vide — impossible de mapper proprement les catégories.");
    }

    let totalImported = 0;
    let totalSkipped = 0;

    for (const theme of THEMES) {
        const { imported, skipped } = await importTheme(theme, knownSlugs);
        totalImported += imported;
        totalSkipped += skipped;
    }

    console.log(`\n📊 Import terminé — ${totalImported} produits importés/mis à jour, ${totalSkipped} ignorés.`);
}

main().catch((error) => {
    console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
    process.exitCode = 1;
});
