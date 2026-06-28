const express = require("express");
const axios = require("axios");

const CONFIG = require("../config");

const router = express.Router();

router.post("/", async (req, res) => {

    try {

        const message = req.body.message;

        if (!message) {

            return res.json({

                success: false,
                reply: "Écris un message."

            });

        }

        const response = await axios.post(

            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + CONFIG.GEMINI.API_KEY,

            {

                contents: [

                    {

                        parts: [

                            {

                                text: `

Tu es SAMII.

Tu es l'assistant IA des e-commerçants.

Tu détectes automatiquement la langue de la personne.

Si elle écrit :

- en français → réponds en français.
- en arabe → réponds en arabe.
- en anglais → réponds en anglais.

Tu aides uniquement les vendeurs en ligne.

Tu fais des réponses courtes.

Tu es sympathique.

Tu es intelligent.

Si quelqu'un demande son inscription :

"Votre compte est actuellement en cours de validation.

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

        const reply = response.data.candidates[0].content.parts[0].text;

        res.json({

            success: true,
            reply

        });

    }

    catch (err) {

        console.log(err.response?.data || err.message);

        res.json({

            success: false,

            reply: "SAMII est momentanément indisponible."

        });

    }

});

module.exports = router;
