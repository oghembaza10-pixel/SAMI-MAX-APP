const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;

// ===================================================
// PAGE D'ACCUEIL (systeme)
// ===================================================
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Sami</title>
<style>
  body { margin:0; background:#0a0a0a; color:#d4af37; font-family:Georgia,serif;
    height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; }
  h1 { font-size:4rem; margin:0; letter-spacing:4px; text-shadow:0 0 20px rgba(212,175,55,0.4); }
  p.tagline { color:#d4af37; opacity:0.8; font-size:1.1rem; margin-top:10px; letter-spacing:2px; }
  .status { margin-top:40px; padding:10px 24px; border:1px solid #d4af37; border-radius:30px; font-size:0.9rem; }
  .dot { display:inline-block; width:8px; height:8px; background:#d4af37; border-radius:50%; margin-right:8px; }
  a.lien { color:#d4af37; opacity:0.6; margin-top:24px; font-size:0.8rem; text-decoration:none; }
</style>
</head>
<body>
  <h1>SAMI</h1>
  <p class="tagline">L'AMI NUMERO 1 EN ALGERIE</p>
  <div class="status"><span class="dot"></span>Systeme en ligne</div>
  <a class="lien" href="/rejoindre">Rejoindre la liste d'attente &rarr;</a>
</body>
</html>
  `);
});

// ===================================================
// PAGE LISTE D'ATTENTE + CHAT DEMO
// ===================================================
app.get('/rejoindre', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sami - Rejoins la liste</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%230a0a0a'/%3E%3Ctext x='50' y='68' font-size='60' font-family='Georgia,serif' fill='%23d4af37' text-anchor='middle'%3ES%3C/text%3E%3C/svg%3E">
<style>
  * { box-sizing: border-box; }
  body {
    margin:0; background:#0a0a0a; color:#f5f0e6;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    min-height:100vh; display:flex; flex-direction:column; align-items:center;
    padding: 40px 20px 80px;
  }
  .wordmark { font-family:Georgia,serif; font-size:3rem; color:#d4af37; letter-spacing:6px;
    text-shadow:0 0 24px rgba(212,175,55,0.35); margin-bottom:0; }
  .tagline { color:#d4af37; opacity:0.75; font-size:0.85rem; letter-spacing:3px; margin-top:6px; margin-bottom:36px; text-transform:uppercase; }

  .compteur { border:1px solid #d4af37; border-radius:40px; padding:8px 22px; font-size:0.85rem;
    color:#d4af37; margin-bottom:36px; }
  .compteur b { color:#f5f0e6; }

  h2 { font-size:1.6rem; max-width:480px; text-align:center; line-height:1.4; font-weight:600; margin-bottom:12px; }
  p.sub { color:#a89c80; max-width:420px; text-align:center; font-size:0.95rem; line-height:1.5; margin-bottom:32px; }

  form { width:100%; max-width:380px; display:flex; flex-direction:column; gap:14px; }
  input {
    background:#141414; border:1px solid #3a3326; color:#f5f0e6; border-radius:10px;
    padding:14px 16px; font-size:1rem; outline:none; transition:border-color .2s;
  }
  input:focus { border-color:#d4af37; }
  button {
    background:#d4af37; color:#0a0a0a; border:none; border-radius:10px;
    padding:15px; font-size:1rem; font-weight:700; letter-spacing:1px; cursor:pointer;
    transition:transform .15s, box-shadow .15s;
  }
  button:hover { transform:translateY(-1px); box-shadow:0 6px 20px rgba(212,175,55,0.25); }
  button:disabled { opacity:0.5; cursor:not-allowed; }

  .erreur { color:#e06a6a; font-size:0.85rem; text-align:center; }

  .carte {
    display:none; width:100%; max-width:380px; margin-top:10px;
    border:1px solid #d4af37; border-radius:16px; padding:28px 24px;
    background:linear-gradient(135deg, #141414 0%, #0a0a0a 100%);
    box-shadow:0 0 40px rgba(212,175,55,0.12);
  }
  .carte .eyebrow { font-size:0.7rem; letter-spacing:3px; color:#d4af37; opacity:0.7; text-transform:uppercase; }
  .carte .nom { font-family:Georgia,serif; font-size:1.4rem; color:#f5f0e6; margin:8px 0 4px; }
  .carte .rang { color:#d4af37; font-size:0.9rem; margin-bottom:20px; }
  .carte .lien-label { font-size:0.75rem; color:#a89c80; margin-bottom:6px; }
  .carte .lien-box { display:flex; gap:8px; }
  .carte .lien-box input { flex:1; font-size:0.8rem; padding:10px 12px; background:#0a0a0a; }
  .carte .lien-box button { padding:10px 16px; font-size:0.85rem; white-space:nowrap; }
  .carte .note { font-size:0.78rem; color:#a89c80; margin-top:16px; line-height:1.5; }

  .separateur { width:100%; max-width:420px; height:1px; background:#2a2418; margin:56px 0 40px; }

  .chat-titre { font-size:1.3rem; text-align:center; margin-bottom:8px; }
  .chat-sub { color:#a89c80; font-size:0.88rem; text-align:center; max-width:380px; margin-bottom:24px; line-height:1.5; }
  .chat-box {
    width:100%; max-width:420px; border:1px solid #3a3326; border-radius:14px;
    background:#0e0e0e; display:flex; flex-direction:column; height:420px; overflow:hidden;
  }
  .chat-messages { flex:1; overflow-y:auto; padding:18px; display:flex; flex-direction:column; gap:12px; }
  .msg { max-width:80%; padding:10px 14px; border-radius:12px; font-size:0.9rem; line-height:1.4; }
  .msg.sami { background:#1c1810; color:#f5f0e6; align-self:flex-start; border:1px solid #3a3326; }
  .msg.user { background:#d4af37; color:#0a0a0a; align-self:flex-end; }
  .chat-input-zone { display:flex; border-top:1px solid #3a3326; }
  .chat-input-zone input { flex:1; border:none; border-radius:0; background:#0e0e0e; padding:14px; }
  .chat-input-zone button { border-radius:0; padding:14px 20px; font-size:0.85rem; }
  .compteur-msgs { font-size:0.75rem; color:#a89c80; text-align:center; margin-top:10px; }
</style>
</head>
<body>
  <div class="wordmark">SAMI</div>
  <div class="tagline">L'ami numero 1 en Algerie</div>

  <div class="compteur"><b id="nbInscrits">--</b> vendeurs deja sur la liste</div>

  <h2 id="titreForm">Sois parmi les 50 premiers a tester Sami gratuitement</h2>
  <p class="sub">Confirmation de commande automatique, SAV intelligent, et bien plus. Inscris-toi maintenant pour reserver ta place avant le lancement.</p>

  <form id="formInscription">
    <input type="text" id="nomShop" placeholder="Nom de ta boutique" required>
    <input type="tel" id="whatsapp" placeholder="Numero WhatsApp (+213...)" required>
    <button type="submit" id="btnSubmit">Rejoindre la liste</button>
    <div class="erreur" id="erreurMsg"></div>
  </form>

  <div class="carte" id="carteMembre">
    <div class="eyebrow">Place reservee</div>
    <div class="nom" id="carteNom"></div>
    <div class="rang" id="carteRang"></div>
    <div class="lien-label">Partage ce lien, fais monter 3 amis vendeurs et gagne un mois gratuit en plus :</div>
    <div class="lien-box">
      <input type="text" id="lienParrainage" readonly>
      <button id="btnCopier">Copier</button>
    </div>
    <div class="note">On te contacte sur WhatsApp avant le lancement. Garde un oeil sur tes messages.</div>
  </div>

  <div class="separateur"></div>

  <div class="chat-titre">Discute avec Sami maintenant</div>
  <p class="chat-sub">Pose-lui tes vraies questions sur ton business. Tu as 20 messages gratuits par jour pour le tester.</p>

  <div class="chat-box">
    <div class="chat-messages" id="chatMessages">
      <div class="msg sami">Salam ! Je suis Sami. Demande-moi ce que tu veux savoir sur la gestion de ta boutique, le SAV, ou ce que je pourrais faire pour toi.</div>
    </div>
    <div class="chat-input-zone">
      <input type="text" id="chatInput" placeholder="Ecris ton message...">
      <button id="btnEnvoyer">Envoyer</button>
    </div>
  </div>
  <div class="compteur-msgs" id="compteurMsgs"></div>

<script>
  async function chargerCompteur() {
    try {
      const r = await fetch('/api/compteur');
      const d = await r.json();
      document.getElementById('nbInscrits').textContent = d.total;
    } catch (e) {
      document.getElementById('nbInscrits').textContent = '50+';
    }
  }
  chargerCompteur();

  document.getElementById('formInscription').addEventListener('submit', async function(e) {
    e.preventDefault();
    const btn = document.getElementById('btnSubmit');
    const erreur = document.getElementById('erreurMsg');
    erreur.textContent = '';
    btn.disabled = true;
    btn.textContent = 'Inscription...';

    const nomShop = document.getElementById('nomShop').value;
    const whatsapp = document.getElementById('whatsapp').value;

    try {
      const r = await fetch('/api/rejoindre', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nomShop: nomShop, whatsapp: whatsapp })
      });
      const data = await r.json();

      if (!data.ok) {
        erreur.textContent = data.message || 'Une erreur est survenue, reessaie.';
        btn.disabled = false;
        btn.textContent = 'Rejoindre la liste';
        return;
      }

      document.getElementById('formInscription').style.display = 'none';
      document.getElementById('titreForm').style.display = 'none';
      document.querySelector('p.sub').style.display = 'none';

      document.getElementById('carteNom').textContent = nomShop;
      document.getElementById('carteRang').textContent = 'Numero ' + data.rang + ' sur la liste';
      document.getElementById('lienParrainage').value = window.location.origin + '/rejoindre?ref=' + data.code;
      document.getElementById('carteMembre').style.display = 'block';

      chargerCompteur();
    } catch (err) {
      erreur.textContent = 'Connexion impossible, reessaie dans un instant.';
      btn.disabled = false;
      btn.textContent = 'Rejoindre la liste';
    }
  });

  document.getElementById('btnCopier').addEventListener('click', function() {
    const input = document.getElementById('lienParrainage');
    input.select();
    document.execCommand('copy');
    const btn = document.getElementById('btnCopier');
    btn.textContent = 'Copie !';
    setTimeout(function() { btn.textContent = 'Copier'; }, 2000);
  });

  var LIMITE_QUOTIDIENNE = 20;function getCompteurDuJour() {
    var aujourdhui = new Date().toDateString();
    var data = JSON.parse(localStorage.getItem('sami_chat_compteur') || '{}');
    if (data.date !== aujourdhui) {
      return { date: aujourdhui, count: 0 };
    }
    return data;
  }

  function majCompteurAffiche() {
    var data = getCompteurDuJour();
    var restant = LIMITE_QUOTIDIENNE - data.count;
    document.getElementById('compteurMsgs').textContent = restant > 0
      ? restant + ' messages gratuits restants aujourd hui'
      : 'Limite atteinte. Reviens demain pour continuer la discussion.';
    if (restant <= 0) {
      document.getElementById('chatInput').disabled = true;
      document.getElementById('btnEnvoyer').disabled = true;
    }
  }
  majCompteurAffiche();

  function ajouterMessage(texte, type) {
    var div = document.createElement('div');
    div.className = 'msg ' + type;
    div.textContent = texte;
    document.getElementById('chatMessages').appendChild(div);
    document.getElementById('chatMessages').scrollTop = document.getElementById('chatMessages').scrollHeight;
  }

  async function envoyerMessage() {
    var input = document.getElementById('chatInput');
    var texte = input.value.trim();
    if (!texte) return;

    var data = getCompteurDuJour();
    if (data.count >= LIMITE_QUOTIDIENNE) {
      majCompteurAffiche();
      return;
    }

    ajouterMessage(texte, 'user');
    input.value = '';
    input.disabled = true;
    document.getElementById('btnEnvoyer').disabled = true;

    ajouterMessage('...', 'sami');
    var placeholderIndex = document.getElementById('chatMessages').children.length - 1;

    try {
      var r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: texte })
      });
      var reponse = await r.json();

      document.getElementById('chatMessages').children[placeholderIndex].textContent = reponse.reply || 'Desole, reessaie.';

      data.count += 1;
      localStorage.setItem('sami_chat_compteur', JSON.stringify(data));
      majCompteurAffiche();
    } catch (err) {
      document.getElementById('chatMessages').children[placeholderIndex].textContent = 'Connexion impossible, reessaie.';
    }

    input.disabled = false;
    document.getElementById('btnEnvoyer').disabled = false;
    input.focus();
  }

  document.getElementById('btnEnvoyer').addEventListener('click', envoyerMessage);
  document.getElementById('chatInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') envoyerMessage();
  });
</script>
</body>
</html>
  `);
});

// ===================================================
// API : inscription liste d'attente
// ===================================================
app.post('/api/rejoindre', async (req, res) => {
  var nomShop = req.body.nomShop;
  var whatsapp = req.body.whatsapp;

  if (!nomShop || !whatsapp) {
    return res.json({ ok: false, message: 'Merci de remplir tous les champs.' });
  }

  var code = Math.random().toString(36).substring(2, 😎.toUpperCase();

  try {
    if (AIRTABLE_API_KEY && AIRTABLE_BASE_ID) {
      var url = 'https://api.airtable.com/v0/' + AIRTABLE_BASE_ID + '/Vendeurs';
      await axios.post(
        url,
        {
          fields: {
            Nom_Shop: nomShop,
            WhatsApp_Contact: whatsapp,
            Statut: 'Liste d attente',
            Code_Referral: code
          }
        },
        { headers: { Authorization: 'Bearer ' + AIRTABLE_API_KEY } }
      );
    } else {
      console.log('Inscription recue (Airtable non configure) :', nomShop, whatsapp);
    }
    return res.json({ ok: true, rang: Math.floor(Math.random() * 30) + 1, code: code });
  } catch (err) {
    console.error('Erreur inscription Airtable :', err.message);
    return res.json({ ok: true, rang: 1, code: code });
  }
});

// API : compteur d'inscrits
app.get('/api/compteur', async (req, res) => {
  try {
    if (AIRTABLE_API_KEY && AIRTABLE_BASE_ID) {
      var url = 'https://api.airtable.com/v0/' + AIRTABLE_BASE_ID + '/Vendeurs';
      var reponse = await axios.get(url, { headers: { Authorization: 'Bearer ' + AIRTABLE_API_KEY } });
      return res.json({ total: reponse.data.records.length });
    }
    return res.json({ total: 0 });
  } catch (err) {
    console.error('Erreur compteur :', err.message);
    return res.json({ total: 0 });
  }
});

// ===================================================
// API CHAT DEMO : repond via Claude + enregistre la conversation
// Ces conversations sont precieuses pour comprendre les vrais besoins
// ===================================================
app.post('/api/chat', async (req, res) => {
  var message = req.body.message || '';
  var reply = 'Sami sera bientot pret a repondre. Inscris-toi sur la liste pour etre prevenu.';

  try {
    if (CLAUDE_API_KEY) {
      var response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: 'claude-sonnet-4-6',
          max_tokens: 300,
          system: 'Tu es Sami, assistant IA pour e-commercants algeriens. Tu parles francais simple, chaleureux, parfois un mot de darija. Tu expliques ce que tu sais faire : confirmer les commandes automatiquement, gerer le SAV, detecter les clients mecontents, repondre sur WhatsApp. Reponses courtes, 3-4 phrases maximum.',
          messages: [{ role: 'user', content: message }]
        },
        { headers: { 'x-api-key': CLAUDE_API_KEY, 'anthropic-version': '2023-06-01' } }
      );
      reply = response.data.content[0].text;
    }
  } catch (err) {
    console.error('Erreur chat Claude :', err.message);
  }

  try {
    if (AIRTABLE_API_KEY && AIRTABLE_BASE_ID) {
      var url2 = 'https://api.airtable.com/v0/' + AIRTABLE_BASE_ID + '/Conversations_Demo';
      await axios.post(
        url2,
        { fields: { Message_Visiteur: message, Reponse_Sami: reply } },
        { headers: { Authorization: 'Bearer ' + AIRTABLE_API_KEY } }
      );
    }
  } catch (err) {
    console.error('Erreur enregistrement conversation (table Conversations_Demo manquante) :', err.message);
  }

  res.json({ reply: reply });
});

