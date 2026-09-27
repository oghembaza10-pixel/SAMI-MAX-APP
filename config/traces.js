// ==========================================================================
// SAMII OS — LA TRACE QUE LAISSE CHAQUE GESTE DE SAMII
// ==========================================================================
//
// ── LE TROU QU'ON BOUCHE ─────────────────────────────────────────────────
//
// Mesuré au chantier F : les VINGT-DEUX outils que SAMII exécute dans une
// conversation — chercher des prospects, comparer des prix, lire l'état du
// business, envoyer une facture — n'écrivaient RIEN dans aucune table. Ils
// passaient par un point unique, `SamiiPlanner.executeFunction`, et
// repartaient dans la réponse du navigateur. Les blocs structurés du
// chantier C sont calculés par tour et jamais gardés.
//
// Conséquence : le Centre d'activité ne pouvait pas dire « SAMII a analysé
// tes prix », parce que personne ne l'écrivait. Ce n'était pas une page qui
// manquait, c'était un producteur.
//
// ── DEUX AXES, PAS UN BOOLÉEN ────────────────────────────────────────────
//
//   ACTEUR   qui a agi : le business, ou SAMII
//   VERBE    quelle est la nature de la contribution
//
// Un booléen `samii: true` ne distinguait pas « il a regardé » de « il a
// envoyé une facture ». Ce sont deux choses très différentes pour celui qui
// lit, et une seule des deux coûte de l'argent.
//
// ══════════════════════════════════════════════════════════════════════════
// COMMENT LE VERBE EST DÉDUIT — ET POURQUOI IL N'EST PAS CHOISI
// ══════════════════════════════════════════════════════════════════════════
//
// Deux sources déjà écrites dans le projet, croisées. Aucune n'a été
// inventée pour ce fichier :
//
//   1. `config/credits.js` — LA TABLE QUI FACTURE. Elle classe déjà les
//      vingt-deux outils, et elle porte la RAISON en toutes lettres :
//        • `GRATUITS` : douze outils, chacun avec son motif — « lire ses
//          propres données », « lire le marché, rien n'est créé », « déjà
//          facturée ailleurs ».
//        • `ACTES` : dix outils payants, chacun avec son libellé — « facture
//          envoyée », « publication préparée », « programme exécuté ».
//      C'est la source la plus sûre qui existe : un verbe qui s'en écarterait
//      dirait au marchand autre chose que ce qu'on lui facture.
//
//   2. La DESCRIPTION de l'outil dans `services/geminiService.js`, celle que
//      le modèle lit pour décider de l'appeler. Elle tranche la nuance que la
//      facturation ne voit pas : `prix_du_marche` est gratuit comme
//      `consulter_agenda`, mais sa description dit « dit si le prix du
//      marchand est bas, bien placé ou trop haut ». Regarder un agenda et
//      rendre un avis ne sont pas le même geste.
//
// LA RÈGLE, EN UNE PHRASE : la facturation décide de l'axe lit / crée ; la
// description décide de la nuance à l'intérieur.
//
// UN SEUL DÉSACCORD ENTRE LES DEUX, ET IL EST NOTÉ SUR SA LIGNE :
// `etat_de_mon_business` est dans `GRATUITS` au motif « lire ses propres
// données », mais sa description ajoute « et une projection de revenus ».
// Une projection n'est pas une lecture. La description l'emporte, et le verbe
// est `analyse`. C'est le seul endroit où j'ai tranché ; il est écrit ici
// pour qu'on puisse me contredire d'une ligne.
//
// ── OÙ EST PASSÉ « DÉTECTE » ? ───────────────────────────────────────────
//
// Aucun des vingt-deux outils ne détecte quoi que ce soit : un outil est
// appelé, il ne surveille pas. La détection est le fait des MOTEURS —
// `stock.low`, `stock.empty` — qui tournent sans qu'on leur demande. Le verbe
// existe donc dans le vocabulaire et il est porté par ces lignes-là, pas par
// un outil. L'inventer pour un outil aurait été le seul verbe faux du lot.
//
// ── ET « RÉSULTAT » / « ERREUR » ? ───────────────────────────────────────
//
// Ce ne sont pas des verbes mais des ISSUES : n'importe lequel des sept
// verbes peut réussir ou échouer. Les ranger parmi les verbes aurait obligé à
// choisir entre « il a envoyé » et « ça a échoué », alors que la vérité est
// les deux à la fois. Ils sont donc un axe séparé, `etat`.
// ==========================================================================

// ── LES VERBES ───────────────────────────────────────────────────────────
//
// Du plus léger au plus engageant. L'ordre n'est pas décoratif : il dit ce
// qu'un geste coûte et ce qu'il laisse derrière lui. `observe` ne change
// rien au monde ; `agit` y laisse quelque chose qui n'existait pas.
const VERBES = ["observe", "detecte", "analyse", "recommande", "prepare", "agit", "execute"];

