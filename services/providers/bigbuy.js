// ============================================================================
// SAMII OS — BIGBUY SERVICE
// Récupération produits + catégories + détails + variantes/attributs.
//
// ⚠️ Contrairement à cj.js (déjà testé en conditions réelles), cette
// intégration n'a pas pu être vérifiée contre l'API BigBuy réelle depuis cet
// environnement (pas de clé, pas d'accès réseau sortant vers bigbuy.eu ici).
// L'authentification (Bearer token simple, pas d'échange de token comme CJ)
// et la structure générale /rest/catalog/*.json sont documentées et stables
// chez BigBuy, mais les noms de champs exacts renvoyés peuvent varier selon
// la version d'API — lance `node scripts/test-bigbuy-import.js` en premier
// pour vérifier avant un vrai import, et ajuste normalizeProduct() si un
// champ attendu ne matche pas la réponse réelle.
// ============================================================================

const BASE_URL = process.env.BIGBUY_API_BASE_URL || "https://api.bigbuy.eu";

function requireKey() {
    if (!process.env.BIGBUY_API_KEY) {
        throw new Error("BIGBUY_API_KEY manquante dans les variables d'environnement.");
    }
}

// ============================================================================
// REQUÊTE AUTHENTIFIÉE — token Bearer simple, pas d'échange comme CJ
// ============================================================================

async function request(path, options = {}) {
    requireKey();

    const response = await fetch(`${BASE_URL}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.BIGBUY_API_KEY}`,
            ...(options.headers || {}),
        },
    });

    const text = await response.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        data = { raw: text };
    }

    if (!response.ok) {
        throw new Error(`BigBuy ${response.status}: ${data?.message || text}`);
    }

    return data;
}

// ============================================================================
// CATÉGORIES
// ============================================================================

async function getCategories() {
    return request("/rest/catalog/categories.json");
}

// ============================================================================
// PRODUITS — LISTE
// ============================================================================

async function listProducts({ page = 1, pageSize = 20, categoryId = "", isoCode = "en", currency = "EUR" } = {}) {
    const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        isoCode,
        currency,
    });
    if (categoryId) params.set("category", String(categoryId));

    return request(`/rest/catalog/products.json?${params.toString()}`);
}

// ============================================================================
// DÉTAIL PRODUIT
// ============================================================================

async function getProductInfo(sku) {
    if (!sku) throw new Error("BigBuy getProductInfo: sku manquant");
    return request(`/rest/catalog/productinformationbysku/${encodeURIComponent(sku)}.json`);
}

async function getProductImages(id) {
    if (!id) throw new Error("BigBuy getProductImages: id manquant");
    return request(`/rest/catalog/productimages/${encodeURIComponent(id)}.json`);
}

async function getProductVariations(id) {
    if (!id) throw new Error("BigBuy getProductVariations: id manquant");
    return request(`/rest/catalog/productvariations/${encodeURIComponent(id)}.json`);
}

async function getProductStock(id) {
    if (!id) throw new Error("BigBuy getProductStock: id manquant");
    return request(`/rest/catalog/productstockbyreference/${encodeURIComponent(id)}.json`);
}

// ============================================================================
// NORMALISATION — même logique défensive que cj.js : plusieurs noms de
// champs possibles essayés dans l'ordre, rien d'inventé si absent.
// ============================================================================

function normalizeImages(images) {
    if (!Array.isArray(images)) return [];
    return [...new Set(
        images.map(img => (typeof img === "string" ? img : img?.url || img?.image)).filter(Boolean)
    )];
}

function normalizeVariants(variations) {
    if (!Array.isArray(variations)) return [];
    return variations.map(v => ({
        vid: String(v.id ?? v.variationId ?? v.sku ?? ""),
        nom: v.attributeValue || v.name || v.attributes?.map(a => a.value).join(" / ") || "",
        prix: v.wholesalePrice ?? v.price ?? null,
        stock: v.quantity ?? v.stock ?? null,
        sku: v.sku || null,
    })).filter(v => v.nom);
}

async function normalizeProduct(product, { images = [], variations = [] } = {}) {
    const id = product?.id ?? product?.sku;

    return {
        bigbuy_id: id || null,
        bigbuy_sku: product?.sku || null,

        title: product?.name || product?.title || "",
        description: product?.description || "",

        category: product?.category?.name || product?.categoryName || null,
        bigbuy_category_id: product?.category?.id || product?.categoryId || null,

        images: normalizeImages(images),
        main_image: normalizeImages(images)[0] || null,
        videos: [], // BigBuy ne fournit pas de vidéo produit dans son catalogue standard
        has_video: false,

        price: product?.retailPrice ?? product?.price ?? null,
        cost_price: product?.wholesalePrice ?? product?.price ?? null,

        weight: product?.weight ?? null,
        stock: product?.stock ?? product?.quantity ?? null,

        variants: normalizeVariants(variations),
        variants_count: normalizeVariants(variations).length,

        supplier: "BigBuy",
        sku: product?.sku || null,
        brand: product?.manufacturer?.name || product?.brand || null,
        country: "Europe",

        raw: product,
    };
}

// ============================================================================
// PRODUIT COMPLET — enchaîne détail + images + variantes
// ============================================================================

async function getFullProduct(sku) {
    const info = await getProductInfo(sku);
    const product = info?.data || info;
    const id = product?.id ?? product?.sku ?? sku;

    let images = [];
    let variations = [];

    try {
        const imgRes = await getProductImages(id);
        images = imgRes?.data || imgRes || [];
    } catch {
        images = [];
    }

    try {
        const varRes = await getProductVariations(id);
        variations = varRes?.data || varRes || [];
    } catch {
        variations = [];
    }

    return normalizeProduct(product, { images, variations });
}

function extractProductRows(result) {
    if (Array.isArray(result?.data)) return result.data;
    if (Array.isArray(result)) return result;
    return [];
}

module.exports = {
    getCategories,
    listProducts,
    getProductInfo,
    getProductImages,
    getProductVariations,
    getProductStock,
    getFullProduct,
    extractProductRows,
    normalizeProduct,
    normalizeImages,
    normalizeVariants,
};
