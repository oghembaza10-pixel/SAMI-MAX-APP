// OG Marketplace — catalogue central
// Source of truth for Marketplace filters/import classification.
// Commerce-only: legacy Airtable data is untouched.

const MARKETPLACE_NAME = 'OG Marketplace';

// Source de vérité réelle : table Supabase `categories_produits` (33 lignes
// actives). Cette liste doit rester identique aux slugs de cette table —
// c'est elle qui est réellement stockée dans annonces.categorie.
const CATEGORIES = [
  { id: 'electronique-tech', label: 'Électronique & Tech', segment: 'tendance' },
  { id: 'maison-decoration', label: 'Maison & Décoration', segment: 'accessible' },
  { id: 'meubles', label: 'Meubles', segment: 'premium' },
  { id: 'eclairage-smart-home', label: 'Éclairage & Smart Home', segment: 'tendance' },
  { id: 'mode-femme', label: 'Mode Femme', segment: 'premium' },
  { id: 'mode-homme', label: 'Mode Homme', segment: 'premium' },
  { id: 'bebe', label: 'Bébé', segment: 'accessible' },
  { id: 'enfants-jouets', label: 'Enfants & Jouets', segment: 'accessible' },
  { id: 'beaute-cosmetiques', label: 'Beauté & Cosmétiques', segment: 'tendance' },
  { id: 'bijoux-accessoires', label: 'Bijoux & Accessoires', segment: 'accessible' },
  { id: 'montres-wearables', label: 'Montres & Wearables', segment: 'tendance' },
  { id: 'chaussures', label: 'Chaussures', segment: 'premium' },
  { id: 'sacs-bagagerie', label: 'Sacs & Bagagerie', segment: 'premium' },
  { id: 'sport-fitness', label: 'Sport & Fitness', segment: 'tendance' },
  { id: 'velos-mobilite-electrique', label: 'Vélos & Mobilité électrique', segment: 'premium' },
  { id: 'automobile-moto', label: 'Automobile & Moto', segment: 'tendance' },
  { id: 'bricolage-outillage', label: 'Bricolage & Outillage', segment: 'accessible' },
  { id: 'jardin-exterieur', label: 'Jardin & Extérieur', segment: 'accessible' },
  { id: 'cuisine-electromenager', label: 'Cuisine & Électroménager', segment: 'accessible' },
  { id: 'maison-art-de-la-table', label: 'Maison & Art de la table', segment: 'accessible' },
  { id: 'animaux', label: 'Animaux', segment: 'accessible' },
  { id: 'gaming', label: 'Gaming', segment: 'tendance' },
  { id: 'informatique-bureau', label: 'Informatique & Bureau', segment: 'premium' },
  { id: 'photo-video', label: 'Photo & Vidéo', segment: 'premium' },
  { id: 'audio', label: 'Audio', segment: 'tendance' },
  { id: 'telephones-accessoires', label: 'Téléphones & Accessoires', segment: 'accessible' },
  { id: 'energie-batteries', label: 'Énergie & Batteries', segment: 'premium' },
  { id: 'voyage-loisirs', label: 'Voyage & Loisirs', segment: 'accessible' },
  { id: 'arts-creativite', label: 'Arts & Créativité', segment: 'accessible' },
  { id: 'livres-education', label: 'Livres & Éducation', segment: 'accessible' },
  { id: 'entretien-organisation', label: 'Entretien & Organisation', segment: 'accessible' },
  { id: 'securite-surveillance', label: 'Sécurité & Surveillance', segment: 'tendance' },
  { id: 'tendances-nouveautes', label: 'Tendances & Nouveautés', segment: 'tendance' },
];

// Raccourcis "Services" — volontairement séparés des 33 catégories produits
// ci-dessus (annonces.categorie = 'service', le libellé précis reste dans le titre).
const SERVICES_RAPIDES = [
  { id: 'nounou',       emoji: '👶', label: 'Nounou' },
  { id: 'plat-semaine', emoji: '🍲', label: 'Plat de la semaine' },
  { id: 'chambre',      emoji: '🛏️', label: 'Louer une chambre' },
  { id: 'autre',        emoji: '🧰', label: 'Autre service' },
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
  SERVICES_RAPIDES,
  SUPPLIER_REGIONS,
  PRODUCT_SEGMENTS,
  SUPPLIERS,
  categoryLabel,
  supplierRegionLabel,
};
