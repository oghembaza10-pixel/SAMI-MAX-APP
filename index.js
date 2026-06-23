const express = require('express');
const app = express();
const Sami = require('./sami'); // Le cerveau qui contient la logique des 33 lois

app.use(express.json());

// ─── 1. OPÉRATIONS COMMERCIALES (Commandes & SAV) ─────────
app.post('/webhook/order', async (req, res) => {
    // Confirmation, Suivi, et Stock
    const resultat = await Sami.traiterCommande(req.body);
    res.status(200).json(resultat);
});

app.post('/webhook/sav', async (req, res) => {
    // Gestion SAV et catégorisation VIP / Blacklist
    const resultat = await Sami.traiterSAV(req.body);
    res.status(200).json(resultat);
});

// ─── 2. ANALYSE & STRATÉGIE (Le Radar) ────────────────────
app.get('/radar/opportunites', async (req, res) => {
    // Recherche d'opportunités et analyse de la concurrence
    const resultat = await Sami.analyserOpportunites();
    res.status(200).json(resultat);
});

app.post('/radar/performance-pub', async (req, res) => {
    // Analyse : Pourquoi ça marche ? Pourquoi ça échoue ?
    const resultat = await Sami.analyserPerformancePub(req.body);
    res.status(200).json(resultat);
});

// ─── 3. RELATION CLIENT & ENGAGEMENT ─────────────────────
app.get('/client/segmentation', async (req, res) => {
    // Gestion de la liste VIP et Blacklist
    const resultat = await Sami.segmenterClients();
    res.status(200).json(resultat);
});

app.post('/client/proposition-produit', async (req, res) => {
    // Proposer le bon produit au bon client
    const resultat = await Sami.faireProposition(req.body);
    res.status(200).json(resultat);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(🚀 Système Souverain en ligne sur le port ${PORT});
});
