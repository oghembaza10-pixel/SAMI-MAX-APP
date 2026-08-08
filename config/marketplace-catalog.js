// OG Marketplace — catalogue central
// Source of truth for Marketplace filters/import classification.
// Commerce-only: legacy Airtable data is untouched.

const CATEGORIES = [
  { id: 'electronique-tech', label: 'High-Tech & Électronique' },
  { id: 'telephones-accessoires', label: 'Téléphones & Accessoires' },
  { id: 'informatique', label: 'Informatique & Bureau' },
  { id: 'audio', label: 'Audio & Casques' },
  { id: 'mode-femme', label: 'Mode Femme' },
  { id: 'mode-homme', label: 'Mode Homme' },
  { id: 'mode-enfant', label: 'Mode Enfant & Bébé' },
  { id: 'sneakers-chaussures', label: 'Sneakers & Chaussures' },
  { id: 'montres-accessoires', label: 'Montres & Accessoires' },
  { id: 'beaute-parfum', label: 'Beauté & Parfum' },
  { id: 'sport-fitness', label: 'Sport & Fitness' },
  { id: 'velos-electriques', label: 'Vélos Électriques' },
  { id: 'trottinettes-electriques', label: 'Trottinettes Électriques' },
  { id: 'mobilite-electrique', label: 'Mobilité Électrique' },
  { id: 'auto-moto', label: 'Auto & Moto' },
  { id: 'maison-decoration', label: 'Maison & Décoration' },
  { id: 'smart-home', label: 'Smart Home' },
  { id: 'meubles', label: 'Meubles & Mobilier' },
  { id: 'cuisine', label: 'Cuisine & Électroménager' },
  { id: 'jardin-outdoor', label: 'Jardin & Outdoor' },
  { id: 'jouets-enfants', label: 'Jouets & Enfants' },
  { id: 'gaming', label: 'Gaming' },
  { id: 'voyage-bagagerie', label: 'Voyage & Bagagerie' },
  { id: 'accessoires-telephone', label: 'Accessoires Téléphone' },
  { id: 'gadgets-tendance', label: 'Gadgets & Tendances' },
  { id: 'lifestyle', label: 'Lifestyle' },
  { id: 'energie-portable', label: 'Énergie & Power Stations' },
  { id: 'bureau-organisation', label: 'Bureau & Organisation' },
  { id: 'bijoux', label: 'Bijoux & Joaillerie' },
  { id: 'produits-viraux', label: 'Produits Viraux TikTok / Reels' },
  { id: 'produits-accessibles', label: 'Produits Accessibles' },
  { id: 'produits-appel', label: 'Produits d’Appel' },
  { id: 'services', label: 'Services & Prestations' },
];

const SUPPLIER_REGIONS = [
  { id: 'local', icon: 'map-pin', label: 'Fournisseurs Locaux', countries: ['DZ', 'MA', 'TN', 'SN', 'CI', 'CM'] },
  { id: 'europe', icon: 'landmark', label: 'Fournisseurs Européens', countries: ['FR', 'ES', 'IT', 'DE', 'NL', 'BE', 'PL'] },
  { id: 'chine', icon: 'factory', label: 'Fournisseurs Chinois', countries: ['CN'] },
  { id: 'turquie', icon: 'ship', label: 'Fournisseurs Turcs', countries: ['TR'] },
  { id: 'dubai', icon: 'building-2', label: 'Fournisseurs Dubaï', countries: ['AE'] },
  { id: 'international', icon: 'globe-2', label: 'Fournisseurs Internationaux', countries: [] },
];

const PRODUCT_SEGMENTS = [
  { id: 'premium', label: 'Premium' },
  { id: 'tendance', label: 'Tendance' },
  { id: 'accessible', label: 'Accessible' },
  { id: 'appel', label: 'Produit d’appel' },
];

const SUPPLIERS = [
  { id: 'cj', code: 'CJ', label: 'CJ Dropshipping', region: 'chine', verified: true },
  { id: 'bigbuy', code: 'BIGBUY', label: 'BigBuy', region: 'europe', verified: true },
  { id: 'local', code: 'LOCAL', label: 'Fournisseur local', region: 'local', verified: false },
];

function categoryLabel(id) {
  return CATEGORIES.find((item) => item.id === id)?.label || id || 'Autre';
}

function supplierRegionLabel(id) {
  return SUPPLIER_REGIONS.find((item) => item.id === id)?.label || id || '';
}

module.exports = {
  CATEGORIES,
  SUPPLIER_REGIONS,
  PRODUCT_SEGMENTS,
  SUPPLIERS,
  categoryLabel,
  supplierRegionLabel,
};
