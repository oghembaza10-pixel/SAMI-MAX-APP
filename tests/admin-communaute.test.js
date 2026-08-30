// ==========================================================================
// SAMII OS — L'espace d'administration d'une partenaire
//
// POURQUOI CE TEST EXISTE. « Audrey n'a pas pu se connecter à son admin. »
// Elle est tombée sur une page blanche portant une seule phrase : « Accès
// réservé aux administrateurs de communauté. »
//
// Cette phrase répondait à QUATRE situations différentes — pas connectée,
// compte introuvable, compte désactivé, mauvaise adresse — et n'offrait
// aucune issue. Impossible de savoir laquelle, ni pour elle, ni pour nous à
// distance. Le plus probable était aussi le plus bête : elle n'avait pas
// encore ouvert de session.
//
// CE QUI EST VÉRIFIÉ ICI.
//   1. Quelqu'un qui n'est pas connecté est ENVOYÉ SE CONNECTER, chez elle,
//      et jamais éconduit.
//   2. Chaque refus restant a une raison distincte et une sortie.
//   3. Un compte qui n'est pas le sien n'entre pas — et n'apprend pas au
//      passage l'adresse de celle qui peut entrer.
//   4. Le tableau de bord se rend vraiment, à SA marque, avec sa part à elle
//      en premier. Une page qui plante ne se voit qu'en production.
//
// Lancer :  npm test
// ==========================================================================
const path = require("path");
const RACINE = path.join(__dirname, "..");
const communautes = require(path.join(RACINE, "config", "communautes"));

let verifs = 0;
const echecs = [];
const verifier = (ok, message) => { verifs++; if (!ok) echecs.push(message); };

// ── Une base simulée, réglable par test ─────────────────────────────────
let COMPTE = null;
const Module = require("module");
const vraiRequire = Module.prototype.require;
Module.prototype.require = function (nom) {
    if (nom === "../services/db") return {
        query: async (q) => {
            if (/FROM utilisateurs\s+WHERE id/i.test(q)) return COMPTE ? [COMPTE] : [];
            if (/COUNT\(\*\)::int AS n FROM utilisateurs/i.test(q)) return [{ n: 128 }];
            if (/FROM publications WHERE communaute/i.test(q)) return [{ n: 34, likes: 210, comments: 47, shares: 0 }];
            if (/FROM paiements/i.test(q)) return [{ n: 6, total: "425000", du_partenaire: "17000", devise: "XAF" }];
            if (/FROM publications p/i.test(q)) return [
                { id: 1, contenu: "Trois outils IA gratuits pour tes visuels", created_at: new Date(), like_count: 42, commentaire_count: 8 }];
            if (/SELECT prenom, nom, email, created_at/i.test(q)) return [
                { prenom: "Aïcha", nom: "M.", email: "aicha@example.cm", created_at: new Date() }];
            return [];
        },
    };
    return vraiRequire.apply(this, arguments);
};
const routeur = require(path.join(RACINE, "routes", "community-admin.js"));
Module.prototype.require = vraiRequire;

const SLUG = "coindudigital";
const COM = communautes.get(SLUG);

function ouvrir(session, slugService = SLUG) {
    const couche = routeur.stack.find((c) => c.route && c.route.path === "/admin/communaute");
    return new Promise((resolve) => {
        const req = { session, params: {}, query: {}, body: {} };
        const res = {
            locals: { COM: communautes.get(slugService) },
            statusCode: 200,
            status(c) { this.statusCode = c; return this; },
            type() { return this; },
            send: (html) => resolve({ statusCode: res.statusCode, html }),
            json: (o) => resolve({ statusCode: res.statusCode, json: o }),
            redirect: (url) => resolve({ statusCode: 302, redirection: url }),
        };
        couche.route.stack[0].handle(req, res, () => resolve({ statusCode: 0 }));
    });
}

