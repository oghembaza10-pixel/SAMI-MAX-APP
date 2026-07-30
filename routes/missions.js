// ==========================================================================
// SAMII OS — MISSIONS — Liste de tâches concrètes générées par SAMII
// ==========================================================================
const express = require("express");
const router  = express.Router();
const airtable = require("../services/airtable");
const workspaceService = require("../services/workspaceService");

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

function getMontant(c) {
    return parseFloat(c.montant || c.Total || 0) || 0;
}

async function genererMissions(workspaceId) {
    const missions = [];

    // ── Commandes en attente depuis plus de 24h ──
    try {
        const commandes = await airtable.find("COMMANDES", `AND({Boutique}="${workspaceId}",{Statut}="en attente")`, 50);
        const maintenant = Date.now();

        for (const c of commandes) {
            const f = c.fields;
            const dateCmd = f["Date Commande"] ? new Date(f["Date Commande"]).getTime() : null;
            if (!dateCmd) continue;
            const heuresDepuis = (maintenant - dateCmd) / (1000 * 60 * 60);
            if (heuresDepuis < 24) continue;

            const nomClient = f["nom client"] || f["Nom Client"] || "un client";
            const idCmd = f["ID Commande"] || c.id;

            missions.push({
                id: `cmd_${c.id}`,
                type: "commande",
                icon: "phone-call",
                texte: `Appeler ${nomClient} pour confirmer la commande #${idCmd}`,
                fait: false,
            });
        }
    } catch (err) {
        console.warn("⚠️ Missions (commandes) :", err.message);
    }

    // ── Clients VIP sans offre depuis longtemps ──
    try {
        const vipClients = await airtable.find("CLIENTS", `AND({workspace_id}="${workspaceId}",{VIP}=1)`, 20);
        for (const c of vipClients) {
            const f = c.fields;
            const nom = f["Nom"] || f["Nom Client"] || "un client VIP";
            const derniereOffre = f.derniere_offre_fidelite ? new Date(f.derniere_offre_fidelite) : null;
            const joursDepuis = derniereOffre ? (Date.now() - derniereOffre.getTime()) / (1000 * 60 * 60 * 24) : Infinity;
            if (joursDepuis
