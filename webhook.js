// ============================================
// RAPPORT.JS — Rapport analytique journalier SAMI
// Envoi automatique à 20h00 heure Algérie
// ============================================

const axios = require("axios");

const AIRTABLE_API_KEY = process.env.APIAIRTABLE;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || "app1nYEr6fReIt7SW";
const AIRTABLE_TABLE_ID = process.env.AIRTABLE_TABLE_ID || "tbl4qlJBAhve1UdPx";

const GREEN_INSTANCE = process.env.GREEN_API_INSTANCE || "7107661372";
const GREEN_TOKEN = process.env.GREEN_API_TOKEN || "0b6a7a3b8b04450480db47b8017e528a03b32366096c4598bd";
const WHATSAPP_MARCHAND = process.env.WHATSAPP_MARCHAND || "213558426208@c.us";

// ─── ENVOYER WHATSAPP ───────────────────────
async function envoyerWhatsApp(message) {
  try {
    await axios.post(
      `https://api.green-api.com/waInstance${GREEN_INSTANCE}/sendMessage/${GREEN_TOKEN}`,
      { chatId: WHATSAPP_MARCHAND, message },
      { headers: { "Content-Type": "application/json" } }
    );
    console.log("📱 Rapport WhatsApp envoyé !");
  } catch (err) {
    console.error("❌ Erreur WhatsApp rapport:", err.response?.data || err.message);
  }
}

