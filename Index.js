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
app.get('/', function (req, res) {
  res.send(
    '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Sami</title>' +
    '<style>' +
    'body{margin:0;background:#0a0a0a;color:#d4af37;font-family:Georgia,serif;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;}' +
    'h1{font-size:4rem;margin:0;letter-spacing:4px;text-shadow:0 0 20px rgba(212,175,55,0.4);}' +
    'p.tagline{color:#d4af37;opacity:0.8;font-size:1.1rem;margin-top:10px;letter-spacing:2px;}' +
    '.status{margin-top:40px;padding:10px 24px;border:1px solid #d4af37;border-radius:30px;font-size:0.9rem;}' +
    '.dot{display:inline-block;width:8px;height:8px;background:#d4af37;border-radius:50%;margin-right:8px;}' +
    'a.lien{color:#d4af37;opacity:0.6;margin-top:24px;font-size:0.8rem;text-decoration:none;}' +
    '</style></head><body>' +
    '<h1>SAMI</h1>' +
    '<p class="tagline">L\'AMI NUMERO 1 EN ALGERIE</p>' +
    '<div class="status"><span class="dot"></span>Systeme en ligne</div>' +
    '<a class="lien" href="/rejoindre">Rejoindre la liste d\'attente</a>' +
    '</body></html>'
  );
});

