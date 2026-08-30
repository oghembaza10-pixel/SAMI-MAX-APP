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
const Module = require("module");
const vraiRequire = Module.prototype.require;
Module.prototype.require = function (nom) {
    if (nom === "../services/db") return {
        query: async (q, p) => {
            REQUETES.push({ sql: q, params: p || [] });
            if (/INSERT INTO discussions/.test(q)) return [{ id: 1 }];
            return [];
        },
    };
    if (nom === "../services/socketService") return { emitToUser: () => {}, emitToShop: () => {} };
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

    if (echecs.length) {
        console.error(`❌ discussions : ${echecs.length} problème(s) sur ${verifs} vérifications\n`);
        for (const e of echecs) console.error("   • " + e);
        process.exit(1);
    }
    console.log(`✅ discussions : ${verifs} vérifications passées`);
})();
