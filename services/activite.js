// ==========================================================================
// SAMII OS — LE POSTE DE TRAVAIL : UNE SEULE TIMELINE, DEUX AXES
// ==========================================================================
//
// ── CE QUI A ÉTÉ MESURÉ, ET POURQUOI LE MODÈLE A CHANGÉ ──────────────────
//
// La première version rendait cinq listes. Mesuré sur un vrai QG : 20 lignes
// peintes pour 11 éléments distincts — 45 % de doublons. La cause n'était pas
// un filtre mal réglé : les cinq sections mélangeaient DEUX QUESTIONS.
//
//     « Activité récente » / « Travail de SAMII »  →  QUI a agi
//     « En cours » / « Terminé » / « Échec »       →  OÙ EN EST-CE
//
// Mises au même niveau, elles montraient forcément deux fois le même fait.
//
// ── LE MODÈLE ────────────────────────────────────────────────────────────
//
// UNE seule liste chronologique. La duplication devient impossible par
// construction : il n'y a qu'un endroit où une ligne peut se trouver.
// Les questions deviennent des FILTRES, pas des sections.
//
//     ACTEUR   business | samii
//     VERBE    observe · detecte · analyse · recommande · prepare · agit · execute
//     ÉTAT     en_cours | reussi | echec
//
// Trois axes, pas un booléen. « Il a regardé l'agenda » et « il a envoyé une
// facture » ne sont pas le même geste, et une seule des deux coûte de
// l'argent.
//
// ── L'EXEMPLE QUI A DÉCIDÉ DU MODÈLE ─────────────────────────────────────
//
// « stock.low peut être un événement business, mais la détection, l'analyse
// et la recommandation de SAMII doivent pouvoir apparaître comme travail de
// SAMII. »
//
// Ce ne sont pas deux fois la même ligne, ce sont deux faits différents :
// le stock qui baisse appartient au business, LE FAIT DE L'AVOIR REPÉRÉ
// appartient à SAMII. Ici, `stock.low` porte donc `acteur: samii,
// verbe: detecte` — c'est un moteur qui l'a vu, personne ne le lui a demandé.
// Le jour où une analyse et une recommandation suivront, elles seront deux
// lignes de plus, reliées par la même `ref_id`. Rien à dédupliquer : il n'y a
// jamais eu de doublon, seulement deux listes qui montraient la même ligne.
//
// ── TROIS SOURCES, AUCUN SECOND JOURNAL ──────────────────────────────────
//
//   `journal`              écrit par 20 fichiers via l'unique journalService
//   `missions_longues`     lu par missionsLongues.lister(), qui filtre déjà
//   `social_publications`  lu par socialStore.listerPublications()
//
// Rien ici n'insère, ne met à jour, ne supprime.
//
// ── LE CLOISONNEMENT ─────────────────────────────────────────────────────
//
// Tout part de `workspace_id`, pris DANS LA SESSION. Sans QG, AUCUNE requête
// ne part : le piège n'est pas de rendre une liste vide, c'est de lancer la
// requête sans sa clause `WHERE`, qui rendrait le journal de tout le monde.
// Cette fuite est revenue cinq fois dans ce projet.
// ==========================================================================

const db = require("./db");
const TRACES = require("../config/traces");

