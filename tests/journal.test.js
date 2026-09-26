// ==========================================================================
// SAMII OS — LE JOURNAL ÉCRIT-IL VRAIMENT CE QU'ON CROIT LUI DIRE ?
// ==========================================================================
//
// POURQUOI CETTE SUITE EXISTE. Mesuré pendant le chantier F, contre une vraie
// base : QUATORZE des cinquante-deux écritures du journal inséraient une
// ligne vide. `services/journalService.js` prend UN OBJET ;
// `engines/automationEngine.js` l'appelait en POSITIONNEL :
//
//     journalService.log(e.shop, "💰 Commande payée : 42")
//       → INSERT { action: null, details: "", workspace_id: null }
//
// JavaScript ne s'en plaint pas. Il déstructure la chaîne, n'y trouve aucune
// des clés attendues, et écrit des `null`. Aucune exception, aucun log,
// aucune alerte — depuis toujours, à chaque commande.
//
// Et c'étaient les lignes les plus précieuses : commande créée, payée,
// expédiée, livrée, confirmée, annulée, stock bas, stock épuisé, boutique
// connectée, carte activée, abonnement modifié.
//
// ── LE SECOND DÉFAUT, DERRIÈRE LE PREMIER ────────────────────────────────
//
// `e.shop` est le domaine Shopify. Le QG est un AUTRE identifiant, obtenu par
// `getWorkspaceIdForShop()`. Corriger seulement la forme de l'appel aurait
// écrit le domaine dans `workspace_id` : les lignes auraient existé, et
// aucune page filtrant par QG ne les aurait trouvées. Un demi-correctif est
// indiscernable d'un correctif — d'où les gardes sur les deux.
//
// CE QU'ON VÉRIFIE.
//   A. Un appel positionnel n'écrit RIEN, et le dit.
//   B. Une ligne sans `action` n'est pas écrite non plus.
//   C. Un appel correct écrit exactement ce qu'on lui a donné.
//   D. La table des automatisations n'a plus un seul appel positionnel, et
//      chaque `action` est le NOM DU DÉCLENCHEUR — aucun vocabulaire neuf.
//   E. Le QG est résolu, et un QG introuvable rend `null`, jamais le domaine.
//
// Ce qu'elle NE peut PAS vérifier : que la base accepte le SQL. Une doublure
// n'exécute pas de requête (règle 3 d'AGENTS.md). C'est le rôle de
// `tests/journal-reel.test.js`, qui écrit dans un vrai Postgres.
//
// Lancer :  npm test
// ==========================================================================
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const RACINE = path.join(__dirname, "..");

let verifs = 0;
const echecs = [];
const verifier = (condition, message) => {
    verifs++;
    if (!condition) echecs.push(message);
};

// ── LA DOUBLURE DE BASE ──────────────────────────────────────────────────
//
// Même idiome que `tests/bus.test.js` : on remplace le module dans le cache
// AVANT que le module testé ne le demande.
function remplacer(chemin, exports) {
    const r = require.resolve(path.join(RACINE, chemin));
    require.cache[r] = { id: r, filename: r, loaded: true, exports };
}

const requetes = [];
remplacer("services/db", {
    query: async (sql, params) => { requetes.push({ sql, params }); return []; },
});

// On coupe aussi le bruit : le garde-fou écrit sur console.error, et c'est
// VOULU. On l'intercepte pour le vérifier, pas pour le faire taire.
const cris = [];
const erreurVraie = console.error;
console.error = (...a) => { cris.push(a.join(" ")); };

const journal = require(path.join(RACINE, "services", "journalService"));

