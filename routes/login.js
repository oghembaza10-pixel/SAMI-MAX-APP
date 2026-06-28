const express = require("express");

const router = express.Router();

router.get("/", (req, res) => {

res.send(`

<!DOCTYPE html>

<html lang="fr">

<head>

<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">

<title>Connexion - SAMII</title>

<style>

body{
background:#0b0b0b;
font-family:Arial;
display:flex;
justify-content:center;
align-items:center;
height:100vh;
margin:0;
color:white;
}

.box{
width:360px;
background:#181818;
padding:30px;
border-radius:12px;
border:1px solid #333;
}

h1{
text-align:center;
color:#d4af37;
margin-bottom:25px;
}

input{
width:100%;
padding:12px;
margin-top:15px;
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

button:hover{
opacity:.9;
}

p{
text-align:center;
margin-top:20px;
}

a{
color:#d4af37;
text-decoration:none;
}

</style>

</head>

<body>

<div class="box">

<h1>Connexion</h1>

<form method="POST" action="/login">

<input
type="email"
name="email"
placeholder="Adresse e-mail"
required>

<input
type="password"
name="password"
placeholder="Mot de passe"
required>

<button type="submit">
Se connecter
</button>

</form>

<p>

Pas encore de compte ?

<a href="/register">

Créer un compte

</a>

</p>

</div>

</body>

</html>

`);

});

router.post("/", async (req, res) => {

const { email, password } = req.body;

res.json({

success:true,

message:"Login reçu.",

email

});

});

module.exports = router;
