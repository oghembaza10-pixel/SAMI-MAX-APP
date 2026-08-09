const express = require("express");
const router = express.Router();
const db = require("../services/db");
const cj = require("../services/cj-service");

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.status(401).json({ success: false, error: "Non connecté" });
    next();
}

const SEARCH_RULES = [
    ["velos-mobilite-electrique", ["electric bike", "ebike", "electric scooter"]],
    ["tendances-nouveautes", ["tiktok viral", "trending products", "viral gadget"]],
    ["mode-femme", ["women summer clothes", "women dress", "women fashion"]],
    ["mode-homme", ["men summer clothes", "men fashion", "tracksuit"]],
    ["beaute-cosmetiques", ["perfume", "skincare", "beauty cosmetics"]],
    ["telephones-accessoires", ["smartphone", "phone accessories", "iphone accessories"]],
    ["informatique-bureau", ["laptop computer", "computer accessories"]],
    ["sport-fitness", ["fitness", "gym", "sports equipment"]],
    ["montres-wearables", ["smart watch", "wearable"]],
    ["bijoux-accessoires", ["jewelry", "fashion jewelry", "accessories"]],
    ["chaussures", ["shoes", "sneakers", "sandals"]],
    ["sacs-bagagerie", ["handbag", "backpack", "luggage"]],
    ["maison-decoration", ["home decor", "home decoration"]],
    ["eclairage-smart-home", ["smart home", "led light", "smart lamp"]],
    ["cuisine-electromenager", ["kitchen appliance", "kitchen gadget"]],
    ["gaming", ["gaming", "game controller", "gaming accessories"]],
    ["audio", ["bluetooth speaker", "earbuds", "headphones"]],
    ["photo-video", ["camera", "photography", "video accessories"]],
    ["energie-batteries", ["power bank", "battery", "solar charger"]],
    ["automobile-moto", ["car accessories", "motorcycle accessories"]],
    ["bricolage-outillage", ["tools", "hardware", "power tools"]],
    ["jardin-exterieur", ["garden", "outdoor"]],
    ["animaux", ["pet supplies", "dog", "cat"]],
    ["bebe", ["baby products", "baby clothes"]],
    ["enfants-jouets", ["toys", "kids toys"]],
    ["voyage-loisirs", ["travel accessories", "camping", "leisure"]],
    ["arts-creativite", ["craft", "art supplies", "creative"]],
    ["livres-education", ["education", "learning"]],
    ["entretien-organisation", ["cleaning", "storage organizer"]],
    ["securite-surveillance", ["security camera", "surveillance", "alarm"]],
    ["meubles", ["furniture", "chair", "table"]],
    ["maison-art-de-la-table", ["tableware", "kitchenware", "dining"]]
];

function text(v, fallback = "") {
    return v === undefined || v === null ? fallback : String(v).trim();
}

function number(v) {
    if (v === undefined || v === null || v === "") return null;
    const n = Number(String(v).replace(/,/g, "."));
    return Number.isFinite(n) ? n : null;
}

function rowsFrom(result) {
    const content = result?.data?.content;
    if (Array.isArray(content)) {
        const rows = [];
        for (const item of content) {
            if (Array.isArray(item?.productList)) rows.push(...item.productList);
            else if (item?.pid || item?.productId || item?.id) rows.push(item);
        }
        if (rows.length) return rows;
    }
    const rows = result?.data?.list || result?.data?.productList || result?.data;
    return Array.isArray(rows) ? rows : [];
}

function pickPid(row) {
    return row?.cj_pid || row?.pid || row?.productId || row?.id || null;
}

function unique(values) {
    return [...new Set((values || []).filter(Boolean).map(String))];
}

function flattenCategories(value, out = []) {
    if (!value) return out;
    if (Array.isArray(value)) {
        for (const item of value) flattenCategories(item, out);
        return out;
    }
    if (typeof value !== "object") return out;
    const id = value.categoryId || value.id || value.categoryID;
    const name = value.categoryName || value.name || value.categoryNameEn;
    if (id && name) out.push({ id: String(id), name: String(name) });
    for (const key of ["children", "childList", "subCategories", "categoryList", "categories", "data"]) {
        if (value[key]) flattenCategories(value[key], out);
    }
    return out;
}

