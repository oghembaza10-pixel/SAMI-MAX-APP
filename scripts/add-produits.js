const db = require("../services/db");

async function run() {
    try {
        await db.query(
            `INSERT INTO produits (workspace_id, nom, description, prix, stock, actif) VALUES
            ($1, $2, $3, $4, $5, $6),
            ($1, $7, $8, $9, $10, $6),
            ($1, $11, $12, $13, $14, $6)`,
            [
                "WS-49f73e7f-bcc9-4f6f-9bd3-7f8cb9634bbe",
                "T-shirt OG Technology Noir", "T-shirt premium coton, coupe moderne, logo brodé", 2500, 50, true,
                "Casquette OG Technology", "Casquette ajustable, broderie or", 1800, 30,
                "Sweat à capuche OG", "Sweat épais, doublure polaire, logo dos", 4500, 20,
            ]
        );
        console.log("✅ 3 produits créés sur le vrai workspace");
    } catch (err) {
        console.error("❌", err.message);
    }
    process.exit(0);
}

run();
