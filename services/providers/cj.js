// ============================================================================
// SAMII OS — CJ DROPSHIPPING SERVICE
// Récupération produits + catégories + détails + médias + variantes
// ============================================================================

const BASE_URL =
    process.env.CJ_API_BASE_URL ||
    "https://developers.cjdropshipping.com/api2.0/v1";

let accessToken = null;
let accessTokenExpiresAt = 0;

// ============================================================================
// CONFIG
// ============================================================================

function requireKey() {
    if (!process.env.CJ_API_KEY) {
        throw new Error("CJ_API_KEY manquante dans Render");
    }
}

// ============================================================================
// REQUÊTE PUBLIQUE
// ============================================================================

async function rawRequest(path, options = {}) {
    const response = await fetch(`${BASE_URL}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });

    const text = await response.text();

    let data;

    try {
        data = JSON.parse(text);
    } catch {
        data = { raw: text };
    }

    if (!response.ok) {
        throw new Error(
            `CJ ${response.status}: ${data?.message || text}`
        );
    }

    return data;
}

// ============================================================================
// AUTHENTIFICATION CJ
// ============================================================================

async function getAccessToken() {
    requireKey();

    if (
        accessToken &&
        Date.now() < accessTokenExpiresAt
    ) {
        return accessToken;
    }

    const data = await rawRequest(
        "/authentication/getAccessToken",
        {
            method: "POST",
            body: JSON.stringify({
                apiKey: process.env.CJ_API_KEY
            })
        }
    );

    const token =
        data?.data?.accessToken ||
        data?.data?.access_token ||
        data?.accessToken ||
        data?.access_token;

    if (!token) {
        throw new Error(
            `CJ authentification réussie mais Access Token introuvable: ${JSON.stringify(data)}`
        );
    }

    accessToken = token;

    // On renouvelle avant expiration réelle
    accessTokenExpiresAt =
        Date.now() + 50 * 60 * 1000;

    return accessToken;
}

// ============================================================================
// REQUÊTE AUTHENTIFIÉE
// ============================================================================

async function request(path, options = {}) {
    const token = await getAccessToken();

    const response = await fetch(
        `${BASE_URL}${path}`,
        {
            ...options,
            headers: {
                "Content-Type": "application/json",
                "CJ-Access-Token": token,
                ...(options.headers || {})
            }
        }
    );

    const text = await response.text();

    let data;

    try {
        data = JSON.parse(text);
    } catch {
        data = {
            raw: text
        };
    }

    if (!response.ok) {
        throw new Error(
            `CJ ${response.status}: ${data?.message || text}`
        );
    }

    return data;
}

// ============================================================================
// CATEGORIES CJ
// ============================================================================

async function getCategories() {
    return request("/product/getCategory");
}

// ============================================================================
// PRODUITS — LISTE
// ============================================================================

async function listProducts({
    page = 1,
    size = 20,
    keyword = "",
    categoryId = "",
    sort = ""
} = {}) {

    const params = new URLSearchParams();

    params.set("pageNum", String(page));
    params.set("pageSize", String(size));

    if (keyword) {
        params.set("productNameEn", keyword);
    }

    if (categoryId) {
        params.set("categoryId", categoryId);
    }

    if (sort) {
        params.set("sort", sort);
    }

    return request(
        `/product/list?${params.toString()}`
    );
}

// ============================================================================
// PRODUITS — TENDANCE / POPULAIRES
// ============================================================================
//
// On garde plusieurs stratégies car CJ peut faire évoluer
// les paramètres de tri.
//
// ============================================================================

async function listTrendingProducts({
    page = 1,
    size = 20,
    categoryId = ""
} = {}) {

    const attempts = [
        {
            pageNum: page,
            pageSize: size,
            categoryId,
            sort: "sales"
        },
        {
            pageNum: page,
            pageSize: size,
            categoryId,
            sort: "orders"
        },
        {
            pageNum: page,
            pageSize: size,
            categoryId
        }
    ];

    let lastError = null;

    for (const paramsObject of attempts) {

        try {

            const params = new URLSearchParams();

            Object.entries(paramsObject).forEach(
                ([key, value]) => {

                    if (
                        value !== undefined &&
                        value !== null &&
                        value !== ""
                    ) {
                        params.set(
                            key,
                            String(value)
                        );
                    }

                }
            );

            const result = await request(
                `/product/list?${params.toString()}`
            );

            return result;

        } catch (error) {
            lastError = error;
        }
    }

    throw lastError;
}

// ============================================================================
// DÉTAIL PRODUIT
// ============================================================================

async function getProduct(pid) {

    if (!pid) {
        throw new Error(
            "CJ getProduct: pid manquant"
        );
    }

    return request(
        `/product/query?pid=${encodeURIComponent(pid)}`
    );
}

// ============================================================================
// VARIANTE
// ============================================================================

async function getVariant(vid) {

    if (!vid) {
        throw new Error(
            "CJ getVariant: vid manquant"
        );
    }

    return request(
        `/product/variant/queryByVid?vid=${encodeURIComponent(vid)}`
    );
}

// ============================================================================
// NORMALISATION DES PHOTOS
// ============================================================================

function normalizeImages(product) {

    const images = [];

    const sources = [
        product?.productImage,
        product?.productImageUrl,
        product?.image,
        product?.mainImage,
        product?.imageUrl,
        product?.images,
        product?.productImages,
        product?.productImageList
    ];

    for (const source of sources) {

        if (!source) continue;

        if (Array.isArray(source)) {

            for (const item of source) {

                if (typeof item === "string") {
                    images.push(item);
                } else if (item?.url) {
                    images.push(item.url);
                }

            }

        } else if (typeof source === "string") {
            images.push(source);
        }
    }

    return [
        ...new Set(
            images.filter(Boolean)
        )
    ];
}

// ============================================================================
// NORMALISATION DES VIDÉOS
// ============================================================================

function normalizeVideos(product) {

    const videos = [];

    const sources = [
        product?.videoUrl,
        product?.video,
        product?.videoUrlList,
        product?.videos,
        product?.productVideo
    ];

    for (const source of sources) {

        if (!source) continue;

        if (Array.isArray(source)) {

            for (const item of source) {

                if (typeof item === "string") {
                    videos.push(item);
                } else if (item?.url) {
                    videos.push(item.url);
                }

            }

        } else if (typeof source === "string") {
            videos.push(source);
        }
    }

    return [
        ...new Set(
            videos.filter(Boolean)
        )
    ];
}

// ============================================================================
// NORMALISATION VARIANTES
// ============================================================================

async function getProductVariants(product) {

    const variants =
        product?.variants ||
        product?.variantList ||
        product?.productVariantList ||
        [];

    if (!Array.isArray(variants)) {
        return [];
    }

    const result = [];

    for (const variant of variants) {

        const vid =
            variant?.vid ||
            variant?.variantId;

        if (!vid) {
            result.push(variant);
            continue;
        }

        try {

            const detail =
                await getVariant(vid);

            result.push({
                ...variant,
                detail:
                    detail?.data ||
                    detail
            });

        } catch {

            result.push(variant);
        }
    }

    return result;
}

// ============================================================================
// PRODUIT NORMALISÉ SAMII
// ============================================================================

async function normalizeProduct(product) {

    const data =
        product?.data ||
        product;

    const pid =
        data?.pid ||
        data?.productId ||
        data?.id;

    const images =
        normalizeImages(data);

    const videos =
        normalizeVideos(data);

    const variants =
        await getProductVariants(data);

    return {

        // Identité CJ
        cj_pid: pid || null,

        cj_spu:
            data?.spu ||
            data?.productSpu ||
            null,

        cj_name:
            data?.productNameEn ||
            data?.name ||
            data?.productName ||
            "",

        // Texte
        title:
            data?.productNameEn ||
            data?.productName ||
            data?.name ||
            "",

        description:
            data?.description ||
            data?.productDescription ||
            data?.productDesc ||
            "",

        // Médias
        images,

        main_image:
            images[0] || null,

        videos,

        // Prix
        price:
            data?.sellPrice ||
            data?.price ||
            data?.productPrice ||
            null,

        cost_price:
            data?.costPrice ||
            data?.supplierPrice ||
            data?.productPrice ||
            null,

        // Catégorie CJ
        cj_category_id:
            data?.categoryId ||
            null,

        cj_category_name:
            data?.categoryName ||
            null,

        // Logistique
        weight:
            data?.weight ||
            null,

        dimensions:
            data?.dimensions ||
            null,

        stock:
            data?.stock ||
            data?.inventory ||
            null,

        // Variantes
        variants,

        // Fournisseur
        supplier:
            data?.supplierName ||
            data?.supplier ||
            "CJ Dropshipping",

        // Avis / statistiques si fournis par CJ
        rating:
            data?.rating ||
            data?.score ||
            null,

        review_count:
            data?.reviewCount ||
            data?.reviews ||
            null,

        sales:
            data?.sales ||
            data?.salesVolume ||
            data?.orderCount ||
            null,

        // Toutes les données originales restent conservées
        raw: data
    };
}

// ============================================================================
// RÉCUPÉRATION D'UN PRODUIT COMPLET
// ============================================================================

async function getFullProduct(pid) {

    const product =
        await getProduct(pid);

    return normalizeProduct(product);
}

// ============================================================================
// RÉCUPÉRATION D'UNE LISTE COMPLÈTE
// ============================================================================

async function getFullProductList({
    page = 1,
    size = 20,
    keyword = "",
    categoryId = ""
} = {}) {

    const result =
        await listProducts({
            page,
            size,
            keyword,
            categoryId
        });

    const rows =
        result?.data?.list ||
        result?.data?.content ||
        result?.data ||
        [];

    if (!Array.isArray(rows)) {
        return [];
    }

    const products = [];

    for (const row of rows) {

        const pid =
            row?.pid ||
            row?.productId ||
            row?.id;

        if (!pid) continue;

        try {

            const full =
                await getFullProduct(pid);

            products.push(full);

        } catch (error) {

            products.push({
                ...normalizeProduct(row),
                detail_error: error.message
            });

        }
    }

    return products;
}

// ============================================================================
// IMPORT TENDANCE
// ============================================================================
//
// Cette fonction est celle que ton futur endpoint d'import pourra appeler.
// Elle récupère les produits puis les enrichit.
//
// ============================================================================

async function importTrendingProducts({
    page = 1,
    size = 20,
    categoryId = ""
} = {}) {

    const result =
        await listTrendingProducts({
            page,
            size,
            categoryId
        });

    const rows =
        result?.data?.list ||
        result?.data?.content ||
        result?.data ||
        [];

    if (!Array.isArray(rows)) {
        return {
            success: true,
            total: 0,
            products: []
        };
    }

    const products = [];

    for (const row of rows) {

        const pid =
            row?.pid ||
            row?.productId ||
            row?.id;

        if (!pid) continue;

        try {

            const product =
                await getFullProduct(pid);

            products.push(product);

        } catch (error) {

            console.warn(
                `⚠️ CJ produit ${pid}:`,
                error.message
            );

            products.push({
                ...normalizeProduct(row),
                detail_error:
                    error.message
            });
        }
    }

    return {
        success: true,
        total: products.length,
        products
    };
}

// ============================================================================
// EXPORT
// ============================================================================

module.exports = {

    // Auth
    getAccessToken,

    // Catégories
    getCategories,

    // Recherche / catalogue
    listProducts,
    listTrendingProducts,

    // Produit
    getProduct,
    getFullProduct,
    getFullProductList,

    // Variantes
    getVariant,
    getProductVariants,

    // Import
    importTrendingProducts,

    // Normalisation
    normalizeProduct,
    normalizeImages,
    normalizeVideos
};
