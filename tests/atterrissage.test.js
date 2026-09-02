// ==========================================================================
// SAMII OS — « JE ME CONNECTE, ET JE TOMBE SUR UNE 404 »
//
// POURQUOI CE TEST EXISTE. Sur le domaine du Coin Du Digital, la connexion
// marchait — bon email, bon mot de passe, session créée — et on atterrissait
// sur une page introuvable.
//
// La destination par défaut était écrite en dur : « /hub » pour un marchand
// sans boutique, « /client-qg » pour un acheteur, « /agence » pour une
// agence. Ce sont NOS pages ; la porte (`index.js`) les ferme chez une
// partenaire. Connexion réussie, arrivée dans le vide — et la personne
// conclut que son mot de passe ne marche pas.
//
// CE QUI EST VÉRIFIÉ ICI, ET COMMENT.
//
// On ne compare pas la destination à une chaîne attendue : ça ne prouverait
// que l'accord du test avec lui-même. On la fait passer par LA PORTE, la
// vraie, celle de `config/modules-qg.js` — la même fonction qu'`index.js`
// interroge à chaque requête. Une destination qui ne passe pas la porte est
// une 404 pour la personne qui vient de se connecter.
//
// Les quatre formes de compte sont éprouvées (acheteur, marchand sans
// boutique, marchand avec boutique, agence), sur les DEUX services, et pour
// les deux entrées possibles : la connexion et l'inscription.
//
// Et on vérifie que rien n'a bougé chez nous : mêmes destinations qu'avant.
//
// Lancer :  npm test
// ==========================================================================
const path = require("path");
const RACINE = path.join(__dirname, "..");
const communautes = require(path.join(RACINE, "config", "communautes"));
const modulesQg   = require(path.join(RACINE, "config", "modules-qg"));
const bcrypt      = require(path.join(RACINE, "node_modules", "bcrypt"));

let verifs = 0;
const echecs = [];
const verifier = (ok, message) => { verifs++; if (!ok) echecs.push(message); };

const MAISON    = communautes.get(communautes.DEFAUT);
const PARTENAIRE = communautes.get("coindudigital");

// ── LA PORTE, telle qu'index.js l'interroge ─────────────────────────────
// Une destination doit être ouverte sur le service qui vient de la donner.
function porteOuverte(chemin, COM) {
    const permis = modulesQg.cheminsAutorises(COM);
    // Une destination peut porter une requête (`/login?verified=1`) : la
    // porte ne lit que le chemin.
    return modulesQg.chemineAutorise(String(chemin || "").split("?")[0], permis);
}

// ── UNE BASE SIMULÉE, RÉGLABLE PAR TEST ─────────────────────────────────
let COMPTE = null;          // la ligne `utilisateurs` renvoyée
let BOUTIQUES = [];         // ce que `workspaces` contient pour cet email

const faussebase = {
    query: async (q) => {
        if (/^\s*SELECT \* FROM utilisateurs WHERE email/i.test(q)) return COMPTE ? [COMPTE] : [];
        if (/^\s*UPDATE utilisateurs/i.test(q)) return [];
        if (/FROM workspaces WHERE owner_email/i.test(q)) return BOUTIQUES;
        if (/INSERT INTO utilisateurs/i.test(q)) return [{ id: "u-neuf" }];
        return [];
    },
};

const Module = require("module");
const vraiRequire = Module.prototype.require;
Module.prototype.require = function (nom) {
    if (nom === "../services/db") return faussebase;
    // L'inscription envoie un courriel et enregistre un parrainage : hors
    // sujet ici, et on ne veut ni réseau ni écriture.
    if (nom === "../services/gmail") return { send: async () => ({}) };
    if (nom === "../services/referralService") return { enregistrerParrainage: async () => ({}) };
    if (nom === "../services/workspaceService") return {
        getByOwner: async () => BOUTIQUES.map((b) => ({ workspaceId: b.id, metier: b.metier })),
        // Le choix du QG est écrit UNE fois dans le service — la connexion
        // et l'inscription l'appellent au lieu de refaire chacune sa
        // requête. Le tri lui-même est en SQL : une doublure ne peut pas le
        // prouver, c'est le contrôle sur base réelle qui s'en charge.
        qgPrincipal: async () => BOUTIQUES[0] || null,
    };
    return vraiRequire.apply(this, arguments);
};
delete require.cache[require.resolve(path.join(RACINE, "routes", "login.js"))];
delete require.cache[require.resolve(path.join(RACINE, "routes", "register.js"))];
delete require.cache[require.resolve(path.join(RACINE, "routes", "workspace.js"))];
const login    = require(path.join(RACINE, "routes", "login.js"));
const register = require(path.join(RACINE, "routes", "register.js"));
const creation = require(path.join(RACINE, "routes", "workspace.js"));
Module.prototype.require = vraiRequire;