// ─── RÉCUPÉRER COMMANDES DU JOUR ────────────
async function getCommandesDuJour() {
  try {
    const aujourdhui = new Date().toISOString().split("T")[0];
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`;
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
      params: {
        filterByFormula: `{Date} = "${aujourdhui}"`,
        maxRecords: 200
      }
    });
    return response.data.records || [];
  } catch (err) {
    console.error("❌ Erreur récupération Airtable:", err.message);
    return [];
  }
}

// ─── GÉNÉRER ET ENVOYER LE RAPPORT ──────────
async function envoyerRapportSoir() {
  console.log("📊 Génération rapport soir SAMI...");

  const commandes = await getCommandesDuJour();
  const date = new Date().toLocaleDateString("fr-DZ");

  // ── Aucune commande
  if (commandes.length === 0) {
    await envoyerWhatsApp(
      `📊 *Rapport SAMI — ${date}*\n\n` +
      `😴 Aucune commande aujourd'hui.\n\n` +
      `💡 *Conseil SAMI :* Lance une promo flash demain matin pour relancer les ventes !\n\n` +
      `🌙 Bonne nuit ! — SAMI`
    );
    return;
  }

  // ── Calculs généraux
  const nbTotal = commandes.length;
  const confirmees = commandes.filter(r => r.fields["Statut"] === "paid");
  const provisoires = commandes.filter(r => r.fields["Statut"] === "PROVISOIRE");
  const annulees = commandes.filter(r => r.fields["Statut"] === "refunded" || r.fields["Statut"] === "voided");

  const totalVentes = confirmees.reduce((sum, r) => sum + (parseFloat(r.fields["Total"]) || 0), 0);
  const totalProvisoire = provisoires.reduce((sum, r) => sum + (parseFloat(r.fields["Total"]) || 0), 0);

  // ── Panier moyen
  const panierMoyen = confirmees.length > 0 ? (totalVentes / confirmees.length).toFixed(0) : 0;

  // ── Meilleure commande
  const meilleureCommande = confirmees.length > 0
    ? confirmees.reduce((max, r) => (parseFloat(r.fields["Total"]) || 0) > (parseFloat(max.fields["Total"]) || 0) ? r : max, confirmees[0])
    : null;

  // ── Clients par catégorie
  const nbVIP = commandes.filter(r => r.fields["Catégorie"] === "VIP").length;
  const nbBasique = commandes.filter(r => r.fields["Catégorie"] === "BASIQUE").length;
  const nbBlacklist = commandes.filter(r => r.fields["Catégorie"] === "BLACKLIST").length;
  const nbNouveaux = commandes.filter(r => r.fields["Catégorie"] === "NOUVEAU").length;

  // ── Taux de conversion (confirmées / total)
  const tauxConversion = ((confirmees.length / nbTotal) * 100).toFixed(0);

  // ── Analyse : ce qui va bien / ce qui va pas
  const pointsPositifs = [];
  const pointsNegatifs = [];
  const conseils = [];

  if (confirmees.length >= 5) pointsPositifs.push("✅ Bonne journée de ventes !");
  if (nbVIP > 0) pointsPositifs.push(`✅ ${nbVIP} client(s) VIP ont commandé`);
  if (panierMoyen > 3000) pointsPositifs.push(`✅ Panier moyen élevé (${panierMoyen} DA)`);
  if (nbNouveaux > 0) pointsPositifs.push(`✅ ${nbNouveaux} nouveau(x) client(s) aujourd'hui`);

  if (nbBlacklist > 0) {
    pointsNegatifs.push(`⚠️ ${nbBlacklist} commande(s) BLACKLIST détectée(s)`);
    conseils.push("🚫 Vérifie et annule les commandes blacklist avant expédition");
  }
  if (provisoires.length > confirmees.length) {
    pointsNegatifs.push("⚠️ Plus de provisoires que de confirmées");
    conseils.push("📞 Relance les clients provisoires par WhatsApp");
  }
  if (parseInt(tauxConversion) < 50) {
    pointsNegatifs.push(`⚠️ Taux de confirmation faible (${tauxConversion}%)`);
    conseils.push("💬 Envoie un message de relance aux commandes en attente");
  }
  if (annulees.length > 0) {
    pointsNegatifs.push(`⚠️ ${annulees.length} commande(s) annulée(s)/remboursée(s)`);
  }
  if (confirmees.length === 0) {
    pointsNegatifs.push("❌ Aucune commande confirmée aujourd'hui");
    conseils.push("🔥 Lance une promo flash ou un code promo demain");
  }

  // ── Conseil général selon performance
  if (confirmees.length >= 10) {
    conseils.push("🚀 Excellente journée ! Pense à réapprovisionner le stock");
  } else if (confirmees.length >= 5) {
    conseils.push("📈 Bonne journée ! Continue avec des posts sur les réseaux");
  } else if (confirmees.length > 0) {
    conseils.push("💡 Journée moyenne — essaie une offre groupée demain");
  }

  // ── Construction du message
  const rapport =
    `📊 *Rapport SAMI — ${date}*\n` +
    `━━━━━━━━━━━━━━━━━━\n\n` +

    `📦 *COMMANDES DU JOUR*\n` +
    `Total reçues : ${nbTotal}\n` +
    `✅ Confirmées : ${confirmees.length}\n` +
    `⏳ Provisoires : ${provisoires.length}\n` +
    `❌ Annulées : ${annulees.length}\n` +
    `📊 Taux confirmation : ${tauxConversion}%\n\n` +

    `━━━━━━━━━━━━━━━━━━\n` +
    `💰 *CHIFFRE D'AFFAIRES*\n` +
    `Ventes confirmées : ${totalVentes.toLocaleString()} DA\n` +
    `En attente : ${totalProvisoire.toLocaleString()} DA\n` +
    `Panier moyen : ${panierMoyen} DA\n` +
    (meilleureCommande ? `🏆 Meilleure commande : ${parseFloat(meilleureCommande.fields["Total"]).toLocaleString()} DA\n` : "") +

    `\n━━━━━━━━━━━━━━━━━━\n` +
    `👥 *CLIENTS*\n` +
    `⭐ VIP : ${nbVIP}\n` +
    `👤 Basique : ${nbBasique}\n` +
    `🆕 Nouveaux : ${nbNouveaux}\n` +
    `🚫 Blacklist : ${nbBlacklist}\n\n` +

    (pointsPositifs.length > 0
      ? `━━━━━━━━━━━━━━━━━━\n🟢 *CE QUI VA BIEN*\n${pointsPositifs.join("\n")}\n\n`
      : "") +

    (pointsNegatifs.length > 0
      ? `━━━━━━━━━━━━━━━━━━\n🔴 *CE QUI VA PAS*\n${pointsNegatifs.join("\n")}\n\n`
      : "") +

    (conseils.length > 0
      ? `━━━━━━━━━━━━━━━━━━\n💡 *CONSEILS SAMI*\n${conseils.join("\n")}\n\n`
      : "") +

    `━━━━━━━━━━━━━━━━━━\n` +
    `🌙 Bonne nuit ! — SAMI 🇩🇿`;

  await envoyerWhatsApp(rapport);
  console.log("✅ Rapport complet envoyé !");
}

// ─── PLANIFICATEUR 20H ALGÉRIE (UTC+1) ──────
function demarrerRapportAutomatique() {
  console.log("⏰ Planificateur rapport 20h activé");

  setInterval(() => {
    const maintenant = new Date();
    const heureAlgerie = (maintenant.getUTCHours() + 1) % 24;
    const minuteAlgerie = maintenant.getUTCMinutes();

    if (heureAlgerie === 20 && minuteAlgerie === 0) {
      console.log("🕗 20h00 Algérie — Envoi rapport !");
      envoyerRapportSoir();
    }
  }, 60000); // Vérifie chaque minute
}

module.exports = { demarrerRapportAutomatique, envoyerRapportSoir };


