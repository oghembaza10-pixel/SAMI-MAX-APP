const BASE_URL = process.env.CJ_API_BASE_URL || "https://developers.cjdropshipping.com/api2.0/v1";
let accessToken = null;
let accessTokenExpiresAt = 0;

function requireKey() {
    if (!process.env.CJ_API_KEY) throw new Error("CJ_API_KEY manquante dans Render");
}

async function rawRequest(path, options = {}) {
    const response = await fetch(`${BASE_URL}${path}`, {
        ...options,
        headers: { "Content-Type": "application/json", ...(options.headers || {}) }
    });
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!response.ok || data?.success === false || data?.result === false) {
        throw new Error(`CJ ${response.status}: ${data?.message || text}`);
    }
    return data;
}

async function getAccessToken() {
    requireKey();
    if (accessToken && Date.now() < accessTokenExpiresAt) return accessToken;
    const data = await rawRequest("/authentication/getAccessToken", {
        method: "POST",
        body: JSON.stringify({ apiKey: process.env.CJ_API_KEY })
    });
    const token = data?.data?.accessToken || data?.data?.access_token || data?.accessToken || data?.access_token;
    if (!token) throw new Error(`CJ token introuvable: ${JSON.stringify(data)}`);
    accessToken = token;
    accessTokenExpiresAt = Date.now() + 50 * 60 * 1000;
    return token;
}