// ══════════════════════════════════════════════════════════════════════════
// A. UN APPEL POSITIONNEL N'ÉCRIT RIEN — LA GARDE DEMANDÉE AU CHANTIER F
// ══════════════════════════════════════════════════════════════════════════
//
// C'est la forme EXACTE qui tournait en production.
(async () => {
    {
        requetes.length = 0; cris.length = 0;
        const rendu = await journal.log("qg-essai", "✅ Boutique connectée");

        verifier(
            requetes.length === 0,
            `un appel positionnel a quand même écrit ${requetes.length} ligne(s) — c'est le défaut du chantier F, revenu`
        );
        verifier(rendu === false, `un appel positionnel rend ${JSON.stringify(rendu)} au lieu de false`);
        verifier(
            cris.some((c) => c.includes("journalService.log")),
            "un appel positionnel est refusé EN SILENCE — c'est précisément ce qui l'a rendu invisible pendant des mois"
        );
    }

    // Et la forme inverse, pour que la garde ne tienne pas par hasard sur
    // l'ordre des arguments : un objet suivi d'un argument de trop.
    {
        requetes.length = 0; cris.length = 0;
        const rendu = await journal.log({ action: "order.paid", workspaceId: "qg-1" }, "détails en trop");
        verifier(requetes.length === 0, "un objet suivi d'un argument positionnel a été écrit — la garde ne compte pas les arguments");
        verifier(rendu === false, "un objet suivi d'un argument positionnel devrait être refusé");
    }

    // Un tableau est un objet pour `typeof` : la garde doit le voir.
    {
        requetes.length = 0;
        const rendu = await journal.log(["order.paid", "qg-1"]);
        verifier(requetes.length === 0, "un tableau a été accepté comme entrée de journal");
        verifier(rendu === false, "un tableau devrait être refusé");
    }

    // ══════════════════════════════════════════════════════════════════════
    // B. UNE LIGNE SANS ACTION N'EST PAS UNE LIGNE
    // ══════════════════════════════════════════════════════════════════════
    //
    // C'est l'autre moitié du même défaut : l'appel positionnel produisait
    // `action: null`. Même si une forme d'appel nous échappait un jour, une
    // ligne sans action ne doit pas entrer — elle ne peut ni se lire, ni se
    // classer, ni se compter.
    {
        requetes.length = 0; cris.length = 0;
        const rendu = await journal.log({ details: "quelque chose", workspaceId: "qg-1" });
        verifier(requetes.length === 0, "une ligne SANS action a été écrite — elle serait invisible dans toute lecture");
        verifier(rendu === false, "une ligne sans action devrait être refusée");
        verifier(cris.some((c) => c.includes("action")), "une ligne sans action est refusée sans le dire");
    }

    // ══════════════════════════════════════════════════════════════════════
    // C. UN APPEL CORRECT ÉCRIT EXACTEMENT CE QU'ON LUI DONNE
    // ══════════════════════════════════════════════════════════════════════
    //
    // Sans ça, les gardes ci-dessus pourraient être satisfaites par une
    // fonction qui refuse TOUT — le pire des correctifs.
    {
        requetes.length = 0;
        const rendu = await journal.log({
            action: "order.paid", details: "Commande #42", workspaceId: "qg-1",
            userId: "u-9", montant: 1500, refId: "42",
        });
        verifier(requetes.length === 1, `un appel correct a produit ${requetes.length} requête(s) au lieu d'une`);
        verifier(rendu === true, `un appel correct rend ${JSON.stringify(rendu)} au lieu de true`);

        const p = requetes[0]?.params || [];
        verifier(/INSERT INTO journal/i.test(requetes[0]?.sql || ""), "l'appel correct n'écrit pas dans la table journal");
        verifier(p[0] === "order.paid", `action écrite : ${JSON.stringify(p[0])}`);
        verifier(p[1] === "Commande #42", `details écrits : ${JSON.stringify(p[1])}`);
        verifier(p[2] === "qg-1", `workspace_id écrit : ${JSON.stringify(p[2])} — c'est la colonne qui décide qui verra la ligne`);
        verifier(p[3] === "u-9", `user_id écrit : ${JSON.stringify(p[3])}`);
    }

    console.error = erreurVraie;

    // ══════════════════════════════════════════════════════════════════════
    // D. LA TABLE DES AUTOMATISATIONS
    // ══════════════════════════════════════════════════════════════════════
    const src = fs.readFileSync(path.join(RACINE, "engines", "automationEngine.js"), "utf8");

    // ── Plus un seul appel positionnel ───────────────────────────────────
    {
        const tous = (src.match(/journalService\.log\(/g) || []).length;
        const enObjet = (src.match(/journalService\.log\(\{/g) || []).length;
        verifier(tous > 0, "engines/automationEngine.js n'écrit plus AUCUNE ligne de journal — cette garde ne mesure plus rien");
        verifier(
            tous === enObjet,
            `engines/automationEngine.js : ${tous - enObjet} appel(s) de journal encore en positionnel — ils écriraient des lignes vides`
        );
    }

    // ── Le QG, jamais le domaine ─────────────────────────────────────────
    //
    // ⚠️ CE DÉCOUPAGE A ÉTÉ ÉCRIT DEUX FOIS.
    //
    // La première version cherchait `log\(\{[^}]*workspaceId` — et elle a crié
    // sur du code juste. `[^}]*` s'arrête au premier `}`, qui est celui d'un
    // `${e.payload.id}` à l'intérieur du texte. Onze appels corrects étaient
    // déclarés orphelins.
    //
    // On compte donc les accolades pour trouver la vraie fin de l'appel.
    // C'est plus long qu'une expression régulière, et c'est le seul moyen de
    // lire un appel qui contient un gabarit.
    const appelsJournal = (() => {
        const trouves = [];
        const marque = "journalService.log({";
        let i = src.indexOf(marque);
        while (i !== -1) {
            let profondeur = 0, j = i + marque.length - 1;
            for (; j < src.length; j++) {
                if (src[j] === "{") profondeur++;
                else if (src[j] === "}") { profondeur--; if (profondeur === 0) break; }
            }
            trouves.push(src.slice(i, j + 1));
            i = src.indexOf(marque, j);
        }
        return trouves;
    })();

    {
        verifier(appelsJournal.length > 0, "aucun appel de journal trouvé dans automationEngine — le découpage est cassé");

        for (const appel of appelsJournal) {
            const action = (appel.match(/action:\s*"([^"]+)"/) || [])[1] || "?";
            verifier(
                !/workspaceId:\s*e\.shop\b/.test(appel),
                `automationEngine « ${action} » passe \`e.shop\` comme workspaceId — c'est le domaine Shopify, pas le QG`
            );
            verifier(
                /workspaceId:\s*e\.workspaceId\b/.test(appel),
                `automationEngine « ${action} » n'a pas \`workspaceId: e.workspaceId\` — sa ligne serait orpheline`
            );
        }
    }

    // ── L'ACTION EST LE NOM DU DÉCLENCHEUR ───────────────────────────────
    //
    // Consigne du chantier : ne pas changer le vocabulaire des événements
    // existants. La table est indexée par déclencheur ; l'action écrite doit
    // être cette clé, pas une phrase réinventée.
    {
        const engine = require(path.join(RACINE, "engines", "automationEngine"));
        const table = engine.automations || {};
        verifier(Object.keys(table).length > 0, "la table des automatisations est vide");

        // On relit la SOURCE et non les fonctions : une lambda ne dit pas ce
        // qu'elle écrira sans qu'on l'exécute, et l'exécuter ferait partir
        // des notifications.
        for (const declencheur of Object.keys(table)) {
            const bloc = src.split(`"${declencheur}": [`)[1];
            if (!bloc) continue;
            const corps = bloc.split("],")[0];
            const m = corps.match(/journalService\.log\(\{\s*action:\s*"([^"]+)"/);
            if (!m) continue;       // ce déclencheur ne journalise pas : normal
            verifier(
                m[1] === declencheur,
                `automationEngine : le déclencheur « ${declencheur} » journalise l'action « ${m[1] }» — le vocabulaire des événements ne doit pas changer`
            );
        }
    }

    // ── LES ONZE ÉVÉNEMENTS DEMANDÉS SONT TOUS COUVERTS ──────────────────
    {
        const attendus = [
            "order.created", "order.paid", "order.fulfilled", "order.delivered",
            "order.confirmed", "order.cancelled", "stock.low", "stock.empty",
            "shop.connected", "carte.activated", "abonnement.upgraded",
        ];
        for (const a of attendus) {
            verifier(
                src.includes(`journalService.log({ action: "${a}"`),
                `automationEngine : l'événement « ${a} » n'écrit plus dans le journal`
            );
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    // E. LA RÉSOLUTION DU QG
    // ══════════════════════════════════════════════════════════════════════
    {
        const engine = require(path.join(RACINE, "engines", "automationEngine"));

        // Un appelant qui connaît déjà son QG est cru sur parole, et on ne
        // relit pas la base pour rien.
        requetes.length = 0;
        verifier(
            await engine.qgDeLEvenement({ shop: "x.myshopify.com", workspaceId: "qg-direct" }) === "qg-direct",
            "qgDeLEvenement ignore le workspaceId que l'appelant lui donne"
        );
        verifier(requetes.length === 0, "qgDeLEvenement relit la base alors que l'appelant lui a donné le QG");

        // Un QG introuvable rend `null` — JAMAIS le domaine en repli. Une
        // ligne rattachée à un faux QG se lit comme vraie ; une ligne
        // orpheline se voit.
        const inconnu = await engine.qgDeLEvenement({ shop: "jamais-vue.myshopify.com" });
        verifier(
            inconnu === null,
            `qgDeLEvenement rend ${JSON.stringify(inconnu)} pour une boutique inconnue — s'il rend le domaine, la ligne paraît rattachée à un QG qui n'existe pas`
        );

        // Sans rien du tout : rien.
        verifier(await engine.qgDeLEvenement({}) === null, "qgDeLEvenement invente un QG à partir d'un événement vide");
        verifier(await engine.qgDeLEvenement(null) === null, "qgDeLEvenement tombe sur un événement absent");
    }

    // ── Verdict ──────────────────────────────────────────────────────────
    if (echecs.length) {
        console.error(`❌ journal : ${echecs.length} problème(s) sur ${verifs} vérifications\n`);
        for (const e of echecs) console.error("   • " + e);
        process.exit(1);
    }
    console.log(`✅ journal : ${verifs} vérifications passées`);
})().catch((err) => {
    console.error = erreurVraie;
    console.error("❌ journal : la suite a levé —", err.message);
    process.exit(1);
});
