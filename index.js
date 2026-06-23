const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const WHATSAPP_NUMBER = process.env.WHATSAPP_NUMBER;
const WHATSAPP_API_KEY = process.env.WHATSAPP_API_KEY;

function envoyerWhatsApp(message) {
  if (!WHATSAPP_NUMBER || !WHATSAPP_API_KEY) return;
  var url = 'https://api.callmebot.com/whatsapp.php?phone=' + WHATSAPP_NUMBER + '&text=' + encodeURIComponent(message) + '&apikey=' + WHATSAPP_API_KEY;
  axios.get(url)
    .then(function() { console.log('WhatsApp envoye'); })
    .catch(function(err) { console.error('Erreur WhatsApp :', err.message); });
}

function analyserAvecGemini(prompt, callback) {
  if (!GEMINI_API_KEY) { callback('Gemini non configure'); return; }
  axios.post(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=' + GEMINI_API_KEY,
    { contents: [{ parts: [{ text: prompt }] }] }
  )
  .then(function(response) {
    callback(response.data.candidates[0].content.parts[0].text);
  })
  .catch(function(err) {
    console.error('Erreur Gemini :', err.message);
    callback('Erreur analyse');
  });
}

function enregistrerAirtable(table, fields) {
  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) return;
  var url = 'https://api.airtable.com/v0/' + AIRTABLE_BASE_ID + '/' + table;
  axios.post(url, { fields: fields }, { headers: { Authorization: 'Bearer ' + AIRTABLE_API_KEY } })
    .then(function() { console.log('Enregistre dans Airtable : ' + table); })
    .catch(function(err) { console.error('Erreur Airtable :', err.message); });
}

app.get('/', function(req, res) {
  res.send('<h1>SAMI</h1><p>Systeme en ligne</p>');
});

app.post('/webhook/order', function(req, res) {
  var commande = req.body;
  console.log('Nouvelle commande recue :', commande.id);

  var client = commande.customer && commande.customer.first_name ? commande.customer.first_name : 'Client';
  var produit = commande.line_items && commande.line_items[0] ? commande.line_items[0].title : 'Produit inconnu';
  var montant = commande.total_price || '0';
  var ville = commande.shipping_address && commande.shipping_address.city ? commande.shipping_address.city : 'Inconnue';

  enregistrerAirtable('Commandes', {
    Client: client,
    Produit: produit,
    Montant: parseFloat(montant),
    Statut: 'Confirmee',
    Ville: ville
  });

  analyserAvecGemini(
    'Genere un message de confirmation chaleureux en francais pour ' + client + ' qui a commande ' + produit + ' pour ' + montant + ' DZD. Maximum 2 phrases.',
    function(messageGemini) {
      var msgWhatsApp = 'NOUVELLE COMMANDE !\nClient: ' + client + '\nProduit: ' + produit + '\nMontant: ' + montant + ' DZD\nVille: ' + ville + '\n\n' + messageGemini;
      envoyerWhatsApp(msgWhatsApp);
    }
  );

  res.status(200).send('Commande confirmee et enregistree');
});

app.post('/webhook/sav', function(req, res) {
  var message = req.body.message || '';
  var client = req.body.client || 'Client';
  console.log('Message SAV recu :', message);

  analyserAvecGemini(
    'Analyse ce message client. Reponds en 1 mot: positif, neutre ou negatif.\n\nMessage : ' + message,
    function(sentiment) {
      sentiment = sentiment.toLowerCase().trim();

      enregistrerAirtable('SAV', {
        Client: client,
        Message: message,
        Sentiment: sentiment
      });

      if (sentiment.indexOf('negatif') !== -1) {
        envoyerWhatsApp('ALERTE SAV - Client mecontent !\nClient: ' + client + '\nMessage: ' + message);
      }

      res.status(200).json({ message_recu: message, sentiment: sentiment });
    }
  );
});

app.get('/rapport/journalier', function(req, res) {
  console.log('Rapport journalier demande');
  analyserAvecGemini(
    'Tu es Sami, assistant e-commerce algerien. Genere un rapport journalier pour une boutique en ligne. Inclus: commandes, chiffre affaires, produit le plus vendu, conseil du jour. Max 10 lignes.',
    function(rapport) {
      envoyerWhatsApp('RAPPORT JOURNALIER SAMI\n\n' + rapport);
      res.status(200).json({ rapport: rapport });
    }
  );
});

app.post('/creative/idees', function(req, res) {
  var produit = req.body.produit || 'produit';
  var budget = req.body.budget || 'petit';
  analyserAvecGemini(
    'Tu es expert marketing algerien. Donne 3 idees de promotion pour vendre ' + produit + ' avec un budget ' + budget + '. Adapte au marche algerien.',
    function(idees) {
      res.status(200).json({ idees: idees });
    }
  );
});

app.post('/webhook/stock', function(req, res) {
  var produit = req.body.produit;
  var quantite_demandee = req.body.quantite_demandee;
  console.log('Verification stock pour ' + produit + ' : ' + quantite_demandee + ' unite(s)');
  res.status(200).json({ produit: produit, disponible: true });
});

app.listen(PORT, function() {
  console.log('Sami Max App demarree sur le port ' + PORT);
});

