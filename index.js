const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Clés secrètes - à remplir plus tard sur Vercel, jamais ici
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;

app.get('/', (req, res) => {
  res.send('Sami Max App est en ligne ✅');
});

// 1. CONFIRMATION DE COMMANDE
app.post('/webhook/order', async (req, res) => {
  const commande = req.body;
  console.log('Nouvelle commande reçue :', commande);

  try {
    // Envoie la commande vers Airtable (la table mère)
    if (AIRTABLE_API_KEY && AIRTABLE_BASE_ID) {
      await axios.post(
        https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Commandes,
        {
          fields: {
            Client: commande.customer?.first_name || 'Inconnu',
            Produit: commande.line_items?.[0]?.title || '',
            Montant: commande.total_price || 0,
            Statut: 'Confirmée'
          }
        },
        { headers: { Authorization: Bearer ${AIRTABLE_API_KEY} } }
      );
    }
    res.status(200).send('Commande confirmée et enregistrée');
  } catch (err) {
    console.error('Erreur Airtable :', err.message);
    res.status(200).send('Commande reçue (erreur enregistrement)');
  }
});

// 2. SAV - ANALYSE DE SENTIMENT + ALERTE URGENCE
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
          messages: [{ role: 'user', content: Ce message est-il positif, neutre ou négatif ? Réponds en 1 mot.\n\nMessage : "${message}" }]
        },
        { headers: { 'x-api-key': CLAUDE_API_KEY, 'anthropic-version': '2023-06-01' } }
      );
      sentiment = response.data.content[0].text.toLowerCase().trim();
    }
  } catch (err) {
    console.error('Erreur analyse sentiment :', err.message);
  }

  if (sentiment.includes('négatif')) {
    console.log('🚨 ALERTE URGENCE - Client mécontent :', message);
    // Ici on pourra plus tard envoyer une alerte WhatsApp via WATI
  }

  res.status(200).json({ message_reçu: message, sentiment });
});

// 3. VÉRIFICATION DE STOCK
app.post('/webhook/stock', (req, res) => {
  const { produit, quantite_demandee } = req.body;
  console.log(Vérification stock pour ${produit} : ${quantite_demandee} unité(s));
  // Pour l'instant on simule un stock toujours disponible
  res.status(200).json({ produit, disponible: true });
});

app.listen(PORT, () => {
  console.log('Sami Max App démarrée sur le port ' + PORT);
});
api.airtable.com
api.airtable.com
