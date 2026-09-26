// ==========================================================================
// SAMII OS — CE QUE SAMII FAIT POUR VOUS, ET QUI NE SE VOYAIT NULLE PART
// ==========================================================================
//
// ── LE PROBLÈME, EN UNE PHRASE ───────────────────────────────────────────
//
// Demander un travail long à SAMII était un acte SANS ÉCHO. La mission part,
// tourne, se reprend après une panne, se termine — et personne ne le voit
// jamais. C'est la différence entre un assistant et un employé : un employé
// rend compte.
//
// Mesuré : `/api/missions` existe depuis des mois, avec ses trois routes et
// ses garde-fous. AUCUNE page ne l'appelle. Zéro consommateur dans `public/`
// et dans `views/`. L'API a été écrite, testée, et jamais branchée.
//
// ── CE FICHIER NE CRÉE AUCUN JOURNAL ─────────────────────────────────────
//
// C'est la consigne, et c'est aussi la bonne architecture : il LIT trois
// sources qui existent déjà et qui sont écrites ailleurs. Rien ici n'insère,
// ne met à jour, ne supprime. Une page de lecture.
//
//   `journal`              la source principale — écrite par 20 fichiers via
//                          l'unique `services/journalService.js`
//   `missions_longues`     les missions de SAMII, lues par missionsLongues
//   `social_publications`  les publications programmées, lues par socialStore
//
// ── LE CLOISONNEMENT, ET POURQUOI IL EST PLUS STRICT QU'AILLEURS ─────────
//
// Tout part de `workspace_id`, pris DANS LA SESSION et nulle part ailleurs.
// La règle 5 du projet — « l'identité vient de la session, jamais du corps de
// la requête » — a coûté quatre pannes ici ; on ne la rejoue pas.
//
// `journal` n'a pas de colonne `communaute`. Ce n'est pas un trou : un QG
// appartient à UNE communauté, donc filtrer par QG est plus fin que filtrer
// par communauté, pas plus lâche. Deux marchands de communautés différentes
// ont forcément deux QG différents.
//
// ── UNE SOURCE EN PANNE NE DOIT PAS EMPORTER LA PAGE ─────────────────────
//
// Les trois lectures sont indépendantes et chacune retombe sur une liste
// vide. Une table indisponible retire une section ; elle ne retire pas la
// page. C'est le même choix que `espacesDe()` dans index.js : on perd la
// liste, pas la conversation.
// ==========================================================================

const db = require("./db");