// ── CE QUI S'AFFICHE SUR LA LIGNE ────────────────────────────────────────
//
// Les identifiants ci-dessus sont sans accent, comme tout identifiant de ce
// projet. Les MONTRER tels quels écrivait « EXECUTE » et « DETECTE » sur la
// page d'un produit francophone — trouvé en ouvrant l'écran, pas en lisant le
// code.
//
// Au participe passé, parce que la ligne raconte ce qui A ÉTÉ fait : on lit
// « a situé les prix face au marché · CONSEILLÉ », pas « … · CONSEILLE ».
const VERBES_LISIBLES = {
    observe:    "observé",
    detecte:    "repéré",
    analyse:    "analysé",
    recommande: "conseillé",
    prepare:    "préparé",
    agit:       "fait",
    execute:    "exécuté",
};

function libelleVerbe(verbe) {
    return VERBES_LISIBLES[String(verbe || "")] || String(verbe || "");
}

// ── LES ISSUES ───────────────────────────────────────────────────────────
const ETATS = ["en_cours", "reussi", "echec"];

const ACTEURS = ["business", "samii"];

// ══════════════════════════════════════════════════════════════════════════
// LES VINGT-DEUX OUTILS
// ══════════════════════════════════════════════════════════════════════════
//
// `verbe`   déduit comme expliqué en tête.
// `libelle` ce que le marchand lit. Écrit à la première personne du passé :
//           c'est un compte rendu, pas un titre de colonne.
// `tracer`  false quand une ligne de journal EXISTE DÉJÀ en aval pour ce
//           geste. En écrire une seconde ferait apparaître le même fait deux
//           fois dans la timeline — exactement ce que ce chantier supprime.
//           La ligne existante dit déjà que c'est SAMII qui a agi : le bus
//           nomme sa source (`order.created.chat`, `rdv.created.chat`) et les
//           deux gestes Telegram portent leur canal dans leur nom.
// `pourquoi` la trace aval, nommée. Un test vérifie qu'elle existe vraiment.
const OUTILS = {
    // ── LA FAMILLE COMMERCE — au nom d'un client, jamais du marchand ─────
    confirmer_commande: {
        verbe: "agit", libelle: "a confirmé une commande",
        tracer: false, pourquoi: "order.confirmed.telegram",
    },
    annuler_commande: {
        verbe: "agit", libelle: "a annulé une commande",
        tracer: false, pourquoi: "order.cancelled.telegram",
    },
    passer_commande: {
        verbe: "agit", libelle: "a enregistré une commande",
        tracer: false, pourquoi: "order.created.chat (par le bus)",
    },
    prendre_rendez_vous: {
        verbe: "agit", libelle: "a posé un rendez-vous",
        tracer: false, pourquoi: "rdv.created.chat (par le bus)",
    },
    // Gratuit au motif « c'est l'étape avant le rendez-vous » : rien n'est
    // créé, des créneaux sont PROPOSÉS. Et rien ne le trace en aval.
    proposer_creneaux_rdv: {
        verbe: "recommande", libelle: "a proposé des créneaux", tracer: true,
    },

    // ── LIRE SES PROPRES DONNÉES ─────────────────────────────────────────
    // `GRATUITS` : « lire ses propres données ». Rien n'est créé, rien n'est
    // jugé — SAMII regarde ce qui est déjà là.
    resume_journee: {
        verbe: "observe", libelle: "a fait le point de la journée", tracer: true,
    },
    consulter_gmail: {
        verbe: "observe", libelle: "a regardé la boîte mail", tracer: true,
    },
    consulter_agenda: {
        verbe: "observe", libelle: "a regardé l'agenda", tracer: true,
    },
    lister_fichiers_drive: {
        verbe: "observe", libelle: "a listé les fichiers du Drive", tracer: true,
    },
    historique_client: {
        verbe: "observe", libelle: "a retrouvé l'historique d'un client", tracer: true,
    },
    // ⚠️ LE SEUL DÉSACCORD ENTRE LES DEUX SOURCES — voir l'en-tête.
    // Facturation : « lire ses propres données ». Description : « … et une
    // projection de revenus quand il y a assez d'historique ». Une projection
    // n'est pas une lecture : la description l'emporte.
    etat_de_mon_business: {
        verbe: "analyse", libelle: "a analysé l'état de l'activité", tracer: true,
    },

    // ── ALLER VOIR DEHORS ────────────────────────────────────────────────
    // `GRATUITS` : « lire le marché, rien n'est créé ». La nuance vient de la
    // description : rapporter n'est pas trancher.
    trouver_fournisseur: {
        verbe: "analyse", libelle: "a cherché où s'approvisionner", tracer: true,
    },
    // « Cherche sur le web de vraies entreprises » — il rapporte une liste.
    rechercher_prospects: {
        verbe: "analyse", libelle: "a cherché des prospects", tracer: true,
    },
    // « dit si le prix du marchand est bas, bien placé ou trop haut » : un avis.
    prix_du_marche: {
        verbe: "recommande", libelle: "a situé les prix face au marché", tracer: true,
    },
    // « quoi vendre, ce qui marche, quelles opportunités saisir » : un avis.
    marche_du_moment: {
        verbe: "recommande", libelle: "a repéré ce qui marche en ce moment", tracer: true,
    },

    // ── CE QUI LAISSE QUELQUE CHOSE DERRIÈRE ─────────────────────────────
    // `ACTES` : ça se paie parce que ça crée ou ça envoie.
    envoyer_email: {
        verbe: "agit", libelle: "a envoyé un e-mail", tracer: true,
    },
    envoyer_facture: {
        verbe: "agit", libelle: "a envoyé une facture", tracer: true,
    },
    creer_evenement_agenda: {
        verbe: "agit", libelle: "a posé un événement dans l'agenda", tracer: true,
    },
    creer_rapport_sheets: {
        verbe: "agit", libelle: "a créé un rapport", tracer: true,
    },
    // Libellé de facturation : « publication préparée ». Le brouillon attend
    // une validation — rien n'est parti.
    preparer_publication: {
        verbe: "prepare", libelle: "a préparé une publication", tracer: true,
    },
    // « programme exécuté ».
    executer_code: {
        verbe: "execute", libelle: "a exécuté un programme", tracer: true,
    },
    // Facturé « stratégie préparée », mais c'est une MISSION LONGUE à
    // plusieurs étapes : au moment de l'appel, SAMII ne prépare pas, il
    // démarre. La préparation est le résultat, pas le geste.
    preparer_strategie: {
        verbe: "execute", libelle: "a lancé une stratégie complète", tracer: true,
    },
};

