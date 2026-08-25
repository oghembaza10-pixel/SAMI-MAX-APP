// ==========================================================================
// SAMII OS — DB (PostgreSQL) — Connexion centrale, remplace progressivement Airtable
// ==========================================================================
const { Pool } = require("pg");

// Supabase impose TLS ; un PostgreSQL local n'en a pas et refuse la connexion
// si on l'exige. Sans cette distinction, impossible de faire tourner quoi que
// ce soit hors production — or un registre d'argent doit pouvoir être éprouvé
// sur une vraie base avant de toucher celle des clients.
const URL_DB = process.env.DATABASE_URL || "";
const EST_LOCAL = /localhost|127\.0\.0\.1|@\/|host=\//.test(URL_DB);

const pool = new Pool({
    connectionString: URL_DB,
    ssl: EST_LOCAL ? false : { rejectUnauthorized: false },
});

async function query(text, params) {
    try {
        const result = await pool.query(text, params);
        return result.rows;
    } catch (err) {
        console.error("❌ DB query :", err.message);
        throw err;
    }
}

// Exécute plusieurs requêtes dans une seule transaction. Indispensable partout
// où de l'argent bouge : bloquer un montant chez l'acheteur et le créditer au
// vendeur doivent réussir ensemble ou échouer ensemble. Sans ça, une coupure
// entre les deux écritures laisse une somme dans le vide, et aucun rapport ne
// tombe plus jamais juste.
//
//   await db.transaction(async (q) => {
//       await q(`INSERT ...`);
//       await q(`INSERT ...`);
//   });
//
// Le client est TOUJOURS rendu au pool, même en cas d'erreur : un client oublié
// finit par épuiser le pool et bloque toute l'application.
async function transaction(travail) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const q = async (text, params) => (await client.query(text, params)).rows;
        const resultat = await travail(q);
        await client.query("COMMIT");
        return resultat;
    } catch (err) {
        try { await client.query("ROLLBACK"); } catch { /* la connexion est déjà perdue */ }
        console.error("❌ DB transaction :", err.message);
        throw err;
    } finally {
        client.release();
    }
}

module.exports = { pool, query, transaction };
