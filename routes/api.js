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

        const result = await planner.build({ goal: message }, context);
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
        // ── Boutique ──
        const boutiqueRes = await axios.get(
            `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_BOUTIQUES}`,
            {
                headers,
                params: {
                    filterByFormula: `{shop_url}="${shop}"`,
                    maxRecords     : 1,
                }
            }
        );
        const boutique = boutiqueRes.data.records[0]?.fields || {};

        // ── Commandes ──
        const commandesRes = await axios.get(
            `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_COMMANDES}`,
            {
                headers,
                params: {
                    filterByFormula     : `{Boutique}="${shop}"`,
                    "sort[0][field]"    : "Date Commande",
                    "sort[0][direction]": "desc",
                    maxRecords          : 100,
                }
            }
        );
        const commandes = commandesRes.data.records.map(r => r.fields);

        // ── Clients ──
        const clientsRes = await axios.get(
            `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_CLIENTS}`,
            {
                headers,
                params: {
                    filterByFormula     : `{Boutique}="${shop}"`,
                    "sort[0][field]"    : "Total Dépensé",
                    "sort[0][direction]": "desc",
                    maxRecords          : 50,
                }
            }
        );
        const clients = clientsRes.data.records.map(r => r.fields);

        // ── Stats globales ──
        const total_commandes = commandes.length;
        const total_revenus   = commandes.reduce((sum, c) => sum + (parseFloat(c.Total) || 0), 0);
        const en_attente      = commandes.filter(c => c.Statut === "en attente").length;
        const confirmees      = commandes.filter(c => c.Statut === "confirmée").length;
        const annulees        = commandes.filter(c => c.Statut === "annulée").length;
        const vip             = clients.filter(c => c.VIP      === true).length;
        const blacklist       = clients.filter(c => c.Blacklist === true).length;

        // ── Livraison ──
        const livrees  = commandes.filter(c => c.Statut === "livrée").length;
        const en_cours = commandes.filter(c => c.Statut === "en cours").length;
        const echecs   = commandes.filter(c => c.Statut === "échoué").length;

        // ── Mission du jour ──
        const aujourd = new Date().toISOString().split("T")[0];
        const cmd_aujourd = commandes.filter(c => (c["Date Commande"] || "").slice(0, 10) === aujourd);
        const rev_aujourd = cmd_aujourd.reduce((s, c) => s + (parseFloat(c.Total) || 0), 0);

        // ── Performance du mois ──
        const moisActuel = aujourd.slice(0, 7);
        const moisPrec   = new Date(new Date().setMonth(new Date().getMonth() - 1))
                            .toISOString().slice(0, 7);
        const cmd_mois   = commandes.filter(c => (c["Date Commande"] || "").startsWith(moisActuel));
        const cmd_moisP  = commandes.filter(c => (c["Date Commande"] || "").startsWith(moisPrec));
        const rev_mois   = cmd_mois.reduce((s, c)  => s + (parseFloat(c.Total) || 0), 0);
        const rev_moisP  = cmd_moisP.reduce((s, c) => s + (parseFloat(c.Total) || 0), 0);
        const evolution  = rev_moisP > 0
            ? ((rev_mois - rev_moisP) / rev_moisP * 100).toFixed(1) + "%"
            : "—";

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
                total_revenus : total_revenus.toFixed(2),
                en_attente,
                confirmees,
                annulees,
                vip,
                blacklist,
            },
            livraison: {
                livrees,
                en_cours,
                echecs,
            },
            mission: {
                date         : aujourd,
                commandes    : cmd_aujourd.length,
                revenus      : rev_aujourd.toFixed(2),
            },
            performance: {
                revenus_mois    : rev_mois.toFixed(2),
                commandes_mois  : cmd_mois.length,
                evolution,
            },
            commandes,
            clients,
        });

    } catch (err) {
        console.error("❌ API qg-data :", err.response?.data || err.message);
        res.status(500).json({ error: "Erreur chargement données." });
    }
});

module.exports = router;

