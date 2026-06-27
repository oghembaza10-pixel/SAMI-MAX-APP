// ======================================================
// SAMII OS V1
// ======================================================

const express = require("express");

const CONFIG = require("./config");

const webhook = require("./routes/webhook");

const app = express();

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

    res.send("🚀 SAMII OS V1 fonctionne.");

});

// ======================================================
// ROUTES
// ======================================================

app.use("/webhook", webhook);
// ======================================================
// CHAT SAMII V1
// ======================================================

app.post("/api/chat", async (req, res) => {

    try {

        const message = req.body.message;

        if (!message) {

            return res.status(400).json({

                success: false,
                reply: "Message vide."

            });

        }

        const axios = require("axios");

        const response = await axios.post(

            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + CONFIG.GEMINI.API_KEY,

            {

                contents: [

                    {

                        parts: [

                            {

                                text:
`
Tu es SAMII.

Tu aides uniquement les e-commerçants.

Règles :

- Réponses courtes.
- Français.
- Professionnel.
- Poli.
- Si quelqu'un demande quand son compte sera activé :

"Votre boutique est actuellement en cours de validation.
Le délai est de 24 à 48 heures.
Merci de faire partie des 10 000 partenaires fondateurs de SAMII."

Question :

${message}
`

                            }

                        ]

                    }

                ]

            }

        );

        const reply =
            response.data.candidates[0]
            .content.parts[0]
            .text;

        res.json({

            success: true,
            reply

        });

    }

    catch (err) {

        console.log(err.message);

        res.json({

            success: true,

            reply:
"Bonjour 👋 Je suis SAMII. Je suis actuellement en maintenance. Revenez dans quelques minutes."

        });

    }

});
// ======================================================
// START
// ======================================================

app.listen(CONFIG.PORT, () => {

    console.log(`🚀 SAMII OS lancé sur ${CONFIG.PORT}`);

});