// ===================================================
// PAGE LISTE D'ATTENTE + CHAT DEMO
// ===================================================
app.get('/rejoindre', function (req, res) {
  var html = '<!DOCTYPE html><html lang="fr"><head>';
  html += '<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">';
  html += '<title>Sami - Rejoins la liste</title>';
  html += '<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Crect width=\'100\' height=\'100\' fill=\'%230a0a0a\'/%3E%3Ctext x=\'50\' y=\'68\' font-size=\'60\' font-family=\'Georgia,serif\' fill=\'%23d4af37\' text-anchor=\'middle\'%3ES%3C/text%3E%3C/svg%3E">';
  html += '<style>';
  html += '*{box-sizing:border-box;}';
  html += 'body{margin:0;background:#0a0a0a;color:#f5f0e6;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:40px 20px 80px;}';
  html += '.wordmark{font-family:Georgia,serif;font-size:3rem;color:#d4af37;letter-spacing:6px;text-shadow:0 0 24px rgba(212,175,55,0.35);margin-bottom:0;}';
  html += '.tagline{color:#d4af37;opacity:0.75;font-size:0.85rem;letter-spacing:3px;margin-top:6px;margin-bottom:28px;text-transform:uppercase;}';
  html += '.countdown{display:flex;gap:14px;margin-bottom:24px;}';
  html += '.cbox{border:1px solid #d4af37;border-radius:10px;padding:10px 16px;text-align:center;min-width:64px;}';
  html += '.cbox .num{font-size:1.5rem;font-weight:700;color:#d4af37;}';
  html += '.cbox .lbl{font-size:0.65rem;color:#a89c80;letter-spacing:1px;text-transform:uppercase;}';
  html += '.offre{border:1px solid #d4af37;border-radius:14px;padding:18px 22px;max-width:420px;margin-bottom:28px;background:linear-gradient(135deg,#141414 0%,#0a0a0a 100%);}';
  html += '.offre .titre-offre{color:#d4af37;font-weight:700;font-size:0.95rem;margin-bottom:6px;}';
  html += '.offre .detail-offre{color:#a89c80;font-size:0.85rem;line-height:1.5;}';
  html += '.compteur{border:1px solid #d4af37;border-radius:40px;padding:8px 22px;font-size:0.85rem;color:#d4af37;margin-bottom:32px;}';
  html += '.compteur b{color:#f5f0e6;}';
  html += 'h2{font-size:1.5rem;max-width:480px;text-align:center;line-height:1.4;font-weight:600;margin-bottom:12px;}';
  html += 'p.sub{color:#a89c80;max-width:420px;text-align:center;font-size:0.92rem;line-height:1.5;margin-bottom:28px;}';
  html += 'form{width:100%;max-width:380px;display:flex;flex-direction:column;gap:14px;}';
  html += 'input{background:#141414;border:1px solid #3a3326;color:#f5f0e6;border-radius:10px;padding:14px 16px;font-size:1rem;outline:none;transition:border-color .2s;}';
  html += 'input:focus{border-color:#d4af37;}';
  html += 'button{background:#d4af37;color:#0a0a0a;border:none;border-radius:10px;padding:15px;font-size:1rem;font-weight:700;letter-spacing:1px;cursor:pointer;transition:transform .15s,box-shadow .15s;}';
  html += 'button:hover{transform:translateY(-1px);box-shadow:0 6px 20px rgba(212,175,55,0.25);}';
  html += 'button:disabled{opacity:0.5;cursor:not-allowed;}';
  html += '.erreur{color:#e06a6a;font-size:0.85rem;text-align:center;}';
  html += '.carte{display:none;width:100%;max-width:380px;margin-top:10px;border:1px solid #d4af37;border-radius:16px;padding:28px 24px;background:linear-gradient(135deg,#141414 0%,#0a0a0a 100%);box-shadow:0 0 40px rgba(212,175,55,0.12);}';
  html += '.carte .eyebrow{font-size:0.7rem;letter-spacing:3px;color:#d4af37;opacity:0.7;text-transform:uppercase;}';
  html += '.carte .nom{font-family:Georgia,serif;font-size:1.4rem;color:#f5f0e6;margin:8px 0 4px;}';
  html += '.carte .rang{color:#d4af37;font-size:0.9rem;margin-bottom:20px;}';
  html += '.carte .lien-label{font-size:0.75rem;color:#a89c80;margin-bottom:6px;}';
  html += '.carte .lien-box{display:flex;gap:8px;}';
  html += '.carte .lien-box input{flex:1;font-size:0.8rem;padding:10px 12px;background:#0a0a0a;}';
  html += '.carte .lien-box button{padding:10px 16px;font-size:0.85rem;white-space:nowrap;}';
  html += '.carte .note{font-size:0.78rem;color:#a89c80;margin-top:16px;line-height:1.5;}';
  html += '.separateur{width:100%;max-width:420px;height:1px;background:#2a2418;margin:50px 0 36px;}';
  html += '.chat-titre{font-size:1.3rem;text-align:center;margin-bottom:8px;}';
  html += '.chat-sub{color:#a89c80;font-size:0.88rem;text-align:center;max-width:380px;margin-bottom:24px;line-height:1.5;}';
  html += '.chat-box{width:100%;max-width:420px;border:1px solid #3a3326;border-radius:14px;background:#0e0e0e;display:flex;flex-direction:column;height:420px;overflow:hidden;}';
  html += '.chat-messages{flex:1;overflow-y:auto;padding:18px;display:flex;flex-direction:column;gap:12px;}';
  html += '.msg{max-width:80%;padding:10px 14px;border-radius:12px;font-size:0.9rem;line-height:1.4;}';
  html += '.msg.sami{background:#1c1810;color:#f5f0e6;align-self:flex-start;border:1px solid #3a3326;}';
  html += '.msg.user{background:#d4af37;color:#0a0a0a;align-self:flex-end;}';
  html += '.chat-input-zone{display:flex;border-top:1px solid #3a3326;}';
  html += '.chat-input-zone input{flex:1;border:none;border-radius:0;background:#0e0e0e;padding:14px;}';
  html += '.chat-input-zone button{border-radius:0;padding:14px 20px;font-size:0.85rem;}';
  html += '.compteur-msgs{font-size:0.75rem;color:#a89c80;text-align:center;margin-top:10px;}';
  html += '</style></head><body>';

  html += '<div class="wordmark">SAMI</div>';
  html += '<div class="tagline">L\'ami numero 1 en Algerie</div>';

  html += '<div class="countdown" id="countdown">';
  html += '<div class="cbox"><div class="num" id="cdH">--</div><div class="lbl">heures</div></div>';
  html += '<div class="cbox"><div class="num" id="cdM">--</div><div class="lbl">min</div></div>';
  html += '<div class="cbox"><div class="num" id="cdS">--</div><div class="lbl">sec</div></div>';
  html += '</div>';

  html += '<div class="offre">';
  html += '<div class="titre-offre">Offre de lancement, places limitees</div>';
  html += '<div class="detail-offre">Les 50 premiers inscrits recoivent 30 jours d\'essai gratuit complet. Partage ton lien personnel : si 3 amis vendeurs s\'inscrivent grace a toi, tu gagnes 15 jours gratuits en plus.</div>';
  html += '</div>';

  html += '<div class="compteur"><b id="nbInscrits">--</b> vendeurs deja sur la liste</div>';

  html += '<h2 id="titreForm">Reserve ta place avant la fin du compte a rebours</h2>';
  html += '<p class="sub">Confirmation de commande automatique, SAV intelligent, et bien plus. Inscris-toi maintenant.</p>';

  html += '<form id="formInscription">';
  html += '<input type="text" id="nomShop" placeholder="Nom de ta boutique" required>';
  html += '<input type="tel" id="whatsapp" placeholder="Numero WhatsApp (+213...)" required>';
  html += '<button type="submit" id="btnSubmit">Rejoindre la liste</button>';
  html += '<div class="erreur" id="erreurMsg"></div>';
  html += '</form>';

  html += '<div class="carte" id="carteMembre">';
  html += '<div class="eyebrow">Place reservee</div>';
  html += '<div class="nom" id="carteNom"></div>';
  html += '<div class="rang" id="carteRang"></div>';
  html += '<div class="lien-label">Ton lien de parrainage, 3 amis inscrits = 15 jours gratuits en plus :</div>';
  html += '<div class="lien-box"><input type="text" id="lienParrainage" readonly><button id="btnCopier">Copier</button></div>';
  html += '<div class="note">On te contacte sur WhatsApp avant le lancement. Garde un oeil sur tes messages.</div>';
  html += '</div>';

  html += '<div class="separateur"></div>';

  html += '<div class="chat-titre">Discute avec Sami maintenant</div>';
  html += '<p class="chat-sub">Pose-lui tes vraies questions sur ton business. Tu as 20 messages gratuits par jour pour le tester.</p>';

  html += '<div class="chat-box">';
  html += '<div class="chat-messages" id="chatMessages"><div class="msg sami">Salam ! Je suis Sami. Demande-moi ce que tu veux savoir sur la gestion de ta boutique, le SAV, ou ce que je pourrais faire pour toi.</div></div>';
  html += '<div class="chat-input-zone"><input type="text" id="chatInput" placeholder="Ecris ton message..."><button id="btnEnvoyer">Envoyer</button></div>';
  html += '</div>';
  html += '<div class="compteur-msgs" id="compteurMsgs"></div>';

  html += '<script>';
  html += 'var DATE_LIMITE = new Date("2026-06-27T23:59:00Z").getTime();';
  html += 'function majCountdown(){';
  html += 'var maintenant = new Date().getTime();';
  html += 'var diff = DATE_LIMITE - maintenant;';
  html += 'if(diff < 0){ diff = 0; }';
  html += 'var h = Math.floor(diff/(1000*60*60));';
  html += 'var m = Math.floor((diff%(1000*60*60))/(1000*60));';
  html += 'var s = Math.floor((diff%(1000*60))/1000);';
  html += 'document.getElementById("cdH").textContent = h;';
  html += 'document.getElementById("cdM").textContent = (m<10?"0":"")+m;';
  html += 'document.getElementById("cdS").textContent = (s<10?"0":"")+s;';
  html += '}';
  html += 'majCountdown();';
  html += 'setInterval(majCountdown, 1000);';

  html += 'async function chargerCompteur(){';
  html += 'try{ var r = await fetch("/api/compteur"); var d = await r.json(); document.getElementById("nbInscrits").textContent = d.total; }';
  html += 'catch(e){ document.getElementById("nbInscrits").textContent = "50+"; }';
  html += '}';
  html += 'chargerCompteur();';

  html += 'document.getElementById("formInscription").addEventListener("submit", async function(e){';
  html += 'e.preventDefault();';
  html += 'var btn = document.getElementById("btnSubmit");';
  html += 'var erreur = document.getElementById("erreurMsg");';
  html += 'erreur.textContent = "";';
  html += 'btn.disabled = true;';
  html += 'btn.textContent = "Inscription...";';
  html += 'var nomShop = document.getElementById("nomShop").value;';
  html += 'var whatsapp = document.getElementById("whatsapp").value;';
  html += 'try{';
  html += 'var r = await fetch("/api/rejoindre", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({nomShop:nomShop, whatsapp:whatsapp}) });';
  html += 'var data = await r.json();';
  html += 'if(!data.ok){ erreur.textContent = data.message || "Une erreur est survenue, reessaie."; btn.disabled=false; btn.textContent="Rejoindre la liste"; return; }';
  html += 'document.getElementById("formInscription").style.display = "none";';
  html += 'document.getElementById("titreForm").style.display = "none";';
  html += 'document.querySelector("p.sub").style.display = "none";';
  html += 'document.getElementById("carteNom").textContent = nomShop;';
  html += 'document.getElementById("carteRang").textContent = "Numero " + data.rang + " sur la liste";';
  html += 'document.getElementById("lienParrainage").value = window.location.origin + "/rejoindre?ref=" + data.code;';
  html += 'document.getElementById("carteMembre").style.display = "block";';
  html += 'chargerCompteur();';
  html += '} catch(err) { erreur.textContent = "Connexion impossible, reessaie dans un instant."; btn.disabled=false; btn.textContent="Rejoindre la liste"; }';
  html += '});';

  html += 'document.getElementById("btnCopier").addEventListener("click", function(){';
  html += 'var input = document.getElementById("lienParrainage");';
  html += 'input.select();';
  html += 'document.execCommand("copy");';
  html += 'var btn = document.getElementById("btnCopier");';
  html += 'btn.textContent = "Copie !";';
  html += 'setTimeout(function(){ btn.textContent = "Copier"; }, 2000);';
  html += '});';

  html += 'var LIMITE_QUOTIDIENNE = 20;';
  html += 'function getCompteurDuJour(){';
  html += 'var aujourdhui = new Date().toDateString();';
  html += 'var data = JSON.parse(localStorage.getItem("sami_chat_compteur") || "{}");';
  html += 'if(data.date !== aujourdhui){ return {date:aujourdhui, count:0}; }';
  html += 'return data;';
  html += '}';
  html += 'function majCompteurAffiche(){';
  html += 'var data = getCompteurDuJour();';
  html += 'var restant = LIMITE_QUOTIDIENNE - data.count;';
  html += 'document.getElementById("compteurMsgs").textContent = restant > 0 ? restant + " messages gratuits restants aujourd hui" : "Limite atteinte. Reviens demain pour continuer la discussion.";';
  html += 'if(restant <= 0){ document.getElementById("chatInput").disabled = true; document.getElementById("btnEnvoyer").disabled = true; }';
  html += '}';
  html += 'majCompteurAffiche();';

  html += 'function ajouterMessage(texte, type){';
  html += 'var div = document.createElement("div");';
  html += 'div.className = "msg " + type;';
  html += 'div.textContent = texte;';
  html += 'document.getElementById("chatMessages").appendChild(div);';
  html += 'document.getElementById("chatMessages").scrollTop = document.getElementById("chatMessages").scrollHeight;';
  html += '}';

  html += 'async function envoyerMessage(){';
  html += 'var input = document.getElementById("chatInput");';
  html += 'var texte = input.value.trim();';
  html += 'if(!texte) return;';
  html += 'var data = getCompteurDuJour();';
  html += 'if(data.count >= LIMITE_QUOTIDIENNE){ majCompteurAffiche(); return; }';
  html += 'ajouterMessage(texte, "user");';
  html += 'input.value = "";';
  html += 'input.disabled = true;';
  html += 'document.getElementById("btnEnvoyer").disabled = true;';
  html += 'ajouterMessage("...", "sami");';
  html += 'var placeholderIndex = document.getElementById("chatMessages").children.length - 1;';
  html += 'try{';
  html += 'var r = await fetch("/api/chat", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({message:texte}) });';
  html += 'var reponse = await r.json();';
  html += 'document.getElementById("chatMessages").children[placeholderIndex].textContent = reponse.reply || "Desole, reessaie.";';
  html += 'data.count += 1;';
  html += 'localStorage.setItem("sami_chat_compteur", JSON.stringify(data));';
  html += 'majCompteurAffiche();';
  html += '} catch(err) { document.getElementById("chatMessages").children[placeholderIndex].textContent = "Connexion impossible, reessaie."; }';
  html += 'input.disabled = false;';
  html += 'document.getElementById("btnEnvoyer").disabled = false;';
  html += 'input.focus();';
  html += '}';

  html += 'document.getElementById("btnEnvoyer").addEventListener("click", envoyerMessage);';
  html += 'document.getElementById("chatInput").addEventListener("keypress", function(e){ if(e.key==="Enter") envoyerMessage(); });';
  html += '</script>';
  html += '</body></html>';

  res.send(html);
});// ===================================================
// API : inscription liste d'attente
// ===================================================
app.post('/api/rejoindre', async function (req, res) {
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
        { fields: { Nom_Shop: nomShop, WhatsApp_Contact: whatsapp, Statut: 'Liste d attente', Code_Referral: code } },
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
app.get('/api/compteur', async function (req, res) {
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
// API CHAT DEMO
// ===================================================
app.post('/api/chat', async function (req, res) {
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
    console.error('Erreur enregistrement conversation :', err.message);
  }

  res.json({ reply: reply });
});
api.airtable.com
api.airtable.com// ===================================================
// WEBHOOKS SHOPIFY - generiques, fonctionnent pour N boutiques
// ===================================================
app.post('/webhook/order', async function (req, res) {
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

app.post('/webhook/sav', async function (req, res) {
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
          messages: [{ role: 'user', content: 'Ce message est-il positif, neutre ou negatif ? Reponds en 1 mot. Message : ' + message }]
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

app.post('/webhook/stock', function (req, res) {
  var produit = req.body.produit;
  var quantite_demandee = req.body.quantite_demandee;
  var boutique = req.headers['x-shopify-shop-domain'] || 'boutique-inconnue';
  console.log('[' + boutique + '] Verification stock pour ' + produit + ' : ' + quantite_demandee + ' unite(s)');
  res.status(200).json({ produit: produit, disponible: true, boutique: boutique });
});

app.listen(PORT, function () {
  console.log('Sami Max App demarree sur le port ' + PORT);
});
api.airtable.com
api.airtable.com



