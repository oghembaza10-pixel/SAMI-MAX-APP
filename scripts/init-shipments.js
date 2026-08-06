const db = require("../services/db");
async function run() {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS shipments (
                id SERIAL PRIMARY KEY,
                order_id TEXT,
                tracking_number TEXT UNIQUE,
                provider TEXT,
                status TEXT,
                destination TEXT DEFAULT 'DZ',
                customer_name TEXT,
                workspace_id TEXT REFERENCES workspaces(id),
                last_updated TIMESTAMP DEFAULT NOW(),
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log("✅ Table shipments créée (remplace le pont Airtable).");
    } catch (err) {
        console.error("❌", err.message);
    }
    process.exit(0);
}
run();
