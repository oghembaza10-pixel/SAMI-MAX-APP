const crypto = require("crypto");

const API_SECRET = process.env.SHOPIFY_API_SECRET;

function verifyWebhookHmac(req) {
    const hmacHeader = req.get("X-Shopify-Hmac-Sha256");
    if (!hmacHeader || !req.body) return false;

    const generated = crypto
        .createHmac("sha256", API_SECRET)
        .update(req.body)
        .digest("base64");

    try {
        return crypto.timingSafeEqual(
            Buffer.from(generated),
            Buffer.from(hmacHeader)
        );
    } catch {
        return false;
    }
}

module.exports = { verifyWebhookHmac };
