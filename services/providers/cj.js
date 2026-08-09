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
    accessTokenExpiresAt =
        Date.now() + 50 * 60 * 1000;

    return accessToken;
}

// ============================================================================
// LIMITE DE DÉBIT — CJ autorise 1 requête / seconde
// ============================================================================

let lastRequestAt = 0;
const MIN_INTERVAL_MS = 1100;

async function throttle() {
    const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) {
        await new Promise(resolve => setTimeout(resolve, wait));
    }
    lastRequestAt = Date.now();
}

// ============================================================================
// REQUÊTE AUTHENTIFIÉE
// ============================================================================

async function request(path, options = {}) {
    const token = await getAccessToken();

    await throttle();

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
// PRODUITS — LISTE V2
// ============================================================================

async function listProducts({
    page = 1,
    size = 20,
    keyword = "",
    categoryId = "",
    countryCode = "",
    startSellPrice = "",
    endSellPrice = "",
    productType = "",
    productFlag = "",
    startWarehouseInventory = "",
    endWarehouseInventory = "",
    verifiedWarehouse = "",
    zonePlatform = "",
    hasCertification = "",
    customization = "",
    orderBy = 0,
    sort = "desc"
} = {}) {

    const params = new URLSearchParams({
        page: String(page),
        size: String(size),
        orderBy: String(orderBy),
        sort: sort,
        features: [
            "enable_description",
            "enable_category",
            "enable_combine",
            "enable_video"
        ].join(",")
    });

    if (keyword) {
        params.set("keyWord", keyword);
    }

    if (categoryId) {
        params.set("categoryId", categoryId);
    }

    if (countryCode) {
        params.set("countryCode", countryCode);
    }

    if (startSellPrice !== "") {
        params.set(
            "startSellPrice",
            String(startSellPrice)
        );
    }

    if (endSellPrice !== "") {
        params.set(
            "endSellPrice",
            String(endSellPrice)
        );
    }

    if (productType !== "") {
        params.set(
            "productType",
            String(productType)
        );
    }

    if (productFlag !== "") {
        params.set(
            "productFlag",
            String(productFlag)
        );
    }

    if (startWarehouseInventory !== "") {
        params.set(
            "startWarehouseInventory",
            String(startWarehouseInventory)
        );
    }

    if (endWarehouseInventory !== "") {
        params.set(
            "endWarehouseInventory",
            String(endWarehouseInventory)
        );
    }

    if (verifiedWarehouse !== "") {
        params.set(
            "verifiedWarehouse",
            String(verifiedWarehouse)
        );
    }

    if (zonePlatform) {
        params.set(
            "zonePlatform",
            zonePlatform
        );
    }

    if (hasCertification !== "") {
        params.set(
            "hasCertification",
            String(hasCertification)
        );
    }

    if (customization !== "") {
        params.set(
            "customization",
            String(customization)
        );
    }

    return request(
        `/product/listV2?${params.toString()}`
    );
}

// ============================================================================
// PRODUITS — TENDANCE
// ============================================================================

async function listTrendingProducts({
    page = 1,
    size = 20,
    categoryId = "",
    platform = ""
} = {}) {

    return listProducts({
        page,
        size,
        categoryId,
        productFlag: 0,
        zonePlatform: platform,
        orderBy: 0,
        sort: "desc"
    });
}

// ============================================================================
// PRODUITS — TIKTOK
// ============================================================================

async function listTikTokProducts({
    page = 1,
    size = 20,
    categoryId = ""
} = {}) {

    return listProducts({
        page,
        size,
        categoryId,
        zonePlatform: "tiktok",
        orderBy: 0,
        sort: "desc"
    });
}

// ============================================================================
// PRODUITS — VIDÉO
// ============================================================================

async function listVideoProducts({
    page = 1,
    size = 20,
    categoryId = ""
} = {}) {

    return listProducts({
        page,
        size,
        categoryId,
        productType: 10,
        orderBy: 0,
        sort: "desc"
    });
}

// ============================================================================
// PRODUITS — TENDANCE TIKTOK + VIDÉO
// ============================================================================

async function listTrendingTikTokProducts({
    page = 1,
    size = 20,
    categoryId = ""
} = {}) {

    return listProducts({
        page,
        size,
        categoryId,
        productFlag: 0,
        zonePlatform: "tiktok",
        productType: 10,
        orderBy: 0,
        sort: "desc"
    });
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
// VIDÉOS PRODUIT
// ============================================================================

async function getProductVideos(pid) {

    if (!pid) {
        throw new Error(
            "CJ getProductVideos: pid manquant"
        );
    }

    return request(
        `/product/queryVideosByProductId?pid=${encodeURIComponent(pid)}`
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
// NORMALISATION PHOTOS / VIDÉOS — helpers communs
// ============================================================================

// CJ renvoie parfois un champ "liste d'URLs" comme un texte JSON
// (ex: productImage = '["url1","url2"]') plutôt qu'un vrai tableau. Sans ce
// décodage, ce texte entier était utilisé tel quel comme URL d'image/vidéo
// (donc une URL invalide, image cassée côté navigateur).
function collectUrlsFromSource(list, source, urlKeys) {

    if (!source) return;

    if (Array.isArray(source)) {

        for (const item of source) {

            if (typeof item === "string") {
                list.push(item);
            } else {
                for (const key of urlKeys) {
                    if (item?.[key]) { list.push(item[key]); break; }
                }
            }
        }

        return;
    }

    if (typeof source === "string") {

        const trimmed = source.trim();

        if (trimmed.startsWith("[")) {
            try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) {
                    collectUrlsFromSource(list, parsed, urlKeys);
                    return;
                }
            } catch {
                // pas du JSON valide : on la traite comme une URL simple ci-dessous
            }
        }

        list.push(source);
    }
}

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
        product?.productImageList,
        product?.imageList
    ];

    for (const source of sources) {
        collectUrlsFromSource(images, source, ["url", "imageUrl"]);
    }

    return [
        ...new Set(
            images.filter(Boolean)
        )
    ];
}

