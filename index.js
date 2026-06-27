const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;

// Page d'accueil
app.get('/', (req, res) => {
  res.send('<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Sami</title><style>body{margin:0;background:#0a0a0a;color:#d4af37;font-family:Georgia,serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;}h1{font-size:4rem;margin:0;letter-spacing:4px;}p{opacity:.8;letter-spacing:2px;}.s{margin-top:30px;padding:10px 22px;border:1px solid #d4af37;border-radius:30px;}a{color:#d4af37;opacity:.6;margin-top:20px;font-size:.8rem;text-decoration:none;}</style></head><body><h1>SAMI</h1><p>L\'AMI NUMERO 1 EN ALGERIE</p><div class="s">Systeme en ligne</div><a href="/rejoindre">Rejoindre la liste</a></body></html>');
});

// Page Rejoindre
app.get('/rejoindre', (req, res) => {
  res.send('<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Sami</title><style>body{margin:0;background:#0a0a0a;color:#f5f0e6;font-family:Georgia,serif;display:flex;flex-direction:column;align-items:center;padding:20px;}.w{font-size:3rem;color:#d4af37;letter-spacing:6px;}.tg{color:#d4af37;opacity:.75;font-size:.8rem;letter-spacing:3px;margin:6px 0 24px;}form{width:100%;max-width:360px;display:flex;flex-direction:column;gap:12px;}input{background:#141414;border:1px solid #3a3326;color:#f5f0e6;border-radius:10px;padding:12px;}button{background:#d4af37;color:#0a0a0a;border:none;border-radius:10px;padding:14px;cursor:pointer;}</style></head><body><div class="w">SAMI</div><div class="tg">L\'AMI NUMERO 1 EN ALGERIE</div><form id="fI"><input type="text" id="ns" placeholder="Nom de ta boutique" required><input type="tel" id="wp" placeholder="WhatsApp (+213...)" required><button type="submit" id="bS">Rejoindre la liste</button></form><script>document.getElementById("fI").addEventListener("submit",async(e)=>{e.preventDefault();const b=document.getElementById("bS");b.disabled=true;b.textContent="Envoi...";const res=await fetch("/api/rejoindre",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({nomShop:document.getElementById("ns").value,whatsapp:document.getElementById("wp").value})});const d=await res.json();if(d.ok)alert("Inscrit avec succès !");else alert("Erreur : "+d.message);b.disabled=false;b.textContent="Rejoindre la liste";});</script></body></html>');
});

// API Inscription
app.post('/api/rejoindre', async (req, res) => {
  const { nomShop, whatsapp } = req.body;
  if (!nomShop || !whatsapp) return res.json({ ok: false, message: 'Champs manquants' });
  try {
    if (AIRTABLE_API_KEY && AIRTABLE_BASE_ID) {
      await axios.post(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Vendeurs`, { fields: { Nom_Shop: nomShop, WhatsApp_Contact: whatsapp } }, { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` } });
    }
    return res.json({ ok: true });
  } catch (err) {
    return res.json({ ok: false, message: 'Erreur serveur' });
  }
});

// Webhook Shopify
app.post('/webhook/order', async (req, res) => {
  try {
    if (AIRTABLE_API_KEY && AIRTABLE_BASE_ID) {
      await axios.post(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Commandes`, { fields: { Client: req.body.customer?.first_name || 'Inconnu' } }, { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` } });
    }
    res.status(200).send('OK');
  } catch (err) {
    res.status(200).send('Erreur');
  }
});

app.listen(PORT, () => console.log('Sami demarre sur le port ' + PORT));
