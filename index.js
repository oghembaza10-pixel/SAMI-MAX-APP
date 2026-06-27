const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

// Route Racine
app.get('/', (req, res) => {
    res.send('<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Sami</title><style>body{margin:0;background:#0a0a0a;color:#d4af37;font-family:Georgia,serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;}h1{font-size:4rem;letter-spacing:4px;margin:0;}.btn{margin-top:30px;padding:12px 25px;border:1px solid #d4af37;border-radius:30px;text-decoration:none;color:#d4af37;}</style></head><body><h1>SAMI</h1><p>L\'AMI NUMERO 1 EN ALGERIE</p><a href="/rejoindre" class="btn">Rejoindre la liste</a></body></html>');
});

// Route Rejoindre
app.get('/rejoindre', (req, res) => {
    res.send('<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Sami - Inscription</title><style>body{background:#0a0a0a;color:#f5f0e6;font-family:Georgia,serif;display:flex;flex-direction:column;align-items:center;padding:50px;}form{display:flex;flex-direction:column;gap:15px;width:100%;max-width:300px;}input{padding:12px;border-radius:8px;border:1px solid #3a3326;background:#141414;color:#fff;}button{padding:12px;background:#d4af37;border:none;border-radius:8px;cursor:pointer;font-weight:bold;}</style></head><body><h2>Rejoindre Sami</h2><form id="sForm"><input type="text" id="shop" placeholder="Nom de la boutique" required><input type="tel" id="wa" placeholder="WhatsApp" required><button type="submit" id="sBtn">Valider</button></form><script>document.getElementById("sForm").addEventListener("submit",async(e)=>{e.preventDefault();const b=document.getElementById("sBtn");b.disabled=true;const r=await fetch("/api/v1/inscrire",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({shop:document.getElementById("shop").value,wa:document.getElementById("wa").value})});const d=await r.json();alert(d.msg);b.disabled=false;});</script></body></html>');
});

// API Inscription
app.post('/api/v1/inscrire', async (req, res) => {
    const { shop, wa } = req.body;
    try {
        if (AIRTABLE_API_KEY && AIRTABLE_BASE_ID) {
            await axios.post(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Vendeurs`, 
            { fields: { "Nom_Shop": shop, "WhatsApp_Contact": wa } }, 
            { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` } });
        }
        res.json({ ok: true, msg: "Inscription réussie !" });
    } catch (e) {
        res.json({ ok: false, msg: "Erreur enregistrement." });
    }
});

// Webhook Shopify
app.post('/api/v1/webhook/order', async (req, res) => {
    try {
        if (AIRTABLE_API_KEY && AIRTABLE_BASE_ID) {
            await axios.post(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Commandes`, 
            { fields: { "Client": req.body.customer?.first_name || "Client" } }, 
            { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` } });
        }
        res.status(200).send("OK");
    } catch (e) {
        res.status(200).send("Err");
    }
});

app.listen(PORT, () => console.log(`Sami actif sur ${PORT}`));
