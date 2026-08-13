// ======================================================
// SAMII OS — MEMORY (état conversation par contact)
// ======================================================
// Persistée en Postgres (table memoire_sessions) — avant cette version,
// c'était un simple objet JS en RAM : tout était perdu à chaque redémarrage
// du serveur (déploiement, crash...), et un même client repartait de zéro
// selon le processus qui traitait sa requête. Ici, un client garde son
// historique tant qu'on ne l'efface pas explicitement (clear), peu importe
// les redémarrages.
const db = require("../services/db");

// Cache en mémoire (par processus) pour éviter une lecture DB à chaque
// message d'une même conversation qui s'enchaîne rapidement — la DB reste
// la source de vérité, ce cache n'est qu'une accélération locale.
const cache = new Map();

async function get(key) {
    if (cache.has(key)) return cache.get(key);

    try {
        const rows = await db.query(
            `SELECT lang, history FROM memoire_sessions WHERE session_key = $1`,
            [key]
        );
        if (!rows[0]) return null;

        const history = typeof rows[0].history === "string"
            ? JSON.parse(rows[0].history)
            : (rows[0].history || []);

        const data = { lang: rows[0].lang || undefined, history };
        cache.set(key, data);
        return data;
    } catch (err) {
        console.error("❌ memory.get :", err.message);
        return null;
    }
}

async function set(key, data) {
    const existing = cache.get(key) || (await get(key)) || {};
    const merged = { ...existing, ...data };
    cache.set(key, merged);

    try {
        await db.query(
            `
            INSERT INTO memoire_sessions (session_key, lang, history, updated_at)
            VALUES ($1, $2, $3, now())
            ON CONFLICT (session_key)
            DO UPDATE SET lang = $2, history = $3, updated_at = now()
            `,
            [key, merged.lang || null, JSON.stringify(merged.history || [])]
        );
    } catch (err) {
        console.error("❌ memory.set :", err.message);
    }
}

async function clear(key) {
    cache.delete(key);
    try {
        await db.query(`DELETE FROM memoire_sessions WHERE session_key = $1`, [key]);
    } catch (err) {
        console.error("❌ memory.clear :", err.message);
    }
}

module.exports = { get, set, clear };
