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
        // Blanc, blanc cassé, noir — c'est ce qu'elle a demandé.
        //
        // Le fond de page est légèrement cassé (#F7F6F3) et les panneaux sont
        // en blanc pur : sur un écran, deux blancs identiques effacent les
        // contours et la page devient une seule masse plate. C'est la nuance
        // entre les deux qui dessine les cartes.
        //
        // Le noir sert d'accent — boutons, éléments actifs. L'or est conservé
        // pour une seule chose : les prix. Un ton chaud au milieu du noir et
        // blanc fait ressortir ce qui se paie, et il est assombri (#8A6A18)
        // parce que son or d'origine, posé sur du blanc, ne se lisait plus.
        couleurs: {
            "--bg": "#F7F6F3",
            "--panel": "#FFFFFF",
            "--text": "#0C0C0D",
            "--muted": "#6A6A72",
            "--blue": "#111114",
            "--blue-2": "#3A3A42",
            "--gold": "#8A6A18",
            "--border": "rgba(0,0,0,.13)",
            // Le texte posé sur un bouton plein. Sans ce jeton, les boutons
            // affichaient du presque-noir sur du noir : le bouton « Créer mon
            // compte » existait, mais on ne pouvait pas le lire.
            "--sur-accent": "#FFFFFF",
            // L'en-tête collant et les surfaces en creux. En dur, ils
            // restaient sombres au milieu d'une page blanche.
            "--voile": "rgba(255,255,255,.86)",
            "--creux": "rgba(0,0,0,.035)",
            // Les deux halos du fond de page. Chez nous ce sont des taches
            // cyan et bleues ; sur du blanc elles teintaient toute la page.
            // Un gris à peine perceptible garde du relief sans couleur.
            "--halo-1": "rgba(0,0,0,.028)",
            "--halo-2": "rgba(0,0,0,.022)",
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

// ── LES ORTHOGRAPHES QUI ARRIVENT VRAIMENT ──────────────────────────────
//
// Son lien vit dans une story, un statut WhatsApp, un commentaire. Les gens
// le retapent de mémoire, et ils le retapent comme ils écrivent son nom :
// « Le Coin Du Digital » devient naturellement `coin-du-digital`. Ce n'est
// pas une erreur de leur part, c'est la graphie la plus évidente.
//
// Chaque variante renvoie vers l'adresse canonique par une redirection, pour
// qu'il n'existe qu'UNE seule adresse partagée et référencée.
const ALIAS = {
    "coin-du-digital": "coindudigital",
    "lecoindudigital": "coindudigital",
    "le-coin-du-digital": "coindudigital",
    "coindigital": "coindudigital",
    "coin-digital": "coindudigital",
};

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

// ── QUELLE MARQUE PORTE CE QG ? ─────────────────────────────────────────
//
// « Pour créer une boutique je tombe dans les QG de OG. » Le QG lisait la
// communauté du COMPTE. Un compte de la maison qui ouvre son QG depuis le
// domaine d'une partenaire y voyait donc notre catalogue complet, et
// « OG · TECHNOLOGY » écrit en haut — sur SON domaine à elle.
//
// LA RÈGLE : LE DOMAINE DÉCIDE, PAS LE COMPTE. Un service partenaire ne sert
// qu'une communauté ; il porte donc sa marque pour tout le monde. Qui veut
// notre QG vient sur notre domaine.
//
// Cette décision vit ici, et pas au milieu d'une route, pour une raison
// précise : c'est elle qui a été fausse, et une décision qu'on ne peut pas
// tester séparément est une décision qui redeviendra fausse.
function pourLeQG(communauteHote, communauteDuCompte) {
    if (communauteHote && existe(communauteHote)) {
        const h = get(communauteHote);
        if (h.slug !== DEFAUT) return h;
    }
    return get(communauteDuCompte);
}

function nettoyer(slug) {
    return String(slug || "").toLowerCase().replace(/[^a-z0-9-]/g, "");
}

// L'adresse canonique d'une variante connue, ou null si ce slug est déjà le
// bon — ou totalement inconnu.
function alias(slug) {
    const propre = nettoyer(slug);
    const cible = ALIAS[propre];
    return cible && cible !== propre ? cible : null;
}

module.exports = { COMMUNAUTES, DEFAUT, ALIAS, get, existe, styleDe, liste, alias, nettoyer, pourLeQG };
