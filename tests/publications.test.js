// ==========================================================================
// SAMII OS — Agir sur une publication : qui a le droit, et sur laquelle ?
//
// POURQUOI CE TEST EXISTE. Quatre exigences sont arrivées d'un coup :
// enregistrer, supprimer, modifier, et « chaque utilisateur doit avoir son
// espace ». Trois d'entre elles écrivent ou effacent, et toutes prennent un
// NUMÉRO DE PUBLICATION en paramètre.
//
// C'est exactement la forme du bug qu'on a déjà eu deux fois — dans les
// discussions, puis dans les actions du fil : une route qui fait confiance
// à un identifiant. Les identifiants se suivent, il n'y a rien à deviner.
//
// CE QUI EST VÉRIFIÉ.
//   1. Toute action filtre par communauté. On ne modifie ni ne supprime la
//      publication d'une autre communauté, même en visant juste.
//   2. Supprimer et modifier sont refusés à qui n'est ni l'auteur ni
//      l'administratrice de CETTE communauté — refusés PAR LE SERVEUR, pas
//      seulement par un bouton caché.
//   3. « Mon espace » ne montre que ses publications à soi, et se compare à
//      la session, jamais à un identifiant fourni par la page.
//
// Lancer :  npm test
// ==========================================================================
const path = require("path");
const RACINE = path.join(__dirname, "..");
const communautes = require(path.join(RACINE, "config", "communautes"));

let verifs = 0;
const echecs = [];
const verifier = (ok, message) => { verifs++; if (!ok) echecs.push(message); };

const REQUETES = [];
let PUBLICATION = null;   // ce que la base rend pour « charger la publication »

const Module = require("module");
const vraiRequire = Module.prototype.require;
Module.prototype.require = function (nom) {
    if (nom === "../services/db") return {
        query: async (q, p) => {
            REQUETES.push({ sql: q, params: p || [] });
            if (/SELECT \* FROM publications\s+WHERE id/i.test(q)) return PUBLICATION ? [PUBLICATION] : [];
            if (/INSERT INTO publications_enregistrees/i.test(q)) return [{ id: 1 }];
            return [];
        },
    };
    if (nom === "../services/socketService") return { emitToUser: () => {}, emitToShop: () => {} };
    if (nom === "../brain/planner") return { ask: async () => "ok" };
    return vraiRequire.apply(this, arguments);
};
const routeur = require(path.join(RACINE, "routes", "community.js"));
Module.prototype.require = vraiRequire;

const SLUG = "coindudigital";
const COM = communautes.get(SLUG);
const MOI = "u-moi";

function appeler(chemin, corps = {}, session = {}, params = {}) {
    const couche = routeur.stack.find(
        (c) => c.route && c.route.path === chemin && c.route.methods.post);
    if (!couche) return Promise.resolve({ absente: true });
    return new Promise((resolve) => {
        const req = {
            params, body: corps, query: {},
            session: { loggedIn: true, userId: MOI, email: "moi@example.cm", ...session },
        };
        const res = {
            locals: { COM },
            statusCode: 200,
            status(c) { this.statusCode = c; return this; },
            json: (o) => resolve({ statusCode: res.statusCode, ...o }),
            send: (o) => resolve({ statusCode: res.statusCode, corps: o }),
            redirect: () => resolve({ statusCode: 302 }),
        };
        let i = 0;
        const suivant = () => { const h = couche.route.stack[i++]?.handle; if (h) h(req, res, suivant); };
        suivant();
    });
}