// ══════════════════════════════════════════════════════════════════════════
// LE VOCABULAIRE MÉTIER — QUI A AGI, ET QUEL GESTE
// ══════════════════════════════════════════════════════════════════════════
//
// Les traces de SAMII se lisent toutes seules : `config/traces.js` les a
// écrites et sait les relire. Ce registre-ci ne couvre donc QUE le
// vocabulaire métier, celui qui existait avant ce chantier.
//
// ── `acteur: "samii"` NE SE DEVINE PAS ───────────────────────────────────
//
// Une action absente de ce registre est affichée avec son identifiant brut,
// rangée côté `business`, et n'entre JAMAIS dans le filtre SAMII. Fermé par
// défaut, comme `config/audiences.js` : oublier d'accorder se voit tout de
// suite, oublier d'interdire ne se voit jamais.
const ACTIONS = {
    // ── CE QUE LE BUSINESS FAIT, SANS SAMII ──────────────────────────────
    "order.created":          { libelle: "Commande reçue", acteur: "business", verbe: "observe" },
    "order.updated":          { libelle: "Commande mise à jour", acteur: "business", verbe: "observe" },
    "order.paid":             { libelle: "Paiement reçu", acteur: "business", verbe: "observe" },
    "order.paid.chargily":    { libelle: "Paiement encaissé", acteur: "business", verbe: "observe" },
    "order.fulfilled":        { libelle: "Commande expédiée", acteur: "business", verbe: "observe" },
    "order.delivered":        { libelle: "Commande livrée", acteur: "business", verbe: "observe" },
    "order.confirmed":        { libelle: "Commande confirmée", acteur: "business", verbe: "observe" },
    "order.cancelled":        { libelle: "Commande annulée", acteur: "business", verbe: "observe" },
    "commande.creee.boutique": { libelle: "Commande passée en boutique", acteur: "business", verbe: "observe" },
    "shop.connected":         { libelle: "Boutique connectée", acteur: "business", verbe: "observe" },
    "shop.uninstalled":       { libelle: "Boutique déconnectée", acteur: "business", verbe: "observe" },
    "carte.activated":        { libelle: "Carte activée", acteur: "business", verbe: "observe" },
    "carte.achetee":          { libelle: "Carte achetée", acteur: "business", verbe: "observe" },
    "abonnement.upgraded":    { libelle: "Abonnement changé", acteur: "business", verbe: "observe" },
    "abonnement.cancelled":   { libelle: "Abonnement annulé", acteur: "business", verbe: "observe" },
    "abonnement.paye":        { libelle: "Abonnement payé", acteur: "business", verbe: "observe" },
    "abonnement.demande.ccp": { libelle: "Demande d'abonnement (CCP)", acteur: "business", verbe: "observe" },
    "abonnement.demande.societe": { libelle: "Demande d'abonnement (société)", acteur: "business", verbe: "observe" },
    "premium.ccp.demande":    { libelle: "Demande premium (CCP)", acteur: "business", verbe: "observe" },
    "recharge.samii":         { libelle: "Recharge de crédits", acteur: "business", verbe: "observe" },
    "recharge.samii.echec":   { libelle: "Recharge échouée", acteur: "business", verbe: "observe", etat: "echec" },
    "tracking.activated":     { libelle: "Suivi de colis activé", acteur: "business", verbe: "observe" },
    "grade.points":           { libelle: "Points de grade", acteur: "business", verbe: "observe" },
    "feedback":               { libelle: "Avis donné sur une réponse", acteur: "business", verbe: "observe" },
    "youtube.publication":    { libelle: "Publication YouTube", acteur: "business", verbe: "observe" },
    // Les treize actions qui s'affichaient avec leur identifiant technique,
    // relevées en balayant le code. Toutes côté business : ce sont des gestes
    // que quelqu'un a faits, pas du travail que SAMII a produit.
    "academie.besoin.publie":   { libelle: "Besoin publié à l'Academy", acteur: "business", verbe: "observe" },
    "academie.besoin.reponse":  { libelle: "Réponse à un besoin", acteur: "business", verbe: "observe" },
    "academie.contrat.accepte": { libelle: "Contrat Academy accepté", acteur: "business", verbe: "observe" },
    "agence.client.cree":       { libelle: "Client d'agence créé", acteur: "business", verbe: "observe" },
    "app.installee":            { libelle: "Application installée", acteur: "business", verbe: "observe" },
    "app.revoquee":             { libelle: "Application révoquée", acteur: "business", verbe: "observe" },
    "facebook.comment":         { libelle: "Commentaire Facebook", acteur: "business", verbe: "observe" },
    "facebook.review":          { libelle: "Avis Facebook", acteur: "business", verbe: "observe" },
    "instagram.comment":        { libelle: "Commentaire Instagram", acteur: "business", verbe: "observe" },
    "whatsapp.message":         { libelle: "Message WhatsApp", acteur: "business", verbe: "observe" },
    "error.whatsapp.message":   { libelle: "Message WhatsApp en échec", acteur: "business", verbe: "observe", etat: "echec" },
    "google.permission_manquante": { libelle: "Permission Google manquante", acteur: "business", verbe: "observe", etat: "echec" },
    "meta.permission_manquante":   { libelle: "Permission Meta manquante", acteur: "business", verbe: "observe", etat: "echec" },

    // ── CE QUE SAMII A PRODUIT, HORS OUTILS DU CHAT ──────────────────────
    //
    // ⚠️ `stock.low` ET `stock.empty` SONT LE CŒUR DU MODÈLE.
    //
    // Le stock qui baisse appartient au business. Mais cette ligne n'est pas
    // le stock : c'est le FAIT DE L'AVOIR REPÉRÉ, par un moteur qui tourne
    // sans qu'on le lui demande. C'est une détection, et elle est à SAMII.
    "stock.low":            { libelle: "Stock bas repéré", acteur: "samii", verbe: "detecte" },
    "stock.empty":          { libelle: "Rupture de stock repérée", acteur: "samii", verbe: "detecte" },
    "autopost.publication": { libelle: "Publication automatique partie", acteur: "samii", verbe: "agit" },
    "autopost.impossible":  { libelle: "Publication automatique impossible", acteur: "samii", verbe: "agit", etat: "echec" },
    "abonnement.expire":    { libelle: "Échéance d'abonnement repérée", acteur: "samii", verbe: "detecte" },
};

