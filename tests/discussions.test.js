// ==========================================================================
// SAMII OS — Les conversations d'une communauté sont-elles closes ?
//
// POURQUOI CE TEST EXISTE. Rien ne cloisonnait les discussions. « Les
// groupes à rejoindre » listait TOUS les groupes de la base, sans aucun
// filtre : les membres d'une partenaire voyaient les nôtres, pouvaient les
// rejoindre d'un clic, et lire ce qui s'y disait.
//
// CE N'EST PAS UNE FUITE COMME LES AUTRES. Le fil, le classement, le
// compteur de membres : on montrait le mauvais contenu, c'était gênant. Ici,
// ce sont des conversations privées entre deux entreprises qui n'ont rien à
// partager — et qui ne sauraient même pas qu'elles ont été lues.
//
// LA RÈGLE VÉRIFIÉE. Toute requête qui liste, cherche ou ouvre une
// discussion filtre par communauté. Y compris « rejoindre » : sans ce
// filtre, un identifiant de groupe partagé par accident suffit à entrer.
//
// COMMENT. On appelle les vraies routes avec une base simulée qui enregistre
// ce qui lui est demandé, et on inspecte les requêtes.
//
// Lancer :  npm test
// ==========================================================================
const path = require("path");
const RACINE = path.join(__dirname, "..");
const communautes = require(path.join(RACINE, "config", "communautes"));

let verifs = 0;
const echecs = [];
const verifier = (ok, message) => { verifs++; if (!ok) echecs.push(message); };

// ── Une base simulée qui note tout ──────────────────────────────────────
const REQUETES = [];
// Ce que la base répond, réglable par test : certains ont besoin qu'une
// discussion EXISTE pour que la route aille jusqu'au bout.
let REPONSES = {};
const PLANNER_APPELS = [];
const Module = require("module");
const vraiRequire = Module.prototype.require;
Module.prototype.require = function (nom) {
    if (nom === "../services/db") return {
        query: async (q, p) => {
            REQUETES.push({ sql: q, params: p || [] });
            for (const [motif, lignes] of Object.entries(REPONSES)) {
                if (new RegExp(motif, "i").test(q)) return lignes;
            }
            if (/INSERT INTO discussions/.test(q)) return [{ id: 1 }];
            return [];
        },
    };
    if (nom === "../services/socketService") return { emitToUser: () => {}, emitToShop: () => {} };
    // Le cerveau ne part pas appeler un vrai modèle pendant les tests.
    if (nom === "../brain/planner") return {
        ask: async (...args) => { PLANNER_APPELS.push(args); return "Réponse simulée."; },
    };
    return vraiRequire.apply(this, arguments);
};
const routeur = require(path.join(RACINE, "routes", "discussions.js"));
Module.prototype.require = vraiRequire;

const SLUG = "coindudigital";

function appeler(chemin, methode, corps = {}, params = {}) {
    const couche = routeur.stack.find(
        (c) => c.route && c.route.path === chemin && c.route.methods[methode]);
    if (!couche) return Promise.resolve(null);
    return new Promise((resolve) => {
        const req = {
            params, body: corps, query: {},
            session: { loggedIn: true, userId: "u1", nom: "Test", email: "t@x.z" },
        };
        // res.locals.COM est posé par index.js : c'est le service qui dit
        // quelle communauté il sert.
        const res = {
            locals: { COM: communautes.get(SLUG) },
            json: resolve, send: resolve, redirect: () => resolve(null),
            status() { return this; },
            render: () => resolve(null),
        };
        let i = 0;
        const suivant = () => { const h = couche.route.stack[i++]?.handle; if (h) h(req, res, suivant); };
        suivant();
    });
}

