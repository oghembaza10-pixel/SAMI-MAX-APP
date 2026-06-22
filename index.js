
const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;

app.get('/', (req, res) => {
  res.send('Sami Max App est en ligne');
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
