const { listProducts } = require('../services/providers/cj');
const db = require('../services/db');

const MARGIN_PERCENT = Number(process.env.CJ_MARGIN_PERCENT || 20);
const MARGIN_FIXED_EUR = Number(process.env.CJ_MARGIN_FIXED_EUR || 1);

function priceFor(product) {
  const cost = Number(product.sellPrice || product.price || 0);
  return Number((cost * (1 + MARGIN_PERCENT / 100) + MARGIN_FIXED_EUR).toFixed(2));
}

function normalize(product) {
  const externalId = product.pid || product.productId || product.id;
  const name = product.productNameEn || product.productName || product.name || `Produit CJ ${externalId}`;
  const category = product.categoryName || 'Autres';
  const cost = Number(product.sellPrice || product.price || 0);
  return {
    externalId: String(externalId),
    title: name,
    category,
    cost,
    price: priceFor(product),
    sku: product.productSku || product.sku || null,
    stock: Number(product.stock || 0),
    sourceUrl: product.productUrl || null,
    metadata: product,
  };
}

async function main() {
  const result = await listProducts({ page: 1, size: 5 });
  const list = result?.data?.content || result?.data?.list || result?.data || [];
  if (!Array.isArray(list) || !list.length) throw new Error('CJ n’a retourné aucun produit');

  console.log(`CJ: ${Math.min(list.length, 5)} produits reçus`);
  console.log(`Marge: ${MARGIN_PERCENT}% + ${MARGIN_FIXED_EUR} EUR`);

  for (const raw of list.slice(0, 5)) {
    const p = normalize(raw);
    console.log(JSON.stringify(p, null, 2));

    // DB adapter compatibility: only write when the existing db service exposes a compatible method.
    if (typeof db.createAnnonce === 'function') {
      await db.createAnnonce({
        titre: p.title,
        description: `Produit importé depuis CJ. Catégorie: ${p.category}`,
        prix: p.price,
        prix_fournisseur: p.cost,
        provider_code: 'CJ',
        provider_product_id: p.externalId,
        sku: p.sku,
        stock: p.stock,
        source_url: p.sourceUrl,
        metadata: p.metadata,
      });
    }
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exitCode = 1;
});
