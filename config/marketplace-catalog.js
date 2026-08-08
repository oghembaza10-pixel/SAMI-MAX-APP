// OG Marketplace — catalogue central
// Source of truth for Marketplace filters/import classification.
// Keep this file commerce-only; it does not alter legacy Airtable data.

const CATEGORIES = [
  { id: 'electronique-tech', label: 'High-Tech & Électronique' },
  { id: 'telephones-accessoires', label: 'Téléphones & Accessoires' },
  { id: 'informatique', label: 'Informatique & Bureau' },
  { id: 'audio',