// ===================================================
// WEBHOOKS SHOPIFY - generiques, fonctionnent pour N boutiques
// ===================================================
app.post('/webhook/order', async (req, res) => {
  var commande = req.body;
  var boutique = req.headers['x-shopify-shop-domain'] || 'boutique-inconnue';
  console.log('Nouvelle commande recue de [' + boutique + '] :', commande);

  try {
    if (AIRTABLE_API_KEY && AIRTABLE_BASE_ID) {
      var url = 'https://api.airtable.com/v0/' + AIRTABLE_BASE_ID + '/Commandes';
      await axios.post(
        url,
        {
          fields: {
            Client: commande.customer && commande.customer.first_name ? commande.customer.first_name : 'Inconnu',
            Produit: commande.line_items && commande.line_items[0] ? commande.line_items[0].title : '',
            Montant: commande.total_price || 0,
            Statut: 'Confirmee',
            Boutique: boutique
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
  var message = req.body.message || '';
  var boutique = req.headers['x-shopify-shop-domain'] || 'boutique-inconnue';
  var sentiment = 'neutre';

  try {
    if (CLAUDE_API_KEY) {
      var response = await axios.post(
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
    console.log('ALERTE URGENCE [' + boutique + '] - Client mecontent :', message);
  }

  res.status(200).json({ message_recu: message, sentiment: sentiment, boutique: boutique });
});

app.post('/webhook/stock', (req, res) => {
  var produit = req.body.produit;
  var quantite_demandee = req.body.quantite_demandee;
  var boutique = req.headers['x-shopify-shop-domain'] || 'boutique-inconnue';
  console.log('[' + boutique + '] Verification stock pour ' + produit + ' : ' + quantite_demandee + ' unite(s)');
  res.status(200).json({ produit: produit, disponible: true, boutique: boutique });app.listen(PORT, () => {
  console.log('Sami Max App demarree sur le port ' + PORT);
});

});
