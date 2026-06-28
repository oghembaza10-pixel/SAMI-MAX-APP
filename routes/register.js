const express = require("express");

const router = express.Router();

router.get("/", (req, res) => {

res.send(`

<!DOCTYPE html>

<html lang="fr">

<head>

<meta charset="UTF-8">

<title>Créer un compte - SAMII</title>

<style>

body{
background:#0b0b0b;
font-family:Arial;
display:flex;
justify-content:center;
align-items:center;
height:100vh;
color:white;
}

.box{
width:380px;
background:#181818;
padding:30px;
border-radius:12px;
border:1px solid #333;
}

h1{
text-align:center;
color:#d4af37;
}

input,select{
width:100%;
padding:12px;
margin-top:12px;
border:none;
border-radius:8px;
box-sizing:border-box;
}

button{
width:100%;
padding:12px;
margin-top:20px;
background:#d4af37;
border:none;
border-radius:8px;
font-weight:bold;
cursor:pointer;
}

small{
display:block;
margin-top:15px;
text-align:center;
color:#999;
}

</style>

</head>

<body>

<div class="box">

<h1>Créer un compte</h1>

<input placeholder="Nom">

<input placeholder="Prénom">

<input type="email" placeholder="Email">

<input placeholder="Téléphone">

<select>

<option>E-commerçant</option>

<option>Livreur (bientôt)</option>

<option>Fournisseur (bientôt)</option>

<option>Client (bientôt)</option>

</select>

<input type="password" placeholder="Mot de passe">

<button>Créer mon compte</button>

<small>

Version Soldat V1

</small>

</div>

</body>

</html>

`);

});

module.exports = router;