// ══════════════════════════════════════════════════════════════════════════
// LE REGISTRE DES ACTIONS — DÉCLARÉ UNE FOIS, FERMÉ PAR DÉFAUT
// ══════════════════════════════════════════════════════════════════════════
//
// Les actions du journal sont des identifiants techniques (`order.paid`,
// `autopost.publication`). Ce registre leur donne un nom lisible, et dit
// lesquelles sont du TRAVAIL DE SAMII.
//
// ── POURQUOI UN REGISTRE ET PAS UN `if` DANS LA VUE ──────────────────────
//
// Règle 4 du projet : les données plutôt que la duplication. Le jour où une
// action change de nom, il y a UN endroit à corriger. Et un registre se
// teste : la suite vérifie que chaque action réellement écrite quelque part
// dans le code y figure.
//
// ── `samii: true` NE SE DEVINE PAS ───────────────────────────────────────
//
// Une action absente de ce registre est affichée telle quelle dans
// « Activité récente », et n'entre JAMAIS dans « Travail de SAMII ». Fermé
// par défaut, comme `config/audiences.js` : oublier d'accorder se voit tout
// de suite, oublier d'interdire ne se voit jamais.
//
// La ligne de partage, mesurée sur qui écrit quoi : `samii: true` quand
// SAMII a agi PENDANT QUE LE MARCHAND NE REGARDAIT PAS — il a publié,
// surveillé un stock, traité la confirmation d'un client, prévenu d'une
// échéance. `samii: false` quand la ligne n'est que la trace d'un geste que
// le marchand a fait lui-même : acheter une carte, demander un abonnement,
// coller un numéro de suivi. Les deux méritent d'être visibles ; une seule
// mérite d'être présentée comme du travail fait pour lui.
const ACTIONS = {
    // ── Ce que SAMII a fait, seul ────────────────────────────────────────
    "order.created":            { libelle: "Commande reçue", samii: true },
    "order.updated":            { libelle: "Commande mise à jour", samii: true },
    "order.paid":               { libelle: "Paiement reçu", samii: true },
    "order.fulfilled":          { libelle: "Commande expédiée", samii: true },
    "order.delivered":          { libelle: "Commande livrée", samii: true },
    "order.confirmed":          { libelle: "Commande confirmée par le client", samii: true },
    "order.cancelled":          { libelle: "Commande annulée", samii: true },
    "order.confirmed.telegram": { libelle: "Commande confirmée sur Telegram", samii: true },
    "order.cancelled.telegram": { libelle: "Commande annulée sur Telegram", samii: true },
    "order.paid.chargily":      { libelle: "Paiement encaissé", samii: true },
    "stock.low":                { libelle: "Stock bas repéré", samii: true },
    "stock.empty":              { libelle: "Rupture de stock repérée", samii: true },
    "autopost.publication":     { libelle: "Publication automatique", samii: true },
    "autopost.impossible":      { libelle: "Publication automatique impossible", samii: true },
    "abonnement.expire":        { libelle: "Abonnement arrivé à échéance", samii: true },

    // ── Ce que le marchand a fait lui-même ───────────────────────────────
    "shop.connected":           { libelle: "Boutique connectée", samii: false },
    "shop.uninstalled":         { libelle: "Boutique déconnectée", samii: false },
    "carte.activated":          { libelle: "Carte activée", samii: false },
    "carte.achetee":            { libelle: "Carte achetée", samii: false },
    "abonnement.upgraded":      { libelle: "Abonnement changé", samii: false },
    "abonnement.cancelled":     { libelle: "Abonnement annulé", samii: false },
    "abonnement.paye":          { libelle: "Abonnement payé", samii: false },
    "abonnement.demande.ccp":   { libelle: "Demande d'abonnement (CCP)", samii: false },
    "abonnement.demande.societe": { libelle: "Demande d'abonnement (société)", samii: false },
    "premium.ccp.demande":      { libelle: "Demande premium (CCP)", samii: false },
    "recharge.samii":           { libelle: "Recharge de crédits", samii: false },
    "recharge.samii.echec":     { libelle: "Recharge échouée", samii: false },
    "tracking.activated":       { libelle: "Suivi de colis activé", samii: false },
    "commande.creee.boutique":  { libelle: "Commande passée en boutique", samii: false },
    "youtube.publication":      { libelle: "Publication YouTube", samii: false },
    "grade.points":             { libelle: "Points de grade", samii: false },
    "feedback":                 { libelle: "Avis donné sur une réponse", samii: false },
};

function libelleAction(action) {
    const id = String(action || "");
    return ACTIONS[id]?.libelle || id || "Action inconnue";
}

function estTravailDeSamii(action) {
    return ACTIONS[String(action || "")]?.samii === true;
}

// ══════════════════════════════════════════════════════════════════════════
// LES ÉTATS — TRADUITS DEPUIS LEURS PROPRES REGISTRES, JAMAIS RECOPIÉS
// ══════════════════════════════════════════════════════════════════════════
//
// `missions_longues` et `social_publications` ont chacune son vocabulaire,
// déclaré chez elles. On ne recopie pas les listes : on dit seulement, pour
// chaque valeur, dans laquelle des trois colonnes elle tombe.
//
// Un état inconnu tombe dans `null` — donc dans aucune des trois sections.
// Il resterait invisible plutôt que de se ranger au hasard dans « Terminé »,
// ce qui ferait croire à un travail fait.
const ETAT_MISSION = {
    attente:  "en_cours",
    en_cours: "en_cours",
    terminee: "termine",
    echouee:  "echec",
    annulee:  "echec",
};

const ETAT_PUBLICATION = {
    scheduled:  "en_cours",
    publishing: "en_cours",
    published:  "termine",
    failed:     "echec",
    cancelled:  "echec",
    // draft, review, approved : pas encore programmées, donc pas encore une
    // activité. Elles se travaillent ailleurs ; les montrer ici ferait croire
    // que quelque chose tourne.
};

