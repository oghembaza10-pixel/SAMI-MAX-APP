const express = require('express'); const axios = require('axios'); const app = express(); app.use(express.json()); app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000; const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY; const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID; const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;

app.get('/', function (req, res) {

res.send(

'<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Sami</title>' + '<style>body{margin:0;background:#0a0a0a;color:#d4af37;font-family:Georgia,serif;heigh 'h1{font-size:4rem;margin:0;letter-spacing:4px;}' + 'p{opacity:.8;letter-spacing:2px;}' + '.s{margin-top:30px;padding:10px 22px;border:1px solid #d4af37;border-radius:30px;font 'a{color:#d4af37;opacity:.6;margin-top:20px;font-size:.8rem;text-decoration:none;}</st ' + '<body><h1>SAMI</h1><p>L\'AMI NUMERO 1 EN ALGERIE</p>' + '<div class="s">Systeme en ligne</div>' + '<a href="/rejoindre">Rejoindre la liste</a></body></html>' ); });

app.get('/rejoindre', function (req, res) {

var h = '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">'; h += '<meta name="viewport" content="width=device-width, initial-scale=1">'; h += '<title>Sami</title><style>'; h += '*{box-sizing:border-box;}body{margin:0;background:#0a0a0a;color:#f5f0e6;font-famil h += '.w{font-family:Georgia,serif;font-size:3rem;color:#d4af37;letter-spacing:6px;}'; h += '.tg{color:#d4af37;opacity:.75;font-size:.8rem;letter-spacing:3px;margin:6px 0 24px h += '.cd{display:flex;gap:12px;margin-bottom:20px;}'; h += '.cb{border:1px solid #d4af37;border-radius:10px;padding:8px 14px;text-align:center h += '.cb .n{font-size:1.4rem;font-weight:700;color:#d4af37;}.cb .l{font-size:.6rem;colo h += '.of{border:1px solid #d4af37;border-radius:14px;padding:16px 20px;max-width:400px; h += '.of b{color:#d4af37;}.of p{color:#a89c80;font-size:.85rem;margin:6px 0 0;}'; h += '.ct{border:1px solid #d4af37;border-radius:40px;padding:8px 20px;font-size:.85rem; h += '.ct b{color:#f5f0e6;}'; h += 'h2{font-size:1.4rem;max-width:440px;text-align:center;margin-bottom:24px;}'; h += 'form{width:100%;max-width:360px;display:flex;flex-direction:column;gap:12px;}'; h += 'input{background:#141414;border:1px solid #3a3326;color:#f5f0e6;border-radius:10px h += 'button{background:#d4af37;color:#0a0a0a;border:none;border-radius:10px;padding:14p h += '.er{color:#e06a6a;font-size:.85rem;text-align:center;}'; h += '.cm{display:none;width:100%;max-width:360px;margin-top:10px;border:1px solid #d4af h += '.cm .nm{font-family:Georgia,serif;font-size:1.3rem;margin:6px 0;}'; h += '.cm .rg{color:#d4af37;font-size:.85rem;margin-bottom:16px;}'; h += '.cm .lb{display:flex;gap:8px;}.cm .lb input{flex:1;font-size:.75rem;}'; h += '</style></head><body>'; h += '<div class="w">SAMI</div><div class="tg">L\'ami numero 1 en Algerie</div>'; h += '<div class="cd"><div class="cb"><div class="n" id="cH">--</div><div class="l">H</div></div>'; h += '<div class="cb"><div class="n" id="cM">--</div><div class="l">MIN</div></div>'; h += '<div class="cb"><div class="n" id="cS">--</div><div class="l">SEC</div></div></div>'; h += '<div class="of"><b>Offre de lancement</b><p>Les 50 premiers inscrits recoivent 30 h += '<div class="ct"><b id="nb">--</b> vendeurs sur la liste</div>'; h += '<h2 id="tF">Reserve ta place avant la fin du compte a rebours</h2>'; h += '<form id="fI"><input type="text" id="ns" placeholder="Nom de ta boutique" required h += '<input type="tel" id="wp" placeholder="WhatsApp (+213...)" required>'; h += '<button type="submit" id="bS">Rejoindre la liste</button><div class="er" id="eM"></div>< h += '<div class="cm" id="cMb"><b id="cN"></b><div class="rg" id="cR"></div>'; h += '<div class="lb"><input type="text" id="lP" readonly><button id="bC">Copier</button>< h += '<script>'; h += 'var DL=new Date("2026-06-27T23:59:00Z").getTime();'; h += 'function mc(){var n=new Date().getTime();var d=DL-n;if(d<0)d=0;'; h += 'document.getElementById("cH").textContent=Math.floor(d/3600000);'; h += 'document.getElementById("cM").textContent=Math.floor((d%3600000)/60000);'; h += 'document.getElementById("cS").textContent=Math.floor((d%60000)/1000);}'; h += 'mc();setInterval(mc,1000);'; h += 'fetch("/api/compteur").then(function(r){return r.json();}).then(function(d){docume h += 'document.getElementById("fI").addEventListener("submit",function(e){'; h += 'e.preventDefault();var b=document.getElementById("bS");var er=document.getElementB h += 'b.disabled=true;b.textContent="...";var ns=document.getElementById("ns").value;var h += 'fetch("/api/rejoindre",{method:"POST",headers:{"Content-Type":"application/json"}, h += '.then(function(r){return r.json();}).then(function(d){'; h += 'if(!d.ok){er.textContent=d.message||"Erreur, reessaie.";b.disabled=false;b.textCon h += 'document.getElementById("fI").style.display="none";document.getElementById("tF").s h += 'document.getElementById("cN").textContent=ns;document.getElementById("cR").textCon h += 'document.getElementById("lP").value=window.location.origin+"/rejoindre?ref="+d.cod h += 'document.getElementById("cMb").style.display="block";'; h += '}).catch(function(){er.textContent="Connexion impossible.";b.disabled=false;b.text h += 'document.getElementById("bC").addEventListener("click",function(){var i=document.g h += '</script></body></html>'; res.send(h); });

app.post('/api/rejoindre', async function (req, res) {

var nomShop = req.body.nomShop; var whatsapp = req.body.whatsapp; if (!nomShop || !whatsapp) return res.json({ ok: false, message: 'Remplis tous les champ var code = Math.random().toString(36).substring(2, 8).toUpperCase(); try {

if (AIRTABLE_API_KEY && AIRTABLE_BASE_ID) {

var url = 'https://api.airtable.com/v0/' + AIRTABLE_BASE_ID + '/Vendeurs'; await axios.post(url, { fields: { Nom_Shop: nomShop, WhatsApp_Contact: whatsapp, Sta } return res.json({ ok: true, rang: Math.floor(Math.random() * 30) + 1, code: code }); } catch (err) {

console.error('Erreur Airtable :', err.message); return res.json({ ok: true, rang: 1, code: code }); } });

app.get('/api/compteur', async function (req, res) {

try {

if (AIRTABLE_API_KEY && AIRTABLE_BASE_ID) {
var url = 'https://api.airtable.com/v0/' + AIRTABLE_BASE_ID + '/Vendeurs'; var r = await axios.get(url, { headers: { Authorization: 'Bearer ' + AIRTABLE_API_KEY } return res.json({ total: r.data.records.length }); } return res.json({ total: 0 }); } catch (err) {

return res.json({ total: 0 }); } });

app.post('/webhook/order', async function (req, res) {

var commande = req.body; var boutique = req.headers['x-shopify-shop-domain'] || 'inconnue'; try {

if (AIRTABLE_API_KEY && AIRTABLE_BASE_ID) {

var url = 'https://api.airtable.com/v0/' + AIRTABLE_BASE_ID + '/Commandes'; await axios.post(url, { fields: { Client: commande.customer && commande.customer.fir } res.status(200).send('OK'); } catch (err) {

res.status(200).send('Recu (erreur enregistrement)'); } });

app.post('/webhook/sav', async function (req, res) {

var message = req.body.message || ''; var sentiment = 'neutre'; try {

if (CLAUDE_API_KEY) {

var r = await axios.post('https://api.anthropic.com/v1/messages', { model: 'claude-s sentiment = r.data.content[0].text.toLowerCase().trim(); } } catch (err) {}

res.status(200).json({ sentiment: sentiment }); });

app.post('/webhook/stock', function (req, res) {

res.status(200).json({ disponible: true }); });

app.listen(PORT, function () {

console.log('Sami demarre sur le port ' + PORT); });