function normalizeKey(v) {
    return text(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function categorySearches(category) {
    const configured = SEARCH_RULES.find(([slug]) => slug === category.slug);
    if (configured) return configured[1];
    const words = normalizeKey(category.nom).split(" ").filter(w => w.length > 2 && !["and", "art", "the"].includes(w));
    return [words.join(" ") || category.nom];
}

function bestCJCategory(localCategory, cjCategories) {
    const local = normalizeKey(localCategory.nom);
    const slug = normalizeKey(localCategory.slug).replace(/ velos /g, " bike ");
    const tokens = unique(`${local} ${slug}`.split(" ")).filter(w => w.length > 2);
    let best = null;
    let score = 0;
    for (const c of cjCategories) {
        const name = normalizeKey(c.name);
        let s = 0;
        for (const token of tokens) if (name.includes(token)) s += token.length >= 5 ? 2 : 1;
        if (s > score) { score = s; best = c; }
    }
    return best;
}

async function getLocalCategories() {
    return db.query(`SELECT id, nom, slug FROM categories_produits WHERE actif=true ORDER BY ordre, id`);
}

async function getCJCategories() {
    try {
        const result = await cj.getCategories();
        return flattenCategories(result?.data || result);
    } catch (error) {
        console.warn("⚠️ CJ catégories:", error.message);
        return [];
    }
}

async function ensureSupplier() {
    const existing = await db.query(`SELECT id FROM fournisseurs WHERE nom=$1 LIMIT 1`, ["CJ Dropshipping"]);
    if (existing.length) return existing[0].id;
    const rows = await db.query(`INSERT INTO fournisseurs (nom, region, site_url, actif, verified) VALUES ($1,$2,$3,true,true) RETURNING id`, ["CJ Dropshipping", "Chine", "https://cjdropshipping.com"]);
    return rows[0].id;
}

function parseVariantOptions(v) {
    const options = v?.options || v?.variantKey || v?.variantName || v?.variantSku || "";
    const raw = text(options);
    const parts = raw.split(/[|,;/]+/).map(s => s.trim()).filter(Boolean);
    return {
        taille: v?.size || v?.propertyValue || parts.find(p => /size|taille/i.test(p)) || null,
        couleur: v?.color || parts.find(p => /color|colour|couleur/i.test(p)) || null,
        options: v?.options && typeof v.options === "object" ? v.options : { raw: options }
    };
}

async function saveMedia(url, type, title) {
    if (!url) return null;
    const existing = await db.query(`SELECT id FROM medias WHERE secure_url=$1 LIMIT 1`, [url]);
    if (existing.length) return existing[0].id;
    const resourceType = type === "video" ? "video" : "image";
    const rows = await db.query(`INSERT INTO medias (provider, resource_type, secure_url, alt_text, context) VALUES ($1,$2,$3,$4,$5) RETURNING id`, ["cj_dropshipping", resourceType, url, title || null, "marketplace:cj"]);
    return rows[0].id;
}

async function attachMedia(productId, url, type, order, principal, title) {
    const mediaId = await saveMedia(url, type, title);
    if (!mediaId) return;
    const existing = await db.query(`SELECT id FROM produit_medias WHERE produit_id=$1 AND media_id=$2 LIMIT 1`, [productId, mediaId]);
    if (!existing.length) {
        await db.query(`INSERT INTO produit_medias (produit_id, media_id, type, ordre, principal) VALUES ($1,$2,$3,$4,$5)`, [productId, mediaId, type, order, principal]);
    }
    return mediaId;
}

async function saveVariants(productId, variants, fallbackCurrency = "USD") {
    for (const v of (Array.isArray(variants) ? variants : [])) {
        const vid = v?.vid || v?.variantId || v?.variantID;
        const opts = parseVariantOptions(v);
        const stock = Number.isFinite(Number(v?.stock)) ? Number(v.stock) : (Number.isFinite(Number(v?.inventory)) ? Number(v.inventory) : 0);
        const supplierPrice = number(v?.costPrice ?? v?.supplierPrice ?? v?.productPrice ?? v?.sellPrice);
        const price = number(v?.sellPrice ?? v?.price ?? v?.nowPrice);
        const image = text(v?.imageUrl || v?.image || v?.productImage || v?.bigImage);
        const existing = vid ? await db.query(`SELECT id FROM produits_variantes WHERE produit_id=$1 AND provider_variant_id=$2 LIMIT 1`, [productId, String(vid)]) : [];
        if (existing.length) {
            await db.query(`UPDATE produits_variantes SET taille=$1,couleur=$2,stock=$3,prix_fournisseur=$4,prix=$5,sku=$6,image_url=$7,options=$8,derniere_sync_at=now(),actif=true WHERE id=$9`, [opts.taille, opts.couleur, stock, supplierPrice, price, text(v?.sku || v?.variantSku) || null, image || null, opts.options || {}, existing[0].id]);
            continue;
        }
        const mediaId = image ? await saveMedia(image, "image", "Variante CJ") : null;
        await db.query(`INSERT INTO produits_variantes (produit_id,taille,couleur,stock,provider_variant_id,sku,prix_fournisseur,prix,devise,poids,image_url,media_id,options,actif,derniere_sync_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,true,now())`, [productId, opts.taille, opts.couleur, stock, vid ? String(vid) : null, text(v?.sku || v?.variantSku) || null, supplierPrice, price, text(v?.currency, fallbackCurrency), number(v?.weight), image || null, mediaId, opts.options || {}]);
    }
}

async function saveProduct(product, category, supplierId) {
    const externalId = text(product.cj_pid);
    if (!externalId) return { inserted: false, reason: "pid_missing" };
    const title = text(product.title || product.cj_name, "Produit CJ");
    const cost = number(product.cost_price);
    const sell = number(product.price);
    const stock = Number.isFinite(Number(product.stock)) ? Number(product.stock) : 0;
    const images = unique(product.images);
    const videos = unique(product.videos);
    const metadata = {
        provider: "cj_dropshipping",
        cj_pid: externalId,
        cj_spu: product.cj_spu || null,
        cj_category_id: product.cj_category_id || null,
        cj_category_name: product.cj_category_name || null,
        rating: product.rating ?? null,
        review_count: product.review_count ?? null,
        sales: product.sales ?? null,
        listed_count: product.listed_count ?? null,
        brand: product.brand || null,
        warehouse: product.warehouse || null,
        certification: product.certification || null,
        delivery_cycle: product.delivery_cycle || null,
        free_shipping: product.free_shipping ?? null,
        customization: product.customization ?? null,
        dimensions: product.dimensions || null,
        inventory: product.inventory || [],
        videos,
        raw: product.raw || {}
    };

    let rows = await db.query(`SELECT id FROM produits WHERE provider_code='CJ' AND provider_product_id=$1 LIMIT 1`, [externalId]);
    let productId;
    if (rows.length) {
        productId = rows[0].id;
        await db.query(`UPDATE produits SET nom=$1,description=$2,prix=$3,stock=$4,photo_url=$5,options=$6,categorie=$7,fournisseur_id=$8,prix_fournisseur=$9,devise=$10,poids=$11,statut_import='api',import_source='cj',derniere_sync_at=now(),sync_status='active',metadata=$12 WHERE id=$13`, [title, text(product.description), sell, stock, images[0] || null, { videos, variants_count: product.variants_count || 0 }, category.nom, supplierId, cost, "USD", number(product.weight), metadata, productId]);
    } else {
        rows = await db.query(`INSERT INTO produits (nom,description,prix,stock,photo_url,actif,options,categorie,fournisseur_id,provider_code,provider_product_id,provider_source_url,reference_interne,sku,prix_fournisseur,devise,poids,statut_import,import_source,derniere_sync_at,sync_status,featured,bestseller,saison,tags,metadata) VALUES ($1,$2,$3,$4,$5,true,$6,$7,$8,'CJ',$9,$10,$11,$12,$13,$14,$15,'api','cj',now(),'active',false,false,$16,$17,$18) RETURNING id`, [title, text(product.description), sell, stock, images[0] || null, { videos }, category.nom, supplierId, externalId, text(product.raw?.productUrl || product.raw?.sourceUrl) || null, product.cj_spu || null, product.sku || null, cost, "USD", number(product.weight), "été", [], metadata]);
        productId = rows[0].id;
    }

    const cat = await db.query(`SELECT id FROM categories_produits WHERE id=$1`, [category.id]);
    if (cat.length) {
        await db.query(`INSERT INTO produit_categories (produit_id,categorie_id,principal) VALUES ($1,$2,true) ON CONFLICT (produit_id,categorie_id) DO UPDATE SET principal=true`, [productId, category.id]);
    }

    await db.query(`DELETE FROM produit_medias WHERE produit_id=$1`, [productId]);
    for (let i = 0; i < images.length; i++) await attachMedia(productId, images[i], "image", i, i === 0, title);
    for (let i = 0; i < videos.length; i++) await attachMedia(productId, videos[i], "video", images.length + i, false, title);
    await saveVariants(productId, product.variants, "USD");
    await db.query(`INSERT INTO stock (workspace_id,produit_id,quantite,seuil_alerte,updated_at) SELECT NULL,$1,$2,5,now() WHERE NOT EXISTS (SELECT 1 FROM stock WHERE produit_id=$1 AND workspace_id IS NULL)`, [productId, stock]);
    await db.query(`INSERT INTO provider_syncs (provider_code,fournisseur_id,entity_type,entity_id,operation,status,external_id,payload,started_at,finished_at) VALUES ('CJ',$1,'product',$2,'import','success',$2,$3,now(),now())`, [supplierId, String(productId), metadata]);
    return { inserted: !rows.length, id: productId };
}

async function importOneQuery(query, category, size, supplierId, report) {
    const result = await cj.listProducts({ page: 1, size, keyword: query });
    const rows = rowsFrom(result);
    report.fetched += rows.length;
    for (const row of rows) {
        const pid = pickPid(row);
        if (!pid) { report.skipped++; continue; }
        try {
            const product = await cj.getFullProduct(pid);
            const saved = await saveProduct(product, category, supplierId);
            if (saved.id) report.imported++; else report.skipped++;
        } catch (error) {
            report.errors.push({ pid: String(pid), query, category: category.slug, error: error.message });
        }
    }
}

router.get("/rules", requireAuth, async (req, res) => {
    const categories = await getLocalCategories();
    res.json({ success: true, categories: categories.map(c => ({ ...c, searches: categorySearches(c) })) });
});

router.get("/preview", requireAuth, async (req, res) => {
    try {
        const query = text(req.query.q, "trending products");
        const size = Math.min(Math.max(parseInt(req.query.size, 10) || 5, 1), 20);
        const result = await cj.listProducts({ page: 1, size, keyword: query });
        const rows = rowsFrom(result);
        const products = [];
        for (const row of rows) {
            const pid = pickPid(row);
            if (!pid) continue;
            try { products.push(await cj.getFullProduct(pid)); } catch { products.push(await cj.normalizeProduct(row)); }
        }
        res.json({ success: true, query, total: products.length, products });
    } catch (error) {
        console.error("❌ CJ preview:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Importe réellement dans produits + médias + variantes + catégories + stock + provider_syncs.
router.post("/import", requireAuth, async (req, res) => {
    const size = Math.min(Math.max(parseInt(req.body?.size, 10) || 3, 1), 10);
    try {
        const categories = await getLocalCategories();
        if (categories.length !== 33) console.warn(`⚠️ Taxonomie attendue: 33, trouvée: ${categories.length}`);
        const supplierId = await ensureSupplier();
        const cjCategories = await getCJCategories();
        const selectedSlugs = Array.isArray(req.body?.categories) && req.body.categories.length ? req.body.categories : null;
        const selected = selectedSlugs ? categories.filter(c => selectedSlugs.includes(c.slug)) : categories;
        const report = { success: true, categories_total: categories.length, categories_importees: 0, fetched: 0, imported: 0, skipped: 0, errors: [], mapping: [] };

        for (const category of selected) {
            const cjCategory = bestCJCategory(category, cjCategories);
            report.mapping.push({ local: category.slug, cj_category_id: cjCategory?.id || null, cj_category_name: cjCategory?.name || null });
            const searches = categorySearches(category);
            let done = false;
            if (cjCategory?.id) {
                try {
                    const result = await cj.listProducts({ page: 1, size, categoryId: cjCategory.id, productFlag: 0, orderBy: 0, sort: "desc" });
                    const rows = rowsFrom(result);
                    report.fetched += rows.length;
                    for (const row of rows) {
                        const pid = pickPid(row);
                        if (!pid) { report.skipped++; continue; }
                        try {
                            const product = await cj.getFullProduct(pid);
                            const saved = await saveProduct(product, category, supplierId);
                            if (saved.id) report.imported++; else report.skipped++;
                        } catch (error) { report.errors.push({ pid: String(pid), category: category.slug, error: error.message }); }
                    }
                    done = rows.length > 0;
                } catch (error) { report.errors.push({ category: category.slug, error: `CJ category: ${error.message}` }); }
            }
            if (!done) {
                for (const query of searches.slice(0, 2)) {
                    try { await importOneQuery(query, category, size, supplierId, report); } catch (error) { report.errors.push({ category: category.slug, query, error: error.message }); }
                }
            }
            report.categories_importees++;
        }
        res.json(report);
    } catch (error) {
        console.error("❌ CJ import:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