(async () => {
    const ACTIONS = [
        ["/enregistrer/:id", {}],
        ["/supprimer/:id", {}],
        ["/modifier/:id", { contenu: "Texte corrigé" }],
        ["/like/:id", {}],
        ["/commenter/:id", { contenu: "Bravo" }],
    ];

    // ── 1. Chaque action lit la publication DANS SA COMMUNAUTÉ ───────────
    for (const [chemin, corps] of ACTIONS) {
        REQUETES.length = 0;
        PUBLICATION = null;   // rien ne correspond : la route doit s'arrêter là
        const r = await appeler(chemin, corps, {}, { id: "1" });
        verifier(!r.absente, `la route ${chemin} n'existe pas`);

        const lecture = REQUETES.find((q) => /FROM publications\b/i.test(q.sql));
        verifier(!!lecture, `${chemin} n'ouvre plus la publication demandée`);
        if (lecture) {
            verifier(/communaute/.test(lecture.sql),
                `${chemin} agit sur une publication par son seul numéro — ses membres touchent NOS publications en tapant un entier`);
            verifier(lecture.params.includes(SLUG),
                `${chemin} filtre, mais pas sur SA communauté (${JSON.stringify(lecture.params)})`);
        }
        // Rien ne doit être écrit quand la publication n'est pas la sienne.
        const ecriture = REQUETES.find((q) => /^\s*(UPDATE|DELETE|INSERT)/i.test(q.sql));
        verifier(!ecriture,
            `${chemin} écrit en base alors que la publication n'appartient pas à cette communauté : ${String(ecriture?.sql).replace(/\s+/g, " ").slice(0, 80)}`);
    }

    // ── 2. Supprimer et modifier : réservés à l'auteur ou à elle ─────────
    // La publication de QUELQU'UN D'AUTRE, dans SA communauté.
    PUBLICATION = { id: 7, auteur_id: "u-quelquun-dautre", communaute: SLUG, contenu: "Son texte" };

    for (const [chemin, corps] of [["/supprimer/:id", {}], ["/modifier/:id", { contenu: "piraté" }]]) {
        REQUETES.length = 0;
        const r = await appeler(chemin, corps, {}, { id: "7" });
        verifier(r.statusCode === 403 && r.success === false,
            `${chemin} laisse n'importe quel membre toucher la publication d'un autre (statut ${r.statusCode})`);
        const ecriture = REQUETES.find((q) => /^\s*(UPDATE|DELETE)/i.test(q.sql));
        verifier(!ecriture,
            `${chemin} a modifié la base pour quelqu'un qui n'en a pas le droit`);
    }

    // L'auteur, lui, passe.
    PUBLICATION = { id: 7, auteur_id: MOI, communaute: SLUG, contenu: "Mon texte" };
    REQUETES.length = 0;
    const modif = await appeler("/modifier/:id", { contenu: "Mon texte corrigé" }, {}, { id: "7" });
    verifier(modif.success === true, `l'auteur ne peut plus modifier sa propre publication (${JSON.stringify(modif)})`);
    const maj = REQUETES.find((q) => /UPDATE publications/i.test(q.sql));
    verifier(!!maj && maj.params.includes("Mon texte corrigé"),
        "la modification n'écrit pas le nouveau texte");
    // La catégorie ne bouge pas : une publication rangée dans « produit »
    // puis basculée ailleurs disparaît des listes où on l'avait trouvée.
    verifier(!!maj && !/categorie/i.test(maj.sql),
        "la modification touche à la catégorie — la publication changerait de rayon sans prévenir");

    // Un texte vide n'efface pas une publication par la bande.
    const vide = await appeler("/modifier/:id", { contenu: "   " }, {}, { id: "7" });
    verifier(vide.success === false, "on peut vider une publication de son texte en la « modifiant »");

    // ── 3. Elle, sur les publications de SA communauté ──────────────────
    PUBLICATION = { id: 9, auteur_id: "u-un-membre", communaute: SLUG, contenu: "Contenu à retirer" };
    const parElle = await appeler("/supprimer/:id", {}, { email: COM.admin }, { id: "9" });
    verifier(parElle.success === true,
        `l'administratrice ne peut pas retirer une publication de sa propre communauté (${JSON.stringify(parElle)})`);

    // Et son adresse tapée avec une majuscule marche aussi — c'est ce que
    // fait un clavier de téléphone.
    const parElleMajuscules = await appeler("/supprimer/:id", {}, { email: String(COM.admin).toUpperCase() }, { id: "9" });
    verifier(parElleMajuscules.success === true,
        "l'administratrice est refusée quand son adresse porte des majuscules");

    // ── 4. « Mon espace » se lit dans la session ────────────────────────
    // Le filtre doit se comparer à l'identifiant de session. S'il acceptait
    // une valeur venue de l'URL, « mon espace » afficherait celui d'un
    // autre — et sur un fil, ça veut dire lire ses brouillons.
    const source = require("fs").readFileSync(path.join(RACINE, "routes", "community.js"), "utf8");
    verifier(/AND \(\$6::boolean IS NULL OR p\.auteur_id = \$1\)/.test(source),
        "le filtre « mon espace » ne se compare plus à l'identifiant de session");
    verifier(!/auteur_id\s*=\s*\$?\{?\s*req\.query/.test(source),
        "le filtre « mon espace » accepte un identifiant fourni dans l'URL — on lirait l'espace de quelqu'un d'autre");

    // ── 5. S'ABONNER À QUELQU'UN ────────────────────────────────────────
    PUBLICATION = { id: 11, auteur_id: "u-une-vendeuse", communaute: SLUG, contenu: "Ma formation" };
    REQUETES.length = 0;
    const abo = await appeler("/abonner/:id", {}, {}, { id: "11" });
    verifier(abo.success === true, `s'abonner ne marche pas (${JSON.stringify(abo)})`);
    const ecrit = REQUETES.find((q) => /INSERT INTO/i.test(q.sql));
    verifier(!!ecrit && ecrit.params.includes("u-une-vendeuse") && ecrit.params.includes(MOI),
        "l'abonnement n'enregistre pas le bon couple (qui suit qui)");
    verifier(!!ecrit && ecrit.params.includes(SLUG),
        "l'abonnement ne porte pas la communauté — un abonnement pris chez elle vaudrait chez nous");

    // On ne s'abonne pas à soi-même : ça n'a aucun sens et ça gonflerait son
    // propre compteur.
    PUBLICATION = { id: 12, auteur_id: MOI, communaute: SLUG, contenu: "Ma publication" };
    REQUETES.length = 0;
    const soi = await appeler("/abonner/:id", {}, {}, { id: "12" });
    verifier(soi.success === false, "on peut s'abonner à soi-même");
    verifier(!REQUETES.find((q) => /INSERT INTO/i.test(q.sql)),
        "un abonnement à soi-même est quand même écrit en base");

    // ── 6. LA COLLISION DE NOMS, ATTRAPÉE DE JUSTESSE ───────────────────
    //
    // La table de cette fonctionnalité s'appelait « abonnements ». Or ce nom
    // était DÉJÀ PRIS, en production, par la facturation : montant, devise,
    // date_fin, identifiant Chargily. Rien à voir avec suivre quelqu'un.
    //
    // CREATE TABLE IF NOT EXISTS ne se plaint pas dans ce cas : il ne fait
    // rien, silencieusement. Les requêtes seraient donc parties contre la
    // table des paiements — et comme le fil lit cette table à chaque
    // affichage, c'est la page entière de sa communauté qui tombait.
    //
    // Trouvé en appliquant le schéma sur la vraie base avant de livrer, pas
    // en relisant le code.
    const src = require("fs").readFileSync(path.join(RACINE, "routes", "community.js"), "utf8");
    const schema = require("fs").readFileSync(path.join(RACINE, "services", "schema.js"), "utf8");
    for (const [fichier, contenu] of [["routes/community.js", src], ["services/schema.js", schema]]) {
        // « abonnements » suivi d'un espace, d'une parenthèse ou d'un point :
        // la table nue. « abonnements_membres » ne correspond pas.
        const nues = [...contenu.matchAll(/\b(?:FROM|INTO|JOIN|UPDATE|TABLE(?: IF NOT EXISTS)?)\s+abonnements(?![_a-z])/gi)];
        verifier(nues.length === 0,
            `${fichier} : ${nues.length} requête(s) visent la table « abonnements » — c'est celle de la FACTURATION. La table des abonnements entre membres s'appelle abonnements_membres.`);
    }

    // ── 7. UNE SÉLECTION VIDE N'EST PAS UNE COMMUNAUTÉ VIDE ─────────────
    //
    // « Quand je clique sur Mon espace, ça me renvoie dans le fil
    // d'actualité. » Le filtre marchait ; c'était la page vide. Sans
    // publication à afficher, on retombait sur l'accueil de la communauté —
    // « Bienvenue / Ce que tu trouveras ici / Ouvre le bal ». On demandait
    // ses publications, on obtenait la page d'accueil : vu de l'écran,
    // c'est le fil.
    //
    // On rend la page pour de vrai, sans aucune publication, et on lit ce
    // qui s'affiche. Une vue filtrée doit parler de ce qu'on cherchait.
    const ejs = require(path.join(RACINE, "node_modules", "ejs")); // eslint-disable-line
    const routeurPage = routeur.stack.find(
        (c) => c.route && Array.isArray(c.route.path) && c.route.path.includes("/c/:slug"));
    function ouvrirPage(f) {
        PUBLICATION = null;
        return new Promise((resolve) => {
            const req = { params: { slug: SLUG }, query: f ? { f } : {},
                session: { loggedIn: true, userId: MOI, email: "moi@example.cm" } };
            const res = { locals: { COM }, status() { return this; },
                send: resolve, json: resolve, redirect: () => resolve(""), render: () => resolve("") };
            let i = 0;
            const suite = () => { const h = routeurPage.route.stack[i++]?.handle; if (h) h(req, res, suite); else resolve(""); };
            suite();
        });
    }
    const ACCUEIL = /Ce que tu trouveras ici|Ouvre le bal/;
    for (const [f, attendu] of [
        ["mes-publications", /rien publié/i],
        ["abonnements", /ne suis encore personne/i],
        ["enregistres", /rien enregistré/i],
        ["produit", /Aucun produit/i],
    ]) {
        const html = String(await ouvrirPage(f) || "");
        verifier(attendu.test(html),
            `« ?f=${f} » sans résultat n'explique pas ce qui manque`);
        verifier(!ACCUEIL.test(html),
            `« ?f=${f} » sans résultat affiche l'accueil de la communauté — c'est ce qui donne l'impression d'être renvoyé dans le fil`);
        verifier(html.includes(`/c/${SLUG}`),
            `« ?f=${f} » sans résultat n'offre aucun chemin de retour vers le fil`);
    }
    // Le fil complet, lui, garde son accueil : c'est là qu'il a un sens.
    verifier(ACCUEIL.test(String(await ouvrirPage("") || "")),
        "le fil complet vide n'accueille plus personne");

    if (echecs.length) {
        console.error(`❌ publications : ${echecs.length} problème(s) sur ${verifs} vérifications\n`);
        for (const e of echecs) console.error("   • " + e);
        process.exit(1);
    }
    console.log(`✅ publications : ${verifs} vérifications passées`);
})().catch((err) => {
    console.error("❌ publications : la suite n'a pas pu s'exécuter —", err.message);
    process.exit(1);
});
