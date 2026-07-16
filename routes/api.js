const express  = require("express");
const router   = express.Router();
const planner  = require("../brain/planner");
const axios    = require("axios");

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const TABLE_BOUTIQUES  = process.env.TABLE_BOUTIQUES;
const TABLE_COMMANDES  = process.env.TABLE_COMMANDES || "Commandes";
const TABLE_CLIENTS    = process.env.TABLE_CLIENTS   || "CLIENTS";

// ── CHAT SAMII ────────────────────────────────────────
router.post("/chat", async (req, res) => {
    try {
        const message = req.body.message;
        if (!message) return res.json({ success: false, reply: "Écris un message." });

        const context = {
            user      : { lang: req.body.lang || "" },
            shop      : req.body.shop       || "",
            client    : req.body.client     || "",
            commande  : req.body.commande   || "",
            page      : req.body.page       || "",
            lastAction: req.body.lastAction || "",
        };

        const result = await planner.plan({ message, context });
        res.json(result);

    } catch (err) {
        console.error("❌ API chat :", err.message);
        res.json({ success: false, reply: "SAMII démarre. Réessaie dans quelques instants." });
    }
});

// ── QG DATA ───────────────────────────────────────────
router.get("/qg-data", async (req, res) => {
    if (!req.session?.loggedIn) return res.status(401).json({ error: "Non connecté" });

    const shop    = req.session.shop;
    const headers = {
        Authorization : `Bearer ${AIRTABLE_API_KEY}`,
        "Content-Type": "application/json",
    };

    try {
        const boutiqueRes = await axios.get(
            `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_BOUTIQUES}?filterByFormula={shop_url}="${shop}"`,
            { headers }
        );
        const boutique = boutiqueRes.data.records[0]?.fields || {};

        const commandesRes = await axios.get(
            `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_COMMANDES}` +
            `?filterByFormula={Boutique}="${shop}"` +
            `&sort[0][field]=Date%20Commande&sort[0][direction]=desc` +
            `&maxRecords=20`,
            { headers }
        );
        const commandes = commandesRes.data.records.map(r => r.fields);

        const clientsRes = await axios.get(
            `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_CLIENTS}` +
            `?filterByFormula={Boutique}="${shop}"` +
            `&sort[0][field]=Total%20D%C3%A9pens%C3%A9&sort[0][direction]=desc` +
            `&maxRecords=50`,
            { headers }
        );
        const clients = clientsRes.data.records.map(r => r.fields);

        const total_commandes = commandes.length;
        const total_revenus   = commandes.reduce((sum, c) => sum + (parseFloat(c.Total) || 0), 0);
        const en_attente      = commandes.filter(c => c.Statut === "en attente").length;
        const confirmees      = commandes.filter(c => c.Statut === "confirmée").length;
        const annulees        = commandes.filter(c => c.Statut === "annulée").length;
        const vip             = clients.filter(c => c.VIP       === true).length;
        const blacklist       = clients.filter(c => c.Blacklist === true).length;

        res.json({
            success : true,
            boutique: {
                nom   : boutique.nom_boutique || shop,
                email : boutique.email        || "",
                pays  : boutique.pays         || "DZ",
                devise: boutique.devise       || "DZD",
            },
            stats: {
                total_commandes,
                total_revenus: total_revenus.toFixed(2),
                en_attente,
                confirmees,
                annulees,
                vip,
                blacklist,
            },
            commandes,
            clients,
        });

    } catch (err) {
        console.error("❌ API qg-data :", err.message);
        res.status(500).json({ error: "Erreur chargement données." });
    }
});

module.exports = router;