// ============================================================================
// NORMALISATION VIDÉOS
// ============================================================================

function normalizeVideos(product) {

    const videos = [];

    const sources = [
        product?.videoUrl,
        product?.video,
        product?.videoUrlList,
        product?.videos,
        product?.productVideo,
        product?.videoList
    ];

    for (const source of sources) {
        collectUrlsFromSource(videos, source, ["url", "videoUrl"]);
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

// maxDetail : au-delà de ce nombre, les variantes restantes sont conservées
// telles quelles (sans l'appel getVariant supplémentaire) — CJ limite à
// 1 requête/seconde, un produit à 80+ variantes prendrait sinon plus d'une
// minute à lui seul.
async function getProductVariants(product, maxDetail = 25) {

    const variants =
        product?.variants ||
        product?.variantList ||
        product?.productVariantList ||
        product?.variantListData ||
        [];

    if (!Array.isArray(variants)) {
        return [];
    }

    const result = [];

    for (const [index, variant] of variants.entries()) {

        const vid =
            variant?.vid ||
            variant?.variantId ||
            variant?.variantID;

        if (!vid || index >= maxDetail) {

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

        } catch (error) {

            result.push({
                ...variant,
                variant_error:
                    error.message
            });
        }
    }

    return result;
}

// ============================================================================
// RÉCUPÉRATION DES VIDÉOS
// ============================================================================

async function getProductVideosSafe(pid) {

    try {

        const result =
            await getProductVideos(pid);

        return normalizeVideos(
            result?.data ||
            result
        );

    } catch {

        return [];
    }
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

    let videos =
        normalizeVideos(data);

    if (pid && !videos.length) {

        videos =
            await getProductVideosSafe(pid);
    }

    const variants =
        await getProductVariants(data);

    return {

        // --------------------------------------------------------------------
        // IDENTITÉ CJ
        // --------------------------------------------------------------------

        cj_pid:
            pid || null,

        cj_spu:
            data?.spu ||
            data?.productSpu ||
            null,

        cj_name:
            data?.productNameEn ||
            data?.productName ||
            data?.name ||
            "",

        // --------------------------------------------------------------------
        // INFORMATIONS PRODUIT
        // --------------------------------------------------------------------

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

        category:
            data?.categoryName ||
            null,

        cj_category_id:
            data?.categoryId ||
            null,

        cj_category_name:
            data?.categoryName ||
            null,

        // --------------------------------------------------------------------
        // MÉDIAS
        // --------------------------------------------------------------------

        images,

        main_image:
            images[0] ||
            null,

        videos,

        has_video:
            videos.length > 0,

        // --------------------------------------------------------------------
        // PRIX
        // --------------------------------------------------------------------

        price:
            data?.sellPrice ??
            data?.price ??
            data?.productPrice ??
            null,

        cost_price:
            data?.costPrice ??
            data?.supplierPrice ??
            data?.productPrice ??
            null,

        // --------------------------------------------------------------------
        // LOGISTIQUE
        // --------------------------------------------------------------------

        weight:
            data?.weight ??
            null,

        dimensions:
            data?.dimensions ??
            null,

        stock:
            data?.stock ??
            data?.inventory ??
            data?.warehouseInventory ??
            null,

        // --------------------------------------------------------------------
        // VARIANTES
        // --------------------------------------------------------------------

        variants,

        variants_count:
            variants.length,

        // --------------------------------------------------------------------
        // FOURNISSEUR
        // --------------------------------------------------------------------

        supplier:
            data?.supplierName ||
            data?.supplier ||
            "CJ Dropshipping",

        // --------------------------------------------------------------------
        // STATISTIQUES
        // --------------------------------------------------------------------

        rating:
            data?.rating ??
            data?.score ??
            null,

        review_count:
            data?.reviewCount ??
            data?.reviews ??
            null,

        sales:
            data?.sales ??
            data?.salesVolume ??
            data?.orderCount ??
            null,

        // --------------------------------------------------------------------
        // INFORMATIONS SUPPLÉMENTAIRES
        // --------------------------------------------------------------------

        sku:
            data?.sku ||
            data?.productSku ||
            null,

        brand:
            data?.brandName ||
            data?.brand ||
            null,

        country:
            data?.countryCode ||
            data?.country ||
            null,

        warehouse:
            data?.warehouse ||
            null,

        certification:
            data?.certification ||
            null,

        // --------------------------------------------------------------------
        // DONNÉES CJ ORIGINALES
        // --------------------------------------------------------------------

        raw:
            data
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
// EXTRACTION DES PRODUITS DE LA RÉPONSE V2
// ============================================================================

function extractProductRows(result) {

    const content =
        result?.data?.content;

    if (Array.isArray(content)) {

        const rows = [];

        for (const item of content) {

            if (
                Array.isArray(
                    item?.productList
                )
            ) {

                rows.push(
                    ...item.productList
                );

            } else if (
                item?.pid ||
                item?.productId ||
                item?.id
            ) {

                rows.push(item);
            }
        }

        if (rows.length) {
            return rows;
        }
    }

    if (
        Array.isArray(
            result?.data?.productList
        )
    ) {

        return result.data.productList;
    }

    if (
        Array.isArray(
            result?.data?.list
        )
    ) {

        return result.data.list;
    }

    if (
        Array.isArray(
            result?.data
        )
    ) {

        return result.data;
    }

    return [];
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
        extractProductRows(result);

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
                ...await normalizeProduct(row),
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
// IMPORT TENDANCE
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
        extractProductRows(result);

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
                ...await normalizeProduct(row),
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
// IMPORT TIKTOK
// ============================================================================

async function importTikTokProducts({
    page = 1,
    size = 20,
    categoryId = ""
} = {}) {

    const result =
        await listTikTokProducts({
            page,
            size,
            categoryId
        });

    const rows =
        extractProductRows(result);

    const products = [];

    for (const row of rows) {

        const pid =
            row?.pid ||
            row?.productId ||
            row?.id;

        if (!pid) continue;

        try {

            products.push(
                await getFullProduct(pid)
            );

        } catch (error) {

            console.warn(
                `⚠️ CJ TikTok ${pid}:`,
                error.message
            );

            products.push({
                ...await normalizeProduct(row),
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
// IMPORT PRODUITS VIDÉO
// ============================================================================

async function importVideoProducts({
    page = 1,
    size = 20,
    categoryId = ""
} = {}) {

    const result =
        await listVideoProducts({
            page,
            size,
            categoryId
        });

    const rows =
        extractProductRows(result);

    const products = [];

    for (const row of rows) {

        const pid =
            row?.pid ||
            row?.productId ||
            row?.id;

        if (!pid) continue;

        try {

            products.push(
                await getFullProduct(pid)
            );

        } catch (error) {

            console.warn(
                `⚠️ CJ vidéo ${pid}:`,
                error.message
            );

            products.push({
                ...await normalizeProduct(row),
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
// IMPORT TENDANCE TIKTOK
// ============================================================================

async function importTrendingTikTokProducts({
    page = 1,
    size = 20,
    categoryId = ""
} = {}) {

    const result =
        await listTrendingTikTokProducts({
            page,
            size,
            categoryId
        });

    const rows =
        extractProductRows(result);

    const products = [];

    for (const row of rows) {

        const pid =
            row?.pid ||
            row?.productId ||
            row?.id;

        if (!pid) continue;

        try {

            products.push(
                await getFullProduct(pid)
            );

        } catch (error) {

            console.warn(
                `⚠️ CJ tendance TikTok ${pid}:`,
                error.message
            );

            products.push({
                ...await normalizeProduct(row),
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

    // Catalogue V2
    listProducts,
    listTrendingProducts,
    listTikTokProducts,
    listVideoProducts,
    listTrendingTikTokProducts,

    // Produits
    getProduct,
    getFullProduct,
    getFullProductList,
    extractProductRows,

    // Vidéos
    getProductVideos,

    // Variantes
    getVariant,
    getProductVariants,

    // Imports
    importTrendingProducts,
    importTikTokProducts,
    importVideoProducts,
    importTrendingTikTokProducts,

    // Normalisation
    normalizeProduct,
    normalizeImages,
    normalizeVideos
};
