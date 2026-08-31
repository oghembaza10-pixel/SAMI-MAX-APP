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
        // Ce que voit quelqu'un qui arrive par un lien partagé et ne sait
        // pas où il est tombé. Repris de sa fiche professionnelle, pas
        // inventé à sa place — et à faire relire par elle : c'est sa
        // communauté qu'on présente, avec ses mots.
        apropos: "Le Coin Du Digital, c'est l'endroit où on partage ce qui fait vraiment "
               + "gagner du temps et de l'argent en ligne : outils IA, astuces tech, "
               + "formations et opportunités digitales. Tu peux lire, poser tes questions, "
               + "vendre tes propres formations ou produits, et être payé directement ici.",
        moteur: "COMMUNAUTÉ EN LIGNE",
        moteurTexte: "Ressources numériques · Outils IA · Astuces Tech · Formations · Opportunités.",
        libelleMembres: "Membres",
        // À trancher avec elle : « SAMII » met en avant le moteur, « L'assistant »
        // efface toute trace de notre marque. Une seule ligne à changer.
        assistant: "L'assistant",
        ecosysteme: false,
        // ── PAS DE GRADES ICI ────────────────────────────────────────────
        //
        // « Enlève les grades aussi, Soldat etc. »
        //
        // « Soldat », « Caporal », la petite icône de casque, la barre qui
        // se remplit vers le grade suivant : c'est NOTRE jeu, et il est
        // militaire. Sur une communauté de ressources numériques à Douala,
        // ça n'évoque rien — au mieux c'est décoratif, au pire ça détonne
        // avec ce qu'elle vend.
        //
        // Les points continuent de se compter en base (ils servent à
        // classer les membres les plus actifs). C'est l'HABILLAGE militaire
        // qu'on retire, pas le classement.
        grades: false,
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
        // MINIMAL + la Marketplace : « On va relâcher la Marketplace pour
        // Inès. » On l'ajoute ICI et pas dans MINIMAL, qui reste la dotation
        // prudente d'une nouvelle partenaire — sinon la prochaine hériterait
        // d'une décision prise pour elle seule, sans que personne l'ait
        // voulu.
        qg: { modules: [...require("./modules-qg").MINIMAL, "marketplace"] },
        // ── LA MARKETPLACE, SANS L'ALGÉRIE ───────────────────────────────
        //
        // « Tu enlèves ce qui est algérien, genre local. Tu laisses juste
        // Local, et on ne veut pas savoir si c'est algérien ou camerounais. »
        //
        // L'onglet s'appelait « 🇩🇿 Algérie & Local ». Un drapeau algérien
        // sur une communauté camerounaise, ça dit à ses membres qu'ils sont
        // sur le site de quelqu'un d'autre. Et mettre un drapeau camerounais
        // à la place ferait la même erreur dans l'autre sens : elle vend
        // aussi hors du Cameroun.
        //
        // « Local » sans pays : ce qui se trouve près de chez soi, où que ce
        // soit. Tout ce qu'il y a DEDANS ne bouge pas — photo, description,
        // prix, catégories, la publication d'annonce.
        marketplace: {
            local: "📍 Local",
            // Les devises montrées à côté de l'euro sur un produit importé.
            // Le franc CFA d'Afrique centrale, celui de Douala — pas le
            // dinar algérien ni le dirham marocain, qui ne lui parlent pas.
            conversions: ["XAF"],
            // Ce qu'on cite en exemple quand l'espace local est vide. La
            // version d'origine parlait d'« un grossiste algérien ».
            exemples: "Une formation, un service, un produit d'un fournisseur près de chez toi…",
            // ── PAS DE FOURNISSEURS, PAS D'IMPORT ────────────────────────
            //
            // « Tu lui mets une Marketplace VIDE, sans nos colonnes,
            // rattachée aux comptes des membres et à leur profil. Tu enlèves
            // ce qui est à nous : les fournisseurs et les modules comme
            // Arsenal. »
            //
            // « Import International » est notre catalogue de dropshipping :
            // les 203 annonces CJ, les régions de fournisseurs, les
            // partenaires. Ce sont NOS accords commerciaux, pas les siens.
            // Les lui montrer ferait deux promesses fausses à la fois : que
            // ces produits sont disponibles chez elle, et qu'elle a un réseau
            // d'import qu'elle n'a pas.
            //
            // Sa Marketplace, c'est ce que SES membres y mettent. Elle
            // démarre vide, et c'est normal — une place de marché se
            // remplit par ceux qui y vendent.
            fournisseurs: false,
        },
        // ── QUI ADMINISTRE CETTE COMMUNAUTÉ ──────────────────────────────
        // Son espace d'administration — membres, publications, ventes, et
        // ce qui lui revient — s'ouvre à cette adresse-là.
        //
        // Déclaré ici plutôt que par une requête SQL à lancer à la main :
        // un accès qui dépend d'un geste sur la base est un accès que
        // personne ne sait plus expliquer six mois après, et qu'on ne peut
        // pas relire. Ici, il se voit.
        //
        // ⚠️ À REMPLACER PAR SON ADRESSE RÉELLE avant de lui donner le lien.
        // Tant que c'est celle-ci, c'est le fondateur qui voit son tableau
        // de bord, pas elle.
        admin: "audreyined133@gmail.com",
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
            // ── LES JETONS DE LA MARKETPLACE ─────────────────────────────
            //
            // Cette page utilise seize jetons, pas les treize des autres.
            // Sans les trois derniers, sa Marketplace s'affichait à moitié :
            // le contenu en blanc, mais la colonne de gauche et l'en-tête
            // restés noirs — on voyait qu'on changeait de maison en entrant.
            //
            // Les variantes « -rgb » servent aux transparences (rgba(var(…),
            // .5)) : sans elles, la valeur est invalide et la règle est
            // ignorée en silence, donc un fond disparaît sans erreur.
            "--bg-rgb": "247,246,243",
            "--panel-rgb": "255,255,255",
            "--blue-rgb": "17,17,20",
            // Le second niveau de surface : les creux, les champs, les
            // en-têtes de tableau. Entre le fond et les panneaux.
            "--panel2": "#EFEDE8",
            "--blue2": "#3A3A42",
            // L'or, réservé aux prix. Décliné pour les fonds et bordures
            // qui l'accompagnent.
            "--gold-bright": "#A8801E",
            "--gold-soft": "rgba(138,106,24,.09)",
            "--gold-border": "rgba(138,106,24,.28)",
            "--silver-bright": "#6A6A72",
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

