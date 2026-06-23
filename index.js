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

// ─── FONCTION : Envoyer message WhatsApp via CallMeBot ───────────────────────
async function envoyerWhatsApp(message) {
  if (!WHATSAPP_NUMBER || !WHATSAPP_API_KEY) return;
  try {
    const url = `https://api.callmebot.com/whatsapp.php?phone=${WHATSAPP_NUMBER}&text=${encodeURIComponent(message)}&apikey=${WHATSAPP_API_KEY}`;
    await axios.get(url);
    console.log('✅ WhatsApp envoyé');
  } catch (err) {
    console.error('❌ Erreur WhatsApp :', err.message);
  }
}

// ─── FONCTION : Analyser avec Gemini ─────────────────────────────────────────
async function analyserAvecGemini(prompt) {
  if (!GEMINI_API_KEY) return 'Gemini non configuré';
  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
      { contents: [{ parts: [{ text: prompt }] }] }
    );
    return response.data.candidates[0].content.parts[0].text;
  } catch (err) {
    console.error('❌ Erreur Gemini :', err.message);
    return 'Erreur analyse';
  }
}

// ─── FONCTION : Enregistrer dans Airtable ────────────────────────────────────
async function enregistrerAirtable(table, fields) {
  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) return;
  try {
    await axios.post(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${table}`,
      { fields },
      { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` } }
    );
    console.log(`✅ Enregistré dans Airtable (${table})`);
  } catch (err) {
    console.error('❌ Erreur Airtable :', err.message);
  }
}

// ─── PAGE D'ACCUEIL ───────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Sami</title>
<style>
  body { margin:0; background:#0a0a0a; color:#d4af37; font-family:Georgia,serif;
    height:100vh; display:flex; flex-direction:column; align-items:center;
    justify-content:center; text-align:center; }
  h1 { font-size:4rem; margin:0; letter-spacing:4px; text-shadow:0 0 20px rgba(212,175,55,0.4); }
  p.tagline { opacity:0.8; font-size:1.1rem; margin-top:10px; letter-spacing:2px; }
  .status { margin-top:40px; padding:10px 24px; border:1px solid #d4af37;
    border-radius:30px; font-size:0.9rem; }
  .dot { display:inline-block; width:8px; height:8px; background:#d4af37;
    border-radius:50%; margin-right:8px; }
</style>
</head>
<body>
  <h1>SAMI</h1>
  <p class="tagline">L'AMI NUMERO 1 EN ALGERIE</p>
  <div class="status"><span class="dot"></span>Systeme en ligne ✅</div>
</body>
</html>
  `);
});

// ─── WEBHOOK : NOUVELLE COMMANDE ──────────────────────────────────────────────
app.post('/webhook/order', async (req, res) => {
  const commande = req.body;
  console.log('📦 Nouvelle commande reçue :', commande.id);

  const client = commande.customer?.first_name || 'Client';
  const produit = commande.line_items?.[0]?.title || 'Produit inconnu';
  const montant = commande.total_price || '0';
  const ville = commande.shipping_address?.city || 'Inconnue';

  // 1. Enregistrer dans Airtable
  await enregistrerAirtable('Commandes', {
    Client: client,
    Produit: produit,
    Montant: parseFloat(montant),
    Statut: 'Confirmée',
    Ville: ville
  });

  // 2. Générer message de confirmation avec Gemini
  const messageGemini = await analyserAvecGemini(
    `Génère un message de confirmation de commande chaleureux en français pour ${client} qui a commandé ${produit} pour ${montant} DZD. Maximum 2 phrases.`
  );

  // 3. Notifier sur WhatsApp
  const msgWhatsApp = `🛍️ NOUVELLE COMMANDE !\nClient: ${client}\nProduit: ${produit}\nMontant: ${montant} DZD\nVille: ${ville}\n\n💬 ${messageGemini}`;
  await envoyerWhatsApp(msgWhatsApp);

  res.status(200).send('Commande confirmée et enregistrée ✅');
});

// ─── WEBHOOK : SAV INTELLIGENT ────────────────────────────────────────────────
app.post('/webhook/sav', async (req, res) => {
  const message = req.body.message || '';
  const client = req.body.client || 'Client';
  console.log('💬 Message SAV reçu :', message);

  // Analyser le sentiment avec Gemini
  const analyse = await analyserAvecGemini(
    `Analyse ce message client et réponds en JSON avec: {"sentiment": "positif/neutre/negatif", "reponse": "ta réponse au client en français, chaleureuse et professionnelle"}\n\nMessage: ${message}`
  );

  let sentiment = 'neutre';
  let reponse = 'Merci pour votre message, nous revenons vers vous rapidement.';

  try {
    const json = JSON.parse(analyse.replace(/
json|'''/g, '').trim()) ;

sentiment = json.sentiment || 'neutre';
reponse = json.reponse || reponse;
  
} attraper (e) {

console.log('Réponse Gemini brute :', analyse);
  
}

// Enregistrer dans Airtable await enregistrerAirtable('SAV', {

Client: client,
Message: message,
Sentiment: sentiment,
Reponse: reponse
  
});

Alerte WhatsApp si client mécontent si (sentiment === 'négatif') {

await envoyerWhatsApp(`🚨 ALERTE SAV - Client mécontent !\nClient: ${client}\nMessage: ${message}\nSentiment: ${sentiment}`);
  
}

res.status(200).json({ sentiment, reponse }) ; });

─── WEBHOOK : RAPPORT JOURNALIER ──────────────────────────────────────────── app.get('/rapport/journalier', async (req, res) => { console.log(« 📊 Génération rapport journalier... ») ;

const rapport = await analyserAvecGemini(

`Tu es Sami, assistant e-commerce algérien. Génère un rapport journalier fictif mais réaliste pour une boutique en ligne algérienne. Inclus: nombre de commandes, chiffre d'affaires, produit le plus vendu, conseil du jour. Format: texte simple, emojis, max 10 lignes.`
  
);

await envoyerWhatsApp( 📊 RAPPORT JOURNALIER SAMI\n\n${rapport});

res.status(200).json({ rapport }) ; });

─── WEBHOOK : IDÉES CRÉATIVES ──────────────────────────────────────────────── app.post('/creative/idees', async (req, res) => { const produit = req.body.produit || « produit » ; const budget = req.body.budget || « petit » ;

const idees = await analyserAvecGemini(

`Tu es un expert marketing e-commerce algérien. Donne 3 idées créatives de promotion pour vendre plus de "${produit}" avec un budget ${budget}. Adapte au marché algérien. Format: liste numérotée, max 5 lignes par idée.`
  
);

res.status(200).json({ idees }) ; });

─── WEBHOOK : STOCK ────────────────────────────────────────────────────────── app.post('/webhook/stock', (req, res) => { const produit = req.body.produit ; const quantite_demandee = req.body.quantite_demandee ; console.log( 📦 Vérification stock pour ${produit} : ${quantite_demandee} unité(s)) ; res.status(200).json({ produit, disponible : true }) ; }) ;

app.listen(PORT, () => { console.log( 🚀 Sami Max App démarrée sur le port ${PORT}); });


---


