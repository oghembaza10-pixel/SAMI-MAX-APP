const axios = require("axios");
const orchestrator = require("../brain/orchestrator");

const SHOPIFY_API_VERSION = "2026-07";

// ─────────────────────────────────────────────
// Récupérer les commandes
// ─────────────────────────────────────────────
async function getOrders(shop, accessToken) {
    try {
        const { data } = await axios.get(
            `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/orders.json`,
            {
                headers: {
                    "X-Shopify-Access-Token": accessToken,
                },
            }
        );

        return {
            success: true,
            orders: data.orders || [],
        };

    } catch (err) {
        console.error("❌ Shopify getOrders :", err.response?.data || err.message);

        return {
            success: false,
            error: err.message,
        };
    }
}

// ─────────────────────────────────────────────
// Récupérer les produits
// ─────────────────────────────────────────────
async function getProducts(shop, accessToken) {
    try {
        const { data } = await axios.get(
            `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/products.json`,
            {
                headers: {
                    "X-Shopify-Access-Token": accessToken,
                },
            }
        );

        return {
            success: true,
            products: data.products || [],
        };

    } catch (err) {
        console.error("❌ Shopify getProducts :", err.response?.data || err.message);

        return {
            success: false,
            error: err.message,
        };
    }
}

// ─────────────────────────────────────────────
// Créer un code de réduction limité dans le temps (relance panier
// abandonné) — API GraphQL, méthode recommandée par Shopify depuis que
// PriceRule/DiscountCode REST sont dépréciées. Nécessite le scope
// write_discounts. Non-bloquant pour l'appelant : renvoie null en cas
// d'échec plutôt que de faire planter la relance (le message part quand
// même, juste sans réduction).
// ─────────────────────────────────────────────
async function createDiscountCode(shop, accessToken, { code, percentage, validityMinutes = 120 }) {
    try {
        const startsAt = new Date();
        const endsAt = new Date(startsAt.getTime() + validityMinutes * 60 * 1000);

        const mutation = `
            mutation discountCodeBasicCreate($basicCodeDiscount: DiscountCodeBasicInput!) {
                discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
                    codeDiscountNode { id }
                    userErrors { field message }
                }
            }
        `;
        const variables = {
            basicCodeDiscount: {
                title: `Relance panier — ${code}`,
                code,
                startsAt: startsAt.toISOString(),
                endsAt: endsAt.toISOString(),
                customerSelection: { all: true },
                customerGets: {
                    value: { percentage: percentage / 100 },
                    items: { all: true },
                },
                appliesOncePerCustomer: true,
                usageLimit: 1,
            },
        };

        const { data } = await axios.post(
            `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
            { query: mutation, variables },
            { headers: { "X-Shopify-Access-Token": accessToken, "Content-Type": "application/json" } }
        );

        const errors = data?.data?.discountCodeBasicCreate?.userErrors || [];
        if (errors.length) {
            console.warn("⚠️ Shopify createDiscountCode :", errors);
            return null;
        }
        return data?.data?.discountCodeBasicCreate?.codeDiscountNode ? code : null;
    } catch (err) {
        console.error("❌ Shopify createDiscountCode :", err.response?.data || err.message);
        return null;
    }
}

// ─────────────────────────────────────────────
// Réception d'un événement Shopify
// ─────────────────────────────────────────────
async function receive(event) {
    try {
        await orchestrator.process({
            type: `shopify.${event.type}`,
            shop: event.shop || "",
            payload: event.payload || {},
        });

        return true;

    } catch (err) {
        console.error("❌ Shopify receive :", err.message);
        return false;
    }
}

module.exports = {
    createDiscountCode,
    getOrders,
    getProducts,
    receive,
};