(async () => {
    // ── 1. PAS CONNECTÉE : on l'envoie se connecter ─────────────────────
    // C'est très probablement ce qui lui est arrivé. Un refus ici n'a aucun
    // sens : il n'y a rien à refuser, il n'y a qu'une session qui manque.
    COMPTE = null;
    const anonyme = await ouvrir({});
    verifier(anonyme.redirection === `/c/${SLUG}/connexion`,
        `déconnectée, elle est ${anonyme.statusCode === 403 ? "éconduite au lieu d'être envoyée se connecter" : `envoyée sur « ${anonyme.redirection} »`}`);

    // Chez nous, la même situation mène à notre page de connexion.
    const anonymeMaison = await ouvrir({}, communautes.DEFAUT);
    verifier(anonymeMaison.redirection === "/login",
        `chez nous, une personne déconnectée est envoyée sur « ${anonymeMaison.redirection} »`);

    // ── 2. CONNECTÉE, MAIS PAS AVEC LA BONNE ADRESSE ────────────────────
    COMPTE = { id: "u9", prenom: "Yao", email: "quelquun@example.cm", role: "membre", communaute: SLUG, actif: true };
    const autre = await ouvrir({ loggedIn: true, userId: "u9" });
    verifier(autre.statusCode === 403, "un compte quelconque entre dans son espace d'administration");
    verifier(/quelquun@example\.cm/.test(autre.html || ""),
        "la page de refus ne dit pas avec quelle adresse la personne est connectée — c'est la seule ligne qui permet de trancher à distance");
    verifier(!(autre.html || "").includes(COM.admin),
        "la page de refus affiche l'adresse de l'administratrice à n'importe quel compte connecté");
    verifier(/\/logout/.test(autre.html || ""),
        "la page de refus n'offre aucune sortie — c'est une impasse, exactement ce qu'elle a vu");

    // ── 3. COMPTE DÉSACTIVÉ : une panne distincte ───────────────────────
    // Elle sortait du WHERE de la requête : un compte désactivé était donc
    // indiscernable d'un compte inexistant.
    COMPTE = { id: "u1", prenom: "Ines", email: COM.admin, role: "membre", communaute: SLUG, actif: false };
    const eteint = await ouvrir({ loggedIn: true, userId: "u1" });
    verifier(eteint.statusCode === 403 && /désactivé/i.test(eteint.html || ""),
        "un compte désactivé reçoit le même message qu'une personne qui n'a rien à faire ici");

    // ── 4. ELLE ENTRE, ET LA PAGE SE REND ───────────────────────────────
    COMPTE = { id: "u1", prenom: "Ines", nom: "Audrey", email: COM.admin, role: "membre", communaute: SLUG, actif: true };
    const chezElle = await ouvrir({ loggedIn: true, userId: "u1", email: COM.admin });
    verifier(chezElle.statusCode === 200 && typeof chezElle.html === "string",
        `l'administratrice déclarée n'entre pas dans son propre espace (statut ${chezElle.statusCode})`);
    const html = chezElle.html || "";

    // Une adresse écrite avec une majuscule au début — ce que fait tout
    // clavier de téléphone — ne doit pas fermer la porte.
    COMPTE = { ...COMPTE, email: String(COM.admin).toUpperCase() };
    const majuscules = await ouvrir({ loggedIn: true, userId: "u1" });
    verifier(majuscules.statusCode === 200,
        "une adresse tapée avec des majuscules est refusée — c'est ce que fait un clavier de téléphone par défaut");

    // ── 5. C'EST SA PAGE, PAS LA NÔTRE ──────────────────────────────────
    verifier(html.includes(COM.nom), `son nom « ${COM.nom} » n'apparaît pas sur son tableau de bord`);
    verifier(!/OG · TECHNOLOGY|SAMII/.test(html),
        "notre marque est écrite sur son espace d'administration");
    for (const [jeton, valeur] of Object.entries(COM.couleurs)) {
        if (["--bg", "--panel", "--text", "--gold"].includes(jeton)) {
            verifier(html.includes(valeur),
                `sa couleur ${jeton} (${valeur}) n'est pas appliquée — la page reste dans notre palette sombre`);
        }
    }

    // ── 6. SA PART D'ABORD ──────────────────────────────────────────────
    // L'argent arrive sur notre compte et lui est reversé. Tant qu'elle ne
    // voit que le volume brut, soit elle croit que tout est à elle, soit
    // elle doit nous croire sur parole.
    verifier(/Ce qui te revient/.test(html),
        "« Ce qui te revient » n'est plus le premier chiffre de son tableau de bord");
    verifier(html.indexOf("Ce qui te revient") < html.indexOf("Volume encaissé"),
        "le volume encaissé est présenté avant sa part — elle lit d'abord un chiffre qui n'est pas le sien");
    verifier(/17\s?000/.test(html), "sa part n'est pas affichée avec le séparateur de milliers");
    verifier(/425\s?000/.test(html), "le volume encaissé n'est pas affiché");
    verifier(/XAF/.test(html), "la devise n'apparaît pas à côté des montants");

    // ── 7. LES CHEMINS DE SORTIE ────────────────────────────────────────
    verifier(html.includes(`/c/${SLUG}`), "aucun lien ne ramène à sa communauté depuis son espace d'administration");
    verifier(!/href="\/community"|href="\/hub"|href="\/marketplace"/.test(html),
        "son espace d'administration renvoie vers des pages qui sont à nous");

    if (echecs.length) {
        console.error(`❌ admin communauté : ${echecs.length} problème(s) sur ${verifs} vérifications\n`);
        for (const e of echecs) console.error("   • " + e);
        process.exit(1);
    }
    console.log(`✅ admin communauté : ${verifs} vérifications passées`);
})().catch((err) => {
    console.error("❌ admin communauté : la page n'a pas pu être rendue —", err.message);
    process.exit(1);
});
