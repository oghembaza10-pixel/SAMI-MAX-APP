// ======================================================
// SAMII OS V1
// ======================================================
const hub = require("./routes/hub");
const path = require("path");
const express = require("express");
const axios = require("axios");
const telegram = require("./routes/telegram");
const settings = require("./routes/settings");
const dashboard = require("./routes/dashboard");
const login = require("./routes/login");
const register = require("./routes/register");
const profile = require("./routes/profile");
const CONFIG = require("./config");
const webhook = require("./routes/webhook");
const academy = require("./routes/academy");
const app = express();
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
const community = require("./routes/community");
const marketplace = require("./routes/marketplace");
const drivers = require("./routes/drivers");
// const suppliers = require("./routes/suppliers");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.get('/', (req, res) => {
    res.render('index');
});

app.use("/hub", hub);

// Cette route intercepte le clic sur une carte (ex: /qg/ecommerce)
// ET C'EST ICI QUE TU DOIS FAIRE ATTENTION :
// Dans le nouveau hub.ejs, les liens sont formatés comme /qg/votre-metier
// Ton EJS 'qg-template' doit être prêt à recevoir la variable 'metier'
app.get('/qg/:metier', (req, res) => {
    res.render('qg-template', { metier: req.params.metier });
});
app.get('/samii', (req, res) => {
    res.render('samii');
});
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
// ROUTES
// ======================================================
app.use(require("./Itinéraires/auth-meta"));
app.use("/webhook/telegram", telegram);
app.use("/community", community);
app.use("/academy", academy);
app.use("/webhook", webhook);
app.use("/profile", profile);
app.use("/dashboard", dashboard);
app.use("/login", login);
app.use("/register", register);
app.use("/settings", settings);
app.use("/marketplace", marketplace);
app.use("/drivers", drivers);
// app.use("/suppliers", suppliers);

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