const posteur = (routeur) => {
    const couche = routeur.stack.find((c) => c.route && c.route.path === "/" && c.route.methods.post);
    return couche.route.stack[0].handle;
};
const POST_LOGIN    = posteur(login);
const POST_REGISTER = posteur(register);

// Appelle la vraie route, avec le service qu'on veut jouer : `res.locals.COM`
// est posé par `index.js` à partir de COMMUNAUTE_PAR_DEFAUT — c'est tout ce
// qui distingue notre domaine du sien.
function appeler(handler, { COM, corps, communauteTraversee }) {
    return new Promise((resolve, rejeter) => {
        const req = {
            body: corps, query: {},
            session: {
                communaute: communauteTraversee || undefined,
                regenerate: (cb) => cb(null),
                save: (cb) => cb && cb(null),
            },
        };
        const res = {
            locals: { COM },
            json: resolve,
            status() { return this; },
            redirect: (u) => resolve({ redirect: u }),
        };
        Promise.resolve(handler(req, res, () => resolve(null))).catch(rejeter);
    });
}

// ── LES QUATRE FORMES DE COMPTE ─────────────────────────────────────────
const FORMES = [
    { nom: "un acheteur",                 type: "client",   boutique: false },
    { nom: "un marchand sans boutique",   type: "marchand", boutique: false },
    { nom: "un marchand avec sa boutique", type: "marchand", boutique: true  },
    { nom: "une agence",                  type: "agence",   boutique: false },
    // Le cas qui manquait, et c'est celui qui était cassé : une agence QUI
    // TIENT AUSSI SA BOUTIQUE. Elle était envoyée sur /agence quoi qu'il
    // arrive — « je me connecte et je tombe sur agence au lieu de mon
    // propre poste de commandement ».
    { nom: "une agence avec sa boutique", type: "agence",   boutique: true  },
];

