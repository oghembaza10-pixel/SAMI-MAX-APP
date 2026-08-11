const db = require("../services/db");

async function run() {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS admin_comptes (
                id SERIAL PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        console.log("✅ Admin : table admin_comptes créée.");
    } catch (err) {
        console.error("❌", err.message);
    }
    process.exit(0);
}

run();