// ── « ← COMMUNAUTÉ » : ÇA RAMÈNE CHEZ QUI ? ─────────────────────────────
//
// « J'étais dans la discussion générale et au moment de revenir en arrière,
// je suis retombé dans la communauté de SAMII. »
//
// Le lien de retour était écrit en dur : `/community`, notre communauté à
// nous. Un membre de chez elle discutait dans SON salon, cliquait sur
// « retour », et se retrouvait chez nous — c'est-à-dire dehors, sur une
// marque qu'il n'a jamais demandé à voir.
//
// C'EST UNE DÉCISION, PAS UNE CHAÎNE DE CARACTÈRES. Elle vit donc ici,
// à un seul endroit, et pas recopiée dans chaque page qui a un bouton
// retour. Le prochain qui ajoute une page n'aura pas à deviner.
function accueil(communaute) {
    const com = communaute?.slug ? communaute : get(communaute);
    return com.ecosysteme ? "/community" : `/c/${com.slug}`;
}

// ── OÙ VA UN MARCHAND QUI N'A PAS ENCORE DE BOUTIQUE ? ──────────────────
//
// Chez nous : le Hub, qui liste ses boutiques et propose d'en créer une.
// Chez elle : le Hub n'existe pas — c'est notre page, avec notre marque et
// nos métiers — et « Mes affaires » deviendrait une impasse : on clique, on
// rebondit sur le fil, sans jamais comprendre pourquoi.
//
// On l'envoie donc directement là où il voulait aller : créer sa boutique.
// Il perd le choix entre plusieurs boutiques ; il gagne de pouvoir en
// ouvrir une. C'est le bon échange tant qu'elle n'a pas son propre Hub.
function accueilMarchand(communaute) {
    const com = communaute?.slug ? communaute : get(communaute);
    return com.ecosysteme ? "/hub" : "/workspace/create";
}

// ── ET UN ACHETEUR, OÙ VA-T-IL ? ────────────────────────────────────────
//
// Chez nous : /client-qg, l'espace acheteur, avec le suivi de commandes et
// « Devenir livreur ». Chez elle : cet espace est fermé — il parle de notre
// réseau, pas du sien. Ses acheteurs vivent dans son fil, là où ils ont
// trouvé le produit.
//
// Cette fonction existe parce que fermer une page ne suffit jamais : il
// faut aussi savoir où vont les gens qu'on y envoyait. Sans elle, un
// acheteur de chez elle cliquait sur « Mes affaires » et rebondissait sans
// explication.
function accueilClient(communaute) {
    const com = communaute?.slug ? communaute : get(communaute);
    return com.ecosysteme ? "/client-qg" : accueil(com);
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

module.exports = { COMMUNAUTES, DEFAUT, ALIAS, get, existe, styleDe, liste, alias, nettoyer, pourLeQG, accueil, accueilMarchand, accueilClient };