// ── L'ESPACE DE NOMS DANS LE JOURNAL ─────────────────────────────────────
//
// `samii.<verbe>.<outil>` — et `.echec` au bout quand le geste a échoué.
//
// POURQUOI DANS LE NOM DE L'ACTION plutôt que dans une colonne : le journal
// n'a pas de colonne libre pour un verbe, et lui en ajouter une aurait voulu
// dire remplir cette colonne pour les cinquante-deux écritures existantes.
// Le préfixe `samii.` suffit à distinguer, il se lit à l'œil nu dans la base,
// il se cherche au `grep`, et il ne peut pas entrer en collision avec le
// vocabulaire métier existant (`order.*`, `stock.*`, `abonnement.*`).
//
// ⚠️ ET SURTOUT : une trace d'outil n'est PAS une action métier. Écrire
// `order.paid` parce que SAMII a regardé un paiement inventerait un fait qui
// n'a pas eu lieu. Le préfixe garantit qu'aucune trace ne peut être confondue
// avec un événement du business.
const PREFIXE = "samii.";

function nomAction(outil, reussi = true) {
    const def = OUTILS[String(outil || "")];
    if (!def) return null;
    return `${PREFIXE}${def.verbe}.${outil}${reussi ? "" : ".echec"}`;
}

// Relire une action du journal. Rend `null` pour tout ce qui n'est pas une
// trace de SAMII — le vocabulaire métier passe à travers sans être touché.
function lireAction(action) {
    const brut = String(action || "");
    if (!brut.startsWith(PREFIXE)) return null;
    const echec = brut.endsWith(".echec");
    const corps = echec ? brut.slice(PREFIXE.length, -".echec".length) : brut.slice(PREFIXE.length);
    const coupe = corps.indexOf(".");
    if (coupe < 0) return null;
    const verbe = corps.slice(0, coupe);
    const outil = corps.slice(coupe + 1);
    if (!VERBES.includes(verbe) || !OUTILS[outil]) return null;
    return {
        acteur: "samii", verbe, outil,
        etat: echec ? "echec" : "reussi",
        libelle: OUTILS[outil].libelle,
    };
}

// Les outils dont on écrit vraiment une trace. Les quatre autres sont déjà
// dits par une ligne métier — voir `tracer` ci-dessus.
function aTracer(outil) {
    return OUTILS[String(outil || "")]?.tracer === true;
}

module.exports = { VERBES, VERBES_LISIBLES, ETATS, ACTEURS, OUTILS, PREFIXE,
                   nomAction, lireAction, aTracer, libelleVerbe };
