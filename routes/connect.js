const express = require("express");
const router = express.Router();
const axios = require("axios");

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const TABLE_BOUTIQUES = process.env.TABLE_BOUTIQUES;

// ─────────────────────────────────────────────────────
// Recherche la boutique via le workspaceId
// ─────────────────────────────────────────────────────
async function getBoutiqueRecord(workspaceId) {
    const res = await axios.get(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_BOUTIQUES}`,
        {
            headers: {
                Authorization: `Bearer ${AIRTABLE_API_KEY}`,
            },
            params: {
                filterByFormula: `{workspaceId}="${workspaceId}"`,
                maxRecords: 1,
            },
        }
    );

    return res.data.records?.[0] || null;
}

// ─────────────────────────────────────────────────────
// Mise à jour Airtable
// ─────────────────────────────────────────────────────
async function patchBoutique(recordId, fields) {
    await axios.patch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_BOUTIQUES}/${recordId}`,
        { fields },
        {
            headers: {
                Authorization: `Bearer ${AIRTABLE_API_KEY}`,
                "Content-Type": "application/json",
            },
        }
    );
}

// ─────────────────────────────────────────────────────
// GET /connect/shopify
// ─────────────────────────────────────────────────────
router.get("/shopify", async (req, res) => {
    const workspaceId = req.session.workspaceId;

    if (!workspaceId) {
        return res.redirect("/qg");
    }

    const record = await getBoutiqueRecord(workspaceId);
    const fields = record?.fields || {};

    res.render("connect/shopify", {
        shop: fields.shop_url || "",
        nomBoutique: fields.nom_boutique || "",
        dateConnexion: fields.date_connexion || "—",
        webhooksActifs: fields.webhooks_actifs || false,
    });
});

// ─────────────────────────────────────────────────────
// GET /connect/telegram
// ─────────────────────────────────────────────────────
router.get("/telegram", async (req, res) => {
    const workspaceId = req.session.workspaceId;

    const record = workspaceId
        ? await getBoutiqueRecord(workspaceId)
        : null;

    const fields = record?.fields || {};

    res.render("connect/telegram", {
        shop: fields.shop_url || "",
        telegramChatId: fields.telegram_chat_id || "",
        telegramActif: fields.telegram_actif || false,
    });
});

// ─────────────────────────────────────────────────────
// POST /connect/telegram
// ─────────────────────────────────────────────────────
router.post("/telegram", async (req, res) => {
    const workspaceId = req.session.workspaceId;

    try {
        const record = await getBoutiqueRecord(workspaceId);

        if (!record) {
            return res.status(404).json({
                error: "Workspace introuvable",
            });
        }

        const { telegram_chat_id, telegram_actif } = req.body;

        await patchBoutique(record.id, {
            telegram_chat_id: String(telegram_chat_id),
            telegram_actif:
                telegram_actif === "true" || telegram_actif === true,
        });

        res.redirect("/hub");
    } catch (err) {
        console.error("❌ connect/telegram :", err.message);
        res.status(500).send("Erreur serveur");
    }
});

// ─────────────────────────────────────────────────────
// GET /connect/whatsapp
// ─────────────────────────────────────────────────────
router.get("/whatsapp", async (req, res) => {
    const workspaceId = req.session.workspaceId;

    const record = workspaceId
        ? await getBoutiqueRecord(workspaceId)
        : null;

    const fields = record?.fields || {};

    res.render("connect/whatsapp", {
        shop: fields.shop_url || "",
        whatsappPhone: fields.whatsapp_phone || "",
        whatsappActif: fields.whatsapp_actif || false,
    });
});

// ─────────────────────────────────────────────────────
// POST /connect/whatsapp
// ─────────────────────────────────────────────────────
router.post("/whatsapp", async (req, res) => {
    const workspaceId = req.session.workspaceId;

    try {
        const record = await getBoutiqueRecord(workspaceId);

        if (!record) {
            return res.status(404).json({
                error: "Workspace introuvable",
            });
        }

        const { whatsapp_phone, whatsapp_actif } = req.body;

        await patchBoutique(record.id, {
            whatsapp_phone: String(whatsapp_phone),
            whatsapp_actif:
                whatsapp_actif === "true" || whatsapp_actif === true,
        });

        res.redirect("/hub");
    } catch (err) {
        console.error("❌ connect/whatsapp :", err.message);
        res.status(500).send("Erreur serveur");
    }
});

module.exports = router;
