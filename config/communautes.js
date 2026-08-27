// ==========================================================================
// SAMII OS — LES COMMUNAUTÉS PARTENAIRES
//
// POURQUOI CE FICHIER EXISTE. Une créatrice arrive avec 8,5 millions de vues
// mensuelles et veut amener son monde chez nous — mais chez ELLE, sous son
// nom, sans traverser notre marque. C'est une demande légitime et c'est ce
// qui décide un partenariat.
//
// LA TENTATION À NE PAS SUIVRE. Copier la communauté, en faire une version
// « Coin Du Digital », et avoir deux codes à maintenir. À la troisième
// partenaire, plus personne ne s'en sort : chaque correction est à faire
// trois fois, et les trois divergent.
//
// CE QU'ON FAIT À LA PLACE. Un seul code, plusieurs marques. Le nom, le
// sigle, les couleurs, la phrase d'accueil : ce sont des DONNÉES, pas du
// code. Ajouter une partenaire, c'est ajouter une entrée ici — pas un
// fichier, pas une route, pas un gabarit.
//
// SAMII est la première entrée de ce registre, pas un cas particulier.
// Le jour où on voudra changer la communauté principale, on éditera une
// ligne comme pour les autres.
//
// L'ADRESSE. `/c/<slug>` — court, partageable, ça tient dans une story.
// La communauté maison reste sur `/community`, inchangée pour ceux qui
// l'ont en favori.
// ==========================================================================

const COMMUNAUTES = {
    // ── La maison ────────────────────────────────────────────────────────
    samii: {
        slug: "samii",
        nom: "Communauté SAMII",
        titre: "Community — SAMII OS",
        sigle: "OG",
        marque: "SAMII",
        marqueSuite: "TECHNOLOGY",
        // Ce qui s'affiche quand le fil est vide. Un « soyez le premier »
        // décourage ; un « voici ce qu'on met ici » explique.
        vide: "Sois le premier à partager avec la communauté.",
        moteur: "SAMII ENGINE ACTIVE",
        moteurTexte: "Communauté synchronisée avec l'écosystème SAMII.",
        libelleMembres: "Membres",
        // Le nom de l'assistant. Chez nous c'est SAMII ; chez une partenaire
        // qui veut sa marque partout, c'est le sien. Le moteur derrière est
        // le même — c'est le nom affiché qui change, et c'est un choix qui
        // se discute avec elle, pas une décision technique.
        assistant: "SAMII",
        // La maison affiche ses autres modules ; une communauté partenaire
        // n'a aucune raison d'envoyer ses visiteurs ailleurs.
        ecosysteme: true,
        couleurs: null,          // null = la feuille de style d'origine
        hote: null,
        // L'application installable. SAMII garde son manifeste historique
        // à la racine — des gens l'ont déjà sur leur écran d'accueil, et
        // changer son identité déplacerait leur icône.
        app: null,
    },

    // ── Le Coin Du Digital — Ines Audrey, Douala ─────────────────────────
    // Nom, sous-titre et positionnement repris mot pour mot de sa fiche
    // professionnelle : « Ressources numériques • Outils IA • Astuces Tech •
    // Formations • Opportunités digitales ». On n'invente pas sa marque à sa
    // place, on la reprend.
    coindudigital: {
        slug: "coindudigital",
        nom: "Le Coin Du Digital",
        titre: "Le Coin Du Digital — la communauté",
        sigle: "CD",
        marque: "LE COIN",
        marqueSuite: "DU DIGITAL",
        vide: "Ici on partage ce qu'on trouve : un outil, une astuce, une opportunité. Poste le tien.",
        moteur: "COMMUNAUTÉ EN LIGNE",
        moteurTexte: "Ressources numériques · Outils IA · Astuces Tech · Formations · Opportunités.",
        libelleMembres: "Membres",
        // À trancher avec elle : « SAMII » met en avant le moteur, « L'assistant »
        // efface toute trace de notre marque. Une seule ligne à changer.
        assistant: "L'assistant",
        ecosysteme: false,
        // ── Le partage ───────────────────────────────────────────────────
        // Sur une vente faite chez elle, la plateforme prend `taux`, et cette
        // commission se partage : `partPartenaire` pour elle, le reste pour
        // la maison. 40 % pour elle, 60 % pour nous — c'est ce qui a été dit.
        //
        // ⚠️ `taux` EST UN PLACEHOLDER. Le pourcentage prélevé sur une vente
        // n'a jamais été tranché avec elle. 10 % est une valeur d'attente
        // pour que le calcul existe, PAS un accord. À confirmer avec elle
        // avant la première vraie vente — après, y toucher se négocie.
        commission: { taux: 0.10, partPartenaire: 0.40 },
        // Ce à quoi ses membres ont droit dans leur QG. Liste blanche : tout
        // ce qui n'est pas nommé ici n'existe pas pour eux. Un module ajouté
        // demain au QG de la maison n'apparaîtra pas chez elle tant que
        // personne ne l'aura décidé — l'oubli va dans le sens sûr.
        qg: { modules: require("./modules-qg").MINIMAL },
        // Bleu pétrole et or : les couleurs de son logo, plus l'or pour ce
        // qui se paie. Reprises telles quelles depuis sa vitrine.
        couleurs: {
            "--bg": "#081820",
            "--panel": "rgba(14,37,48,.92)",
            "--text": "#F1ECE0",
            "--muted": "#9FB4BD",
            "--blue": "#D9B24C",
            "--blue-2": "#12708C",
            "--gold": "#D9B24C",
            "--border": "rgba(217,178,76,.2)",
        },
        hote: null,
        // SON application, installée depuis un lien — pas depuis un magasin.
        // Au Cameroun c'est le bon format : rien à télécharger de lourd, pas
        // de compte Play Store, pas de validation à attendre. Elle envoie un
        // lien, ses gens appuient sur « Installer », et son icône est sur
        // leur écran d'accueil à côté de WhatsApp.
        app: {
            nom: "Le Coin Du Digital",
            nomCourt: "Coin Digital",
            description: "Ressources numériques, outils IA, astuces tech, formations et opportunités digitales.",
            fond: "#081820",
            theme: "#081820",
            icone: "coindudigital",
        },
    },
};

const DEFAUT = "samii";

// Un slug d'URL n'est jamais digne de confiance : il arrive du dehors et
// sert à choisir un objet. On ne renvoie que ce qui est déclaré ici.
function get(slug) {
    const propre = String(slug || "").toLowerCase().replace(/[^a-z0-9-]/g, "");
    return COMMUNAUTES[propre] || COMMUNAUTES[DEFAUT];
}

function existe(slug) {
    const propre = String(slug || "").toLowerCase().replace(/[^a-z0-9-]/g, "");
    return Object.prototype.hasOwnProperty.call(COMMUNAUTES, propre);
}

// Les variables CSS à injecter, ou une chaîne vide pour la communauté
// maison — qui garde la feuille d'origine sans qu'on ait à la recopier.
function styleDe(communaute) {
    if (!communaute?.couleurs) return "";
    return Object.entries(communaute.couleurs).map(([k, v]) => `${k}:${v};`).join("");
}

function liste() {
    return Object.values(COMMUNAUTES);
}

module.exports = { COMMUNAUTES, DEFAUT, get, existe, styleDe, liste };
