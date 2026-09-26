// ==========================================================================
// SAMII OS — JOURNAL — écriture centralisée, jamais bloquante
// Un seul point d'écriture pour la table `journal`, pour deux raisons :
// 1) éviter de dupliquer la logique de secours dans chaque appelant si les
//    colonnes montant/ref_id n'existent pas encore en base (migration pas
//    encore lancée sur cet environnement — voir scripts/alter-journal.js) ;
// 2) une écriture de journal ne doit jamais faire planter l'action métier
//    qu'elle accompagne (créer une commande, confirmer un paiement...).
// ==========================================================================
const db = require("./db");

let colonnesEtenduesDisponibles = true;

// ══════════════════════════════════════════════════════════════════════════
// LE GARDE-FOU — POURQUOI UN APPEL MAL FORMÉ DOIT CRIER, PAS ÉCRIRE
// ══════════════════════════════════════════════════════════════════════════
//
// ⚠️ MESURÉ EN PRODUCTION, PENDANT LE CHANTIER F.
//
// Cette fonction prend UN OBJET. `engines/automationEngine.js` l'appelait en
// POSITIONNEL — `log(e.shop, "💰 Commande payée : 42")` — sur QUATORZE de ses
// écritures. JavaScript ne s'en plaint pas : il déstructure la chaîne
// « qg-xxx », n'y trouve ni `action` ni `workspaceId`, et insère :
//
//     { action: null, details: "", workspace_id: null }
//
// Exécuté côte à côte contre une vraie base, les deux formes :
//
//     log({action:"order.paid", details:"Commande #42", workspaceId:"qg-1"})
//       → { action: "order.paid", details: "Commande #42", workspace_id: "qg-1" }
//     log("qg-1", "✅ Boutique connectée")
//       → { action: null,         details: "",            workspace_id: null }
//
// Et ce sont les lignes les plus précieuses qui partaient blanches :
// commande créée, payée, expédiée, annulée, stock bas, carte activée,
// abonnement modifié. Elles s'écrivaient à chaque commande, depuis toujours,
// sans qu'aucune erreur n'apparaisse nulle part.
//
// ── POURQUOI ON REFUSE AU LIEU DE DEVINER ────────────────────────────────
//
// On aurait pu rattraper la forme positionnelle : les quatorze appels
// avaient tous la même — `(workspaceId, details)`. C'est précisément ce qui
// la rend dangereuse : ça marche jusqu'au premier appelant qui les met dans
// l'autre ordre, et ce jour-là on écrit un journal FAUX au lieu d'un journal
// VIDE. Un journal se lit pour comprendre ce qui s'est passé ; une ligne
// devinée y est pire qu'une ligne absente.
//
// Donc : on n'écrit pas, et on le dit fort. C'est l'idiome de
// `config/audiences.js` — fermé par défaut, et bruyamment. Un refus muet se
// découvre trop tard, et toujours par la mauvaise personne.
//
// ── ET ON NE LÈVE JAMAIS ─────────────────────────────────────────────────
//
// La règle 2 de l'en-tête de ce fichier tient : une écriture de journal ne
// doit jamais faire tomber l'action métier qu'elle accompagne. Un appel mal
// formé repart donc normalement, sans ligne et avec une erreur en console.
function log(entree, ...positionnels) {
    if (positionnels.length || typeof entree !== "object" || entree === null || Array.isArray(entree)) {
        console.error(
            "❌ journalService.log attend UN OBJET — `log({ action, details, workspaceId })`. "
            + `Reçu ${positionnels.length + 1} argument(s), le premier de type ${Array.isArray(entree) ? "array" : typeof entree}. `
            + "Aucune ligne écrite : une ligne de journal devinée vaut moins que pas de ligne du tout."
        );
        return Promise.resolve(false);
    }

    // Une ligne sans `action` est invisible : rien ne peut la classer, la
    // filtrer ni la compter. C'est exactement ce que produisait l'appel
    // positionnel, et c'est donc la seconde moitié de la même garde.
    if (!entree.action) {
        console.error(
            "❌ journalService.log : `action` est vide — une ligne sans action ne peut être ni lue ni classée. "
            + `details = ${JSON.stringify(String(entree.details || "").slice(0, 60))}`
        );
        return Promise.resolve(false);
    }

    return ecrire(entree);
}

// action, details, workspaceId : toujours écrits. montant/refId/userId :
// optionnels, écrits seulement si les colonnes existent (repli auto sinon).
async function ecrire({ action, details = "", workspaceId = null, userId = null, montant = null, refId = null }) {
    if (colonnesEtenduesDisponibles) {
        try {
            await db.query(
                `INSERT INTO journal (action, details, workspace_id, user_id, montant, ref_id) VALUES ($1, $2, $3, $4, $5, $6)`,
                [action, details, workspaceId, userId, montant, refId]
            );
            return true;
        } catch (err) {
            // 42703 = colonne inexistante (Postgres) : migration pas encore
            // appliquée sur cet environnement. On bascule en mode compatible
            // pour le reste du process, sans jamais faire échouer l'appelant.
            if (err.code === "42703") {
                colonnesEtenduesDisponibles = false;
                console.warn("⚠️ journal.montant/ref_id absents en base — lance `node scripts/alter-journal.js`. Écriture en mode compatible en attendant.");
            } else {
                console.error("❌ journalService.log :", err.message);
                return false;
            }
        }
    }

    try {
        await db.query(
            `INSERT INTO journal (action, details, workspace_id, user_id) VALUES ($1, $2, $3, $4)`,
            [action, details, workspaceId, userId]
        );
        return true;
    } catch (err) {
        console.error("❌ journalService.log (mode compatible) :", err.message);
        return false;
    }
}

module.exports = { log };