// ══════════════════════════════════════════════════════════════════════════
// UNE SEULE FORME POUR TOUT CE QUI S'AFFICHE
// ══════════════════════════════════════════════════════════════════════════
//
// Trois sources, une forme. La vue a UN peintre, pas trois — c'est la leçon
// du chantier C : trois rendus pour trois formes, c'est trois endroits où
// l'un d'eux oublie d'échapper un texte.
//
//   source       d'où ça vient, pour le diagnostic
//   titre        ce qu'on lit en gras
//   detail       la phrase, telle que la source l'a écrite
//   quand        ISO, ou null
//   etat         "en_cours" | "termine" | "echec" | "note"
//   progression  { etape, total } pour une mission, sinon null
//   erreur       le motif d'un échec, sinon null
//   parSamii     true si c'est du travail fait sans que le marchand agisse
// ── LE LIBELLÉ NE DOIT PAS RÉPÉTER LE DÉTAIL ─────────────────────────────
//
// ⚠️ TROUVÉ EN OUVRANT LA PAGE, PAS EN LISANT LE CODE.
//
// Le registre nomme l'action (« Commande confirmée sur Telegram ») et le
// journal porte la phrase écrite par le moteur (« Commande confirmée sur
// Telegram : CMD-119 »). Les deux sont justes, et côte à côte ils donnent :
//
//     Commande confirmée sur Telegram
//     Commande confirmée sur Telegram : CMD-119
//
// La seule information neuve est « CMD-119 », noyée dans une répétition.
//
// On ne retire donc QUE ce qui est littéralement le libellé, en tête, suivi
// d'un séparateur. Pas de troncature, pas de résumé : si la phrase ne
// commence pas exactement par le libellé, elle est affichée telle quelle.
// Deviner serait pire que répéter — une ligne de journal se lit pour savoir
// ce qui s'est passé.
function sansRedite(titre, detail) {
    const t = String(titre || "").trim();
    const d = String(detail || "").trim();
    if (!t || !d) return d;
    if (d.toLowerCase().indexOf(t.toLowerCase()) !== 0) return d;
    // Ce qui reste, débarrassé du séparateur qui suivait le libellé.
    const reste = d.slice(t.length).replace(/^[\s:—–-]+/, "").trim();
    // Rien après le libellé : la phrase ne disait que lui, il n'y a pas de
    // détail à montrer. Rendre la phrase entière la ferait afficher deux fois.
    return reste;
}

function element({ source, titre, detail = "", quand = null, etat = "note",
                   progression = null, erreur = null, parSamii = false }) {
    return {
        source,
        titre: String(titre || ""),
        detail: sansRedite(titre, detail),
        quand: quand ? new Date(quand).toISOString() : null,
        etat,
        progression,
        erreur: erreur ? String(erreur) : null,
        parSamii: parSamii === true,
    };
}

// ── LE JOURNAL DU QG ─────────────────────────────────────────────────────
//
// ⚠️ LE FILTRE N'EST PAS OPTIONNEL. Sans `workspaceId`, cette fonction rend
// une liste VIDE — elle ne lit pas « tout le journal ». Une table sans filtre
// est globale par défaut, et cette fuite est revenue cinq fois dans ce projet
// (le fil, les discussions, le classement, la marketplace, les vitrines).
// Ici, il n'y a pas de requête à faire sans QG : il n'y a rien à montrer.
async function lireJournal(workspaceId, limite) {
    if (!workspaceId) return [];
    try {
        const lignes = await db.query(
            `SELECT action, details, montant, created_at
               FROM journal
              WHERE workspace_id = $1
              ORDER BY created_at DESC, id DESC
              LIMIT $2`,
            [String(workspaceId), limite]
        );
        return lignes.map((l) => element({
            source: "journal",
            titre: libelleAction(l.action),
            detail: l.details || "",
            quand: l.created_at,
            etat: "note",
            parSamii: estTravailDeSamii(l.action),
        }));
    } catch (err) {
        console.error("❌ activite.lireJournal :", err.message);
        return [];
    }
}

