const express = require("express");
const router = express.Router();
const db = require("../services/db");
const cj = require("../services/cj-service");

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.status(401).json({ success: false, error: "Non connecté" });
    next();
}

// Catalogue cible actuellement présent dans le Marketplace.
// On ne modifie pas la taxonomie existante ici.
const RULES = [
    { q: "electric bike", cat: "sport" },
    { q: "electric scooter", cat: "sport" },
    { q: "tiktok viral", cat: "autre" },
    { q: "summer clothes", cat: "mode" },
    { q: "tracksuit", cat: "mode" },
    { q: "perfume", cat: "beaute" },
    { q: "phone smartphone", cat: "electronique" },
    { q: "laptop computer", cat: "electronique" },
    { q: "smart watch", cat: "electronique" },
    { q: "home kitchen", cat: "cuisine" },
    { q: "beauty skincare", cat: "beaute_premium" },
    { q: "luxury accessories", cat: "luxe" },
];

function rowsFrom(result) {
    const rows = result?.data?.list || result?.data?.content || result?.data || [];
    return Array.isArray(rows) ? rows : [];
}

function pickPid(row) {
    return row?.cj_pid || row?.pid || row?.productId || row?.id || null;
}

function categoryFor(query) {
    return RULES.find(r => r.q === query)?.cat || "autre";
}

function text(value, fallback = "") {
    if (value === undefined || value === null) return fallback;
    return String(value).trim();
}

async function saveProduct(product, category) {
    const pid = text(product.cj_pid);
    if (!pid) return { inserted: false, reason: "pid_missing" };

    const title = text(product.title || product.cj_name, "Produit CJ");
    const price = product.price ?? product.cost_price ?? "";
    const images = Array.isArray(product.images) ? product.images.filter(Boolean) : [];
    const descriptionParts = [
        text(product.description),
        product.sales != null ? `Ventes CJ: ${product.sales}` : "",
        product.rating != null ? `Note: ${product.rating}` : "",
        product.review_count != null ? `Avis: ${product.review_count}` : "",
        product.weight != null ? `Poids: ${product.weight}` : "",
        product.videos?.length ? `Vidéos: ${product.videos.join(" | ")}` : "",
    ].filter(Boolean);

    const existing = await db.query(
        `SELECT id FROM annonces WHERE vendeur_id=$1 AND titre=$2 LIMIT 1`,
        ["cj_dropshipping", title]
    );
    if (existing.length) return { inserted: false, reason: "already_exists", id: existing[0].id };

    const rows = await db.query(
        `INSERT INTO annonces
        (titre,categorie,prix,pays,ville,description,photo_url,photos_urls,region_fournisseur,vendeur_id,vendeur_nom,type_vendeur,actif)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,true)
        RETURNING id`,
        [
            title,
            category,
            text(price, "Sur devis"),
            "Chine",
            "CJ Dropshipping",
            descriptionParts.join("\n\n"),
            images[0] || "",
            images.length ? JSON.stringify(images) : null,
            "chine",
            "cj_dropshipping",
            "CJ Dropshipping",
            "fournisseur",
        ]
    );

    return { inserted: true, id: rows[0]?.id || null };
}

// Aperçu réel CJ sans écrire en base.
router.get("/preview", requireAuth, async (req, res) => {
    try {
        const query = req.query.q || RULES[0].q;
        const size = Math.min(Math.max(parseInt(req.query.size, 10) || 10, 1), 30);
        const result = await cj.listProducts({ page: 1, size, keyword: query });
        const rows = rowsFrom(result);
        const products = [];
        for (const row of rows) {
            const pid = pickPid(row);
            if (!pid) continue;
            try { products.push(await cj.getFullProduct(pid)); }
            catch { products.push(cj.normalizeProduct(row)); }
        }
        res.json({ success: true, query, category: categoryFor(query), total: products.length, products });
    } catch (err) {
        console.error("❌ CJ preview:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Import production: récupère, enrichit et écrit dans annonces.
router.post("/import", requireAuth, async (req, res) => {
    const size = Math.min(Math.max(parseInt(req.body?.size, 10) || 10, 1), 30);
    const selected = Array.isArray(req.body?.queries) && req.body.queries.length
        ? RULES.filter(r => req.body.queries.includes(r.q))
        : RULES;

    const report = { success: true, requested: selected.length, fetched: 0, inserted: 0, skipped: 0, errors: [], categories: {} };

    for (const rule of selected) {
        try {
            const result = await cj.listProducts({ page: 1, size, keyword: rule.q });
            const rows = rowsFrom(result);
            report.fetched += rows.length;
            report.categories[rule.cat] = (report.categories[rule.cat] || 0) + rows.length;

            for (const row of rows) {
                const pid = pickPid(row);
                if (!pid) { report.skipped++; continue; }
                try {
                    const product = await cj.getFullProduct(pid);
                    const saved = await saveProduct(product, rule.cat);
                    if (saved.inserted) report.inserted++; else report.skipped++;
                } catch (err) {
                    report.errors.push({ pid: String(pid), query: rule.q, error: err.message });
                }
            }
        } catch (err) {
            report.errors.push({ query: rule.q, error: err.message });
        }
    }

    res.json(report);
});

router.get("/rules", requireAuth, (req, res) => res.json({ success: true, rules: RULES }));

module.exports = router;
