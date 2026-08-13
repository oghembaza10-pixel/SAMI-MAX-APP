// ==========================================================================
// Import BigBuy → Marketplace (table `annonces`)
// Même logique que import-cj-products.js (réhébergement Cloudinary, marge,
// classement par catégorie interne). BigBuy est un catalogue européen B2B :
// pas de vidéo produit native, mais souvent un vrai stock EU (livraison plus
// rapide que la Chine) et des attributs/variantes propres.
//
// ⚠️ À tester d'abord avec `node scripts/test-bigbuy-import.js` — cette
// intégration n'a pas pu être vérifiée contre l'API BigBuy réelle depuis cet
// environnement de développement (voir services/providers/bigbuy.js).
//
// Usage : node scripts/import-bigbuy-products.js
// Réglages via variables d'environnement (toutes optionnelles) :
//   BIGBUY_IMPORT_PAGES   nombre de pages à importer (défaut 5, 20/page)
//   BIGBUY_MARGIN_PERCENT marge en % appliquée au coût BigBuy (défaut 25)
//   BIGBUY_MARGIN_FIXED_EUR marge fixe ajoutée en EUR (défaut 1.5)
// ==========================================================================
const bigbuy = require("../services/providers/bigbuy");
const db = require("../services/db");

const CLOUDINARY_CLOUD_NAME = "ojwx5hft";
const CLOUDINARY_UPLOAD_PRESET = "MARKETPLACE OG";
const REHOST_IMAGES_MAX = 5;

