// ==========================================================================
// SAMII OS — DB (PostgreSQL) — Connexion centrale, remplace progressivement Airtable
// ==========================================================================
const { Pool } = require("pg");

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
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

module.exports = { pool, query };
