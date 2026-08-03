const db = require("../services/db");

async function run() {
    try {
        await db.query(
            `INSERT INTO workspaces (id, nom, owner_email, metier, pays, devise)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (id) DO NOTHING`,
            ["WS-49f73e7f-bcc9-4f6f-9bd3-7f8cb9634bbe", "Ma Boutique OG", "oghembaza10@gmail.com", "ecommerce", "DZ", "DZD"]
        );
        console.log("✅ Workspace réel créé dans PostgreSQL");
    } catch (err) {
        console.error("❌", err.message);
    }
    process.exit(0);
}

run();