// ── LE CANAL DIT QUI A AGI ───────────────────────────────────────────────
//
// Le bus écrit `order.created.${source}` et `rdv.created.${source}`. La
// source est DANS LE NOM : `shopify` et `boutique` sont le business, `chat`
// et `telegram` sont SAMII — c'est lui qui a tenu la conversation.
//
// C'est ce qui permet de NE PAS écrire une seconde ligne pour les quatre
// outils de commerce (voir `config/traces.js`, `tracer: false`) : la ligne
// métier dit déjà que SAMII a agi. Une trace de plus aurait fait apparaître
// le même fait deux fois.
const CANAUX_DE_SAMII = ["chat", "telegram", "whatsapp", "instagram", "messenger"];

const RACINES_A_CANAL = ["order.created", "order.confirmed", "order.cancelled",
                         "rdv.created", "rdv.confirmed", "rdv.cancelled"];

function parCanal(action) {
    const brut = String(action || "");
    for (const racine of RACINES_A_CANAL) {
        if (!brut.startsWith(racine + ".")) continue;
        const canal = brut.slice(racine.length + 1);
        const base = ACTIONS[racine];
        return {
            libelle: base ? `${base.libelle} (${canal})` : brut,
            acteur: CANAUX_DE_SAMII.includes(canal) ? "samii" : "business",
            verbe: CANAUX_DE_SAMII.includes(canal) ? "agit" : "observe",
        };
    }
    return null;
}

// ── LIRE UNE ACTION, D'OÙ QU'ELLE VIENNE ─────────────────────────────────
//
// Trois chemins, dans cet ordre : une trace de SAMII (préfixe `samii.`), une
// action métier connue, une action à canal. Tout le reste retombe côté
// business avec son identifiant brut — honnête, et jamais attribué à SAMII.
function lire(action) {
    const trace = TRACES.lireAction(action);
    if (trace) return trace;

    const connue = ACTIONS[String(action || "")];
    if (connue) {
        return {
            acteur: connue.acteur, verbe: connue.verbe,
            etat: connue.etat || "reussi", libelle: connue.libelle, outil: null,
        };
    }

    const canal = parCanal(action);
    if (canal) return { ...canal, etat: "reussi", outil: null };

    return {
        acteur: "business", verbe: "observe", etat: "reussi",
        libelle: String(action || "Action inconnue"), outil: null,
    };
}

// ── LES ÉTATS DES DEUX AUTRES SOURCES ────────────────────────────────────
//
// Un état inconnu rend `null` — l'élément n'est alors pas montré du tout,
// plutôt que rangé au hasard dans « réussi », ce qui ferait croire à un
// travail fait.
const ETAT_MISSION = {
    attente:  "en_cours",
    en_cours: "en_cours",
    terminee: "reussi",
    echouee:  "echec",
    annulee:  "echec",
};

const ETAT_PUBLICATION = {
    scheduled:  "en_cours",
    publishing: "en_cours",
    published:  "reussi",
    failed:     "echec",
    cancelled:  "echec",
    // draft / review / approved : pas encore programmées. Les montrer ferait
    // croire que quelque chose tourne.
};