async function request(path, options = {}) {
    const token = await getAccessToken();
    const response = await fetch(`${BASE_URL}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            "CJ-Access-Token": token,
            ...(options.headers || {})
        }
    });
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!response.ok || data?.success === false || data?.result === false) {
        throw new Error(`CJ ${response.status}: ${data?.message || text}`);
    }
    return data;
}

async function getCategories() {
    return request("/product/getCategory");
}

async function listProducts({
    page = 1, size = 10, keyword = "", categoryId = "", countryCode = "",
    startSellPrice = "", endSellPrice = "", productType = "", productFlag = "",
    startWarehouseInventory = "", endWarehouseInventory = "", verifiedWarehouse = "",
    zonePlatform = "", hasCertification = "", customization = "", orderBy = 0, sort = "desc"
} = {}) {
    const params = new URLSearchParams({
        page: String(page), size: String(Math.min(Math.max(size, 1), 100)),
        orderBy: String(orderBy), sort,
        features: "enable_description,enable_category,enable_combine,enable_video"
    });
    const values = {
        keyWord: keyword, categoryId, countryCode, startSellPrice, endSellPrice,
        productType, productFlag, startWarehouseInventory, endWarehouseInventory,
        verifiedWarehouse, zonePlatform, hasCertification, customization
    };
    for (const [key, value] of Object.entries(values)) {
        if (value !== "" && value !== null && value !== undefined) params.set(key, String(value));
    }
    return request(`/product/listV2?${params.toString()}`);
}

async function listTrendingProducts({ page = 1, size = 10, categoryId = "", platform = "" } = {}) {
    return listProducts({ page, size, categoryId, productFlag: 0, zonePlatform: platform, orderBy: 0, sort: "desc" });
}

async function listTikTokProducts({ page = 1, size = 10, categoryId = "" } = {}) {
    return listProducts({ page, size, categoryId, zonePlatform: "tiktok", orderBy: 0, sort: "desc" });
}

async function listVideoProducts({ page = 1, size = 10, categoryId = "" } = {}) {
    return listProducts({ page, size, categoryId, productType: 10, orderBy: 0, sort: "desc" });
}

async function listTrendingTikTokProducts({ page = 1, size = 10, categoryId = "" } = {}) {
    return listProducts({ page, size, categoryId, productFlag: 0, zonePlatform: "tiktok", productType: 10, orderBy: 0, sort: "desc" });
}

async function getProduct(pid) {
    if (!pid) throw new Error("CJ getProduct: pid manquant");
    return request(`/product/query?pid=${encodeURIComponent(pid)}&features=enable_combine,enable_video`);
}

async function getProductVariants(pid) {
    if (!pid) return [];
    try {
        const result = await request(`/product/variant/query?pid=${encodeURIComponent(pid)}`);
        return Array.isArray(result?.data) ? result.data : [];
    } catch { return []; }
}

async function getVariant(vid) {
    if (!vid) throw new Error("CJ getVariant: vid manquant");
    return request(`/product/variant/queryByVid?vid=${encodeURIComponent(vid)}&features=enable_inventory`);
}

async function getInventoryByProductId(pid) {
    if (!pid) return [];
    try {
        const result = await request(`/product/stock/getInventoryByPid?pid=${encodeURIComponent(pid)}`);
        return result?.data?.inventories || result?.data || [];
    } catch { return []; }
}

async function getProductVideos(pid) {
    if (!pid) return [];
    try {
        const result = await request("/product/queryVideosByProductId", {
            method: "POST",
            body: JSON.stringify({ productId: pid })
        });
        return result?.data || [];
    } catch { return []; }
}

function normalizeImages(product) {
    const out = [];
    const sources = [product?.bigImage, product?.productImage, product?.productImageUrl, product?.image,
        product?.mainImage, product?.imageUrl, product?.images, product?.productImages,
        product?.productImageList, product?.imageList];
    for (const source of sources) {
        if (!source) continue;
        const items = Array.isArray(source) ? source : [source];
        for (const item of items) {
            if (typeof item === "string") out.push(item);
            else if (item?.url) out.push(item.url);
            else if (item?.imageUrl) out.push(item.imageUrl);
            else if (item?.bigImage) out.push(item.bigImage);
        }
    }
    return [...new Set(out.filter(Boolean))];
}

function normalizeVideos(product) {
    const out = [];
    const sources = [product?.videoUrl, product?.video, product?.videoUrlList, product?.videos,
        product?.productVideo, product?.videoList];
    for (const source of sources) {
        if (!source) continue;
        const items = Array.isArray(source) ? source : [source];
        for (const item of items) {
            if (typeof item === "string") out.push(item);
            else if (item?.url) out.push(item.url);
            else if (item?.videoUrl) out.push(item.videoUrl);
            else if (item?.videoUrlPath) out.push(item.videoUrlPath);
        }
    }
    return [...new Set(out.filter(Boolean))];
}

async function normalizeProduct(product) {
    const data = product?.data || product || {};
    const pid = data?.pid || data?.productId || data?.id;
    let images = normalizeImages(data);
    let videos = normalizeVideos(data);
    if (pid && !videos.length) videos = normalizeVideos(await getProductVideos(pid));
    let variants = Array.isArray(data?.variants) ? data.variants : (Array.isArray(data?.variantList) ? data.variantList : []);
    if (pid && !variants.length) variants = await getProductVariants(pid);
    const inventory = pid ? await getInventoryByProductId(pid) : [];
    return {
        cj_pid: pid || null,
        cj_spu: data?.spu || data?.productSpu || data?.sku || data?.productSku || null,
        cj_name: data?.productNameEn || data?.nameEn || data?.productName || data?.name || "",
        title: data?.productNameEn || data?.nameEn || data?.productName || data?.name || "",
        description: data?.description || data?.productDescription || data?.productDesc || data?.remark || "",
        category: data?.categoryName || data?.threeCategoryName || null,
        cj_category_id: data?.categoryId || null,
        cj_category_name: data?.categoryName || data?.threeCategoryName || null,
        images, main_image: images[0] || null, videos, has_video: videos.length > 0,
        price: data?.nowPrice ?? data?.discountPrice ?? data?.sellPrice ?? data?.price ?? data?.productPrice ?? null,
        cost_price: data?.costPrice ?? data?.supplierPrice ?? data?.productPrice ?? data?.sellPrice ?? null,
        weight: data?.weight ?? data?.productWeight ?? null,
        dimensions: data?.dimensions ?? null,
        stock: data?.stock ?? data?.inventory ?? data?.warehouseInventory ?? data?.warehouseInventoryNum ?? null,
        inventory, variants, variants_count: variants.length,
        supplier: data?.supplierName || data?.supplier || "CJ Dropshipping",
        rating: data?.rating ?? data?.score ?? null,
        review_count: data?.reviewCount ?? data?.reviews ?? null,
        sales: data?.sales ?? data?.salesVolume ?? data?.orderCount ?? null,
        listed_count: data?.listedNum ?? null,
        sku: data?.sku || data?.productSku || null,
        brand: data?.brandName || data?.brand || null,
        country: data?.countryCode || data?.country || null,
        warehouse: data?.warehouse || null,
        certification: data?.certification || (data?.hasCECertification ? "CE" : null),
        delivery_cycle: data?.deliveryCycle || null,
        free_shipping: data?.isFreeShipping ?? (data?.addMarkStatus === 1),
        customization: data?.customization ?? data?.isPersonalized ?? null,
        raw: data
    };
}

async function getFullProduct(pid) {
    return normalizeProduct(await getProduct(pid));
}

function extractProductRows(result) {
    const content = result?.data?.content;
    if (Array.isArray(content)) {
        const rows = [];
        for (const item of content) {
            if (Array.isArray(item?.productList)) rows.push(...item.productList);
            else if (item?.pid || item?.productId || item?.id) rows.push(item);
        }
        if (rows.length) return rows;
    }
    return result?.data?.list || result?.data?.productList || (Array.isArray(result?.data) ? result.data : []);
}

async function getFullProductList({ page = 1, size = 10, keyword = "", categoryId = "" } = {}) {
    const result = await listProducts({ page, size, keyword, categoryId });
    const rows = extractProductRows(result);
    const products = [];
    for (const row of rows) {
        const pid = row?.pid || row?.productId || row?.id;
        if (!pid) continue;
        try { products.push(await getFullProduct(pid)); }
        catch (error) { products.push({ ...await normalizeProduct(row), detail_error: error.message }); }
    }
    return { success: true, total: products.length, products };
}

async function importTrendingProducts(options = {}) {
    const result = await listTrendingProducts(options);
    const rows = extractProductRows(result);
    const products = [];
    for (const row of rows) {
        const pid = row?.pid || row?.productId || row?.id;
        if (!pid) continue;
        try { products.push(await getFullProduct(pid)); } catch { products.push(await normalizeProduct(row)); }
    }
    return { success: true, total: products.length, products };
}

async function importTikTokProducts(options = {}) {
    const result = await listTikTokProducts(options);
    const rows = extractProductRows(result);
    const products = [];
    for (const row of rows) {
        const pid = row?.pid || row?.productId || row?.id;
        if (!pid) continue;
        try { products.push(await getFullProduct(pid)); } catch { products.push(await normalizeProduct(row)); }
    }
    return { success: true, total: products.length, products };
}

module.exports = {
    getAccessToken, getCategories, listProducts, listTrendingProducts, listTikTokProducts,
    listVideoProducts, listTrendingTikTokProducts, getProduct, getProductVariants, getVariant,
    getInventoryByProductId, getProductVideos, getFullProduct, getFullProductList,
    importTrendingProducts, importTikTokProducts, normalizeProduct, normalizeImages, normalizeVideos,
    extractProductRows
};
