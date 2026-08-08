// OG Marketplace — catalogue central
// Source of truth for Marketplace filters/import classification.
// Commerce-only: legacy Airtable data is untouched.

const MARKETPLACE_NAME = 'OG Marketplace';

const CATEGORIES = [
  { id: 'electronique-tech', label: 'High-Tech & Électronique', segment: 'tendance' },
  { id: 'telephones-accessoires', label: 'Téléphones & Accessoires', segment: 'accessible' },
  { id: 'informatique', label: 'Informatique & Bureau', segment: 'premium' },
  { id: 'audio', label: 'Audio & Casques', segment: 'tendance' },
  { id: 'mode-femme', label: 'Mode Femme', segment: 'premium' },
  { id: 'mode-homme', label: 'Mode Homme', segment: 'premium' },
  { id: 'mode-enfant', label: 'Mode Enfant & Bébé', segment: 'accessible' },
  { id: 'sneakers-chaussures', label: 'Sneakers & Chaussures', segment: 'premium' },
  { id: 'montres-accessoires', label: 'Montres & Accessoires', segment: 'tendance' },
  { id: 'beaute-parfum', label: 'Beauté & Parfum', segment: 'tendance' },
  { id: 'sport-fitness', label: 'Sport & Fitness', segment: 'tendance' },
  { id: 'velos-electriques', label: 'Vélos Électriques', segment: 'premium' },
  { id: 'trottinettes-electriques', label: 'Trottinettes Électriques', segment: 'premium' },
  { id: 'mobilite-electrique', label: 'Mobilité Électrique', segment: 'premium' },
  { id: 'auto-moto', label: 'Auto & Moto', segment: 'tendance' },
  { id: 'maison-decoration', label: 'Maison & Décoration', segment: 'accessible' },
  { id: 'smart-home', label: 'Smart Home', segment: 'tendance' },
  { id: 'meubles', label: 'Meubles & Mobilier', segment: 'premium' },
  { id: 'cuisine', label: 'Cuisine & Électroménager', segment: 'accessible' },
  { id: 'jardin-outdoor', label: 'Jardin & Outdoor', segment: 'accessible' },
  { id: 'jouets-enfants', label: 'Jouets & Enfants', segment: 'accessible' },
  { id: 'gaming', label: 'Gaming', segment: 'tendance' },
  { id: 'voyage-bagagerie', label: 'Voyage & Bagagerie', segment: 'accessible' },
  { id: 'accessoires-telephone', label: 'Accessoires Téléphone', segment: 'accessible' },
  { id: 'gadgets-tendance', label: 'Gadgets & Tendances', segment: 'tendance' },
  { id: 'lifestyle', label: 'Lifestyle', segment: 'tendance' },
  { id: 'energie-portable', label: 'Énergie & Power Stations', segment: 'premium' },
  { id: 'bureau-organisation', label: 'Bureau & Organisation', segment: 'accessible' },
  { id: 'bijoux', label: 'Bijoux & Joaillerie', segment: 'accessible' },
  { id: 'produits-viraux', label: 'Produits Viraux TikTok / Reels', segment: 'tendance' },
  { id: 'produits-accessibles', label: 'Produits Accessibles', segment: 'accessible' },
  { id: 'produits-appel', label: 'Produits d’Appel', segment: 'appel' },
  { id: 'services', label: 'Services & Prestations', segment: 'accessible' },
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
  { id: 'cj', code: 'CJ', label: 'CJ Dropshipping', region: 'chine', verified: true, status: 'active' },
  { id: 'bigbuy', code: 'BIGBUY', label: 'BigBuy', region: 'europe', verified: true, status: 'planned' },
  { id: 'local', code: 'LOCAL', label: 'Fournisseur local', region: 'local', verified: false, status: 'planned' },
];

function categoryLabel(id) {
  return CATEGORIES.find((item) => item.id === id)?.label || id || 'Autre';
}

function supplierRegionLabel(id) {
  return SUPPLIER_REGIONS.find((item) => item.id === id)?.label || id || '';
}

module.exports = {
  MARKETPLACE_NAME,
  CATEGORIES,
  SUPPLIER_REGIONS,
  PRODUCT_SEGMENTS,
  SUPPLIERS,
  categoryLabel,
  supplierRegionLabel,
};
