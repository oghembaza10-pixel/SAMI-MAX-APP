const express = require("express");

const router = express.Router();

router.get("/", (req, res) => {

res.send(`

<!DOCTYPE html>

<html lang="fr">

<head>

<meta charset="UTF-8">

<title>QG</title>

<style>

*{
margin:0;
padding:0;
box-sizing:border-box;
font-family:Arial;
}

body{

background:#0b0b0b;

color:white;

padding:40px;

}

.logo{

font-size:70px;

font-weight:bold;

color:#d4af37;

text-align:center;

}

h1{

text-align:center;

margin-top:10px;

font-size:42px;

}

p{

text-align:center;

color:#cfcfcf;

margin-top:10px;

}

.bienvenue{

margin-top:40px;

background:#171717;

padding:25px;

border-radius:15px;

border:1px solid #333;

}

.grid{

display:grid;

grid-template-columns:repeat(auto-fit,minmax(240px,1fr));

gap:20px;

margin-top:35px;

}

.card{

background:#171717;

padding:25px;

border-radius:15px;

border:1px solid #2b2b2b;

transition:.2s;

}

.card:hover{

border-color:#d4af37;

transform:translateY(-3px);

}

.card h3{

color:#d4af37;

margin-bottom:12px;

}

.badge{

display:inline-block;

margin-top:15px;

padding:6px 12px;

background:#d4af37;

color:black;

font-weight:bold;

border-radius:8px;

}

.footer{

margin-top:50px;

text-align:center;

color:#888;

}

</style>

</head>

<body>

<div class="logo">S</div>

<h1>QG</h1>

<p>Le partenaire intelligent des entrepreneurs.</p>

<div class="bienvenue">

<h2>🏠 Bon retour au QG.</h2>

<br>

<p>

🎯 Un message. Un objectif. Une victoire.

<br><br>

🤖 SAMII est à tes côtés pour t'aider à atteindre ton objectif.

</p>

</div>

<div class="grid">

<div class="card">

<h3>🤖 Parler à SAMII</h3>

<p>Votre partenaire intelligent est prêt.</p>

</div>

<div class="card">

<h3>🛍 Shopify</h3>

<p>Connexion disponible.</p>

</div>

<div class="card">

<h3>📱 WhatsApp</h3>

<p>Activation disponible.</p>

</div>

<div class="card">

<h3>👤 Profil</h3>

<p>Gérez votre compte.</p>

</div>

<div class="card">

<h3>⚙ Paramètres</h3>

<p>Configuration du QG.</p>

</div>

<div class="card">

<h3>👥 Communauté</h3>

<p>Bientôt disponible.</p>

<span class="badge">Bientôt</span>

</div>

<div class="card">

<h3>🚚 Livreurs</h3>

<p>Bientôt disponible.</p>

<span class="badge">Bientôt</span>

</div>

<div class="card">

<h3>🏪 Marketplace</h3>

<p>Bientôt disponible.</p>

<span class="badge">Bientôt</span>

</div>

<div class="card">

<h3>📦 Suivi colis</h3>

<p>Bientôt disponible.</p>

<span class="badge">Bientôt</span>

</div>

<div class="card">

<h3>🏆 Grade</h3>

<p>

Mode actuel :

<br><br>

🪖 SOLDAT

</p>

</div>

</div>

<div class="footer">

Version SOLDAT V1

</div>

</body>

</html>

`);

});

module.exports = router;
