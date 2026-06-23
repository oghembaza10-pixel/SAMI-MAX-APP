const express = require('express');
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

const sami = require('./sami');

// ─── ROUTES ───────────────────────────────────────────────
app.get('/', (req, res) => res.send(sami.pageDAccueil()));

app.post('/webhook/order', async (req, res) => {
  const resultat = await sami.traiterCommande(req.body);
  res.status(200).send(resultat);
});

app.post('/webhook/sav', async (req, res) => {
  const resultat = await sami.traiterSAV(req.body);
  res.status(200).json(resultat);
});

app.get('/rapport/journalier', async (req, res) => {
  const resultat = await sami.genererRapport();
  res.status(200).json(resultat);
});

app.listen(PORT, () => {
  console.log(`🚀 Sami Max App démarrée sur le port ${PORT}`);
});
