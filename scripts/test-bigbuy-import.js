// Vérifie que BIGBUY_API_KEY fonctionne vraiment avant de lancer un import complet.
// Usage : node scripts/test-bigbuy-import.js
const { listProducts, extractProductRows } = require('../services/providers/bigbuy');

async function main() {
    const result = await listProducts({ page: 1, pageSize: 5 });
    const list = extractProductRows(result);
    console.log(JSON.stringify({ ok: true, count: list.length, sample: list.slice(0, 5) }, null, 2));
}

main().catch((error) => {
    console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
    process.exitCode = 1;
});
