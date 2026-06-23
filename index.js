const express = require('express');
const app = express();
const Sami = require('./sami');

app.use(express.json());

app.get('/', (req, res) => res.json(Sami.pageDAccueil()));

app.post('/webhook/sav', async (req, res) => {
    const resultat = await Sami.traiterSAV(req.body);
    res.status(200).json(resultat);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(🚀 Système Souverain en ligne sur le port ${PORT});
});
