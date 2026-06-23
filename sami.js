const axios = require('axios');
const Protocoles = require('./lois'); // Importation des 33 lois

const pageDAccueil = () => {
    return { status: "online", brand: "The Sovereign", constitution: "33 Protocoles Actifs" };
};

const gemini = async (prompt, protocoleId) => {
    // Sami consulte la loi avant de penser
    const loiAppliquee = Protocoles[protocoleId] || "Loi Universelle";
    console.log(Action sous le protocole: ${protocoleId} - ${loiAppliquee});

    try {
        const response = await axios.post(
            https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY},
            { contents: [{ parts: [{ text: En respectant le protocole ${loiAppliquee}: ${prompt} }] }] }
        );
        let texte = response.data.candidates[0].content.parts[0].text;
        return texte.replace(/```json|```/g, '').trim();
    } catch (err) {
        return '{"error": "Échec protocole"}';
    }
};

const traiterSAV = async (body) => {
    // Le SAV est traité selon la Loi 21 (Forteresse) et 32 (Sceau)
    const analyse = await gemini("Analyse sentiment: " + body.message, 21);
    return JSON.parse(analyse);
};

module.exports = {
    pageDAccueil,
    traiterSAV,
    traiterCommande: async (data) => ({ status: "Traitée via Loi 32" })
};