// ── LES MISSIONS LONGUES ─────────────────────────────────────────────────
//
// On passe par `missionsLongues.lister()`, qui filtre DÉJÀ sur `user_id` ET
// `workspace_id`. Réécrire la requête ici en aurait fait une deuxième, qui
// aurait divergé le jour où l'une des deux change.
async function lireMissions({ userId, workspaceId }, limite) {
    if (!userId && !workspaceId) return [];
    try {
        const longues = require("./missionsLongues");
        const lignes = await longues.lister({ userId, workspaceId, limite });
        return lignes.map((m) => {
            const etat = ETAT_MISSION[String(m.etat || "")] || null;
            if (!etat) return null;
            return element({
                source: "mission",
                titre: libelleMission(m.mission),
                detail: "",
                quand: m.fin_le || m.debut_le || m.created_at,
                etat,
                progression: { etape: Number(m.etape) || 0, total: Number(m.etapes_total) || 0 },
                erreur: m.erreur || null,
                parSamii: true,
            });
        }).filter(Boolean);
    } catch (err) {
        console.error("❌ activite.lireMissions :", err.message);
        return [];
    }
}

// Le nom lisible d'une mission vient de `config/agents.js`, qui la déclare.
// On ne recopie pas les libellés : un titre écrit ici aurait divergé du jour
// où la mission est renommée.
function libelleMission(id) {
    try {
        return require("../config/agents").mission(id)?.libelle || String(id || "Mission");
    } catch {
        return String(id || "Mission");
    }
}

// ── LES PUBLICATIONS PROGRAMMÉES ─────────────────────────────────────────
async function lirePublications(workspaceId, limite) {
    if (!workspaceId) return [];
    try {
        const store = require("./socialStore");
        const lignes = await store.listerPublications({ workspaceId, limite });
        return lignes.map((p) => {
            const etat = ETAT_PUBLICATION[String(p.statut || "")] || null;
            if (!etat) return null;
            return element({
                source: "publication",
                titre: p.titre || "Publication",
                detail: p.plateforme || p.v_plateforme || "",
                quand: p.publiee_le || p.programmee_le || p.created_at,
                etat,
                erreur: p.erreur || null,
                parSamii: true,
            });
        }).filter(Boolean);
    } catch (err) {
        console.error("❌ activite.lirePublications :", err.message);
        return [];
    }
}

const recent = (a, b) => new Date(b.quand || 0) - new Date(a.quand || 0);

// ══════════════════════════════════════════════════════════════════════════
// CE QUE LA PAGE LIT
// ══════════════════════════════════════════════════════════════════════════
//
// Les trois lectures partent ENSEMBLE. Séquentielles, la page attendrait la
// somme des trois latences pour afficher une liste.
async function pour({ workspaceId = null, userId = null, limite = 40 } = {}) {
    const n = Math.min(Math.max(Number(limite) || 40, 1), 200);

    const [journal, missions, publications] = await Promise.all([
        lireJournal(workspaceId, n),
        lireMissions({ userId, workspaceId }, n),
        lirePublications(workspaceId, n),
    ]);

    const travaux = [...missions, ...publications];

    // « Travail de SAMII » réunit les missions, les publications, et les
    // lignes du journal que le registre reconnaît comme siennes. C'est la
    // seule section qui mélange les trois sources, et c'est voulu : la
    // question du marchand n'est pas « quelle table », c'est « qu'est-ce
    // qu'il a fait pour moi ».
    const samii = [...travaux, ...journal.filter((l) => l.parSamii)].sort(recent).slice(0, n);

    const sections = {
        enCours: travaux.filter((t) => t.etat === "en_cours").sort(recent),
        termine: travaux.filter((t) => t.etat === "termine").sort(recent),
        echec:   travaux.filter((t) => t.etat === "echec").sort(recent),
        recent:  journal,
        samii,
    };

    return {
        ...sections,
        // Une page vide doit pouvoir le DIRE, plutôt que d'afficher cinq
        // titres au-dessus de cinq blancs. Calculé ici : la vue n'a pas à
        // savoir combien de sections existent.
        vide: Object.values(sections).every((l) => l.length === 0),
    };
}

module.exports = {
    pour, ACTIONS, ETAT_MISSION, ETAT_PUBLICATION,
    libelleAction, estTravailDeSamii, libelleMission, element, sansRedite,
    // Exportées pour que la suite éprouve chaque lecture séparément —
    // notamment qu'aucune ne lit sans QG.
    lireJournal, lireMissions, lirePublications,
};
