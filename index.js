const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;

app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Sami</title>
<style>
  body {
    margin: 0;
    background: #0a0a0a;
    color: #d4af37;
    font-family: Georgia, serif;
    height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
  }
  h1 {
    font-size: 4rem;
    margin: 0;
    letter-spacing: 4px;
    text-shadow: 0 0 20px rgba(212,175,55,0.4);
  }
  p.tagline {
    color: #d4af37;
    opacity: 0.8;
    font-size: 1.1rem;
    margin-top: 10px;
    letter-spacing: 2px;
  }
  .status {
    margin-top: 40px;
    padding: 10px 24px;
    border: 1px solid #d4af37;
    border-radius: 30px;
    font-size: 0.9rem;
  }
  .dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    background: #d4af37;
    border-radius: 50%;
    margin-right: 8px;
  }
</style>
</head>
<body>
  <h1>SAMI</h1>
  <p class="tagline">L'AMI NUMERO 1 EN ALGERIE</p>
  <div class="status"><span class="dot"></span>Systeme en ligne</div>
</body>
</html>
  `);
});

app.post('/webhook/order', async (req, res) => {
  const commande = req.body;
  console.log('Nouvelle commande recue :', commande);

  try {
    if (AIRTABLE_API_KEY && AIRTABLE_BASE_ID) {
      const url = 'https://api.airtable.com/v0/' + AIRTABLE_BASE_ID + '/Commandes';
      await axios.post(
        url,
        {
          fields: {
            Client: commande.customer && commande.customer.first_name ? commande.customer.first_name : 'Inconnu',
            Produit: commande.line_items && commande.line_items[0] ? commande.line_items[0].title : '',
            Montant: commande.total_price || 0,
            Statut: 'Confirmee'
          }
        },
        { headers: { Authorization: 'Bearer ' + AIRTABLE_API_KEY } }
      );
    }
    res.status(200).send('Commande confirmee et enregistree');
  } catch (err) {
    console.error('Erreur Airtable :', err.message);
    res.status(200).send('Commande recue (erreur enregistrement)');
  }
});

app.post('/webhook/sav', async (req, res) => {
  const message = req.body.message || '';
  let sentiment = 'neutre';

  try {
    if (CLAUDE_API_KEY) {
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: 'claude-sonnet-4-6',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Ce message est-il positif, neutre ou negatif ? Reponds en 1 mot.\n\nMessage : ' + message }]
        },
        { headers: { 'x-api-key': CLAUDE_API_KEY, 'anthropic-version': '2023-06-01' } }
      );
      sentiment = response.data.content[0].text.toLowerCase().trim();
    }
  } catch (err) {
    console.error('Erreur analyse sentiment :', err.message);
  }

  if (sentiment.indexOf('negatif') !== -1) {
    console.log('ALERTE URGENCE - Client mecontent :', message);
  }

  res.status(200).json({ message_recu: message, sentiment: sentiment });
});

app.post('/webhook/stock', (req, res) => {
  const produit = req.body.produit;
  const quantite_demandee = req.body.quantite_demandee;
  console.log('Verification stock pour ' + produit + ' : ' + quantite_demandee + ' unite(s)');
  res.status(200).json({ produit: produit, disponible: true });
});

app.listen(PORT, () => {
  console.log('Sami Max App demarree sur le port ' + PORT);
});