async function rehostImage(url) {
    try {
        const imgRes = await fetch(url);
        if (!imgRes.ok) return null;
        const blob = await imgRes.blob();

        const form = new FormData();
        form.append("file", blob, "bigbuy-image.jpg");
        form.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

        const uploadRes = await fetch(
            `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
            { method: "POST", body: form }
        );
        if (!uploadRes.ok) return null;

        const data = await uploadRes.json();
        return data.secure_url || null;
    } catch {
        return null;
    }
}

async function rehostImages(urls) {
    const result = [];
    for (const url of (urls || []).slice(0, REHOST_IMAGES_MAX)) {
        const hosted = await rehostImage(url);
        result.push(hosted || url);
    }
    return result;
}

const IMPORT_PAGES = Number(process.env.BIGBUY_IMPORT_PAGES || 5);
const MARGIN_PERCENT = Number(process.env.BIGBUY_MARGIN_PERCENT || 25);
const MARGIN_FIXED_EUR = Number(process.env.BIGBUY_MARGIN_FIXED_EUR || 1.5);

// BigBuy renvoie aussi des descriptions en HTML brut — même souci que CJ.
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

async function getCategorySlugs() {
    const rows = await db.query(`SELECT slug FROM categories_produits WHERE actif = true`);
    return new Set(rows.map(r => r.slug));
}

// Même liste de règles que import-cj-products.js — dupliquée volontairement
// (les deux scripts tournent indépendamment) plutôt que de créer une
// dépendance partagée pour ce premier passage.
function refineCategory(title, fallback, knownSlugs) {
    // Chaque terme bordé par \b (limite de mot) — sans ça "ring" matchait aussi
    // "Spring"/"Measuring", "car" matchait tout mot contenant ces lettres.
    const rules = [
        [/\b(earring|jewelry|jewellery|ring|necklace|bracelet)\b/, "bijoux-accessoires"],
        [/\b(watch|wearable)\b/, "montres-wearables"],
        [/\b(shoe|sneaker|footwear)\b/, "chaussures"],
        [/\b(bag|backpack|luggage)\b/, "sacs-bagagerie"],
        [/\b(beauty|cosmetic|skin|makeup|perfume)\b/, "beaute-cosmetiques"],
        [/\b(sport|fitness|outdoor)\b/, "sport-fitness"],
        [/\b(bike|bicycle|scooter|e-?bike|mobility)\b/, "velos-mobilite-electrique"],
        [/\b(kitchen|cookware|home\s?appliance)\b/, "cuisine-electromenager"],
        [/\b(furniture)\b/, "meubles"],
        [/\b(light|lamp|led|smart\s?home)\b/, "eclairage-smart-home"],
        [/\b(gaming|console|controller)\b/, "gaming"],
        [/\b(audio|headphone|speaker|earbud)\b/, "audio"],
        [/\b(camera|photo|video)\b/, "photo-video"],
        [/\b(computer|laptop|office)\b/, "informatique-bureau"],
        [/\b(baby|infant)\b/, "bebe"],
        [/\b(toy|kids|children)\b/, "enfants-jouets"],
        [/\b(pet|animal)\b/, "animaux"],
        [/\b(garden|outdoor)\b/, "jardin-exterieur"],
        [/\b(tool|diy|repair)\b/, "bricolage-outillage"],
        [/\b(security|surveillance|alarm)\b/, "securite-surveillance"],
        [/\b(battery|power\s?bank|energy)\b/, "energie-batteries"],
        [/\b(travel|luggage)\b/, "voyage-loisirs"],
        [/\b(car|moto|automobile)\b/, "automobile-moto"],
        [/\b(phone|mobile\s?case)\b/, "telephones-accessoires"],
        [/\b(electric|gadget|smart)\b/, "electronique-tech"],
    ];

    const n = (title || "").toLowerCase();
    for (const [regex, slug] of rules) {
        if (regex.test(n) && knownSlugs.has(slug)) return slug;
    }
    return knownSlugs.has(fallback) ? fallback : "tendances-nouveautes";
}

function priceFor(cost) {
    return Number((cost * (1 + MARGIN_PERCENT / 100) + MARGIN_FIXED_EUR).toFixed(2));
}

async function main() {
    console.log(`Marge appliquée : ${MARGIN_PERCENT}% + ${MARGIN_FIXED_EUR} EUR`);

    const knownSlugs = await getCategorySlugs();
    if (!knownSlugs.size) {
        throw new Error("categories_produits est vide — impossible de mapper proprement les catégories.");
    }

    let imported = 0;
    let skipped = 0;

    for (let page = 1; page <= IMPORT_PAGES; page++) {
        console.log(`\n📦 Page ${page}/${IMPORT_PAGES}`);

        let listResult;
        try {
            listResult = await bigbuy.listProducts({ page, pageSize: 20 });
        } catch (err) {
            console.error(`❌ Liste BigBuy (page ${page}) :`, err.message);
            continue;
        }

        const rows = bigbuy.extractProductRows(listResult);
        if (!rows.length) {
            console.log("   Aucun produit retourné pour cette page.");
            continue;
        }

        for (const row of rows) {
            const sku = row?.sku || row?.id;
            if (!sku) { skipped++; continue; }

            let product;
            try {
                product = await bigbuy.getFullProduct(sku);
            } catch (err) {
                console.warn(`   ⚠️ Détail produit ${sku} :`, err.message);
                skipped++;
                continue;
            }

            const cost = Number(product.cost_price);
            if (!product.title || !Number.isFinite(cost) || cost <= 0) { skipped++; continue; }

            const categorie = refineCategory(product.title, "tendances-nouveautes", knownSlugs);
            const prix = priceFor(cost);

            const hostedImages = await rehostImages(product.images || []);
            const mainImage = hostedImages[0] || null;
            const photosUrls = JSON.stringify(hostedImages);
            const variantes = JSON.stringify(product.variants || []);

            const metadata = JSON.stringify({
                source: "BIGBUY",
                bigbuy_id: product.bigbuy_id,
                category_bigbuy: product.category,
                brand: product.brand,
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
                        variantes=EXCLUDED.variantes,
                        synced_at=NOW()
                    RETURNING id, titre
                `, [
                    product.title, categorie, stripHtmlTags(product.description) || `Produit importé depuis BigBuy.`,
                    `${prix} EUR`, mainImage, photosUrls,
                    JSON.stringify({ source: "BIGBUY", category: product.category, sku: product.sku }),
                    "fournisseur", "bigbuy", "BigBuy", product.country || "Europe",
                    "BIGBUY", String(product.bigbuy_id || sku), null, "europe",
                    cost, "EUR", product.stock, product.sku,
                    metadata, "[]", variantes,
                ]);

                await db.query(
                    `INSERT INTO provider_syncs (provider_code, entity_type, entity_id, operation, status, external_id, finished_at)
                     VALUES ('BIGBUY', 'produit', $1, 'import', 'success', $2, NOW())`,
                    [String(result[0]?.id || ""), String(sku)]
                );

                console.log(`   ✅ ${result[0]?.titre} (id=${result[0]?.id}, cat=${categorie}, photos=${hostedImages.length}, variantes=${product.variants.length})`);
                imported++;
            } catch (err) {
                console.error(`   ❌ Insert échoué pour ${sku} :`, err.message);
                skipped++;
            }
        }
    }

    console.log(`\n📊 Import terminé — ${imported} produits importés/mis à jour, ${skipped} ignorés.`);
}

main().catch((error) => {
    console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
    process.exitCode = 1;
});
