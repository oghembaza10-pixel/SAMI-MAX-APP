/**
 * ============================================================
 * OG • CRM Engine
 * Gère toutes les conversations et clients
 * ============================================================
 */

const airtable = require("../services/airtable");

class CRMEngine {

    // ── HELPER : Trouve ou crée un client ────────────
    async findOrCreateClient(data) {
        const { name, phone, email, source } = data;

        // Cherche par téléphone ou email
        const formula = phone
            ? `{Téléphone} = "${phone}"`
            : `{Email} = "${email}"`;

        let client = await airtable.findOne("CLIENTS", formula);

        if (!client) {
            client = await airtable.create("CLIENTS", {
                "Nom"      : name || "Inconnu",
                "Téléphone": phone || "",
                "Email"    : email || "",
                "Source"   : source || "inconnu",
                "Date"     : new Date().toISOString(),
                "Statut"   : "actif",
            });
            console.log(`✅ Nouveau client créé : ${name}`);
        }

        return client;
    }

    // ── HELPER : Enregistre conversation ─────────────
    async saveConversation(data) {
        const { client, message, source, shop, direction = "entrant" } = data;
        return await airtable.create("CONVERSATIONS", {
            "Client"   : client || "Inconnu",
            "Message"  : message || "",
            "Source"   : source || "inconnu",
            "Direction": direction,
            "Boutique" : shop || "",
            "Date"     : new Date().toISOString(),
            "Lu"       : false,
        });
    }

    // ── TELEGRAM ─────────────────────────────────────
    async telegram(event) {
        try {
            const msg  = event.payload;
            const shop = event.shop || "";
            const name = msg.from?.first_name || "Inconnu";
            const text = msg.text || "";

            console.log(`✈️ Telegram message : ${name} → ${text}`);

            await this.findOrCreateClient({
                name,
                phone : "",
                source: "telegram",
            });

            await this.saveConversation({
                client : name,
                message: text,
                source : "telegram",
                shop,
            });

            await airtable.log("telegram.message", `${name}: ${text}`, shop);
            await airtable.journal("telegram.message", { name, text }, shop);

            return { success: true };

        } catch (err) {
            console.error("❌ CRMEngine.telegram :", err.message);
            return { success: false, error: err.message };
        }
    }

    // ── WHATSAPP ──────────────────────────────────────
    async whatsapp(event) {
        try {
            const msg  = event.payload;
            const shop = event.shop || "";
            const name  = msg.senderName || "Inconnu";
            const phone = msg.sender || "";
            const text  = msg.message || "";

            console.log(`💬 WhatsApp message : ${name} → ${text}`);

            await this.findOrCreateClient({
                name,
                phone,
                source: "whatsapp",
            });

            await this.saveConversation({
                client : name,
                message: text,
                source : "whatsapp",
                shop,
            });

            await airtable.log("whatsapp.message", `${name}: ${text}`, shop);
            await airtable.journal("whatsapp.message", { name, phone, text }, shop);

            return { success: true };

        } catch (err) {
            console.error("❌ CRMEngine.whatsapp :", err.message);
            return { success: false, error: err.message };
        }
    }

    // ── INSTAGRAM ─────────────────────────────────────
    async instagram(event) {
        try {
            const msg  = event.payload;
            const shop = event.shop || "";
            const name = msg.sender?.name || "Inconnu";
            const text = msg.message?.text || "";

            console.log(`📸 Instagram message : ${name} → ${text}`);

            await this.findOrCreateClient({
                name,
                source: "instagram",
            });

            await this.saveConversation({
                client : name,
                message: text,
                source : "instagram",
                shop,
            });

            await airtable.log("instagram.message", `${name}: ${text}`, shop);
            await airtable.journal("instagram.message", { name, text }, shop);

            return { success: true };

        } catch (err) {
            console.error("❌ CRMEngine.instagram :", err.message);
            return { success: false, error: err.message };
        }
    }

    // ── MESSENGER ─────────────────────────────────────
    async messenger(event) {
        try {
            const msg  = event.payload;
            const shop = event.shop || "";
            const name = msg.sender?.name || "Inconnu";
            const text = msg.message?.text || "";

            console.log(`📘 Messenger message : ${name} → ${text}`);

            await this.findOrCreateClient({
                name,
                source: "messenger",
            });

            await this.saveConversation({
                client : name,
                message: text,
                source : "messenger",
                shop,
            });

            await airtable.log("messenger.message", `${name}: ${text}`, shop);
            await airtable.journal("messenger.message", { name, text }, shop);

            return { success: true };

        } catch (err) {
            console.error("❌ CRMEngine.messenger :", err.message);
            return { success: false, error: err.message };
        }
    }
}

module.exports = new CRMEngine();