(async () => {
    const HASH = await bcrypt.hash("motdepasse", 4);
    const poser = (forme) => {
        COMPTE = {
            id: "u-1", email: "essai@exemple.com", prenom: "Inès", nom: "A.",
            password_hash: HASH, type_compte: forme.type,
            statut_acces: "actif", email_verifie: true,
        };
        BOUTIQUES = forme.boutique ? [{ id: "ws-1", metier: "ecommerce" }] : [];
    };
    const IDENTIFIANTS = { email: "essai@exemple.com", password: "motdepasse" };
    const INSCRIPTION  = {
        nom: "A.", prenom: "Inès", email: "neuf@exemple.com",
        telephone: "690000000", password: "motdepasse",
    };

    // ── 1. CHEZ ELLE : AUCUNE DESTINATION NE DOIT ÊTRE UNE PORTE FERMÉE ──
    for (const forme of FORMES) {
        poser(forme);

        const co = await appeler(POST_LOGIN, { COM: PARTENAIRE, corps: IDENTIFIANTS });
        verifier(co && co.success === true,
            `${forme.nom} n'arrive pas à se connecter chez elle (${JSON.stringify(co)})`);
        verifier(co && porteOuverte(co.redirect, PARTENAIRE),
            `chez elle, ${forme.nom} est envoyé sur « ${co && co.redirect} » — la porte ferme cette page : 404 juste après une connexion réussie`);

        // Même chose par l'inscription : un compte déjà existant qui repasse
        // par le formulaire d'inscription est connecté au passage.
        const re = await appeler(POST_REGISTER, {
            COM: PARTENAIRE,
            corps: { ...INSCRIPTION, email: "essai@exemple.com", type_compte: forme.type },
        });
        verifier(re && re.success === true,
            `${forme.nom} n'arrive pas à passer par l'inscription chez elle (${JSON.stringify(re)})`);
        verifier(re && porteOuverte(re.redirect, PARTENAIRE),
            `chez elle, après inscription, ${forme.nom} est envoyé sur « ${re && re.redirect} » — page fermée par la porte`);
    }

    // Une inscription NEUVE, celle du premier jour : le compte n'existe pas
    // encore. C'est le chemin qu'emprunte chaque nouveau membre chez elle.
    for (const forme of FORMES) {
        COMPTE = null;
        BOUTIQUES = forme.boutique ? [{ id: "ws-1", metier: "ecommerce" }] : [];
        const neuf = await appeler(POST_REGISTER, {
            COM: PARTENAIRE, corps: { ...INSCRIPTION, type_compte: forme.type },
        });
        verifier(neuf && neuf.success === true,
            `${forme.nom} n'arrive pas à créer son compte chez elle (${JSON.stringify(neuf)})`);
        verifier(neuf && porteOuverte(neuf.redirect, PARTENAIRE),
            `chez elle, ${forme.nom} qui vient de créer son compte atterrit sur « ${neuf && neuf.redirect} » — page fermée : son tout premier écran est une erreur`);
    }

    // ── 2. CHEZ NOUS : RIEN NE DOIT AVOIR BOUGÉ ─────────────────────────
    // Les destinations historiques, une par une. Ce bloc est là pour crier
    // si la correction ci-dessus a déplacé quelqu'un chez nous.
    const ATTENDU_MAISON = {
        "client|false"  : "/client-qg",
        "marchand|false": "/hub",
        "marchand|true" : "/qg",
        "agence|false"  : "/agence",
        // Le QG Agence est une vue sur les clients des AUTRES. Quand on a sa
        // propre boutique, sa maison c'est son QG à soi — /agence reste à un
        // clic dans le menu, l'inverse n'était pas vrai.
        "agence|true"   : "/qg",
    };
    for (const forme of FORMES) {
        poser(forme);
        const co = await appeler(POST_LOGIN, { COM: MAISON, corps: IDENTIFIANTS });
        const attendu = ATTENDU_MAISON[`${forme.type}|${forme.boutique}`];
        verifier(co && co.redirect === attendu,
            `chez nous, ${forme.nom} allait sur « ${attendu} » et va maintenant sur « ${co && co.redirect} »`);
    }

    // ── 3. LA DESTINATION DEMANDÉE PASSE AVANT TOUT ─────────────────────
    poser(FORMES[1]);
    const avecSuite = await appeler(POST_LOGIN, {
        COM: PARTENAIRE, corps: { ...IDENTIFIANTS, suite: "/admin/communaute" },
    });
    verifier(avecSuite && avecSuite.redirect === "/admin/communaute",
        `la page qu'on voulait vraiment ouvrir est perdue : on atterrit sur « ${avecSuite && avecSuite.redirect} »`);

    // Et une adresse extérieure glissée dans le formulaire reste refusée.
    const piege = await appeler(POST_LOGIN, {
        COM: PARTENAIRE, corps: { ...IDENTIFIANTS, suite: "https://faux-site.example/vol" },
    });
    verifier(piege && piege.redirect !== "https://faux-site.example/vol",
        "la connexion suit une adresse extérieure fournie dans le formulaire — c'est une redirection ouverte");
    verifier(piege && porteOuverte(piege.redirect, PARTENAIRE),
        `après avoir refusé l'adresse piégée, on atterrit sur « ${piege && piege.redirect} », que la porte ferme`);

    // ── 4. LA COMMUNAUTÉ TRAVERSÉE, SUR NOTRE DOMAINE ───────────────────
    // Quelqu'un qui arrive chez nous par un lien `?c=coindudigital` doit
    // repartir chez elle, pas dans notre Hub. C'est ce que faisait déjà
    // l'ancien code : cette partie ne doit pas disparaître avec la correction.
    poser(FORMES[1]);
    const traversee = await appeler(POST_LOGIN, {
        COM: MAISON, corps: IDENTIFIANTS, communauteTraversee: "coindudigital",
    });
    verifier(traversee && traversee.redirect === "/c/coindudigital",
        `venu par un lien de sa communauté, on est renvoyé sur « ${traversee && traversee.redirect} » au lieu de chez elle`);

    // Mais SUR SON PROPRE SERVICE, ce marqueur ne doit pas court-circuiter
    // le reste : un marchand de chez elle qui a une boutique va dans son QG,
    // pas sur le fil. Sinon on répare la 404 en créant une impasse.
    poser(FORMES[2]);
    const chezElleAvecBoutique = await appeler(POST_LOGIN, {
        COM: PARTENAIRE, corps: IDENTIFIANTS, communauteTraversee: "coindudigital",
    });
    verifier(chezElleAvecBoutique && chezElleAvecBoutique.redirect === "/qg",
        `un marchand de chez elle qui a déjà sa boutique est déposé sur « ${chezElleAvecBoutique && chezElleAvecBoutique.redirect} » au lieu de son QG`);

    // ── 5. LA PAGE D'ARRIVÉE PORTE-T-ELLE LA BONNE MARQUE ? ─────────────
    //
    // Réparer la destination ne suffit pas si la page qu'on ouvre annonce
    // « Bonjour Général ! Je suis SAMII ». C'est le PREMIER écran d'un
    // nouveau marchand chez elle : notre nom et notre vocabulaire militaire
    // y étaient écrits en dur, sur son domaine à elle.
    const rendre = (COM) => new Promise((resolve, rejeter) => {
        const couche = creation.stack.find((c) => c.route && c.route.path === "/create");
        const handlers = couche.route.stack.map((s) => s.handle);
        const req = { query: {}, session: { loggedIn: true, email: "essai@exemple.com" } };
        const res = {
            locals: { COM },
            send: resolve,
            redirect: (u) => resolve(`__REDIRECTION__${u}`),
            status() { return this; },
        };
        // requireAuth puis la page.
        Promise.resolve(handlers[0](req, res, () =>
            Promise.resolve(handlers[1](req, res, () => resolve("")))
                .catch(rejeter))).catch(rejeter);
    });

    BOUTIQUES = [];
    const sienne = await rendre(PARTENAIRE);
    const notre  = await rendre(MAISON);

    verifier(!/\bSAMII\b/.test(sienne),
        "la page « créer ma boutique » annonce encore SAMII sur le domaine du Coin Du Digital");
    verifier(!/Général|General!|الجنرال|将军/.test(sienne),
        "les grades militaires (« Bonjour Général ») reviennent sur une communauté qui les a retirés");
    verifier(sienne.includes(PARTENAIRE.nom),
        `la page « créer ma boutique » ne porte pas le nom « ${PARTENAIRE.nom} »`);
    // Et chez nous, rien ne bouge : c'est notre page, notre ton.
    verifier(/Je suis <b>SAMII<\/b>/.test(notre),
        "chez nous, la page « créer ma boutique » ne dit plus « Je suis SAMII »");
    verifier(/Bonjour Général/.test(notre),
        "chez nous, la page « créer ma boutique » a perdu son ton militaire");

    // Un marchand de Douala doit pouvoir choisir son pays. La liste
    // s'arrêtait au Maghreb, à l'Europe et au Golfe : il ne restait
    // qu'« Autre », sans devise, dès la première question.
    verifier(/data-devise="XAF"[^>]*>Cameroun</.test(sienne),
        "le Cameroun n'est pas proposé à la création d'une boutique — ses marchands démarrent sans devise");

    if (echecs.length) {
        console.error(`❌ atterrissage : ${echecs.length} problème(s) sur ${verifs} vérifications\n`);
        for (const e of echecs) console.error("   • " + e);
        process.exit(1);
    }
    console.log(`✅ atterrissage : ${verifs} vérifications passées`);
})().catch((err) => {
    console.error("❌ atterrissage : la connexion n'a pas pu être jouée —", err.message);
    console.error(err.stack);
    process.exit(1);
});
