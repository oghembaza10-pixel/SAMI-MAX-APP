/**
 * ============================================================
 * OG • Cloudflare Service
 * Gestion automatique des sous-domaines clients
 * ============================================================
 */

const axios = require("axios");
const CONFIG = require("../config");

async function createClientSubdomain(subdomainName, targetIPOrCname) {
    const zoneId = CONFIG.CLOUDFLARE.ZONE_ID;
    const apiToken = CONFIG.CLOUDFLARE.API_TOKEN;

    if (!zoneId || !apiToken) {
        console.error("❌ Erreur Cloudflare : Identifiants manquants dans la configuration.");
        return { success: false, error: "Missing Cloudflare credentials" };
    }

    try {
        const response = await axios.post(
            `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`,
            {
                type: "CNAME", // Utilise "CNAME" pour pointer vers ton app Render ou un autre domaine, ou "A" pour une IP fixe
                name: `${subdomainName}.souverain-store.com`,
                content: targetIPOrCname || "samii.souverain-store.com", // Par défaut pointe vers ton app principale ou l'adresse cible
                ttl: 1, // Automatique
                proxied: true // Active le proxy Cloudflare (SSL / HTTPS gratuit et protection)
            },
            {
                headers: {
                    "Authorization": `Bearer ${apiToken}`,
                    "Content-Type": "application/json"
                }
            }
        );

        console.log(`✅ Sous-domaine ${subdomainName}.souverain-store.com créé avec succès via Cloudflare !`);
        return { success: true, data: response.data.result };

    } catch (error) {
        console.error("❌ Erreur API Cloudflare :", error.response?.data || error.message);
        return { success: false, error: error.response?.data || error.message };
    }
}

module.exports = { createClientSubdomain };
