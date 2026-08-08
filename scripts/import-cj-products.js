const { listProducts } = require('../services/providers/cj');
const db = require('../services/db');

const IMPORT_LIMIT = Number(process.env.CJ_IMPORT_LIMIT || 50);
const MARGIN_PERCENT = Number(process.env.CJ_MARGIN_PERCENT || 20);
const MARGIN_FIXED_EUR = Number(process.env.CJ_MARGIN_FIXED_EUR || 1);

function priceFor(product) {
  const cost = Number(product.sellPrice || product.price || 0);
  return Number((cost * (1 + MARGIN_PERCENT / 100) + MARGIN_FIXED_EUR).toFixed(2));
}

function marketplaceCategory(name = '') {
  const n = name.toLowerCase();
  if (/(earring|jewelry|jewellery|watch|ring|necklace|bracelet)/.test(n)) return 'bijoux-accessoires';
  if (/(clothing|apparel|dress|shirt|shoe|fashion)/.test(n)) return 'mode';
  if (/(beauty|cosmetic|skin|makeup|perfume)/.test(n)) return 'beaute-cosmetiques';
  if (/(sport|fitness|outdoor)/.test(n)) return 'sport-fitness';
  if (/(bike|bicycle|electric vehicle|scooter|mobility)/.test(n)) return 'velos-mobilite-electrique';
  if (/(home|appliance|electronic|phone|computer|smart)/.test(n)) return 'electronique-tech';
  if (/(kitchen|furniture|home decor|house)/.test(n)) return 'maison-decoration';
  if (/(gaming|console)/.test(n)) return 'gaming';
  if (/(audio|headphone|speaker)/.test(n)) return 'audio';
  return 'tendances-nouveautes';
}

function imageList(product) {
  const raw = product.productImage;
  if (!raw) return [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
  } catch {}
  return [String(raw)];
}

function normalize(product) {
  const externalId = product.pid || product.productId || product.id;
  const name = product.productNameEn || product.productName || product.name || `Produit CJ ${externalId}`;
  const sourceCategory = product.categoryName || 'Autres';
  const cost = Number(product.sellPrice || product.price || 0);
  const photos = imageList(product);
  return {
    externalId: String(externalId),
    title: name,
    category: marketplaceCategory(sourceCategory),
    sourceCategory,
    cost,
    price: priceFor(product),
    sku: product.productSku || product.sku || null,
    stock: Number.isFinite(Number(product.stock)) && Number(product.stock) > 0 ? Number(product.stock) : null,
    photos,
    metadata: product,
  };
}

async function main() {
  const result = await listProducts({ page: 1, size: IMPORT_LIMIT });
  const list = result?.data?.content || result?.data?.list || result?.data || [];
  if (!Array.isArray(list) || !list.length) throw new Error('CJ n’a retourné aucun produit');

  const selected = list.filter(p => Number(p.sellPrice || p.price || 0) > 0).slice(0, IMPORT_LIMIT);
  console.log(`CJ: ${selected.length} produits sélectionnés`);
  console.log(`Marge: ${MARGIN_PERCENT}% + ${MARGIN_FIXED_EUR} EUR`);

  for (const raw of selected) {
    const p = normalize(raw);
    const photosJson = JSON.stringify(p.photos);

    const rows = await db.query(`
      INSERT INTO annonces
        (titre, categorie, description, prix, photo_url, photos_urls, caracteristiques,
         type_vendeur, vendeur_id, vendeur_nom, pays, actif, created_at,
         provider_code, provider_product_id, source_url, region_fournisseur,
         prix_fournisseur, devise, stock, sku, synced_at, metadata)
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,NOW(),$12,$13,$14,$15,$16,$17,$18,$19,NOW(),$20::jsonb)
      ON CONFLICT (provider_code, provider_product_id)
      WHERE provider_code IS NOT NULL AND provider_product_id IS NOT NULL
      DO UPDATE SET
        titre=EXCLUDED.titre,
        categorie=EXCLUDED.categorie,
        prix=EXCLUDED.prix,
        photo_url=EXCLUDED.photo_url,
        photos_urls=EXCLUDED.photos_urls,
        prix_fournisseur=EXCLUDED.prix_fournisseur,
        devise=EXCLUDED.devise,
        stock=EXCLUDED.stock,
        sku=EXCLUDED.sku,
        metadata=EXCLUDED.metadata,
        synced_at=NOW()
      RETURNING id,titre,prix,provider_product_id
    `, [
      p.title, p.category, `Produit importé depuis CJ — catégorie fournisseur: ${p.sourceCategory}`,
      `${p.price} EUR`, p.photos[0] || null, photosJson,
      JSON.stringify({ source: 'CJ', category: p.sourceCategory, sku: p.sku }),
      'fournisseur', 'cj', 'CJ Dropshipping', 'Chine', 'CJ', p.externalId,
      null, 'chine', p.cost, 'EUR', p.stock, p.sku, JSON.stringify(p.metadata),
    ]);

    console.log(JSON.stringify({ ok: true, imported: rows[0] }));
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exitCode = 1;
});