// ── LE LIBELLÉ NE RÉPÈTE PAS LE DÉTAIL ───────────────────────────────────
//
// Trouvé en ouvrant la page : le registre nomme l'action (« Commande
// confirmée sur Telegram ») et le journal porte la phrase du moteur
// (« Commande confirmée sur Telegram : CMD-119 »). La seule information neuve
// était « CMD-119 », noyée dans une répétition.
//
// On ne retire QUE le libellé exact, en tête, suivi d'un séparateur. Une
// phrase qui ne commence pas par lui passe intacte : deviner serait pire que
// répéter, parce qu'une ligne de journal se lit pour savoir ce qui s'est
// passé.
function sansRedite(titre, detail) {
    const t = String(titre || "").trim();
    const d = String(detail || "").trim();
    if (!t || !d) return d;
    if (d.toLowerCase().indexOf(t.toLowerCase()) !== 0) return d;
    return d.slice(t.length).replace(/^[\s:—–-]+/, "").trim();
}

// ══════════════════════════════════════════════════════════════════════════
// UNE SEULE FORME POUR TOUT CE QUI S'AFFICHE
// ══════════════════════════════════════════════════════════════════════════
//
// Trois sources, une forme, un peintre. Trois rendus pour trois formes, c'est
// trois endroits où l'un d'eux oublie d'échapper un texte.
function element({ source, acteur = "business", verbe = "observe", etat = "reussi",
                   titre, detail = "", quand = null, progression = null,
                   erreur = null, refId = null, conversationId = null, gestes = [] }) {
    return {
        source, acteur, verbe, etat,
        // Le mot qu'on AFFICHE, distinct de l'identifiant qu'on filtre : le
        // gabarit ne doit pas avoir à savoir comment s'accentue un verbe.
        verbeLisible: TRACES.libelleVerbe(verbe),
        titre: String(titre || ""),
        detail: sansRedite(titre, detail),
        quand: quand ? new Date(quand).toISOString() : null,
        progression,
        erreur: erreur ? String(erreur) : null,
        refId: refId ? String(refId) : null,
        conversationId: conversationId ? String(conversationId) : null,
        gestes,
    };
}

// ── LE GESTE SUIVANT — SEULEMENT CEUX QUI EXISTENT VRAIMENT ──────────────
//
// « voir · reprendre · annuler · relancer · voir résultat · ouvrir dans le
// Chat. » Mesuré, de ces six, trois seulement ont une route derrière :
//
//   annuler        POST /api/missions/:id/annuler   ✅ existe, jamais branché
//   voir résultat  GET  /api/missions/:id           ✅ rend `resultat` si terminée
//   ouvrir le Chat /?tour=<id>                      ✅ depuis ce chantier
//
// « reprendre » et « relancer » n'ont AUCUNE route. Poser les boutons quand
// même aurait donné trois boutons morts sur une page qui existe justement
// pour rendre le travail visible. On ne les met pas ; le jour où la route
// existera, une ligne ici les fera apparaître.
function gestesDe({ source, etat, id, resultat, lien, conversationId }) {
    const g = [];
    if (source === "mission" && etat === "en_cours" && id) {
        g.push({ libelle: "Arrêter", type: "annuler", cible: `/api/missions/${id}/annuler` });
    }
    if (source === "mission" && etat === "reussi" && resultat && id) {
        g.push({ libelle: "Voir le résultat", type: "resultat", cible: `/api/missions/${id}` });
    }
    if (source === "publication" && lien) {
        g.push({ libelle: "Voir la publication", type: "lien", cible: lien });
    }
    if (conversationId) {
        g.push({ libelle: "Ouvrir dans le Chat", type: "chat", cible: `/?tour=${encodeURIComponent(conversationId)}` });
    }
    return g;
}

// ── LE JOURNAL DU QG ─────────────────────────────────────────────────────
//
// ⚠️ LE FILTRE N'EST PAS OPTIONNEL. Sans `workspaceId`, on ne lance AUCUNE
// requête — on ne lit pas « tout le journal ». Une table sans filtre est
// globale par défaut.
async function lireJournal(workspaceId, limite) {
    if (!workspaceId) return [];
    try {
        const lignes = await db.query(
            `SELECT action, details, montant, created_at, ref_id, conversation_id
               FROM journal
              WHERE workspace_id = $1
              ORDER BY created_at DESC, id DESC
              LIMIT $2`,
            [String(workspaceId), limite]
        );
        return lignes.map((l) => {
            const q = lire(l.action);
            return element({
                source: "journal",
                acteur: q.acteur, verbe: q.verbe, etat: q.etat,
                titre: q.libelle,
                detail: l.details || "",
                quand: l.created_at,
                refId: l.ref_id,
                conversationId: l.conversation_id,
                gestes: gestesDe({ source: "journal", conversationId: l.conversation_id }),
            });
        });
    } catch (err) {
        console.error("❌ activite.lireJournal :", err.message);
        return [];
    }
}

