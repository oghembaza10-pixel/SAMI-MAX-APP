// Vérifie une par une toutes les clés Gemini détectées (GEMINI_API_KEY +
// GEMINI_API_KEY_2..._20) — chaque clé a son propre quota gratuit, donc les
// tester une par une ne consomme quasiment rien sur aucune d'elles.
// Usage : node scripts/test-gemini.js
const axios = require("axios");
const CONFIG = require("../config");

const MODEL = "gemini-2.5-flash";

async function testKey(key, index) {
    const label = `Clé #${index + 1} (…${key.slice(-4)})`;
    try {
        await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
            { contents: [{ role: "user", parts: [{ text: "Réponds juste \"ok\"." }] }] }
        );
        console.log(`✅ ${label} — valide`);
        return true;
    } catch (err) {
        const code = err.response?.data?.error?.code;
        const msg  = err.response?.data?.error?.message || err.message;
        console.log(`❌ ${label} — échec (${code || "?"}) : ${msg}`);
        return false;
    }
}

async function main() {
    const keys = CONFIG.GEMINI.API_KEYS;
    console.log(`── ${keys.length} clé(s) Gemini détectée(s) sur Render ──\n`);
    if (keys.length === 0) {
        throw new Error("Aucune clé Gemini détectée (GEMINI_API_KEY manquante).");
    }

    let valides = 0;
    for (let i = 0; i < keys.length; i++) {
        const ok = await testKey(keys[i], i);
        if (ok) valides++;
    }

    console.log(`\n──────────────────────────────`);
    console.log(`${valides}/${keys.length} clé(s) valide(s).`);
}

main().catch((error) => {
    console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
    process.exitCode = 1;
});
