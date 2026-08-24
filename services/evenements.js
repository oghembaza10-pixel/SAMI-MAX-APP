// ==========================================================================
// SAMII OS — BUS D'ÉVÉNEMENTS
//
// Le problème qu'il résout : à chaque endroit où une commande ou un
// rendez-vous change d'état, le code répétait à la main quatre gestes —
// écrire au journal, prévenir le QG en direct, notifier le marchand,
// prévenir les partenaires abonnés. Quatre lignes à ne pas oublier, dans
// une vingtaine de fichiers. On en oublie : c'est exactement comme ça que
// les rendez-vous pris par créneau Telegram n'atteignaient aucun partenaire.
//
// Ici, l'appelant dit UNE chose — « il s'est passé ceci » — et le bus décide
// qui prévenir, à partir du CATALOGUE ci-dessous.
//
//     evenements.publier(workspaceId, "commande.creee", { id, nomClient, ... });
//
// Trois règles de conception, à respecter si tu ajoutes un événement :
//
//   1. LES NOMS SOCKET NE CHANGENT PAS. Le QG écoute des noms précis
//      ("nouvelle-commande", "rdv-confirme"...). Les renommer casserait le
//      temps réel en silence : ça marcherait en développement et plus rien
//      ne bougerait chez le marchand. Le catalogue les conserve tels quels.
//
//   2. RIEN N'EST BLOQUANT. Une commande ne doit jamais échouer parce que le
//      journal, une notification ou le n8n d'une agence a un problème. Chaque
//      destinataire est isolé : s'il tombe, les autres sont servis quand même.
//
//   3. LE BUS N'ÉCRIT PAS EN BASE. Il ne fait que raconter ce qui vient de se
//      produire. L'appelant a déjà fait l'INSERT ou l'UPDATE — sinon on aurait
//      deux endroits qui décident de la vérité.
// ==========================================================================
const journalService = require("./journalService");
const socketService = require("./socketService");
const notify = require("./notify");
const apiPartenaire = require("./apiPartenaire");

// ── CATALOGUE ────────────────────────────────────────────────────────────
// Pour chaque événement métier : qui est prévenu, et sous quelle forme.
//   socket       — nom écouté par le QG (NE PAS RENOMMER, voir règle 1)
//   partenaire   — nom public de l'API, tel que documenté sur /api-docs
//   journal      — action + libellé lisible dans l'activité du marchand
//   notification — poussée sur le téléphone du marchand, si elle a un sens
const CATALOGUE = {
    "commande.creee": {
        socket: "nouvelle-commande",
        partenaire: "commande.creee",
        journal: (d) => ({
            action: `order.created.${d.source || "chat"}`,
            details: `#${d.id} — ${d.nomClient || "Client"}`,
        }),
        notification: (d) => ({
            title: "🛒 Nouvelle commande",
            body: `${d.nomClient || "Client"} — ${d.produit || ""}`.trim(),
            url: "/qg",
        }),
    },
    "commande.confirmee": {
        socket: "commande-confirmee",
        partenaire: "commande.confirmee",
        journal: (d) => ({ action: "order.confirmed", details: `#${d.id}` }),
    },
    "commande.annulee": {
        socket: "commande-annulee",
        partenaire: "commande.annulee",
        journal: (d) => ({ action: "order.cancelled", details: `#${d.id}` }),
    },
    "rendezvous.cree": {
        socket: "nouveau-rdv",
        partenaire: "rendezvous.cree",
        journal: (d) => ({
            action: `rdv.created.${d.source || "chat"}`,
            details: `#${d.id} — ${d.clientNom || "Client"}`,
        }),
        notification: (d) => ({
            title: "📅 Nouveau rendez-vous",
            body: `${d.clientNom || "Client"} — ${d.motif || ""}`.trim(),
            url: "/qg",
        }),
    },
    "rendezvous.confirme": {
        socket: "rdv-confirme",
        partenaire: "rendezvous.confirme",
        journal: (d) => ({ action: "rdv.confirmed", details: `#${d.id}` }),
    },
    "rendezvous.annule": {
        socket: "rdv-annule",
        partenaire: "rendezvous.annule",
        journal: (d) => ({ action: "rdv.cancelled", details: `#${d.id}` }),
    },
    "message.recu": {
        socket: "whatsapp.message",
        partenaire: "message.recu",
        journal: (d) => ({
            action: `${d.canal || "chat"}.message`,
            details: `${d.nom || "Client"}: ${d.message || ""}`,
        }),
    },
};

/**
 * Raconte au reste du système ce qui vient de se produire.
 *
 * @param {string} workspaceId  espace concerné — sans lui, on ne sait qui prévenir
 * @param {string} type         clé du CATALOGUE, ex. "commande.creee"
 * @param {object} donnees      ce que les destinataires reçoivent
 * @param {object} [options]
 * @param {boolean} [options.silencieux]  n'envoie pas la notification poussée
 *        (utile quand le marchand est lui-même à l'origine du changement :
 *        inutile de lui vibrer dans la poche pour son propre clic)
 * @param {object} [options.socketDonnees]  charge utile socket si elle doit
 *        différer de `donnees` (compatibilité avec l'existant)
 */
function publier(workspaceId, type, donnees = {}, options = {}) {
    const regle = CATALOGUE[type];
    if (!regle) {
        console.warn(`⚠️ evenements.publier : type inconnu « ${type} » — rien envoyé.`);
        return;
    }
    if (!workspaceId) {
        console.warn(`⚠️ evenements.publier : « ${type} » sans workspaceId — rien envoyé.`);
        return;
    }

    // Chaque destinataire est isolé : un journal en panne ne doit pas priver
    // le partenaire de son webhook, ni l'inverse.
    if (regle.socket) {
        try {
            socketService.emitToShop(workspaceId, regle.socket, options.socketDonnees || donnees);
        } catch (err) {
            console.error(`❌ bus[${type}] socket :`, err.message);
        }
    }

    if (regle.journal) {
        const ligne = regle.journal(donnees);
        journalService.log({
            ...ligne,
            workspaceId,
            refId: donnees.id ? String(donnees.id) : null,
            // Le journal sait porter un montant : c'est ce qui alimente le
            // chiffre d'affaires du QG. On le transmet quand l'événement en a
            // un, pour ne rien perdre de ce que faisaient les appels directs.
            montant: typeof donnees.montant === "number" ? donnees.montant : null,
        }).catch(err => console.error(`❌ bus[${type}] journal :`, err.message));
    }

    if (regle.partenaire) {
        Promise.resolve(apiPartenaire.emettre(workspaceId, regle.partenaire, donnees))
            .catch(err => console.error(`❌ bus[${type}] partenaire :`, err.message));
    }

    if (regle.notification && !options.silencieux) {
        Promise.resolve(notify.notifyWorkspace(workspaceId, regle.notification(donnees)))
            .catch(err => console.error(`❌ bus[${type}] notification :`, err.message));
    }
}

module.exports = { publier, CATALOGUE, TYPES: Object.keys(CATALOGUE) };
