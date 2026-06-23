const axios = require('axios');

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const WHATSAPP_NUMBER = process.env.WHATSAPP_NUMBER;
const WHATSAPP_API_KEY = process.env.WHATSAPP_API_KEY;

// ─── WHATSAPP ─────────────────────────────────────────────
async function envoyerWhatsApp(message) {
  if (!WHATSAPP_NUMBER || !WHATSAPP_API_KEY) return;
  try {
    const url = `https://api.callmebot.com/whatsapp.php?phone=${WHATSAPP_NUMBER}&text=${encodeURIComponent(message)}&apikey=${WHATSAPP_API_KEY}`;
    await axios.get(url);
  } catch (err) {
    console.error('Erreur WhatsApp :', err.message);
  }
}

// ─── GEMINI ───────────────────────────────────────────────
async function gemini(prompt) {
  if (!GEMINI_API_KEY) return 'Gemini non configuré';
  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
      { contents: [{ parts: [{ text: prompt }] }] }
    );
    return response.data.candidates[0].content.parts[0].text;
  } catch (err) {
    console.error('Erreur Gemini :', err.message);
    return 'Erreur analyse';
  }
}

// ─── AIRTABLE ─────────────────────────────────────────────
async function airtable(table, fields) {
  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) return;
  try {
    await axios.post(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${table}`,
      { fields },
      { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` } }
    );
  } catch (err) {
    console.error('Erreur Airtable :', err.message);
  }
}

// ─── PAGE ACCUEIL ─────────────────────────────────────────
function pageDAccueil() {
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Sami</title>
<style>
  body { margin:0; background:#0a0a0a; color:#d4af37; font-family:Georgia,serif;
    height:100vh; display:flex; flex-direction:column; align-items:center;
    justify-content:center; text-align:center; }
  h1 { font-size:4rem; margin:0; letter-spacing:4px; }
  p { opacity:0.8; font-size:1.1rem; margin-top:10px; letter-spacing:2px; }
  .status { margin-top:40px; padding:10px 24px; border:1px solid #d4af37; border-radius:30px; }
</style>
</head>
<body>
  <h1>SAMI</h1>
  <p>L'AMI NUMERO 1 EN ALGERIE 🇩🇿</p>
  <div class="status">⚡ Système en ligne ✅</div>
</body>
</html>`;
}

// ─── TRAITER COMMANDE ─────────────────────────────────────
async function traiterCommande(commande) {
  const client = commande.customer?.first_name || 'Client';
  const produit = commande.line_items?.[0]?.title || 'Produit inconnu';
  const montant = commande.total_price || '0';
  const ville = commande.shipping_address?.city || 'Inconnue';

  await airtable('Commandes', { Client: client, Produit: produit, Montant: parseFloat(montant), Statut: 'Confirmée', Ville: ville });

  const msg = await gemini(`Message de confirmation chaleureux en français pour ${client} qui a commandé ${produit} pour ${montant} DZD. Max 2 phrases.`);

  await envoyerWhatsApp(`🛍️ COMMANDE !\nClient: ${client}\nProduit: ${produit}\nMontant: ${montant} DZD\nVille: ${ville}\n\n${msg}`);

  return 'Commande traitée ✅';
}

// ─── TRAITER SAV ──────────────────────────────────────────
async function traiterSAV(body) {
  const message = body.message || '';
  const client = body.client || 'Client';

  const analyse = await gemini(`Analyse ce message et réponds en JSON: {"sentiment": "positif/neutre/negatif", "reponse": "réponse chaleureuse en français"}\n\nMessage: ${message}`);

  let sentiment = 'neutre';
  let reponse = 'Merci, nous revenons vers vous rapidement.';

  try {
    const json = JSON.parse(analyse.replace(/
