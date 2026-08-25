// ==========================================================================
// SAMII OS — Tests du bus d'événements
//
// Le bus est devenu le passage obligé de tout ce qui sort de SAMII : QG en
// direct, journal, notification, partenaires. Une régression ici ne se voit
// pas — elle se traduit par un partenaire qui ne reçoit plus rien, en
// silence, pendant des semaines. D'où ces tests.
//
// Lancer :  npm test
// ==========================================================================
const assert = require("assert");
const path = require("path");
const RACINE = path.join(__dirname, "..");

const recu = { socket: [], journal: [], partenaire: [], notif: [] };
let enPanne = null;

function remplacer(chemin, exports) {
    const r = require.resolve(path.join(RACINE, chemin));
    require.cache[r] = { id: r, filename: r, loaded: true, exports };
}
remplacer("services/socketService", {
    emitToShop: (ws, nom, d) => {
        if (enPanne === "socket") throw new Error("socket indisponible");
        recu.socket.push({ ws, nom, d });
    },
});
remplacer("services/journalService", {
    log: async (l) => {
        if (enPanne === "journal") throw new Error("journal indisponible");
        recu.journal.push(l);
    },
});
remplacer("services/notify", {
    notifyWorkspace: async (ws, p) => {
        if (enPanne === "notif") throw new Error("notifications indisponibles");
        recu.notif.push({ ws, p });
    },
});
remplacer("services/apiPartenaire", {
    EVENEMENTS: ["commande.creee","commande.confirmee","commande.annulee",
                 "rendezvous.cree","rendezvous.confirme","rendezvous.annule","message.recu"],
    emettre: async (ws, ev, d) => {
        if (enPanne === "partenaire") throw new Error("partenaires indisponibles");
        recu.partenaire.push({ ws, ev, d });
    },
});

const bus = require(path.join(RACINE, "services/evenements"));
const pause = (ms = 40) => new Promise(r => setTimeout(r, ms));

const cas = [];
const verifier = (titre, ok, detail = "") => cas.push({ titre, ok, detail });

(async () => {
    // 1. Un événement atteint les quatre destinataires d'un seul appel.
    bus.publier("WS-1", "commande.creee",
        { id: "TG-1", nomClient: "Yacine", produit: "Veste", montant: 8500, source: "telegram" });
    await pause();
    verifier("le QG reçoit le nom historique de l'événement",
        recu.socket[0]?.nom === "nouvelle-commande", recu.socket[0]?.nom);
    verifier("le partenaire est prévenu", recu.partenaire[0]?.ev === "commande.creee");
    verifier("le journal porte l'action et la référence",
        recu.journal[0]?.action === "order.created.telegram" && recu.journal[0]?.refId === "TG-1");
    verifier("le montant part au journal (chiffre d'affaires du QG)",
        recu.journal[0]?.montant === 8500);
    verifier("le marchand est notifié", recu.notif[0]?.p.title === "🛒 Nouvelle commande");

    // 2. Mode silencieux : le marchand agit lui-même, inutile de le notifier.
    recu.notif.length = 0;
    bus.publier("WS-1", "commande.confirmee", { id: "TG-1" }, { silencieux: true });
    await pause();
    verifier("silencieux : aucune notification poussée", recu.notif.length === 0);

    // 3. Les sept types du catalogue sont bien câblés.
    verifier("le catalogue couvre 7 événements", bus.TYPES.length === 7, bus.TYPES.join(", "));

    // 4. Garde-fous : un type inconnu ou un espace vide ne doit rien émettre
    //    plutôt que d'émettre n'importe quoi.
    const avant = recu.socket.length;
    bus.publier("WS-1", "type.inexistant", {});
    bus.publier("", "commande.creee", { id: 1 });
    await pause(20);
    verifier("type inconnu et espace vide : rien n'est envoyé", recu.socket.length === avant);

    // 5. Isolation des pannes : une commande ne doit jamais échouer parce
    //    qu'un destinataire est tombé.
    for (const cible of ["socket", "journal", "partenaire", "notif"]) {
        enPanne = cible;
        const av = { s: recu.socket.length, j: recu.journal.length, p: recu.partenaire.length };
        let aJete = false;
        try { bus.publier("WS-2", "commande.creee", { id: "X", nomClient: "T" }); }
        catch { aJete = true; }
        await pause();
        const servis = (recu.socket.length > av.s) + (recu.journal.length > av.j) + (recu.partenaire.length > av.p);
        verifier(`${cible} en panne : rien n'explose, les autres sont servis`, !aJete && servis >= 2, `${servis}/3`);
    }
    enPanne = null;

    for (const c of cas) console.log(`${c.ok ? "✓" : "✗"}  ${c.titre}${c.ok || !c.detail ? "" : " → " + c.detail}`);
    const echecs = cas.filter(c => !c.ok);
    console.log(`\n${cas.length - echecs.length}/${cas.length} vérifications passées`);
    assert.strictEqual(echecs.length, 0, `${echecs.length} test(s) en échec`);
    process.exit(0);
})().catch(e => { console.error("\n❌", e.message); process.exit(1); });
