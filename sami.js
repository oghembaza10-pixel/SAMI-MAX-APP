// ============================================
// SAMI.JS — Le Cerveau de SAMI
// Classification : VIP / Basique / Blacklist
// ============================================

const axios = require("axios");

const AIRTABLE_API_KEY = process.env.APIAIRTABLE;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || "app1nYEr6fReIt7SW";
const AIRTABLE_TABLE_ID = process.env.AIRTABLE_TABLE_ID || "tbl4qlJBAhve1UdPx";

// ─── 1. CHERCHER CLIENT DANS AIRTABLE ───────
async function chercherClient(telephone) {
  try {
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`;
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
      params: {
        filterByFormula: `{Téléphone} = "${telephone}"`,
        sort: [{ field: "Date", direction: "desc" }]
      }
    });
    return response.data.records || [];
  } catch (err) {
    console.error("❌ Erreur recherche Airtable:", err.response?.data || err.message);
    return [];
  }
}

// ─── 2. CLASSIFIER LE CLIENT ────────────────
async function classifierClient(telephone, totalCommande) {
  const historique = await chercherClient(telephone);

  // Blacklist ?
  const estBlacklist = historique.some(r => r.fields["Catégorie"] === "BLACKLIST");
  if (estBlacklist) {
    console.log("🚫 Client BLACKLIST détecté :", telephone);
    return { categorie: "BLACKLIST", nbCommandes: historique.length, historique };
  }

  // Compter commandes passées
  const nbCommandes = historique.length;
  const totalDepense = historique.reduce((sum, r) => sum + (r.fields["Total"] || 0), 0) + totalCommande;

  // VIP : 3+ commandes OU total > 10000 DA
  if (nbCommandes >= 2 || totalDepense >= 10000) {
    console.log("⭐ Client VIP :", telephone, `(${nbCommandes + 1} commandes, ${totalDepense} DA)`);
    return { categorie: "VIP", nbCommandes: nbCommandes + 1, totalDepense, historique };
  }

  // Basique : nouveau client
  console.log("👤 Client BASIQUE :", telephone);
  return { categorie: "BASIQUE", nbCommandes: nbCommandes + 1, totalDepense, historique };
}

// ─── 3. DÉTECTER ANOMALIES ──────────────────
function detecterAnomalies(commande) {
  const alertes = [];

  // Numéro manquant
  const tel = commande.shipping_address?.phone || commande.customer?.phone || "";
  if (!tel) alertes.push("⚠️ Numéro de téléphone manquant");

  // Adresse manquante
  if (!commande.shipping_address?.address1) alertes.push("⚠️ Adresse de livraison manquante");

  // Montant suspect (0 DA)
  if (!commande.total_price || parseFloat(commande.total_price) === 0) alertes.push("⚠️ Montant à 0");

  // Email générique
  if (commande.email && commande.email.includes("example.com")) alertes.push("⚠️ Email suspect");

  return alertes;
}

// ─── 4. FORMATER NUMÉRO ALGÉRIEN ────────────
function formaterTelephone(tel) {
  if (!tel) return null;
  let numero = tel.replace(/\D/g, "");
  if (numero.startsWith("0")) numero = "213" + numero.slice(1);
  if (!numero.startsWith("213")) numero = "213" + numero;
  return numero + "@c.us";
}

// ─── 5. ANALYSER COMMANDE (fonction principale) ─
async function analyserCommande(commande) {
  console.log("🧠 SAMI analyse commande:", commande.id);

  const telephone = commande.shipping_address?.phone
    || commande.billing_address?.phone
    || commande.customer?.phone
    || "";

  const prenom = commande.shipping_address?.first_name
    || commande.customer?.first_name
    || "Client";

  const total = parseFloat(commande.total_price) || 0;
  const anomalies = detecterAnomalies(commande);
  const classification = await classifierClient(telephone, total);

  const resultat = {
    id: commande.id,
    prenom,
    telephone,
    telephoneFormate: formaterTelephone(telephone),
    total,
    categorie: classification.categorie,
    nbCommandes: classification.nbCommandes,
    anomalies,
    aDesAnomalies: anomalies.length > 0,
    estBlacklist: classification.categorie === "BLACKLIST",
    estVIP: classification.categorie === "VIP"
  };

  console.log("✅ Analyse terminée:", resultat.categorie, "| Anomalies:", anomalies.length);
  return resultat;
}

// ─── 6. MESSAGE SELON CATÉGORIE ─────────────
function messageClient(analyse, commande) {
  if (analyse.estBlacklist) return null; // Pas de message pour blacklist

  if (analyse.estVIP) {
    return `🌟 Salam ${analyse.prenom} !\n\nEn tant que client VIP, votre commande #${commande.id} est notre priorité absolue ✨\n\nNous vous remercions pour votre fidélité 💎\n\nVotre commande sera traitée en priorité 🚀\n\n— Équipe SAMI`;
  }

  return `Salam ${analyse.prenom} ! 🌟\n\nVotre commande #${commande.id} a bien été reçue et confirmée ✅\n\nMerci pour votre confiance ! 🙏\n\nNous vous tiendrons informé de l'avancement 📦\n\n— Équipe SAMI`;
}

// ─── 7. MESSAGE MARCHAND ────────────────────
function messageMarchand(analyse, commande) {
  const emoji = analyse.estBlacklist ? "🚫" : analyse.estVIP ? "⭐" : "🛒";
  const alertesTexte = analyse.anomalies.length > 0
    ? `\n\n⚠️ ALERTES:\n${analyse.anomalies.join("\n")}`
    : "";

  return `${emoji} *Commande #${commande.id}*\n\n` +
    `👤 ${analyse.prenom}\n` +
    `📞 ${analyse.telephone || "Non renseigné"}\n` +
    `💰 ${commande.total_price} ${commande.currency}\n` +
    `🏷️ Statut client: ${analyse.categorie}\n` +
    `📊 Nb commandes: ${analyse.nbCommandes}` +
    alertesTexte;
}

module.exports = {
  analyserCommande,
  classifierClient,
  detecterAnomalies,
  formaterTelephone,
  messageClient,
  messageMarchand
};