(async () => {
    // ── 1. Lister : mes groupes, et ceux à rejoindre ─────────────────────
    REQUETES.length = 0;
    await appeler("/", "get");
    const surDiscussions = REQUETES.filter((r) => /FROM discussions/i.test(r.sql));
    verifier(surDiscussions.length > 0, "la page des discussions ne lit plus aucune discussion");
    for (const r of surDiscussions) {
        verifier(/communaute/.test(r.sql),
            `une requête liste des discussions sans filtrer par communauté — ses membres voient NOS groupes : ${r.sql.replace(/\s+/g, " ").trim().slice(0, 110)}`);
        verifier(r.params.includes(SLUG),
            `une requête sur les discussions est filtrée, mais pas sur SA communauté (${JSON.stringify(r.params)})`);
    }

    // ── 2. Créer : le groupe naît dans SA communauté ─────────────────────
    REQUETES.length = 0;
    await appeler("/groupe", "post", { nom: "Les vendeuses de Douala" });
    const creation = REQUETES.find((r) => /INSERT INTO discussions/i.test(r.sql));
    verifier(!!creation, "créer un groupe n'écrit plus rien");
    if (creation) {
        verifier(/communaute/.test(creation.sql),
            "un groupe est créé sans communauté — il apparaîtrait partout, chez nous comme chez elle");
        verifier(creation.params.includes(SLUG),
            `le groupe est créé dans la mauvaise communauté (${JSON.stringify(creation.params)})`);
    }

    // ── 3. Rejoindre : LA porte dérobée ──────────────────────────────────
    // Sans filtre ici, il suffit d'un identifiant de groupe — partagé par
    // accident, deviné, ou trouvé dans un lien — pour entrer dans une
    // conversation d'une autre communauté. La liste peut être filtrée et
    // cette porte rester grande ouverte.
    REQUETES.length = 0;
    await appeler("/:id/rejoindre", "post", {}, { id: "42" });
    const verif = REQUETES.find((r) => /FROM discussions/i.test(r.sql));
    verifier(!!verif, "rejoindre un groupe ne vérifie plus son existence");
    if (verif) {
        verifier(/communaute/.test(verif.sql),
            "on peut rejoindre un groupe d'une AUTRE communauté avec son seul identifiant — le filtre de la liste ne protège rien");
        verifier(verif.params.includes(SLUG),
            `la vérification à l'entrée d'un groupe ne porte pas sur sa communauté (${JSON.stringify(verif.params)})`);
    }

    // ── 4. Le chemin du retour ───────────────────────────────────────────
    // « J'étais dans la discussion générale et au moment de revenir en
    // arrière, je suis retombé dans la communauté de SAMII. »
    //
    // Le lien portait `/community` en dur. On ne vérifie donc pas un lien,
    // mais TOUS : n'importe quelle ancre interne qui sort de son monde
    // fait échouer ce test, y compris celles qui n'existent pas encore.
    REQUETES.length = 0;
    REPONSES = {};
    const page = await appeler("/", "get");
    verifier(typeof page === "string" && page.length > 0, "la page des discussions ne rend plus rien");
    const AUTORISES = [`/c/${SLUG}`, "/discussions", "/logout", "/login"];
    const liens = [...String(page || "").matchAll(/href="(\/[^"#]*)"/g)].map((m) => m[1]);
    verifier(liens.length > 0, "la page des discussions n'a plus aucun lien interne — le bouton retour a disparu");
    for (const l of liens) {
        verifier(AUTORISES.some((a) => l === a || l.startsWith(a + "/")),
            `un lien de sa page de discussions renvoie hors de chez elle : ${l} — ses membres atterrissent sur notre marque`);
    }
    verifier(liens.includes(`/c/${SLUG}`),
        "plus aucun lien ne ramène à SA communauté depuis les discussions — on entre, on ne sort plus");

    // La décision elle-même, testée à part : c'est elle qui a été fausse.
    verifier(communautes.accueil(communautes.get(SLUG)) === `/c/${SLUG}`,
        "accueil() renvoie une partenaire ailleurs que sur sa propre communauté");
    verifier(communautes.accueil(communautes.get(communautes.DEFAUT)) === "/community",
        "accueil() ne ramène plus la maison sur /community");
    verifier(communautes.accueil(SLUG) === `/c/${SLUG}`,
        "accueil() n'accepte pas un slug — la moitié des appels planteront");

    // ── 5. Entrer par le numéro : la fenêtre laissée ouverte ─────────────
    // Les groupes étaient protégés par l'appartenance. Les salles GÉNÉRALES
    // n'ont pas de membres — n'importe qui y entre par définition. Ouvrir
    // /discussions/1 depuis son service donnait donc NOTRE salle générale,
    // en lecture comme en écriture. Les identifiants sont des entiers qui
    // se suivent : il n'y avait rien à deviner.
    for (const [chemin, methode, corps] of [["/:id", "get", {}], ["/:id/message", "post", { contenu: "salut" }]]) {
        REQUETES.length = 0;
        REPONSES = {};
        await appeler(chemin, methode, corps, { id: "1" });
        const lecture = REQUETES.find((r) => /FROM discussions\b/i.test(r.sql));
        verifier(!!lecture, `${methode.toUpperCase()} ${chemin} ne lit plus la discussion demandée`);
        if (lecture) {
            verifier(/communaute/.test(lecture.sql),
                `${methode.toUpperCase()} ${chemin} ouvre une discussion sur son seul numéro — ses membres lisent et écrivent dans NOTRE salle générale en tapant /discussions/1`);
            verifier(lecture.params.includes(SLUG),
                `${methode.toUpperCase()} ${chemin} filtre, mais pas sur SA communauté (${JSON.stringify(lecture.params)})`);
        }
    }

    // ── 6. L'assistant répond vraiment ───────────────────────────────────
    // Le handler passait `COM` à repondreCommeSamii() sans l'avoir jamais
    // déclaré. La réponse HTTP étant déjà partie, le ReferenceError tombait
    // dans le catch : l'assistant ne répondait jamais, et aucune erreur
    // métier ne le disait. C'est précisément ce qu'on lui vend.
    REQUETES.length = 0;
    PLANNER_APPELS.length = 0;
    REPONSES = {
        "SELECT \\* FROM discussions": [{ id: 1, type: "general", nom: "Chat général", communaute: SLUG }],
        "INSERT INTO discussion_messages": [{ id: 9, expediteur_id: "u1", contenu: "salut", created_at: new Date() }],
    };
    await appeler("/:id/message", "post", { contenu: "combien coûte la formation ?" }, { id: "1" });
    await new Promise((r) => setImmediate(r));
    verifier(PLANNER_APPELS.length === 1,
        "l'assistant ne répond pas dans le salon alors qu'on lui pose une vraie question — c'est l'automatisation qu'on lui a vendue");
    const consignes = PLANNER_APPELS[0]?.[1]?.instructions || "";
    verifier(consignes.includes(communautes.get(SLUG).assistant),
        "l'assistant se présente sous un autre nom que le sien dans son salon");
    verifier(!/SAMII/i.test(consignes) || communautes.get(SLUG).assistant.toUpperCase().includes("SAMII"),
        "notre marque apparaît dans les consignes de SON assistant");

    if (echecs.length) {
        console.error(`❌ discussions : ${echecs.length} problème(s) sur ${verifs} vérifications\n`);
        for (const e of echecs) console.error("   • " + e);
        process.exit(1);
    }
    console.log(`✅ discussions : ${verifs} vérifications passées`);
})();
