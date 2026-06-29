// ======================================================
// SAMII OS V1
// ======================================================

const express = require("express");
const axios = require("axios");
const settings = require("./routes/settings");
const dashboard = require("./routes/dashboard");
const login = require("./routes/login");
const register = require("./routes/register");
const profile = require("./routes/profile");
const CONFIG = require("./config");
const webhook = require("./routes/webhook");
const academy = require("./routes/academy");
const app = express();
const community = require("./routes/community");
const marketplace = require("./routes/marketplace");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ======================================================
// Vérification
// ======================================================

if (!CONFIG.AIRTABLE.API_KEY) {

    console.log("❌ AIRTABLE_API_KEY manquante");

} else {

    console.log("✅ Airtable connecté");

}

if (!CONFIG.AIRTABLE.BASE_ID) {

    console.log("❌ AIRTABLE_BASE_ID manquant");

}

console.log("🚀 SAMII OS démarre...");

// ======================================================
// HOME
// ======================================================

app.get("/", (req, res) => {

    res.send(`

<!DOCTYPE html>

<html lang="fr">

<head>

<meta charset="UTF-8">

<title>SAMII</title>

<style>

body{

background:#0b0b0b;

color:white;

font-family:Arial;

text-align:center;

padding:60px;

}

input{

width:320px;

padding:12px;

border-radius:10px;

border:none;

margin-top:20px;

}

button{

padding:12px 22px;

margin-left:10px;

background:#d4af37;

border:none;

border-radius:10px;

cursor:pointer;

font-weight:bold;

}

#rep{

margin-top:30px;

white-space:pre-wrap;

max-width:700px;

margin-left:auto;

margin-right:auto;

}

</style>

</head>

<body>

<h1>🤖 SAMII</h1>

<p>L'IA des e-commerçants algériens.</p>

<input id="msg" placeholder="Pose une question à SAMII">

<button onclick="envoyer()">Envoyer</button>

<div id="rep"></div>

<script>

async function envoyer(){

const r=await fetch("/api/chat",{

method:"POST",

headers:{

"Content-Type":"application/json"

},

body:JSON.stringify({

message:document.getElementById("msg").value

})

});

const d=await r.json();

document.getElementById("rep").innerHTML=d.reply;

}

</script>

</body>

</html>

`);

});

// ======================================================
// ROUTES
// ======================================================
app.use("/community", community);
app.use("/academy", academy);
app.use("/webhook", webhook);
app.use("/profile", profile);
app.use("/dashboard", dashboard);
app.use("/login", login);
app.use("/register", register);
app.use("/settings", settings);
app.use("/marketplace", marketplace);
// ======================================================
// CHAT SAMII V1
// ======================================================

app.post("/api/chat", async (req, res) => {

    try {

        const message = req.body.message;

        if (!message) {

            return res.json({

                success:false,

                reply:"Écris un message."

            });

        }

        const response = await axios.post(

            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + CONFIG.GEMINI.API_KEY,

            {

                contents:[

                    {

                        parts:[

                            {

text:`

Tu es SAMII.

Tu aides uniquement les e-commerçants.

Tu réponds en français.

Tu es professionnel.

Tu fais des réponses courtes.

Si quelqu'un demande son inscription :

"Votre compte est en cours de validation.
Le délai est de 24 à 48 heures.
Merci de faire partie des 10 000 partenaires fondateurs."

Question :

${message}

`

                            }

                        ]

                    }

                ]

            }

        );

        const reply=response.data.candidates[0].content.parts[0].text;

        res.json({

            success:true,

            reply

        });

    }

    catch(err){

        console.log(err.response?.data || err.message);

        res.json({

            success:false,

            reply:"SAMII démarre actuellement. Réessaie dans quelques instants."

        });

    }

});

// ======================================================
// START
// ======================================================

app.listen(CONFIG.PORT, () => {

console.log(`🚀 SAMII OS lancé sur ${CONFIG.PORT}`);

});