// Le nom lisible d'une mission vient de `config/agents.js`, qui la déclare.
function libelleMission(id) {
    try {
        return require("../config/agents").mission(id)?.libelle || String(id || "Mission");
    } catch {
        return String(id || "Mission");
    }
}

// ── LES MISSIONS LONGUES ─────────────────────────────────────────────────
//
// On passe par `missionsLongues.lister()`, qui filtre DÉJÀ sur `user_id` ET
// `workspace_id`. Réécrire la requête ici en aurait fait une seconde, qui
// aurait divergé le jour où l'une des deux change.
async function lireMissions({ userId, workspaceId }, limite) {
    if (!userId && !workspaceId) return [];
    try {
        const lignes = await require("./missionsLongues").lister({ userId, workspaceId, limite });
        return lignes.map((m) => {
            const etat = ETAT_MISSION[String(m.etat || "")] || null;
            if (!etat) return null;
            return element({
                source: "mission",
                acteur: "samii", verbe: "execute", etat,
                titre: libelleMission(m.mission),
                quand: m.fin_le || m.debut_le || m.created_at,
                progression: { etape: Number(m.etape) || 0, total: Number(m.etapes_total) || 0 },
                erreur: m.erreur || null,
                conversationId: m.conversation_id || null,
                gestes: gestesDe({
                    source: "mission", etat, id: m.id,
                    resultat: etat === "reussi",
                    conversationId: m.conversation_id,
                }),
            });
        }).filter(Boolean);
    } catch (err) {
        console.error("❌ activite.lireMissions :", err.message);
        return [];
    }
}

// ── LES PUBLICATIONS PROGRAMMÉES ─────────────────────────────────────────
async function lirePublications(workspaceId, limite) {
    if (!workspaceId) return [];
    try {
        const lignes = await require("./socialStore").listerPublications({ workspaceId, limite });
        return lignes.map((p) => {
            const etat = ETAT_PUBLICATION[String(p.statut || "")] || null;
            if (!etat) return null;
            return element({
                source: "publication",
                acteur: "samii",
                verbe: etat === "en_cours" ? "prepare" : "agit",
                etat,
                titre: p.titre || "Publication",
                detail: p.plateforme || p.v_plateforme || "",
                quand: p.publiee_le || p.programmee_le || p.created_at,
                erreur: p.erreur || null,
                gestes: gestesDe({ source: "publication", etat, lien: p.externe_url || null }),
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
// UNE liste, `fil`. Chaque élément y figure UNE SEULE FOIS — c'est vrai par
// construction, puisqu'il n'y a qu'une liste où le mettre.
//
// `enCours` n'est PAS une seconde liste : c'est une VUE des éléments du fil
// qui tournent encore, épinglée en haut pour qu'on ne la cherche pas. Le
// gabarit les marque comme déjà vus et ne les repeint pas dans le fil.
async function pour({ workspaceId = null, userId = null, limite = 60 } = {}) {
    const n = Math.min(Math.max(Number(limite) || 60, 1), 200);

    const [journal, missions, publications] = await Promise.all([
        lireJournal(workspaceId, n),
        lireMissions({ userId, workspaceId }, n),
        lirePublications(workspaceId, n),
    ]);

    const fil = [...journal, ...missions, ...publications].sort(recent).slice(0, n);
    const enCours = fil.filter((e) => e.etat === "en_cours");

    // Les compteurs des filtres sont calculés ICI, sur la liste réellement
    // rendue. Les compter dans le gabarit aurait voulu dire les recompter à
    // chaque rendu, et se tromper d'un le jour où la liste est tronquée.
    const compteurs = {
        tout:     fil.length,
        samii:    fil.filter((e) => e.acteur === "samii").length,
        business: fil.filter((e) => e.acteur === "business").length,
        enCours:  enCours.length,
        echecs:   fil.filter((e) => e.etat === "echec").length,
    };

    return { fil, enCours, compteurs, vide: fil.length === 0 };
}

module.exports = {
    pour, ACTIONS, ETAT_MISSION, ETAT_PUBLICATION, CANAUX_DE_SAMII,
    lire, sansRedite, element, gestesDe, libelleMission, parCanal,
    lireJournal, lireMissions, lirePublications,
};
